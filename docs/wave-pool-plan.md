# Shared Wave Pool — Implementation Plan and Status

A tech demo: a 3D pool of water rendered in every connected client's browser,
simulated on the server, where people make waves to move one shared buoyant
boat and can see where the other clients are watching from.

The pitch is not the water. It is that the generic room protocol landed in
`aug-5-collab` can carry a server-authoritative physics simulation without a
physics-specific transport or a second realtime connection. The only generic
presence enhancement is a cached structural roster (§6.6), which also fixes an
existing render-at-pointer-rate issue in the canvas demo.

There is exactly **one** pool: `pool:global`. Every authenticated site user who
opens the demo joins that same surface. Multiple pool scopes, private pool
sessions, and horizontal simulation scaling are deliberately out of scope.

**Implementation status (2026-08-07):** the shared protocol, authoritative wave
and boat simulation, exact global-room admission, gateway wiring, pool-specific
pointer/viewpoint presence, structural roster, fixed-capacity scene buffers,
orbit controller, Three.js renderer, route, and automated tests are implemented.
Automated verification is recorded in §9. The remaining acceptance work is
intentionally browser-driven: visual/physics tuning, two-browser interaction,
React Profiler confirmation, and bandwidth/compression measurement. Per
repository guidance, the implementation did not start the dev server or claim
visual verification.

---

## 1. Baseline before implementation

Roughly 80% of the networking is done. Confirmed by reading the current tree:

| Piece | Where | Reused as-is? |
| --- | --- | --- |
| Generic room presence, ref-counted join/leave | `apps/next/src/lib/realtime/presence-room.ts` | Yes, plus a structural-roster projection |
| Per-namespace join policy + state validation | `apps/nest/src/realtime/presence/room-namespaces.ts:101` | One entry plus an exact-room admission predicate |
| In-memory membership & roster | `apps/nest/src/realtime/presence/room-registry.ts` | Yes, unchanged; the pool tracks its own socket set |
| Rate limiting | `apps/nest/src/realtime/presence/rate-limiter.ts` | Yes, unchanged |
| Room fan-out helper | `apps/nest/src/realtime/realtime.gateway.ts:488` | Binary shape reused; pool adds volatile broadcast semantics |
| Cursor store, throttled publish, idle retirement | `apps/next/src/stores/userApp/sharedCursorStore.ts` | Yes, plus pool projection and structural roster reads |
| Fixed shared world concept | `apps/next/src/lib/realtime/canvas-world.ts` | Pattern copied for 3D |

At planning time, the two missing pieces were **a server tick loop** (the
gateway was a stateless relay) and **a 3D renderer** (`three` was not yet a Next
dependency). Both now exist in the paths described below.

---

## 2. Design decisions

### 2.1 Height field, not volumetric liquid

The surface is a 2D grid of heights evolved by the discrete wave equation.
A true volumetric solver (FLIP/PIC, SPH) is an order of magnitude more work and
its state does not survive the network.

- **Pros:** ~40 lines of solver; ~0.5 ms/tick at 128×128; state is a flat array,
  trivially serialisable; looks exactly like a wave pool.
- **Cons:** no splashes, no breaking waves, and no volumetric hull displacement.
  The shared boat samples the height field instead (§2.7), which is sufficient
  for this interaction but is not full fluid/geometry coupling.

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
  that is likely irrelevant; `permessage-deflate` may recover some of it, but
  §7 measures rather than assumes that benefit.

Temporal deltas stay documented as a later optimisation, to be added **only if
measurement demands it** (§7).

### 2.4 One shared broadcast, no per-client baselines

Quake-style delta compression needs per-client baselines and ack windows because
UDP clients lose different packets. This stack is Socket.IO over TCP: admitted
packets are ordered, while §5.4 deliberately drops a volatile frame before it
enters a slow socket's transport. Because every included tile is absolute and
periodic keyframes repair omitted tiles, one encoded buffer still goes to the
global room with zero per-client baseline bookkeeping. Encoding is O(1) for the
pool, not per client.

The cost TCP brings instead is head-of-line blocking: a stalled client backs up
its stream and socket.io buffers unboundedly. Handled in §5.4.

### 2.5 Pointers publish 2D; viewpoints publish 3D

The pointer raycasts onto the water plane, so its meaningful position is 2D. Its
rendered height is looked up from the field the client already has.

- Zero extra bytes on the wire.
- Pool presence wraps the optional pointer and required viewpoint in one state:
  `{ pointer: { x, y } | null, viewpoint: { x, y, z } }`. One throttled
  presence stream therefore covers both inputs without another room or socket.
- Cursors visually bob on the waves for free.

The viewpoint is the Three.js camera position in the same zero-based pool-world
coordinates. Remote viewpoints render as color-coded 3D cones aimed at the
pool, so a client across the table is visibly across the table. The local
viewpoint is excluded from that client's marker buffer.

