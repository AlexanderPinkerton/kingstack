import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DoubleSide,
  DirectionalLight,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Raycaster,
  RedFormat,
  Scene,
  ShaderMaterial,
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
  POOL_WORLD,
} from "@kingstack/shared";
import type { CursorBuffer } from "@/lib/pool/cursor-buffer";
import type { PoolField } from "@/lib/pool/pool-field";

const VERTEX_SHADER = /* glsl */ `
  uniform sampler2D previousField;
  uniform sampler2D currentField;
  uniform float frameMix;
  uniform float heightMax;
  uniform float visualHeightScale;

  varying float vHeight;
  varying vec2 vPoolUv;
  varying vec3 vWorldPosition;

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
    vPoolUv = poolUv;
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D previousField;
  uniform sampler2D currentField;
  uniform float frameMix;
  uniform float heightMax;
  uniform float visualHeightScale;
  uniform vec2 fieldTexel;
  uniform vec2 cellSize;
  uniform vec3 deepColor;
  uniform vec3 crestColor;
  uniform vec3 accentColor;

  varying float vHeight;
  varying vec2 vPoolUv;
  varying vec3 vWorldPosition;

  float sampleHeight(vec2 poolUv) {
    float previous = texture2D(previousField, poolUv).r * 255.0 - 128.0;
    float current = texture2D(currentField, poolUv).r * 255.0 - 128.0;
    float quantised = mix(previous, current, frameMix);
    return clamp(quantised / 127.0, -1.0, 1.0) * heightMax * visualHeightScale;
  }

  void main() {
    float crest = smoothstep(-0.15, 0.85, vHeight);
    float trough = smoothstep(0.0, 0.9, -vHeight);
    vec3 color = mix(deepColor, crestColor, crest * 0.72);
    color = mix(color, deepColor * 0.48, trough * 0.5);

    float left = sampleHeight(vPoolUv - vec2(fieldTexel.x, 0.0));
    float right = sampleHeight(vPoolUv + vec2(fieldTexel.x, 0.0));
    float nearHeight = sampleHeight(vPoolUv - vec2(0.0, fieldTexel.y));
    float farHeight = sampleHeight(vPoolUv + vec2(0.0, fieldTexel.y));
    vec3 normal = normalize(vec3(
      -(right - left) / (2.0 * cellSize.x) * 0.62,
      1.0,
      -(farHeight - nearHeight) / (2.0 * cellSize.y) * 0.62
    ));
    vec3 lightDirection = normalize(vec3(-0.35, 0.86, 0.38));
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 halfVector = normalize(lightDirection + viewDirection);
    float diffuse = 0.5 + max(dot(normal, lightDirection), 0.0) * 0.5;
    float specular = pow(max(dot(normal, halfVector), 0.0), 28.0);
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);

    color *= diffuse;
    color += mix(accentColor, vec3(0.72, 0.9, 0.96), 0.35) * specular * 0.26;
    color += accentColor * fresnel * 0.2;
    color = min(color, vec3(0.68, 0.9, 0.96));
    float alpha = 0.82 + fresnel * 0.14 + specular * 0.02;
    gl_FragColor = vec4(color, alpha);
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

export interface PoolRendererOptions {
  reducedMotion?: boolean;
  /** Presentation-only exaggeration; authoritative heights remain unchanged. */
  visualHeightScale?: number;
}

/** Owns all WebGL resources for one canvas. No React or MobX dependency. */
export class PoolRenderer implements PoolProjector {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(42, 1, 10, 5_000);
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
    size: 13,
    sizeAttenuation: false,
    map: this.cursorTexture,
    transparent: true,
    opacity: 0.95,
    vertexColors: true,
    depthTest: false,
    depthWrite: false,
  });
  private readonly cursorPoints: Points;
  private readonly basinGeometries: BufferGeometry[] = [];
  private readonly basinMaterial = new MeshStandardMaterial({
    color: 0x111c24,
    roughness: 0.58,
    metalness: 0.32,
  });
  private readonly floorMaterial = new MeshStandardMaterial({
    color: 0x06131b,
    roughness: 0.82,
    metalness: 0.12,
  });
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly intersection = new Vector3();
  private readonly surfacePlane = new Plane(new Vector3(0, 1, 0), 0);
  private readonly reducedMotion: boolean;
  private readonly visualHeightScale: number;

  private animationFrame: number | null = null;
  private fieldVersion = -1;
  private cursorVersion = -1;
  private width = 0;
  private height = 0;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly field: PoolField,
    private readonly cursors: CursorBuffer,
    options: PoolRendererOptions = {},
  ) {
    this.reducedMotion = options.reducedMotion ?? false;
    this.visualHeightScale = Math.min(
      3,
      Math.max(1, options.visualHeightScale ?? 2.2),
    );
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x070b11, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.camera.position.set(0, 960, 1_320);
    this.camera.lookAt(0, -20, 0);

    this.scene.add(new AmbientLight(0x77a6b8, 0.72));
    const keyLight = new DirectionalLight(0xc8f5ff, 2.4);
    keyLight.position.set(-520, 900, 620);
    this.scene.add(keyLight);
    this.addBasin();

    this.poolMaterial = new ShaderMaterial({
      uniforms: {
        previousField: { value: this.previousTexture },
        currentField: { value: this.currentTexture },
        frameMix: { value: 1 },
        heightMax: { value: POOL_HEIGHT_MAX },
        visualHeightScale: { value: this.visualHeightScale },
        fieldTexel: {
          value: new Vector2(
            1 / (POOL_GRID.cols - 1),
            1 / (POOL_GRID.rows - 1),
          ),
        },
        cellSize: {
          value: new Vector2(
            POOL_WORLD.width / (POOL_GRID.cols - 1),
            POOL_WORLD.depth / (POOL_GRID.rows - 1),
          ),
        },
        deepColor: { value: new Color(0x071c28) },
        crestColor: { value: new Color(0x2e9cb5) },
        accentColor: { value: new Color(0x8ee8ff) },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
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
    if (!this.reducedMotion || resized || fieldChanged || cursorsChanged) {
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
    const distanceScale = Math.max(1, 16 / 9 / aspect);
    this.camera.position.set(0, 960 * distanceScale, 1_320 * distanceScale);
    this.camera.lookAt(0, -20, 0);
    this.camera.aspect = aspect;
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

    const floor = new PlaneGeometry(POOL_WORLD.width, POOL_WORLD.depth);
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
