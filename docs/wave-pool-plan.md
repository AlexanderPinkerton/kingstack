# Shared Wave Pool — Implementation Plan

A tech demo: a 3D pool of water rendered in every connected client's browser,
simulated on the server, where moving your cursor through the surface creates
ripples that everyone sees.

The pitch is not the water. It is that `PresenceRoom<TState>` and the room
protocol landed in `aug-5-collab` carry a server-authoritative physics
simulation **without a single change to the presence layer**.

---

## 1. What already exists

Roughly 80% of the networking is done. Confirmed by reading the current tree:

| Piece | Where | Reused as-is? |
| --- | --- | --- |
| Generic room presence, ref-counted join/leave | `apps/next/src/lib/realtime/presence-room.ts` | Yes, unchanged |
| Per-namespace join policy + state validation | `apps/nest/src/realtime/presence/room-namespaces.ts:101` | One new table entry |
| In-memory membership & roster | `apps/nest/src/realtime/presence/room-registry.ts` | Yes, plus two lifecycle hooks |
| Rate limiting | `apps/nest/src/realtime/presence/rate-limiter.ts` | Yes, unchanged |
| Room fan-out helper | `apps/nest/src/realtime/realtime.gateway.ts:488` | Yes, accepts binary payloads |
| Cursor store, throttled publish, idle retirement | `apps/next/src/stores/userApp/sharedCursorStore.ts` | Yes, new projection only |
| Fixed shared world concept | `apps/next/src/lib/realtime/canvas-world.ts` | Pattern copied for 3D |

Two things do **not** exist and are the real work: **a server tick loop** (the
gateway is currently a stateless relay) and **a 3D renderer** (no `three` in
`apps/next/package.json`).

---

## 2. Design decisions

### 2.1 Height field, not volumetric liquid

The surface is a 2D grid of heights evolved by the discrete wave equation.
A true volumetric solver (FLIP/PIC, SPH) is an order of magnitude more work and
its state does not survive the network.

- **Pros:** ~40 lines of solver; ~0.5 ms/tick at 128×128; state is a flat array,
  trivially serialisable; looks exactly like a wave pool.
- **Cons:** no splashes, no breaking waves, no interaction with submerged
  geometry. Accepted — none of those are what the demo is showing.

### 2.2 Server-authoritative, streamed to clients

The server owns the field. Clients are dumb renderers that never run a solver.

- **Pros:** no drift, no cross-browser float-determinism assumptions, late
  joiners land in a live pool, one obvious source of truth.
- **Cons:** ~2–8 KB/s per client while active; ripples appear after RTT/2
  (~20–50 ms). Water is low-frequency and blobby, so that latency reads as
  fine — unlike a crosshair.

Rejected alternative — **deterministic lockstep** (broadcast impulses only,
every client solves locally) is ~50× cheaper on the wire (~100 B/s) but drifts
with any divergence, shows late joiners a flat pool, and relies on bit-identical
float behaviour across browsers. Authority is worth a few KB/s here.

### 2.3 Spatial sparsity, not temporal deltas

This is the correction to the original "send compressed deltas" framing.

Game netcode delta-compresses because state is sparse **in time** — most
entities do not change most ticks. A wave field is the opposite: every cell
changes every tick, because that is what a wave is.

The sparsity that actually pays here is **spatial**: a pool is flat almost
everywhere almost always, and ripples are localised and decay.

So: split the grid into tiles, and send only tiles that carry energy. Idle pool
costs **zero bytes**. One ripple costs a handful of tiles.

Within a dirty tile, send **absolute quantised values, not deltas**:

- **Pros:** no `Int8` delta-range clipping edge case; every frame is
  self-correcting for the tiles it contains; no error accumulation, therefore no
  drift by construction and no reconciliation path to build; markedly simpler.
- **Cons:** roughly 2× the bytes of a delta-within-tile scheme. At these volumes
  that is irrelevant, and `permessage-deflate` recovers much of it.

Temporal deltas stay documented as a later optimisation, to be added **only if
measurement demands it** (§7).

### 2.4 One shared broadcast, no per-client baselines

Quake-style delta compression needs per-client baselines and ack windows because
UDP clients lose different packets. This stack is socket.io over TCP — ordered
and reliable — so one encoded buffer goes to every client in the room with zero
per-client bookkeeping. Encoding is O(1) per room, not per client.