Full 6DOF cursors are deliberately out of scope: a mouse has no depth axis, so
there is no honest mapping.

### 2.6 One fixed global pool

The only accepted room id is `pool:global`. A namespace admission predicate
rejects `pool:anything-else` before it reaches either Socket.IO membership or
the simulation.

- **Pros:** one bounded 60 Hz solver; no per-scope cache, registry, quota, or
  eviction policy; every visitor sees the same world; initial implementation
  and instrumentation stay honest.
- **Cons:** one Nest process is authoritative; all users share one participant
  and bandwidth budget; horizontal scaling requires an explicit owner or an
  external simulation service later. Accepted for the demo.

The room still requires the existing authenticated realtime connection.
Anonymous socket access is a separate product/auth decision, not implied by
"global."

### 2.7 One sampled rigid-body boat, not a particle fluid simulation

The server advances one lightweight six-degree-of-freedom rigid body after each
wave step. Six fixed probes under the hull sample height, vertical velocity,
and slope from the field. Distributed buoyancy and drag at those points create
translation, pitch, and roll; the sampled surface normal supplies the lateral
force that lets waves push the boat.

- **Pros:** one deterministic source of truth; no large physics dependency; the
  60 Hz hot path stays allocation-free TypeScript; late joiners receive the
  exact current pose; enough coupling for the intended wave-pushing game.
- **Cons:** arcade physics, not naval architecture; no planing, capsizing,
  splashes, wake generation, or collision geometry. Probe gains and hull shape
  require browser tuning. A particle solver would add large cost without fixing
  the more important multiplayer-authority problem.

---

## 3. Shared protocol and coordinate system

Add `packages/shared/pool/index.ts` and export it from `@kingstack/shared`. Add
that workspace dependency to `apps/nest`; `apps/next` already has it. This is
the single source of truth for room identity, dimensions, quantisation, and
wire-envelope types:

```ts
export const POOL_ROOM_ID = "pool:global" as const;
export const POOL_WORLD = { width: 1600, depth: 1000 } as const;
export const POOL_GRID = { cols: 64, rows: 40, tile: 8 } as const;
export const POOL_HEIGHT_MAX = 80;
export const POOL_PRESENTATION_HEIGHT_SCALE = 2.2;
export const POOL_PROTOCOL_VERSION = 1;
export const POOL_BROADCAST_INTERVAL_MS = 100;
export const POOL_BOAT_BROADCAST_INTERVAL_MS = 1000 / 30;
```

`64 × 40` cells over a `1600 × 1000` world is 25 world-units per cell, and
divides evenly into `8 × 5 = 40` tiles of `8 × 8`.

The protocol's pool surface is `x = 0…1600`, `z = 0…1000`; Y is height. The
three.js mesh may be centred internally, but `PoolRenderer.project()`
must convert back to that zero-based protocol space before publishing. The pool
pointer stays `{ x, y }`, where `y` means **depth along Z**, but pool presence
is `{ pointer, viewpoint }`. `viewpoint` uses real 3D coordinates; its X/Z
range deliberately extends beyond the basin because cameras sit around the
table. The pool namespace validates the complete envelope rather than using the
wider generic `CANVAS_WORLD_LIMIT` validator.

---

## 4. Wire format

Two frame types on a `pool` Socket.IO event. Binary rides as an attachment; the
shared decoder accepts `ArrayBuffer` or an exact `ArrayBufferView` and rejects a
wrong protocol version, room id, action, mask, or byte length before mutating
client state.

**Keyframe** — sent to one socket on join.

```ts
{ type: "pool", version: 1, roomId: "pool:global", epoch: string,
  action: "keyframe", seq: number,
  grid: { cols: 64, rows: 40, tile: 8 },
  data: ArrayBuffer }   // Int8, cols*rows = 2560 bytes
```

**Tile frame** — broadcast at 10 Hz while any tile is live.

```ts
{ type: "pool", version: 1, roomId: "pool:global", epoch: string,
  action: "tiles", seq: number,
  mask: number[],       // indices of included tiles, ascending
  data: ArrayBuffer }   // Int8, mask.length * 64 bytes, row-major per tile
```

Height quantisation:
`int8 = clamp(round(h / POOL_HEIGHT_MAX * 127), -127, 127)`. The fixed shared
constant is compiled into both endpoints; there is no runtime negotiation.

**Tile liveness rule.** A tile is included when `max|int8| > 0`, **plus one
final frame after it reaches all-zero**. Without that trailing frame a tile that
goes quiet leaves stale non-zero values on the client forever.

