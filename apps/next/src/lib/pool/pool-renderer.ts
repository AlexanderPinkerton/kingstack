import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  RedFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  POOL_BROADCAST_INTERVAL_MS,
  POOL_CELL_COUNT,
  POOL_GRID,
  POOL_HEIGHT_MAX,
  POOL_PRESENTATION_HEIGHT_SCALE,
  POOL_WORLD,
  type PoolViewpoint,
} from "@kingstack/shared";
import type { BoatBuffer } from "@/lib/pool/boat-buffer";
import type { CursorBuffer } from "@/lib/pool/cursor-buffer";
import type { PoolField } from "@/lib/pool/pool-field";
import type { ViewpointBuffer } from "@/lib/pool/viewpoint-buffer";

const VERTEX_SHADER = /* glsl */ `
  uniform sampler2D previousField;
  uniform sampler2D currentField;
  uniform float frameMix;
  uniform float heightMax;
  uniform float visualHeightScale;

  varying float vHeight;

  float decodeHeight(sampler2D field, vec2 poolUv) {
    float quantised = texture2D(field, poolUv).r * 255.0 - 128.0;
    return clamp(quantised / 127.0, -1.0, 1.0) * heightMax;
  }

  void main() {
    // PlaneGeometry's V axis runs opposite the pool's positive Z axis after
    // rotation, so reverse it once at the protocol boundary.
    vec2 poolUv = vec2(uv.x, 1.0 - uv.y);
    float previousHeight = decodeHeight(previousField, poolUv);
    float currentHeight = decodeHeight(currentField, poolUv);
    float height = mix(previousHeight, currentHeight, frameMix) * visualHeightScale;

    vec3 transformed = position;
    transformed.y += height;
    vHeight = height / (heightMax * visualHeightScale);
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying float vHeight;

  void main() {
    float energy = smoothstep(0.02, 0.72, abs(vHeight));
    float brightness = mix(0.68, 1.0, energy);
    float alpha = mix(0.2, 0.88, energy);
    gl_FragColor = vec4(vec3(brightness), alpha);
  }
`;

const TONE_COLORS = [
  new Color(0xd8ff70), // lime
  new Color(0xa89cff), // violet
  new Color(0x8ee8ff), // cyan
  new Color(0xf9da7f), // amber
  new Color(0xff9c6e), // coral
] as const;

export interface PoolWorldPoint {
  x: number;
  z: number;
}

export interface PoolProjector {
  project(fractionX: number, fractionY: number): PoolWorldPoint | null;
}

export interface PoolViewController extends PoolProjector {
  orbit(deltaX: number, deltaY: number): void;
  zoom(deltaY: number): void;
  viewpoint(): PoolViewpoint;
}

export interface PoolRendererOptions {
  reducedMotion?: boolean;
  initialAzimuth?: number;
}