The cost TCP brings instead is head-of-line blocking: a stalled client backs up
its stream and socket.io buffers unboundedly. Handled in §5.4.

### 2.5 Cursors publish 2D, render 3D

The pointer raycasts onto the water plane, so its meaningful position is 2D. Its
rendered height is looked up from the field the client already has.

- Zero extra bytes on the wire.
- The presence payload is byte-identical to today's `canvas` namespace, so
  `PresenceRoom<CursorState>` and `SharedCursorStore` need no changes at all.
- Cursors visually bob on the waves for free.

Full 6DOF cursors are deliberately out of scope: a mouse has no depth axis, so
there is no honest mapping.

---

## 3. Coordinate system

New `apps/next/src/lib/realtime/pool-world.ts`, mirroring `canvas-world.ts`:

```ts
export const POOL_WORLD = { width: 1600, depth: 1000 } as const;
export const POOL_GRID = { cols: 64, rows: 40, tile: 8 } as const;
```

`64 × 40` cells over a `1600 × 1000` world is 25 world-units per cell, and
divides evenly into `8 × 5 = 40` tiles of `8 × 8`.

The pool surface is the XZ plane in three.js; Y is height. Presence state stays
`{ x, y }` where `y` means **depth along Z**, matching the existing
`validateCanvasState` shape exactly.

---

## 4. Wire format

Two frame types on the existing `emitToRoom` channel. Binary rides through
socket.io as an attachment, so `{ type, roomId, ... , data: ArrayBuffer }` works
with the current helper signature unchanged.

**Keyframe** — sent to one socket on join.

```ts
{ type: "pool", roomId, action: "keyframe", seq: number,
  grid: { cols: 64, rows: 40, tile: 8 },
  data: ArrayBuffer }   // Int8, cols*rows = 2560 bytes
```

**Tile frame** — broadcast at 10 Hz while any tile is live.

```ts
{ type: "pool", roomId, action: "tiles", seq: number,
  mask: number[],       // indices of included tiles, ascending
  data: ArrayBuffer }   // Int8, mask.length * 64 bytes, row-major per tile
```

Height quantisation: `int8 = clamp(round(h / H_MAX * 127), -127, 127)`, with
`H_MAX` a fixed constant so client and server never negotiate.

**Tile liveness rule.** A tile is included when `max|int8| > 0`, **plus one
final frame after it reaches all-zero**. Without that trailing frame a tile that
goes quiet leaves stale non-zero values on the client forever.

`seq` is monotonic per room, for logging and for detecting a client that has
fallen behind. It is not an ack — nothing is acked.

---

## 5. Server work (`apps/nest/src/realtime/pool/`)

### 5.1 `wave-field.ts` — the solver

Pure TypeScript, no socket.io, no Nest. Testable directly, matching the
precedent set by `room-registry.ts`.

```ts
export class WaveField {
  constructor(cols: number, rows: number, opts?: WaveFieldOptions);
  step(dt: number): void;              // discrete wave equation + damping
  impulse(x: number, z: number, strength: number, radius: number): void;
  quantise(out: Int8Array): void;      // world height -> Int8
}
```

Two `Float32Array` buffers (current, previous), standard second-order update
with a damping factor. Reflecting boundaries at the pool walls.

### 5.2 `pool-room.ts` — per-room simulation

Owns one `WaveField`, the previous quantised frame, per-participant last-known
cursor position, and the tick handle.

Force injection reads from presence, which the server **already receives**:
`handlePresenceSet` (`realtime.gateway.ts:227`) sees every cursor at ~30 Hz. The
sim derives an impulse from `(position - lastPosition) / dt` and injects
proportional to speed.

This means **no new client→server message exists at all** — and it sidesteps
`SIGNAL_RATE_PER_SECOND = 8`, which would otherwise strangle a drag.

Taps still work via the existing `room:signal` `ripple` kind as a fixed-strength
impulse.

### 5.3 `pool-registry.ts` — lifecycle

Start a room's tick on first join, stop on last leave. Hooks into the three
existing call sites: `handleRoomJoin`, `handleRoomLeave`, `handleDisconnect`.

Simulation runs at **60 Hz**; broadcast at **10 Hz** (every 6th tick). Decoupling
them keeps the solver stable without paying for 60 Hz of network.