`epoch` is a random id created with each server-side `GlobalPool`. Only a valid
keyframe may establish a new epoch; a tile from an unknown epoch is ignored. On
that keyframe the client discards its old sequence and field, then resumes. This
prevents a Nest restart from leaving a client that remembers a high old sequence
unable to accept the new simulation's low one.

`seq` is monotonic within an epoch. Tile frames are volatile (§5.4),
so a gap is expected under backpressure: the client logs the gap, continues
applying later absolute tiles, and becomes fully authoritative again at the
next keyframe. It is not an ack — nothing is acked.

**Boat frame** — sent reliably to one socket on join and at sleep, and
broadcast volatile at 30 Hz while the simulation is active.

```ts
{ type: "pool:boat", version: 1, roomId: "pool:global",
  epoch: string, seq: number,
  position: { x: number, y: number, z: number },
  rotation: { x: number, y: number, z: number, w: number },
  resetSeq: number, resetCooldownMs: number }
```

Boat frames have their own sequence within the same epoch. The client retains
the previous and current pose and interpolates both position and quaternion.
`resetSeq` changes only after an accepted global reset; cooldown remaining lets
late joiners reconstruct the same five-second button state. The decoder rejects
non-finite/out-of-world positions, non-unit rotations, and invalid cooldowns.

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
  sample(x: number, z: number, out: WaveSample): WaveSample;
  quantise(out: Int8Array): void;      // world height -> Int8
  energy(): number;                    // displacement + velocity
  reset(): void;
}
```

Two `Float32Array` buffers (current, previous), standard second-order update
with a damping factor. Reflecting boundaries at the pool walls. The wave speed,
cell spacing, and fixed `1 / 60` timestep must satisfy the 2D Courant stability
condition; the constructor rejects unstable options instead of relying only on
a long-running test to discover them. `sample()` bilinearly reads height,
vertical velocity, and finite-difference slopes into a caller-owned object for
the allocation-free boat path.

### 5.1a `boat-simulation.ts` — sampled rigid body

Pure TypeScript, no Nest and no socket dependency. `BoatSimulation.step(field)`
runs after `WaveField.step()` at 60 Hz. Six submerged hull probes apply
buoyancy, vertical/horizontal water drag, and force-at-point torque; a normalized
quaternion integrates angular velocity. Air damping, speed caps, pool-wall
response, finite-value checks, and a reset height bound keep hostile input from
making the global simulation unstable.

### 5.2 `global-pool.ts` — the one simulation and its lifecycle

One `GlobalPool` is constructed with the gateway. There is no pool registry and
no map keyed by scope. It owns one `WaveField`, one `BoatSimulation`, one
quantised frame, a `Set<socketId>` of members, a
`Map<socketId, PointerSample>`, monotonic field/boat sequences, and the tick
handle.

```ts
class GlobalPool {
  join(socket: Socket): void;
  leave(socketId: string): void;
  observePointer(socketId: string, point: PoolPoint | null, nowMs: number): void;
  tap(point: PoolPoint): void;
  dispose(): void;
}
```

Membership is idempotent and independent from `RoomRegistry` retractions. Every
join receives a freshly quantised current keyframe and current boat frame,
including a late join that lands between 10 Hz broadcasts. Joining a flat pool
does not start a wasteful 60 Hz timer: the first accepted pointer movement or
tap wakes it. The last leave stops the timer, clears pointer history, and resets
the unseen field and boat so a later first visitor does not resume frozen state.

Simulation runs at **60 Hz** with a fixed timestep. The spatially larger field
broadcasts at **10 Hz** every sixth step; the single small boat pose broadcasts
at **30 Hz** every other step. A delayed Node event loop never passes a large
wall-clock `dt` into the solver or performs an unbounded catch-up loop. It
records missed simulation time for instrumentation and continues from the next
fixed step.

With members present, a flat field and settled boat sleep instead of ticking.
Sleep requires total displacement-plus-velocity energy below threshold, an
all-zero quantised frame, and low boat linear/angular velocity; a zero-height
crossing or coasting boat must not sleep. Before sleeping, send one reliable
all-zero keyframe and final reliable boat pose. The next pointer impulse or tap
wakes the fixed-step timer.

### 5.3 Input contract and gateway wiring

Force injection reuses messages the server already receives; there is no new
client→server message. After validation, the gateway calls the global pool from
all relevant paths:

| Gateway path | Pool action |
| --- | --- |
| `handleRoomJoin` for `pool:global` | `join(client)` after Socket.IO join |
| `handlePresenceSet` with a point | `observePointer(client.id, point, now)` |
| `handlePresenceSet` with `null` | clear that socket's motion baseline |
| `handlePresenceClear` | clear that socket's motion baseline |
| accepted `room:signal/ripple` | inject one fixed, bounded tap before peer fan-out |
| accepted `room:signal/reset-boat` | enforce the global five-second cooldown, reset pose/velocity, and reliably broadcast it |
| `handleRoomLeave` | `leave(client.id)` even if no presence was published |
| `handleDisconnect` | `leave(client.id)` unconditionally, not from `leaveAll()` results |

Pointer history is keyed by socket id, not the client-supplied participant id.
The first sample after join, idle, re-entry, identity replacement, or a long
sampling gap establishes a baseline and injects no force. When
`setPresence()` reports `supersededParticipantId`, the gateway clears the socket
baseline before observing the replacement entry. Later samples derive speed
from server arrival time.

Every input is bounded before touching `WaveField`: exact world bounds, minimum
and maximum sample interval, maximum speed, maximum impulse strength/radius,
and maximum absolute field height. Pool presence validation extracts only the
nested `pointer`; viewpoint movement never injects a wave. A non-finite solver
or rigid-body value is a logged reset, not a value allowed to contaminate all
future frames. Tests cover teleports, re-entry, malformed points, and a client
alternating opposite pool corners at the presence rate limit.

Boat reset is a server rule, not a disabled-button convention. `GlobalPool`
accepts one reset every 5,000 ms across all sockets, increments `resetSeq`, and
reliably broadcasts the centered pose immediately. Rejected attempts do not
move the boat. The latest remaining cooldown is included in join and live boat
frames, so another tab and a late join cannot bypass or misrepresent it.

### 5.4 Backpressure

The 10 Hz tile stream uses Socket.IO's public volatile path:

```ts
server.to(POOL_ROOM_ID).volatile.emit("pool", tileFrame);
```

Socket.IO drops a volatile packet for a socket whose transport is not writable,
so the hot stream cannot grow that socket's Engine.IO buffer. Do not read the
private `socket.conn.writeBuffer` field.

While the field is active, broadcast a full **volatile** keyframe every two
seconds. It repairs a missed tile or trailing-zero frame once a transiently slow
client becomes writable again. Initial join keyframes and the single all-zero
keyframe sent when the field sleeps are reliable; high-rate simulation frames
are never reliable. A persistently unwritable client cannot receive useful
realtime state anyway; high-rate pool frames add no backlog, while the existing
ping timeout remains responsible for genuinely dead-connection cleanup.

For diagnostics only, count room sockets whose public
`socket.conn.transport.writable` flag is false at broadcast time. Correctness
does not depend on that sampling being race-free.

### 5.5 Namespace registration

Add an optional generic `allowsRoomId(roomId)` predicate to namespace policy and
one pool entry in `room-namespaces.ts`:

```ts
pool: {
  access: "guest",
  allowsRoomId: (roomId) => roomId === POOL_ROOM_ID,
  validateState: validatePoolPresenceState,
  validateSignal: (kind, data) =>
    kind === "ripple" ? validatePoolPoint(data) : null,
},
```

`denyRoomAccess` applies the predicate before `RoomRegistry.join()` and
`client.join()`. Thus `pool:private`, accidental dynamic scopes, and hostile
room creation are rejected rather than becoming unused presence rooms.

---

## 6. Client work

### 6.0 Hard constraint: React is not in the render hot path

**React mounts the scene, then never renders it in response to simulation or
pointer movement.** Every per-frame update is a direct mutation of a three.js
object from a plain `requestAnimationFrame` loop written in TypeScript. React
Strict Mode's development mount/cleanup/mount probe is expected and all
imperative lifecycle methods remain idempotent.

This is structural, not a matter of discipline. The rules below are what make it
impossible to reintroduce the problem by accident, rather than merely unlikely.

**No React Three Fiber.** R3F's `useFrame` callback does genuinely run outside
the reconciler, so the loop itself would be fine — but R3F puts a React
reconciler underneath the scene graph, so *any* JSX describing scene contents is
one careless `observer` or changed prop away from reconciling three.js objects at
pointer rate. Plain `three` removes that possibility entirely. It also drops a
dependency and shrinks the bundle. The cost is renderer, resize, shader, and
disposal code that we own and control.

**Pull, never push.** The render loop *polls* plain data each frame. Nothing
subscribes, nothing reacts, nothing calls `setState`. No MobX reaction is allowed
to reach a React component at frame rate.

**The five rules:**

1. No `observer()` component reads anything that changes at pointer or frame
   rate. Ever.
2. Per-frame data lives in plain typed arrays and plain number fields — **not**
   `observable`. Not even the `version` counter.
3. Scene objects and GPU buffers are pre-allocated at mount. They are never
   created or destroyed per frame; bounded draw ranges select active cursors.
4. The renderer imports nothing from `react` or `mobx-react-lite`.
5. React-facing UI (facepile, counts) is driven by a separate **structural**
   observable that changes on membership, identity, or pointer-active
   transitions — never on coordinate movement. See §6.6.

A lint rule (`no-restricted-imports` for `react` inside `lib/pool/`) makes rule 4
mechanical.

### 6.1 `apps/next/src/lib/pool/pool-field.ts`

Pure TS. Holds previous and current snapshots, applies validated keyframes and
tile frames, and exposes:

```ts
readonly previous: Int8Array;
readonly current: Int8Array;
version: number;             // plain number, bumped on apply
receivedAtMs: number;        // plain monotonic timestamp
heightAt(x: number, z: number, alpha: number): number;
```

Before applying a frame, copy the 2.5 KB current snapshot to previous, then
apply the keyframe or tiles to current. That small 10 Hz copy is simpler than a
third reconciliation representation and gives both the shader and CPU cursor
sampling the same interpolation endpoints.

**Nothing here is observable.** Making 2560 cells reactive — or even just
`version`, which ticks at 10 Hz — is the single worst thing we could do to this
scene. The renderer polls `version` and timestamps from its plain rAF loop.

### 6.2 Fixed-capacity scene buffers

The renderer must not read `SharedCursorStore.cursors` in the loop. That is a
MobX `computed`, and **a computed read outside a reaction is recomputed on every
access** — so polling it at 60 fps re-runs the filter and allocates a fresh array
of objects every frame, for garbage the collector then has to chase.

Instead use a small plain mirror, updated by a raw presence subscription owned
by `WavePoolStore` (§6.7):

```ts
class CursorBuffer {
  readonly positions: Float32Array;   // [x, z] per slot, fixed capacity
  readonly tones: Uint8Array;
  count: number;
  version: number;
}
```

Movement of an already slotted peer is one array write. A plain id-to-slot map
is rebuilt only on structural presence changes. The render pool has a documented
fixed capacity (start with 64); overflow participants remain in the facepile but
are not drawn in 3D. When a visible participant leaves, the deterministic slot
rebuild promotes overflow, so a stationary overflow cursor cannot remain hidden
forever.

`ViewpointBuffer` follows the same bounded pattern with `[x, y, z]` positions,
excludes the local participant, and deliberately ignores pointer-only presence
updates. `BoatBuffer` retains adjacent validated positions/quaternions and snaps
both endpoints when the server epoch changes. None of these buffers is MobX
observable.

### 6.3 `apps/next/src/lib/pool/pool-renderer.ts`

Pure TypeScript class with no React or MobX imports. Owns the three.js renderer,
scene, camera, water mesh, cursor pool, and the rAF loop.

```ts
export class PoolRenderer {
  constructor(
    canvas: HTMLCanvasElement,
    field: PoolField,
    cursors: CursorBuffer,
    viewpoints: ViewpointBuffer,
    boat: BoatBuffer,
    options?: PoolRendererOptions,
  );
  project(fractionX: number, fractionY: number): { x: number; z: number } | null;
  orbit(deltaX: number, deltaY: number): void;
  zoom(deltaY: number): void;
  viewpoint(): PoolViewpoint;
  start(): void;
  stop(): void;
  dispose(): void;
}
```

Per frame, in plain TS:

- If `field.version` changed, upload previous and current snapshots to two
  `DataTexture`s and flag them for update. Otherwise touch neither texture.
- Derive a timestamp-based interpolation factor from `field.receivedAtMs`,
  clamped to `0…1`, so 10 Hz snapshots read as smooth at 60 fps. No client-side
  solver or extrapolation exists.
- Displace the water plane's Y in the vertex shader by sampling and mixing both
  textures. Render the displaced 64×40 geometry as a white wireframe, with line
  opacity and brightness increasing slightly at energetic crests and troughs.
  Draw one shaded gray point sprite at every grid intersection from the same
  geometry and shader uniforms; the 2,560 round markers add one draw call rather
  than 2,560 sphere meshes. Their luminance stays below the white boat, rising
  modestly with wave energy. A local-only display toggle makes either the
  wireframe or point layer visible, never both, without rebuilding the renderer
  or publishing presence state.
- Render the surface above a recessed, low-contrast wireframe basin, with a
  2.2× presentation-only height scale. The monochrome, unlit treatment avoids
  specular flashes and keeps the simulation legible as a field rather than a
  solid sheet of water. The exaggeration never feeds back into the
  authoritative field or wire format.
- Walk `cursors.positions` and update one preallocated point-cloud position and
  colour buffer with a draw range bounded by `count`. Y comes from
  `field.heightAt(x, z, alpha)`, using the exact same interpolation factor as
  the surface. This is one draw call rather than 64 sprite draw calls.
- Interpolate the one boat's position and quaternion between 30 Hz poses using
  an interval adapted from observed arrivals, then mutate a prebuilt
  white wireframe hull/deck/cabin group.
- Update five preallocated instanced cone batches (one explicit unlit material
  per presence tone) from `ViewpointBuffer` only when its version changes.
  Matching vertical lines anchor camera positions to the pool plane; cone
  orientation points toward the pool.

The whole loop is allocation-free after mount.

### 6.4 `apps/next/src/lib/pool/pool-surface.ts`

Replaces `CursorSurfaceController` for this scene. Same lifecycle (`attach` /
`detach` / `dispose`, idempotent), but asks the renderer's
`project(fractionX, fractionY)` method for a point on the analytic `y = 0`
plane. The controller caches the canvas rectangle and converts DOM coordinates
to fractions; Three.js camera/matrix knowledge stays in the renderer.

The pool-specific presence store accepts these world units and publishes them
inside `pointer`. Right-drag captures the pointer and calls `orbit`; the mouse
wheel calls `zoom`. Each camera change republishes `renderer.viewpoint()` in
the same throttled presence state. Secondary dragging clears the surface
pointer so moving the camera cannot accidentally manufacture waves.

The renderer computes the ray/plane intersection analytically rather than
traversing mesh geometry, then converts its centred mesh coordinates to the
protocol's zero-based `0…width`, `0…depth` space.

### 6.5 `apps/next/src/components/examples/WavePool.tsx`

The entire React surface of the 3D scene:

```tsx
export const WavePoolCanvas = memo(function WavePoolCanvas({
  pool,
}: {
  pool: WavePoolStore;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = new PoolRenderer(
      canvas,
      pool.field,
      pool.cursorBuffer,
      pool.viewpointBuffer,
      pool.boat,
    );
    const surface = new PoolSurfaceController(pool, renderer);
    renderer.start();
    surface.attach(canvas);
    return () => { surface.dispose(); renderer.dispose(); };
  }, [pool]);

  return <canvas ref={ref} className="size-full" />;
});
```

No `observer`. No state. No props that change after mount. The `memo` boundary
also prevents structural facepile updates in the surrounding component from
rendering the canvas component again.

Surrounding chrome (`PresenceFacepile`, participant count, copy) stays ordinary
React **outside** this component, driven by the structural roster of §6.6 rather
than by the presence map directly. The route breaks out of the application
content column so the canvas fills the viewport; the title, instructions,
presence, and reset control float over it without intercepting pointer input.

The reset button observes a dedicated MobX projection that changes at most once
per displayed countdown second. The 30 Hz `BoatBuffer` remains plain data and
never becomes a React dependency. Clicking publishes one validated room signal;
the button enters a short pending state until the reliable authoritative boat
frame supplies the accepted reset generation and five-second deadline.

`RippleLayer` and `CursorOverlay` are DOM/SVG and do not carry over; their job is
done in-scene now. `PresenceFacepile` carries over unchanged because §6.6 makes
its existing `participants` and `hasPointer` inputs structural.

### 6.6 Structural roster for the React chrome

`PresenceRoom.entries` is mutated on every cursor move — 30 Hz per peer — so any
`observer` reading a derived value from it re-renders at that rate. This is not
hypothetical; it is happening in the existing canvas demo today (§11).

Add a cached observable structural projection to generic `PresenceRoom`:

```ts
interface PresenceSummary {
  participant: PresenceParticipant;
  hasState: boolean;
}