/** Owns all WebGL resources for one canvas. No React or MobX dependency. */
export class PoolRenderer implements PoolViewController {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(42, 1, 10, 8_000);
  private readonly previousBytes = new Uint8Array(POOL_CELL_COUNT);
  private readonly currentBytes = new Uint8Array(POOL_CELL_COUNT);
  private readonly previousTexture = this.createFieldTexture(
    this.previousBytes,
  );
  private readonly currentTexture = this.createFieldTexture(this.currentBytes);
  private readonly poolGeometry = new PlaneGeometry(
    POOL_WORLD.width,
    POOL_WORLD.depth,
    POOL_GRID.cols - 1,
    POOL_GRID.rows - 1,
  );
  private readonly poolMaterial: ShaderMaterial;
  private readonly cursorGeometry = new BufferGeometry();
  private readonly cursorPositions: Float32Array;
  private readonly cursorColors: Float32Array;
  private readonly cursorTexture = createCursorTexture();
  private readonly cursorMaterial = new PointsMaterial({
    size: 8,
    sizeAttenuation: false,
    map: this.cursorTexture,
    transparent: true,
    opacity: 0.95,
    vertexColors: true,
    depthTest: false,
    depthWrite: false,
  });
  private readonly cursorPoints: Points;
  private readonly viewpointGeometry = new ConeGeometry(19, 54, 6);
  private readonly viewpointMaterials: MeshBasicMaterial[] = [];
  private readonly viewpointMarkers: InstancedMesh[] = [];
  private readonly viewpointToneCounts = new Uint16Array(TONE_COLORS.length);
  private readonly viewpointLineGeometry = new BufferGeometry();
  private readonly viewpointLinePositions: Float32Array;
  private readonly viewpointLineColors: Float32Array;
  private readonly viewpointLineMaterial = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.68,
    depthTest: false,
    depthWrite: false,
  });
  private readonly viewpointLines: LineSegments;
  private readonly viewpointTransform = new Object3D();
  private readonly viewpointDirection = new Vector3();
  private readonly viewpointUp = new Vector3(0, 1, 0);
  private readonly boatGroup = new Group();
  private readonly boatGeometries: BufferGeometry[] = [];
  private readonly boatMaterials: MeshBasicMaterial[] = [];
  private readonly boatPreviousRotation = new Quaternion();
  private readonly boatCurrentRotation = new Quaternion();
  private readonly basinGeometries: BufferGeometry[] = [];
  private readonly basinMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly floorMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly intersection = new Vector3();
  private readonly surfacePlane = new Plane(new Vector3(0, 1, 0), 0);
  private readonly reducedMotion: boolean;
  private readonly visualHeightScale = POOL_PRESENTATION_HEIGHT_SCALE;

  private animationFrame: number | null = null;
  private fieldVersion = -1;
  private cursorVersion = -1;
  private viewpointVersion = -1;
  private boatVersion = -1;
  private width = 0;
  private height = 0;
  private cameraAzimuth = 0;
  private cameraElevation = 0.63;
  private cameraRadius = 1_630;
  private viewportDistanceScale = 1;
  private cameraDirty = true;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly field: PoolField,
    private readonly cursors: CursorBuffer,
    private readonly viewpoints: ViewpointBuffer,
    private readonly boat: BoatBuffer,
    options: PoolRendererOptions = {},
  ) {
    this.reducedMotion = options.reducedMotion ?? false;
    this.cameraAzimuth = options.initialAzimuth ?? 0;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.applyCameraPose();

    this.addBasin();

    this.poolMaterial = new ShaderMaterial({
      uniforms: {
        previousField: { value: this.previousTexture },
        currentField: { value: this.currentTexture },
        frameMix: { value: 1 },
        heightMax: { value: POOL_HEIGHT_MAX },
        visualHeightScale: { value: this.visualHeightScale },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      wireframe: true,
    });
    // The geometry is already horizontal, so the shader displaces its Y axis.
    this.poolGeometry.rotateX(-Math.PI / 2);
    this.scene.add(new Mesh(this.poolGeometry, this.poolMaterial));

    this.cursorPositions = new Float32Array(cursors.capacity * 3);
    this.cursorColors = new Float32Array(cursors.capacity * 3);
    this.cursorGeometry.setAttribute(
      "position",
      new BufferAttribute(this.cursorPositions, 3),
    );
    this.cursorGeometry.setAttribute(
      "color",
      new BufferAttribute(this.cursorColors, 3),
    );
    this.cursorGeometry.setDrawRange(0, 0);
    this.cursorPoints = new Points(this.cursorGeometry, this.cursorMaterial);
    this.cursorPoints.renderOrder = 2;
    this.scene.add(this.cursorPoints);

    // Explicit tone materials avoid the fragile instanced-color shader path and
    // guarantee that a marker matches its participant's facepile color.
    for (const color of TONE_COLORS) {
      const material = new MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.96,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const markers = new InstancedMesh(
        this.viewpointGeometry,
        material,
        viewpoints.capacity,
      );
      markers.count = 0;
      markers.frustumCulled = false;
      markers.renderOrder = 3;
      this.viewpointMaterials.push(material);
      this.viewpointMarkers.push(markers);
      this.scene.add(markers);
    }

    this.viewpointLinePositions = new Float32Array(viewpoints.capacity * 6);
    this.viewpointLineColors = new Float32Array(viewpoints.capacity * 6);
    this.viewpointLineGeometry.setAttribute(
      "position",
      new BufferAttribute(this.viewpointLinePositions, 3),
    );
    this.viewpointLineGeometry.setAttribute(
      "color",
      new BufferAttribute(this.viewpointLineColors, 3),
    );
    this.viewpointLineGeometry.setDrawRange(0, 0);
    this.viewpointLines = new LineSegments(
      this.viewpointLineGeometry,
      this.viewpointLineMaterial,
    );
    this.viewpointLines.frustumCulled = false;
    this.viewpointLines.renderOrder = 3;
    this.scene.add(this.viewpointLines);

    this.addBoat();

    this.resize();
  }

  start(): void {
    if (this.disposed || this.animationFrame !== null) return;
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  }

  stop(): void {
    if (this.animationFrame === null) return;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  project(fractionX: number, fractionY: number): PoolWorldPoint | null {
    if (
      !Number.isFinite(fractionX) ||
      !Number.isFinite(fractionY) ||
      fractionX < 0 ||
      fractionX > 1 ||
      fractionY < 0 ||
      fractionY > 1
    ) {
      return null;
    }

    this.ndc.set(fractionX * 2 - 1, 1 - fractionY * 2);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (
      !this.raycaster.ray.intersectPlane(this.surfacePlane, this.intersection)
    ) {
      return null;
    }

    const x = this.intersection.x + POOL_WORLD.width / 2;
    const z = this.intersection.z + POOL_WORLD.depth / 2;
    if (x < 0 || x > POOL_WORLD.width || z < 0 || z > POOL_WORLD.depth) {
      return null;
    }
    return { x, z };
  }

  orbit(deltaX: number, deltaY: number): void {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    this.cameraAzimuth -= deltaX * 0.005;
    this.cameraElevation = Math.min(
      1.18,
      Math.max(0.28, this.cameraElevation + deltaY * 0.004),
    );
    this.applyCameraPose();
    this.cameraDirty = true;
  }

  zoom(deltaY: number): void {
    if (!Number.isFinite(deltaY)) return;
    this.cameraRadius = Math.min(
      2_800,
      Math.max(1_100, this.cameraRadius * Math.exp(deltaY * 0.001)),
    );
    this.applyCameraPose();
    this.cameraDirty = true;
  }

  viewpoint(): PoolViewpoint {
    this.resize();
    return {
      x: this.camera.position.x + POOL_WORLD.width / 2,
      y: this.camera.position.y,
      z: this.camera.position.z + POOL_WORLD.depth / 2,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.poolGeometry.dispose();
    this.poolMaterial.dispose();
    this.previousTexture.dispose();
    this.currentTexture.dispose();
    this.cursorGeometry.dispose();
    this.cursorMaterial.dispose();
    this.cursorTexture.dispose();
    this.viewpointGeometry.dispose();
    this.viewpointMaterials.forEach((material) => material.dispose());
    this.viewpointLineGeometry.dispose();
    this.viewpointLineMaterial.dispose();
    this.boatGeometries.forEach((geometry) => geometry.dispose());
    this.boatMaterials.forEach((material) => material.dispose());
    this.basinGeometries.forEach((geometry) => geometry.dispose());
    this.basinMaterial.dispose();
    this.floorMaterial.dispose();
    this.renderer.dispose();
  }

  private readonly renderFrame = (nowMs: number): void => {
    this.animationFrame = null;
    if (this.disposed) return;

    const resized = this.resize();
    const fieldChanged = this.syncField();
    const alpha = this.reducedMotion
      ? 1
      : Math.min(
          1,
          Math.max(
            0,
            (nowMs - this.field.receivedAtMs) / POOL_BROADCAST_INTERVAL_MS,
          ),
        );
    this.poolMaterial.uniforms.frameMix.value = alpha;
    const cursorsChanged = this.syncCursors(alpha);
    const viewpointsChanged = this.syncViewpoints();
    const boatChanged = this.syncBoat(
      this.reducedMotion
        ? 1
        : Math.min(
            1,
            Math.max(
              0,
              (nowMs - this.boat.receivedAtMs) /
                (this.boat.interpolationIntervalMs * 1.15),
            ),
          ),
    );
    const cameraChanged = this.cameraDirty;
    this.cameraDirty = false;
    if (
      !this.reducedMotion ||
      resized ||
      fieldChanged ||
      cursorsChanged ||
      viewpointsChanged ||
      boatChanged ||
      cameraChanged
    ) {
      this.renderer.render(this.scene, this.camera);
    }
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  };

  private resize(): boolean {
    const width = Math.max(1, Math.floor(this.canvas.clientWidth));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight));
    if (width === this.width && height === this.height) return false;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    // Pull back on portrait surfaces so the fixed-width world is never
    // cropped merely because the canvas is taller on a phone.
    this.viewportDistanceScale = Math.max(1, 16 / 9 / aspect);
    this.camera.aspect = aspect;
    this.applyCameraPose();
    this.camera.updateProjectionMatrix();
    return true;
  }

  private syncField(): boolean {
    if (this.fieldVersion === this.field.version) return false;
    this.fieldVersion = this.field.version;
    for (let index = 0; index < POOL_CELL_COUNT; index += 1) {
      this.previousBytes[index] = (this.field.previous[index] ?? 0) + 128;
      this.currentBytes[index] = (this.field.current[index] ?? 0) + 128;
    }
    this.previousTexture.needsUpdate = true;
    this.currentTexture.needsUpdate = true;
    return true;
  }

  private syncCursors(alpha: number): boolean {
    const cursorChanged = this.cursorVersion !== this.cursors.version;
    this.cursorVersion = this.cursors.version;
    for (let index = 0; index < this.cursors.count; index += 1) {
      const sourceOffset = index * 2;
      const targetOffset = index * 3;
      const x = this.cursors.positions[sourceOffset] ?? 0;
      const z = this.cursors.positions[sourceOffset + 1] ?? 0;
      this.cursorPositions[targetOffset] = x - POOL_WORLD.width / 2;
      this.cursorPositions[targetOffset + 1] =
        this.field.heightAt(x, z, alpha) * this.visualHeightScale + 22;
      this.cursorPositions[targetOffset + 2] = z - POOL_WORLD.depth / 2;

      if (cursorChanged) {
        const color =
          TONE_COLORS[this.cursors.tones[index] ?? 0] ?? TONE_COLORS[0];
        this.cursorColors[targetOffset] = color.r;
        this.cursorColors[targetOffset + 1] = color.g;
        this.cursorColors[targetOffset + 2] = color.b;
      }
    }
    this.cursorGeometry.setDrawRange(0, this.cursors.count);
    const position = this.cursorGeometry.getAttribute("position");
    position.needsUpdate = true;
    if (cursorChanged) {
      this.cursorGeometry.getAttribute("color").needsUpdate = true;
    }
    return cursorChanged;
  }

  private syncViewpoints(): boolean {
    if (this.viewpointVersion === this.viewpoints.version) return false;
    this.viewpointVersion = this.viewpoints.version;
    this.viewpointToneCounts.fill(0);
    for (let index = 0; index < this.viewpoints.count; index += 1) {
      const offset = index * 3;
      const x = (this.viewpoints.positions[offset] ?? 0) - POOL_WORLD.width / 2;
      const y = this.viewpoints.positions[offset + 1] ?? 0;
      const z =
        (this.viewpoints.positions[offset + 2] ?? 0) - POOL_WORLD.depth / 2;
      this.viewpointTransform.position.set(x, y, z);
      this.viewpointDirection.set(-x, -y, -z).normalize();
      this.viewpointTransform.quaternion.setFromUnitVectors(
        this.viewpointUp,
        this.viewpointDirection,
      );
      this.viewpointTransform.updateMatrix();
      const tone = Math.min(
        TONE_COLORS.length - 1,
        this.viewpoints.tones[index] ?? 0,
      );
      const toneSlot = this.viewpointToneCounts[tone] ?? 0;
      this.viewpointMarkers[tone]?.setMatrixAt(
        toneSlot,
        this.viewpointTransform.matrix,
      );
      this.viewpointToneCounts[tone] = toneSlot + 1;

      const color = TONE_COLORS[tone] ?? TONE_COLORS[0];
      const lineOffset = index * 6;
      this.viewpointLinePositions[lineOffset] = x;
      this.viewpointLinePositions[lineOffset + 1] = 0;
      this.viewpointLinePositions[lineOffset + 2] = z;
      this.viewpointLinePositions[lineOffset + 3] = x;
      this.viewpointLinePositions[lineOffset + 4] = Math.max(0, y - 27);
      this.viewpointLinePositions[lineOffset + 5] = z;
      this.viewpointLineColors[lineOffset] = color.r;
      this.viewpointLineColors[lineOffset + 1] = color.g;
      this.viewpointLineColors[lineOffset + 2] = color.b;
      this.viewpointLineColors[lineOffset + 3] = color.r;
      this.viewpointLineColors[lineOffset + 4] = color.g;
      this.viewpointLineColors[lineOffset + 5] = color.b;
    }
    for (let tone = 0; tone < this.viewpointMarkers.length; tone += 1) {
      const markers = this.viewpointMarkers[tone];
      if (!markers) continue;
      markers.count = this.viewpointToneCounts[tone] ?? 0;
      markers.instanceMatrix.needsUpdate = true;
    }
    this.viewpointLineGeometry.setDrawRange(0, this.viewpoints.count * 2);
    this.viewpointLineGeometry.getAttribute("position").needsUpdate = true;
    this.viewpointLineGeometry.getAttribute("color").needsUpdate = true;
    return true;
  }

  private syncBoat(alpha: number): boolean {
    const changed = this.boatVersion !== this.boat.version;
    this.boatVersion = this.boat.version;
    this.boatGroup.visible = this.boat.epoch !== null;
    if (!this.boatGroup.visible) return changed;

    const previousPosition = this.boat.previousPosition;
    const currentPosition = this.boat.currentPosition;
    this.boatGroup.position.set(
      (previousPosition[0] ?? 0) +
        ((currentPosition[0] ?? 0) - (previousPosition[0] ?? 0)) * alpha -
        POOL_WORLD.width / 2,
      (previousPosition[1] ?? 0) +
        ((currentPosition[1] ?? 0) - (previousPosition[1] ?? 0)) * alpha,
      (previousPosition[2] ?? 0) +
        ((currentPosition[2] ?? 0) - (previousPosition[2] ?? 0)) * alpha -
        POOL_WORLD.depth / 2,
    );
    this.boatPreviousRotation.fromArray(this.boat.previousRotation);
    this.boatCurrentRotation.fromArray(this.boat.currentRotation);
    this.boatGroup.quaternion.slerpQuaternions(
      this.boatPreviousRotation,
      this.boatCurrentRotation,
      alpha,
    );
    return changed;
  }

  private applyCameraPose(): void {
    const radius = this.cameraRadius * this.viewportDistanceScale;
    const horizontalRadius = Math.cos(this.cameraElevation) * radius;
    this.camera.position.set(
      Math.sin(this.cameraAzimuth) * horizontalRadius,
      Math.sin(this.cameraElevation) * radius,
      Math.cos(this.cameraAzimuth) * horizontalRadius,
    );
    this.camera.lookAt(0, -20, 0);
  }

  private createFieldTexture(bytes: Uint8Array): DataTexture {
    bytes.fill(128);
    const texture = new DataTexture(
      bytes,
      POOL_GRID.cols,
      POOL_GRID.rows,
      RedFormat,
      UnsignedByteType,
    );
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
  }

  private addBasin(): void {
    const basinDepth = 125;
    const wallThickness = 34;
    const wallHeight = basinDepth + 12;
    const wallY = -basinDepth / 2 + 3;
    const halfWidth = POOL_WORLD.width / 2;
    const halfDepth = POOL_WORLD.depth / 2;

    const floor = new PlaneGeometry(POOL_WORLD.width, POOL_WORLD.depth, 16, 10);
    floor.rotateX(-Math.PI / 2);
    const floorMesh = new Mesh(floor, this.floorMaterial);
    floorMesh.position.y = -basinDepth;
    this.basinGeometries.push(floor);
    this.scene.add(floorMesh);

    const sideGeometry = new BoxGeometry(
      wallThickness,
      wallHeight,
      POOL_WORLD.depth + wallThickness * 2,
    );
    const endGeometry = new BoxGeometry(
      POOL_WORLD.width + wallThickness * 2,
      wallHeight,
      wallThickness,
    );
    this.basinGeometries.push(sideGeometry, endGeometry);

    for (const x of [
      -halfWidth - wallThickness / 2,
      halfWidth + wallThickness / 2,
    ]) {
      const wall = new Mesh(sideGeometry, this.basinMaterial);
      wall.position.set(x, wallY, 0);
      this.scene.add(wall);
    }
    for (const z of [
      -halfDepth - wallThickness / 2,
      halfDepth + wallThickness / 2,
    ]) {
      const wall = new Mesh(endGeometry, this.basinMaterial);
      wall.position.set(0, wallY, z);
      this.scene.add(wall);
    }
  }

  private addBoat(): void {
    const hullGeometry = new SphereGeometry(1, 20, 12);
    const deckGeometry = new BoxGeometry(76, 12, 112);
    const cabinGeometry = new BoxGeometry(42, 30, 48);
    const boatMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const hull = new Mesh(hullGeometry, boatMaterial);
    hull.scale.set(52, 25, 102);
    hull.position.y = 2;
    const deck = new Mesh(deckGeometry, boatMaterial);
    deck.position.y = 22;
    const cabin = new Mesh(cabinGeometry, boatMaterial);
    cabin.position.set(0, 43, -10);

    this.boatGeometries.push(hullGeometry, deckGeometry, cabinGeometry);
    this.boatMaterials.push(boatMaterial);
    this.boatGroup.add(hull, deck, cabin);
    this.boatGroup.visible = false;
    this.boatGroup.renderOrder = 2;
    this.scene.add(this.boatGroup);
  }
}

function createCursorTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(16, 16, 2, 16, 16, 15);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.48, "rgba(255, 255, 255, 0.95)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