### 5.4 Backpressure

Before broadcasting, check `socket.conn.writeBuffer.length` against a threshold.
A socket over it is skipped for that frame and flagged to receive a fresh
keyframe once it drains. Prevents one slow client from growing server memory
without bound.

### 5.5 Namespace registration

One entry in `room-namespaces.ts`:

```ts
pool: {
  requiresAuth: true,
  validateState: validateCanvasState,          // reused verbatim
  validateSignal: (kind, data) =>
    kind === "ripple" ? validateCanvasState(data) : null,
},
```

---

## 6. Client work

### 6.0 Hard constraint: React is not in the render hot path

**React renders this scene exactly once — a mount point — and never touches it
again.** Every per-frame update is a direct mutation of a three.js object from a
plain `requestAnimationFrame` loop written in TypeScript.

This is structural, not a matter of discipline. The rules below are what make it
impossible to reintroduce the problem by accident, rather than merely unlikely.

**No React Three Fiber.** R3F's `useFrame` callback does genuinely run outside
the reconciler, so the loop itself would be fine — but R3F puts a React
reconciler underneath the scene graph, so *any* JSX describing scene contents is
one careless `observer` or changed prop away from reconciling three.js objects at
pointer rate. Plain `three` removes that possibility entirely. It also drops a
dependency and shrinks the bundle. The cost is ~100 lines of renderer, resize,
and disposal boilerplate that we own and control.

**Pull, never push.** The render loop *polls* plain data each frame. Nothing
subscribes, nothing reacts, nothing calls `setState`. No MobX reaction is allowed
to reach a React component at frame rate.

**The five rules:**

1. No `observer()` component reads anything that changes at pointer or frame
   rate. Ever.
2. Per-frame data lives in plain typed arrays and plain number fields — **not**
   `observable`. Not even the `version` counter.
3. Scene objects are pre-allocated in a fixed pool at mount. Never created or
   destroyed per frame; visibility is toggled with `.visible`.
4. The renderer imports nothing from `react` or `mobx-react-lite`.
5. React-facing UI (facepile, counts) is driven by a separate **throttled**
   observable that only ticks when the roster actually changes — never at
   position rate. See §6.5.

A lint rule (`no-restricted-imports` for `react` inside `lib/pool/`) makes rule 4
mechanical.

### 6.1 `apps/next/src/lib/pool/pool-field.ts`

Pure TS. Holds one `Int8Array` of the field, applies keyframes and tile frames,
exposes:

```ts
readonly field: Int8Array;   // plain, mutated in place
version: number;             // plain number, bumped on apply
heightAt(x: number, z: number): number;   // bilinear sample, for cursor bobbing
```

**Nothing here is observable.** Making 2560 cells reactive — or even just
`version`, which ticks at 10 Hz — is the single worst thing we could do to this
scene. The renderer compares `version` against its own last-seen value each
frame and re-uploads the texture only on a change.

### 6.2 `apps/next/src/lib/pool/cursor-buffer.ts`

The renderer must not read `SharedCursorStore.cursors` in the loop. That is a
MobX `computed`, and **a computed read outside a reaction is recomputed on every
access** — so polling it at 60 fps re-runs the filter and allocates a fresh array
of objects every frame, for garbage the collector then has to chase.

Instead a small plain mirror, updated from the same presence subscription:

```ts
class CursorBuffer {
  readonly positions: Float32Array;   // [x, z] per slot, fixed capacity
  readonly tones: Uint8Array;
  count: number;
  version: number;
}
```

Written on presence events (≤30 Hz, one array write), read by the loop with zero
allocation. Fixed capacity — a room over capacity simply stops drawing the
overflow.

### 6.3 `apps/next/src/lib/pool/pool-renderer.ts`

Pure TypeScript class. **Imports `three` only.** Owns the renderer, scene,
camera, water mesh, cursor pool, and the rAF loop.

```ts
export class PoolRenderer {
  constructor(canvas: HTMLCanvasElement, field: PoolField, cursors: CursorBuffer);
  start(): void;
  stop(): void;
  dispose(): void;
}
```

Per frame, in plain TS:

- If `field.version` changed, copy the `Int8Array` into the `DataTexture` and
  flag `needsUpdate`. Otherwise touch nothing.