/** Replaced only on join/leave/rename or null ↔ non-null state. */
readonly roster: PresenceSummary[];
```

`PresenceRoom` updates `entries` for every coordinate, but replaces `roster`
only when participant metadata or a feature-selected active bit changes. Its
generic `structuralHasState` option defaults to `state !== null`; pool presence
selects `state.pointer !== null`, so viewpoint-only movement does not make the
facepile claim that someone is pointing. Merely reading an observable-map-
derived computed behind a `rosterKey` would still track that map and is
explicitly not the implementation.

Thus the facepile renders on join/leave/rename and when someone starts or stops
publishing a pointer, but never for non-null coordinate-to-coordinate movement.
The 3D scene ignores this observable path entirely. This also fixes the existing
canvas demo.

### 6.7 Wiring

`UserStoreManager` owns exactly one lazily constructed `WavePoolStore`; there is
no scope argument and no map:

```ts
class WavePoolStore {
  readonly field: PoolField;
  readonly boat: BoatBuffer;
  readonly cursorBuffer: CursorBuffer;
  readonly viewpointBuffer: ViewpointBuffer;
  readonly cursors: PoolPresenceStore;
  activate(): () => void;
  dispose(): void;
}
```

On first activation it performs this order synchronously:

1. subscribe to `pool` frames;
2. subscribe to `pool:boat` frames;
3. subscribe to raw `presence` frames for `CursorBuffer` and `ViewpointBuffer`;
4. activate `PoolPresenceStore`, whose `PresenceRoom` installs its own listeners
   and performs the one ref-counted `room:join` for `pool:global`.

This ordering guarantees the direct join keyframe cannot arrive before its
listener. `WavePoolStore` does not acquire a second room lease. Reconnect works
through the existing `RealtimeManager`: subscriptions are attached to the new
socket before its retained room lease is rejoined and the server sends a new
keyframe. Final release leaves the room before removing the two aggregate
subscriptions, then clears the plain buffers.

`useWavePool(participant)` is a thin bridge: get the singleton store, activate
it on mount, and forward stable participant identity changes. It returns the
stable `WavePoolStore`; `WavePoolCanvas` creates renderer and surface-controller
imperative objects in its one effect. `UserStoreManager.dispose()` disposes the
singleton if it was constructed.

### 6.8 Design-system, accessibility, and reduced motion

Reuse the existing collaboration chrome, `PresenceFacepile`, presence-tone
palette, typography, spacing, and borders rather than inventing a second visual
language for the demo. The implementation follows
`apps/next/src/components/ui/ui-design.md` and the existing canvas/presence
components, but gives this experiment a deliberately stark black-and-white
field aesthetic: the viewport, basin, water, boat, copy, and controls are
monochrome. Established presence tones remain only on participant cursors,
camera markers, guide lines, and facepile identities so collaborators can still
be matched across the UI and 3D scene.

The canvas gets an accessible label and adjacent explanatory fallback text.
For `prefers-reduced-motion: reduce`, draw only when field/cursor state or size
changes, with no interpolation or camera motion. Touch keeps the existing tap
impulse. The mesh already matches the modest 64×40 protocol field, and client
rendering never changes authoritative state.

---

## 7. Instrumentation

Printf debugging is explicitly sanctioned by `AGENTS.md`, and this is a system
where the numbers decide the design. Server metrics use the injected structured
logger. Client measurements use the existing browser logger or sampled
`performance` entries rather than raw `console`, which the Next ESLint config
rejects. Log from the start:

| Metric | Where | Why |
| --- | --- | --- |
| Tick duration p50/p99 and missed fixed steps | `global-pool.ts` | Confirms cost and event-loop health |
| Tiles sent per frame | broadcast | Validates the spatial-sparsity premise |
| Encoded payload bytes/s per recipient and estimated total egress | broadcast | Keeps per-client cost distinct from audience scaling |
| Actual wire bytes/s and server CPU, compression off vs on | transport/external capture | Measures whether deflate helps rather than assuming it |
| Unwritable sockets sampled; client sequence gaps; keyframe recoveries | §5.4/client | Catches the TCP/volatile failure mode |
| Client decode/apply p50/p99 and long rAF frames | `PoolField`/renderer | Catches decode and render cost |
| **React render count during coordinate-to-coordinate movement** | React DevTools Profiler | Proves §6.0 holds — scene and chrome must be **zero** |

The React-render check is the acceptance test for the hot-path constraint:
record a 10-second profile after every cursor is already active, move several
cursors, and confirm no component in or around the scene renders. A pointer
starting or stopping may legitimately update the structural facepile once; a
non-null coordinate changing to another non-null coordinate may not.

Do not enable `perMessageDeflate` on faith. It is gateway-wide, costs CPU, and
the installed Engine.IO default threshold is 1024 bytes, larger than many
one-ripple tile frames. Establish an uncompressed baseline, then A/B an explicit
configuration and keep it only if actual wire egress improves without harmful
tick/event-loop regression. Post-deflate bytes cannot be measured inside the
ordinary broadcast helper; use transport instrumentation or an external capture.

The go/no-go on temporal deltas is dimensional and per recipient: with eight
people actively disturbing the pool, if the sustained p95 pool stream exceeds
**15 KB/s per recipient** over a 30-second window after the chosen compression
setting, revisit §2.3. Track total server egress separately because it scales
linearly with connected recipients regardless of codec.

---

## 8. Tests

Following existing conventions — `*.spec.ts` beside source in `apps/nest`,
`__tests__/*.test.ts` in `apps/next`.

- `wave-field.spec.ts` — impulse propagates outward; energy falls below the
  sleep threshold; boundaries reflect; unstable Courant options are rejected;
  bounded hostile impulses remain finite over 10k ticks; continuous sampling
  exposes height, velocity, and slope.
- `boat-simulation.spec.ts` — the body remains finite and settles on flat water;
  a sloped surface produces horizontal motion and rotation.
- Shared `pool-codec` specs — quantise → encode → decode → reconstruct is
  bit-exact; tile masks include live tiles plus trailing zero; wrong version,
  room, mask, ordering, and byte length are rejected; a new epoch requires and
  accepts a new keyframe even when its sequence is below the previous epoch.
- `global-pool.spec.ts` — membership is idempotent; every join gets a current
  field and boat frame without waking a flat pool; first input starts it; last
  leave stops and resets; idle sleep sends final field/boat state;
  pointer baselines, null/re-entry, long gaps, teleports, taps, and disconnects
  obey the bounded input contract.
- Namespace/gateway specs — only `pool:global` joins; valid pointer/tap events
  reach the simulation; clear/leave/disconnect clean it even without a published
  presence entry; tile broadcasts are volatile and join/final-zero keyframes are
  reliable.
- `pool-field.test.ts` — keyframe then tiles reconstruct exactly; stale frames
  are ignored, sequence gaps are applied and logged, and a later keyframe repairs
  a deliberately dropped trailing-zero frame; an unknown epoch's tile is ignored
  until its keyframe; previous/current interpolation and height sampling agree.
- Client scene-buffer specs — pointer and viewpoint projections exclude self,
  update in place, bound overflow deterministically, and ignore unrelated state
  changes; boat frames retain adjacent interpolation endpoints and reject stale
  or malformed poses.
- Boat-reset specs — the server accepts exactly one global reset per five
  seconds, broadcasts the centered pose reliably, protocol validation carries
  the cooldown, and the low-frequency client projection counts down without
  observing hot pose frames.
- `wave-pool-store.test.ts` — pool and raw-presence listeners exist before the
  single room join, ref counts release symmetrically, and reconnect receives a
  keyframe without a second lease.
- Presence-room/shared-cursor specs — coordinate movement does not replace the
  structural roster; join/leave/rename and null↔non-null transitions do.

---

## 9. Sequencing and verification status

| # | Step | Status | Verification |
| --- | --- | --- | --- |
| 1 | Shared constants/types/codec + exact-room namespace policy | Implemented | Protocol and admission specs |
| 2 | `WaveField` solver + bounded-input specs | Implemented | Solver unit/long-run tests |
| 3 | `GlobalPool`, gateway wiring, volatile recovery, instrumentation | Implemented | Realtime suite + Nest typecheck |
| 4 | Sampled buoyant boat + authoritative pose stream | Implemented | Solver/lifecycle/codec tests |
| 5 | Structural roster, pool presence, field/cursor/viewpoint/boat buffers | Implemented | Client lifecycle/codec tests |
| 6 | `PoolRenderer`, water shader, boat, viewpoint markers | Implemented | Next typecheck; visual check pending |
| 7 | Pointer projection, orbit/zoom controller, collaboration chrome | Implemented | Native controller tests; two-browser check pending |
| 8 | Reduced motion, compression decision, final profiling | Partial | Reduced motion implemented; profiling/A-B remains manual |

Current automated result: 34 focused Nest tests and 44 focused Next
pool/presence tests pass, and both package typechecks pass. The final section is
not silently treated as complete: browser/Profiler acceptance remains manual,
and compression stays off until the §7 A/B measurement justifies it.

---

## 10. Known risks

1. **The global pool has one process owner.** Two Nest replicas produce two
   divergent "global" pools. Deploy exactly one realtime Nest instance for this
   phase and log an instance id at pool startup. Redis fan-out alone is not
   enough later; horizontal scaling needs leader ownership or an external
   simulation service. This limitation is accepted, but deployment must verify
   replica count rather than infer it from `apps/nest/railway.json`.
2. **One audience budget.** Solver cost stays constant, but outbound egress is
   O(connected users), and only 64 cursors are drawn in 3D. Instrument recipient
   count/egress and document the visual cap. There is intentionally no sharding
   or private-room escape hatch in this phase.
3. **`three` is a heavy new dependency.** The App Router gives
   `/app/wave-pool` its own route chunk, and no shared layout imports the
   renderer. Dropping R3F (§6.0) avoids a second 3D dependency.
4. **Mobile and reduced motion.** Touch has no hover, so taps are its only
   impulse. Reduced-motion clients render only on incoming changes. These are
   client presentation choices, not alternate simulations.
5. **`setPointer`'s "fraction" contract widens** to "controller input mapped
   into the room's coordinate space." Small, but it touches shared comments and
   tests.
6. **Compression affects the entire gateway.** It remains off unless the A/B
   measurement in §7 shows a net benefit.
7. **Boat dynamics are intentionally approximate.** Distributed probes create
   convincing buoyancy and wave force, but gain/hull tuning is visual work and
   the model does not promise real-world displacement, wakes, or capsizing.

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
pattern that would melt the 3D scene, which is why §6.6 exists. The structural
roster in `PresenceRoom` fixes both demos while preserving pointer-active
transitions for the facepile.

## 12. Note unrelated to this work

`AGENTS.md` points at `contribution-standards/` for detailed standards, and that
directory does not exist in the repo. The state-management guidance appears to
live in `docs/state-management/` instead. Worth fixing so the pointer resolves.