- Advance a lerp factor toward the newest field so 10 Hz snapshots read as smooth
  at 60 fps. Waves are low-frequency, so linear interpolation between two
  quantised grids is visually sufficient — no client-side solver.
- Displace the water plane's Y in the **vertex shader** from that texture. The
  CPU never touches vertex data.
- Walk `cursors.positions`, write `.position` on pooled sprites, set `.visible`
  for `count`, hide the rest. Y comes from `field.heightAt`.

The whole loop is allocation-free after mount.

### 6.4 `apps/next/src/lib/pool/pool-surface.ts`

Replaces `CursorSurfaceController` for this scene. Same shape and lifecycle
(`attach` / `detach` / `dispose`, idempotent), but converts pointer position via
a camera raycast against the water plane instead of `getBoundingClientRect`.

Feeds `SharedCursorStore.setPointer` with world units directly, using a
clamp-to-world projection. Note `setPointer`'s doc comment currently says it
takes a surface fraction — that comment needs widening.

Raycasting is done by hand against a known plane (`ray.origin + t * ray.dir`
solved for `y = 0`), not with `THREE.Raycaster` against the mesh — the plane is
analytic, so there is no reason to traverse geometry.

### 6.5 `apps/next/src/components/examples/WavePool.tsx`

The entire React surface of the 3D scene:

```tsx
export function WavePoolCanvas({ field, cursors, surface }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = new PoolRenderer(canvas, field, cursors);
    renderer.start();
    surface.attach(canvas);
    return () => { surface.detach(); renderer.dispose(); };
  }, [field, cursors, surface]);

  return <canvas ref={ref} className="size-full" />;
}
```

No `observer`. No state. No props that change after mount. It renders once.

Surrounding chrome (`PresenceFacepile`, participant count, copy) stays ordinary
React **outside** this component, driven by the throttled roster of §6.6 rather
than by the presence map directly.

`RippleLayer` and `CursorOverlay` are DOM/SVG and do not carry over; their job is
done in-scene now. `PresenceFacepile` carries over unchanged.

### 6.6 Throttled roster for the React chrome

`PresenceRoom.entries` is mutated on every cursor move — 30 Hz per peer — so any
`observer` reading a derived value from it re-renders at that rate. This is not
hypothetical; it is happening in the existing canvas demo today (§11).

Add to `SharedCursorStore` an observable that changes only when the participant
*set* changes:

```ts
/** Sorted participant ids, updated only on join/leave/rename. */
private readonly rosterKey = observable.box("");
get roster(): PresenceParticipant[];   // recomputed only when rosterKey changes
```

Position updates leave `rosterKey` untouched, so the facepile re-renders on
join/leave and never on movement. The 3D scene ignores this path entirely.

### 6.7 Wiring

`useWavePool(scope, participant)` in the existing `useSharedCursors.ts`,
following `useCanvasCursors` exactly — a thin bridge that activates stores on
mount and returns stable references. It returns `{ field, cursors, surface,
store }`, all stable for the component's lifetime, so the `useEffect` in §6.5
runs exactly once.

`UserStoreManager` gains a `poolFieldStore(scope)` beside `cursorStore` /
`canvasCursorStore`, cached in the same map pattern and disposed in `dispose()`.

---

## 7. Instrumentation

Printf debugging is explicitly sanctioned by `AGENTS.md`, and this is a system
where the numbers decide the design. Log from the start:

| Metric | Where | Why |
| --- | --- | --- |
| Tick duration p50/p99 | `pool-room.ts` | Confirms the 0.5 ms estimate |
| Tiles sent per frame | broadcast | Validates the spatial-sparsity premise |
| Bytes/frame pre- and post-deflate | broadcast | Decides whether §2.3 deltas are ever needed |
| Sockets skipped for backpressure | §5.4 | Catches the TCP failure mode |
| Client apply time, dropped frames | `PoolField` | Catches decode cost |
| **React render count while cursors move** | React DevTools Profiler | Proves §6.0 holds — must be **zero** |

The React-render check is the acceptance test for the whole hot-path constraint:
record a 10-second profile with several cursors moving, and confirm no component
in or around the scene renders. Any non-zero count is a bug, not a tuning issue.

**Enable `perMessageDeflate` on the gateway** — it is off by default in
socket.io v3+. Measure with it on before hand-rolling any coder.

The go/no-go on temporal deltas is: if post-deflate bytes/frame at 8 concurrent
users exceeds ~15 KB/s, revisit §2.3. Otherwise leave it simple.

---

## 8. Tests

Following existing conventions — `*.spec.ts` beside source in `apps/nest`,
`__tests__/*.test.ts` in `apps/next`.

- `wave-field.spec.ts` — impulse propagates outward; energy decays to zero;
  boundaries reflect without exploding; solver is stable over 10k ticks.
- `pool-codec.spec.ts` — **quantise → encode → decode → reconstruct is
  bit-exact.** This is the test that guarantees the no-drift property.
- `pool-codec.spec.ts` — tile mask includes exactly the live tiles, plus the
  trailing zero frame.
- `pool-room.spec.ts` — tick starts on first join and stops on last leave; a
  cursor moving injects force proportional to speed.
- `pool-field-store.test.ts` — keyframe then tiles reconstructs the server's
  array exactly; out-of-order or unknown frames are ignored.

---

## 9. Sequencing

| # | Step | Est. | Verifiable by |
| --- | --- | --- | --- |
| 1 | `WaveField` solver + specs | 0.5 d | Unit tests, ASCII-art dump of the grid |
| 2 | Codec (quantise/tile/encode/decode) + specs | 0.5 d | Bit-exact roundtrip test |
| 3 | `PoolRoom` tick loop, lifecycle, namespace entry | 0.75 d | Server logs show tiles flowing |
| 4 | `PoolFieldStore` + wiring, no 3D yet | 0.5 d | 2D canvas debug view of the field |
| 5 | `PoolRenderer` + displacement shader | 1 d | Visual; React render count is zero |
| 6 | Raycast surface controller, pooled in-scene cursors | 0.75 d | Visual, two browsers |
| 7 | Backpressure, instrumentation, reduced-motion, mobile fallback | 0.5 d | Metrics + throttled-network test |

**~4.5 days.** Step 4 landing before step 5 is deliberate: it makes the whole
networking stack testable with a flat 2D debug view, so any bug found during the
3D work is known to be a rendering bug.

---

## 10. Known risks

1. **Multi-instance servers break the sim.** Two Nest instances = two divergent
   pools. Note this is *already* true of `RoomRegistry` and all presence today,
   so it is a pre-existing constraint rather than something this feature
   introduces — but a simulation makes it far more visible. Single instance, or
   Redis-backed room state. Check `apps/nest/railway.json` before deploying.
2. **`three` is a heavy new dependency.** Route-level dynamic import so it never
   enters the shared bundle. Dropping R3F (§6.0) removes a second one.
3. **Mobile.** Touch has no hover, so there is no cursor to drag. Taps already
   work via the existing signal path. The shader plane should degrade to a lower
   grid resolution on low-end GPUs.
4. **`setPointer`'s "fraction" contract widens** to "point in the room's
   coordinate space". Small, but it touches a shared doc comment.
5. **Idle CPU.** A room with members but a flat pool still ticks at 60 Hz. Add a
   sleep when total energy is below threshold, waking on the next impulse.

---

## 11. Pre-existing issue found while planning

**The canvas demo re-renders its facepile at pointer rate today.**

`CollaborativeCanvas.tsx:83` wraps `RoomPresence` in `observer` and reads
`store.participants`. That is a `computed` (`sharedCursorStore.ts:131`) which
returns `Array.from(this.entries.values()).map(e => e.participant)` — a **new
array on every recompute**. `PresenceRoom.setSelf` calls `entries.set(...)` on
every cursor move, so with one peer moving, `participants` invalidates ~30×/s,
returns a fresh array reference, and `RoomPresence` re-renders ~30×/s. The
roster has not changed; only a position has.

`CoordinateReadout` reads `store.cursors` and *should* update at that rate, so it
is correct. The facepile is not.

Cost today is a small DOM diff, so it is not urgent — but it is exactly the
pattern that would melt the 3D scene, which is why §6.6 exists. Fixing
`SharedCursorStore` with the throttled roster benefits the existing demo too.

## 12. Note unrelated to this work

`AGENTS.md` points at `contribution-standards/` for detailed standards, and that
directory does not exist in the repo. The state-management guidance appears to
live in `docs/state-management/` instead. Worth fixing so the pointer resolves.
