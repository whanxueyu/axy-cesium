<template>
  <div class="snow-scene">
    <Map
      mapType="gd"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      :duration="1.2"
      :loadTerrain="false"
      @loaded="handleMapLoaded"
    ></Map>
    <canvas ref="snowCanvasRef" class="snow-canvas"></canvas>

    <div :class="['weather-panel', { collapsed: !showPanel }]">
      <button
        v-if="showPanel"
        class="icon-button panel-close"
        type="button"
        title="收起"
        @click="togglePanel"
      >
        <el-icon size="18">
          <Close />
        </el-icon>
      </button>
      <button v-else class="panel-open" type="button" title="参数" @click="togglePanel">
        <el-icon size="24">
          <Grid />
        </el-icon>
      </button>

      <div v-if="showPanel" class="panel-content">
        <div class="panel-title">
          <el-icon size="18">
            <Cloudy />
          </el-icon>
          <span>雪效果</span>
          <button class="icon-button reset-button" type="button" title="重置" @click="resetSnow">
            <el-icon size="17">
              <RefreshRight />
            </el-icon>
          </button>
        </div>

        <div class="control-row">
          <span>雪量</span>
          <el-slider v-model="settings.intensity" :min="0.1" :max="1" :step="0.01"></el-slider>
        </div>
        <div class="control-row">
          <span>风向</span>
          <el-slider v-model="settings.windDirection" :min="0" :max="360" :step="1"></el-slider>
        </div>
        <div class="control-row">
          <span>风力</span>
          <el-slider v-model="settings.windPower" :min="0" :max="1" :step="0.01"></el-slider>
        </div>
        <div class="control-row">
          <span>飘速</span>
          <el-slider v-model="settings.speed" :min="0.35" :max="1.8" :step="0.01"></el-slider>
        </div>
        <div class="control-row">
          <span>雾化</span>
          <el-slider v-model="settings.fog" :min="0.1" :max="1" :step="0.01"></el-slider>
        </div>

        <div class="switch-row">
          <span>低空雪雾</span>
          <el-switch v-model="settings.groundMist"></el-switch>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import * as Cesium from 'cesium';
import Map from '@/components/cesium/map.vue';
import { Close, Cloudy, Grid, RefreshRight } from '@element-plus/icons-vue';

interface SnowParticle {
  x: number;
  y: number;
  depth: number;
  speedSeed: number;
  sizeSeed: number;
  swaySeed: number;
  phase: number;
  driftSeed: number;
  shapeSeed: number;
}

interface SnowflakeSprite {
  canvas: HTMLCanvasElement;
  center: number;
  radius: number;
}

interface SceneSnapshot {
  fogEnabled: boolean;
  fogRenderable: boolean;
  fogDensity: number;
  fogVisualDensityScalar: number;
  fogMaxHeight: number;
  fogMinimumBrightness: number;
  highDynamicRange: boolean;
  globeLighting: boolean;
  depthTestAgainstTerrain: boolean;
  baseColor: Cesium.Color;
  resolutionScale: number;
  skyAtmosphereShow?: boolean;
}

const SNOW_TOP_HEIGHT = 3400;
const CLOUD_TOP_HEIGHT = 4300;
const MAX_SNOW_PARTICLES = 12000;
const MAX_NEAR_DETAIL_PARTICLES = 640;
const SNOW_DIRECTION_VARIATION = 0.13;

const cameraDestination = {
  longitude: 116.397,
  latitude: 39.905,
  height: 1800,
};

const cameraOrientation = {
  heading: 28,
  pitch: -34,
  roll: 0,
};

const settings = reactive({
  intensity: 0.78,
  windDirection: 110,
  windPower: 0.28,
  speed: 0.85,
  fog: 0.46,
  groundMist: true,
});

const showPanel = ref(true);
const snowCanvasRef = ref<HTMLCanvasElement | null>(null);
const resolution = new Cesium.Cartesian2(1, 1);

let viewer: Cesium.Viewer | null = null;
let sceneSnapshot: SceneSnapshot | null = null;
let canvasContext: CanvasRenderingContext2D | null = null;
let animationFrameId = 0;
let lastFrameTime = 0;
let lastAtmosphereBucket = -1;
let weatherStrength = settings.intensity;
let snowParticles: SnowParticle[] = [];
const snowflakeSpriteCache = new globalThis.Map<number, SnowflakeSprite>();
let overcastGradient: CanvasGradient | null = null;
let overcastGradientKey = '';
let groundMistGradient: CanvasGradient | null = null;
let groundMistGradientKey = '';
let snowProjectionDirty = true;
let hasSnowCameraPose = false;
let hasSnowDirection = false;
let lastSnowWindDirection = Number.NaN;
let lastSnowWindPower = Number.NaN;
let lastSnowSpeed = Number.NaN;

const localOrigin = new Cesium.Cartesian3();
const localFrame = new Cesium.Matrix4();
const inverseLocalFrame = new Cesium.Matrix4();
const viewProjectionMatrix = new Cesium.Matrix4();
const localToClipMatrix = new Cesium.Matrix4();
const localCameraPosition = new Cesium.Cartesian3();
const localCameraDirection = new Cesium.Cartesian3();
const localStart = new Cesium.Cartesian3();
const localEnd = new Cesium.Cartesian3();
const screenStart = new Cesium.Cartesian2();
const screenEnd = new Cesium.Cartesian2();
const screenSnowDirection = {
  x: 0,
  y: 1,
};
const targetSnowDirection = {
  x: 0,
  y: 1,
};
const lastSnowCameraPosition = new Cesium.Cartesian3();
const lastSnowCameraDirection = new Cesium.Cartesian3();
const lastSnowCameraUp = new Cesium.Cartesian3();

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const resetSnow = () => {
  settings.intensity = 0.78;
  settings.windDirection = 110;
  settings.windPower = 0.28;
  settings.speed = 0.85;
  settings.fog = 0.46;
  settings.groundMist = true;
  snowProjectionDirty = true;
  syncSnowParticles(true);
  lastAtmosphereBucket = -1;
  updateSceneAtmosphere();
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  captureSceneState();
  applySceneSetup();
  snowProjectionDirty = true;
  syncSnowParticles(true);
  updateSceneAtmosphere();
};

const captureSceneState = () => {
  if (!viewer || sceneSnapshot) return;

  const scene = viewer.scene;
  sceneSnapshot = {
    fogEnabled: scene.fog.enabled,
    fogRenderable: scene.fog.renderable,
    fogDensity: scene.fog.density,
    fogVisualDensityScalar: scene.fog.visualDensityScalar,
    fogMaxHeight: scene.fog.maxHeight,
    fogMinimumBrightness: scene.fog.minimumBrightness,
    highDynamicRange: scene.highDynamicRange,
    globeLighting: scene.globe.enableLighting,
    depthTestAgainstTerrain: scene.globe.depthTestAgainstTerrain,
    baseColor: Cesium.Color.clone(scene.globe.baseColor),
    resolutionScale: viewer.resolutionScale,
    skyAtmosphereShow: scene.skyAtmosphere?.show,
  };
};

const applySceneSetup = () => {
  if (!viewer) return;

  const scene = viewer.scene;
  scene.highDynamicRange = scene.highDynamicRangeSupported;
  scene.globe.depthTestAgainstTerrain = false;
  scene.globe.enableLighting = true;
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#aab8bd');
  viewer.resolutionScale = 0.95;
  viewer.clock.shouldAnimate = true;
  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = true;
  }
};

const restoreSceneState = () => {
  if (!viewer || !sceneSnapshot) return;

  const scene = viewer.scene;
  scene.fog.enabled = sceneSnapshot.fogEnabled;
  scene.fog.renderable = sceneSnapshot.fogRenderable;
  scene.fog.density = sceneSnapshot.fogDensity;
  scene.fog.visualDensityScalar = sceneSnapshot.fogVisualDensityScalar;
  scene.fog.maxHeight = sceneSnapshot.fogMaxHeight;
  scene.fog.minimumBrightness = sceneSnapshot.fogMinimumBrightness;
  scene.highDynamicRange = sceneSnapshot.highDynamicRange;
  scene.globe.enableLighting = sceneSnapshot.globeLighting;
  scene.globe.depthTestAgainstTerrain = sceneSnapshot.depthTestAgainstTerrain;
  scene.globe.baseColor = sceneSnapshot.baseColor;
  viewer.resolutionScale = sceneSnapshot.resolutionScale;
  if (scene.skyAtmosphere && sceneSnapshot.skyAtmosphereShow !== undefined) {
    scene.skyAtmosphere.show = sceneSnapshot.skyAtmosphereShow;
  }
};

const getHeightFactorByHeight = (height: number) => {
  if (height >= CLOUD_TOP_HEIGHT) return 0;
  if (height <= SNOW_TOP_HEIGHT) return 1;

  const t = (height - SNOW_TOP_HEIGHT) / (CLOUD_TOP_HEIGHT - SNOW_TOP_HEIGHT);
  return 1 - t * t * (3 - 2 * t);
};

const getHeightFactor = () => {
  if (!viewer) return getHeightFactorByHeight(cameraDestination.height);

  return getHeightFactorByHeight(viewer.camera.positionCartographic.height);
};

const getNearGroundFactor = () => {
  if (!viewer) return 0;

  const height = viewer.camera.positionCartographic.height;
  if (height <= 420) return 1;
  if (height >= 1900) return 0;

  const t = (height - 420) / 1480;
  return 1 - t * t * (3 - 2 * t);
};

const updateSceneAtmosphere = () => {
  if (!viewer) return;

  const strength = settings.intensity * getHeightFactor();
  const bucket = Math.round((strength * 100) + (settings.fog * 20));
  if (bucket === lastAtmosphereBucket) return;
  lastAtmosphereBucket = bucket;

  const fog = viewer.scene.fog;
  fog.enabled = strength > 0.01;
  fog.renderable = strength > 0.01;
  fog.density = 0.00004 + settings.fog * strength * 0.00034;
  fog.visualDensityScalar = 0.08 + settings.fog * strength * 0.46;
  fog.maxHeight = CLOUD_TOP_HEIGHT;
  fog.minimumBrightness = 0.22;
};

const getWindVector = () => {
  const direction = Cesium.Math.toRadians(settings.windDirection);
  const windSpeed = settings.windPower * (24 + settings.speed * 26);

  return {
    x: Math.sin(direction) * windSpeed,
    y: Math.cos(direction) * windSpeed,
    directionX: Math.sin(direction),
    directionY: Math.cos(direction),
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getSnowflakeSprite = (radius: number) => {
  const radiusBucket = clamp(Math.round(radius * 2), 2, 20);
  const bucketRadius = radiusBucket * 0.5;
  const cached = snowflakeSpriteCache.get(radiusBucket);
  if (cached) return cached;

  const padding = 3;
  const size = Math.ceil(bucketRadius * 2 + padding * 2);
  const center = size * 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    const fallback = { canvas, center, radius: bucketRadius };
    snowflakeSpriteCache.set(radiusBucket, fallback);
    return fallback;
  }

  const gradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    bucketRadius,
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.24, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.82)');
  gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.42)');
  gradient.addColorStop(0.9, 'rgba(255, 255, 255, 0.1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(center, center, bucketRadius, 0, Math.PI * 2);
  context.fill();

  const sprite = { canvas, center, radius: bucketRadius };
  snowflakeSpriteCache.set(radiusBucket, sprite);
  return sprite;
};

const updateLocalFrame = () => {
  if (!viewer) return;

  const cartographic = viewer.camera.positionCartographic;
  Cesium.Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    0,
    Cesium.Ellipsoid.WGS84,
    localOrigin,
  );
  Cesium.Transforms.eastNorthUpToFixedFrame(localOrigin, Cesium.Ellipsoid.WGS84, localFrame);
};

const updateProjectionMatrix = () => {
  if (!viewer) return;

  Cesium.Matrix4.multiply(
    viewer.camera.frustum.projectionMatrix,
    viewer.camera.viewMatrix,
    viewProjectionMatrix,
  );
  Cesium.Matrix4.multiply(viewProjectionMatrix, localFrame, localToClipMatrix);
};

const projectLocalPoint = (
  east: number,
  north: number,
  height: number,
  width: number,
  viewportHeight: number,
  result: Cesium.Cartesian2,
) => {
  const matrix = localToClipMatrix;
  const clipX = matrix[0] * east + matrix[4] * north + matrix[8] * height + matrix[12];
  const clipY = matrix[1] * east + matrix[5] * north + matrix[9] * height + matrix[13];
  const clipW = matrix[3] * east + matrix[7] * north + matrix[11] * height + matrix[15];

  if (!Number.isFinite(clipW) || clipW <= 0.01) return false;

  const inverseW = 1 / clipW;
  result.x = (clipX * inverseW * 0.5 + 0.5) * width;
  result.y = (0.5 - clipY * inverseW * 0.5) * viewportHeight;
  return Number.isFinite(result.x) && Number.isFinite(result.y);
};

const getSnowVolume = () => {
  const cameraHeight = viewer?.camera.positionCartographic.height ?? cameraDestination.height;
  const radius = clamp(820 + cameraHeight * 0.46, 900, 2600);
  const top = Math.min(SNOW_TOP_HEIGHT, Math.max(520, cameraHeight + 850));
  const bottom = Math.max(20, Math.min(top - 180, cameraHeight - 1450));

  return {
    radius,
    bottom,
    top,
    height: top - bottom,
  };
};

const updateScreenSnowDirection = (
  volume: ReturnType<typeof getSnowVolume>,
  width: number,
  height: number,
  wind: ReturnType<typeof getWindVector>,
) => {
  if (!viewer) return;

  const cameraHeight = viewer.camera.positionCartographic.height;
  const sampleHeight = clamp(
    cameraHeight - Math.min(420, volume.height * 0.3),
    volume.bottom + 80,
    volume.top - 80,
  );
  const fallSpeed = (8 + settings.speed * 14) * 1.05;
  const velocityLength = Math.hypot(wind.x, wind.y, fallSpeed) || 1;
  const sampleTailMeters = 32;
  const lookAhead = Math.min(volume.radius * 0.45, 620);

  Cesium.Matrix4.inverseTransformation(localFrame, inverseLocalFrame);
  Cesium.Matrix4.multiplyByPoint(inverseLocalFrame, viewer.camera.positionWC, localCameraPosition);
  Cesium.Matrix4.multiplyByPointAsVector(
    inverseLocalFrame,
    viewer.camera.directionWC,
    localCameraDirection,
  );

  let sampleEast = localCameraPosition.x;
  let sampleNorth = localCameraPosition.y;
  const horizontalLength = Math.hypot(localCameraDirection.x, localCameraDirection.y) || 1;
  if (Math.abs(localCameraDirection.z) > 0.0001) {
    const viewPlaneDistance = (sampleHeight - localCameraPosition.z) / localCameraDirection.z;
    if (
      Number.isFinite(viewPlaneDistance) &&
      viewPlaneDistance > 20 &&
      viewPlaneDistance < volume.radius * 3
    ) {
      sampleEast += localCameraDirection.x * viewPlaneDistance;
      sampleNorth += localCameraDirection.y * viewPlaneDistance;
    } else {
      sampleEast += (localCameraDirection.x / horizontalLength) * lookAhead;
      sampleNorth += (localCameraDirection.y / horizontalLength) * lookAhead;
    }
  } else {
    sampleEast += (localCameraDirection.x / horizontalLength) * lookAhead;
    sampleNorth += (localCameraDirection.y / horizontalLength) * lookAhead;
  }

  sampleEast = clamp(sampleEast, -volume.radius * 0.65, volume.radius * 0.65);
  sampleNorth = clamp(sampleNorth, -volume.radius * 0.65, volume.radius * 0.65);

  localStart.x = sampleEast;
  localStart.y = sampleNorth;
  localStart.z = sampleHeight;
  // Project the actual falling velocity: horizontal wind plus downward gravity.
  localEnd.x = sampleEast + (wind.x / velocityLength) * sampleTailMeters;
  localEnd.y = sampleNorth + (wind.y / velocityLength) * sampleTailMeters;
  localEnd.z = sampleHeight - (fallSpeed / velocityLength) * sampleTailMeters;

  if (
    !projectLocalPoint(localStart.x, localStart.y, localStart.z, width, height, screenStart) ||
    !projectLocalPoint(localEnd.x, localEnd.y, localEnd.z, width, height, screenEnd)
  ) {
    targetSnowDirection.x = 0;
    targetSnowDirection.y = 1;
    return;
  }

  const dx = screenEnd.x - screenStart.x;
  const dy = screenEnd.y - screenStart.y;
  const projectedLength = Math.hypot(dx, dy);
  if (projectedLength < 0.35) {
    targetSnowDirection.x = 0;
    targetSnowDirection.y = 1;
    return;
  }

  const maxHorizontal = 0.05 + settings.windPower * 0.86;
  const minDownward = 0.94 - settings.windPower * 0.42;
  const directionX = clamp(dx / projectedLength, -maxHorizontal, maxHorizontal);
  const directionY = Math.max(dy / projectedLength, minDownward);
  const directionLength = Math.hypot(directionX, directionY) || 1;

  targetSnowDirection.x = directionX / directionLength;
  targetSnowDirection.y = directionY / directionLength;
};

const smoothSnowDirection = (dt: number) => {
  if (!hasSnowDirection) {
    screenSnowDirection.x = targetSnowDirection.x;
    screenSnowDirection.y = targetSnowDirection.y;
    hasSnowDirection = true;
    return;
  }

  const response = 1 - Math.exp(-Math.min(dt, 0.05) * 12);
  const nextX = screenSnowDirection.x
    + (targetSnowDirection.x - screenSnowDirection.x) * response;
  const nextY = screenSnowDirection.y
    + (targetSnowDirection.y - screenSnowDirection.y) * response;
  const length = Math.hypot(nextX, nextY) || 1;
  screenSnowDirection.x = nextX / length;
  screenSnowDirection.y = nextY / length;
};

const hasSnowCameraChanged = () => {
  if (!viewer) return false;

  const camera = viewer.camera;
  if (!hasSnowCameraPose) return true;

  return (
    Cesium.Cartesian3.distanceSquared(camera.positionWC, lastSnowCameraPosition) > 0.25 ||
    Cesium.Cartesian3.distanceSquared(camera.directionWC, lastSnowCameraDirection) > 0.00000001 ||
    Cesium.Cartesian3.distanceSquared(camera.upWC, lastSnowCameraUp) > 0.00000001
  );
};

const refreshSnowProjection = (
  volume: ReturnType<typeof getSnowVolume>,
  width: number,
  height: number,
  wind: ReturnType<typeof getWindVector>,
) => {
  if (!viewer) return;

  const windChanged = (
    settings.windDirection !== lastSnowWindDirection ||
    settings.windPower !== lastSnowWindPower ||
    settings.speed !== lastSnowSpeed
  );
  if (!snowProjectionDirty && !hasSnowCameraChanged() && !windChanged) return;

  updateLocalFrame();
  updateProjectionMatrix();
  updateScreenSnowDirection(volume, width, height, wind);
  Cesium.Cartesian3.clone(viewer.camera.positionWC, lastSnowCameraPosition);
  Cesium.Cartesian3.clone(viewer.camera.directionWC, lastSnowCameraDirection);
  Cesium.Cartesian3.clone(viewer.camera.upWC, lastSnowCameraUp);
  hasSnowCameraPose = true;
  lastSnowWindDirection = settings.windDirection;
  lastSnowWindPower = settings.windPower;
  lastSnowSpeed = settings.speed;
  snowProjectionDirty = false;
};

const placeSnowParticle = (particle: SnowParticle) => {
  const width = resolution.x || window.innerWidth;
  const height = resolution.y || window.innerHeight;
  const padding = Math.max(100, Math.max(width, height) * 0.12);

  // Fill the whole viewport and its buffer so particles do not emerge from
  // one visible diagonal band after the first frame.
  particle.x = -padding + Math.random() * (width + padding * 2);
  particle.y = -padding + Math.random() * (height + padding * 2);
};

const wrapSnowValue = (value: number, min: number, max: number) => {
  const span = max - min;
  return min + ((((value - min) % span) + span) % span);
};

const wrapSnowParticle = (
  particle: SnowParticle,
  width: number,
  height: number,
  padding: number,
) => {
  const minX = -padding;
  const maxX = width + padding;
  const minY = -padding;
  const maxY = height + padding;

  // Keep the emitter continuous. Appearance seeds are intentionally left
  // untouched so a wrapped flake cannot suddenly change its size.
  particle.x = wrapSnowValue(particle.x, minX, maxX);
  particle.y = wrapSnowValue(particle.y, minY, maxY);
};

const createSnowParticle = (): SnowParticle => {
  const particle: SnowParticle = {
    x: 0,
    y: 0,
    depth: Math.random(),
    speedSeed: 0.76 + Math.random() * 0.5,
    sizeSeed: 0.72 + Math.random() * 0.64,
    swaySeed: 0.7 + Math.random() * 0.9,
    phase: Math.random() * Math.PI * 2,
    driftSeed: Math.random(),
    shapeSeed: Math.random(),
  };
  placeSnowParticle(particle);
  return particle;
};

const syncSnowParticles = (refresh = false) => {
  const target = weatherStrength > 0.01
    ? Math.round(MAX_SNOW_PARTICLES * (0.18 + weatherStrength * 0.82))
    : 0;

  if (refresh) {
    snowParticles = Array.from({ length: target }, () => createSnowParticle());
    return;
  }

  while (snowParticles.length < target) {
    snowParticles.push(createSnowParticle());
  }
  if (snowParticles.length > target) {
    snowParticles.splice(target);
  }
};

const resizeCanvas = () => {
  const canvas = snowCanvasRef.value;
  if (!canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.1);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  resolution.x = width;
  resolution.y = height;

  canvasContext = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (canvasContext) {
    canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasContext.imageSmoothingEnabled = true;
  }
  overcastGradient = null;
  overcastGradientKey = '';
  groundMistGradient = null;
  groundMistGradientKey = '';
  snowProjectionDirty = true;
  syncSnowParticles(true);
};

const drawOvercast = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const overcast = settings.intensity * getHeightFactor();
  const coldness = settings.fog * overcast;
  const darkness = 0.06 + overcast * (0.16 + settings.fog * 0.12);

  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(12, 20, 24, ${darkness})`;
  context.fillRect(0, 0, width, height);

  context.fillStyle = `rgba(174, 190, 196, ${0.035 + overcast * 0.09})`;
  context.fillRect(0, 0, width, height);

  const veilKey = `${width}:${height}:${Math.round(coldness * 100)}`;
  if (veilKey !== overcastGradientKey) {
    overcastGradient = context.createLinearGradient(0, 0, 0, height);
    overcastGradient.addColorStop(0, `rgba(218, 230, 234, ${0.12 * coldness})`);
    overcastGradient.addColorStop(0.48, `rgba(193, 211, 218, ${0.08 * coldness})`);
    overcastGradient.addColorStop(1, `rgba(150, 174, 184, ${0.03 * coldness})`);
    overcastGradientKey = veilKey;
  }
  context.fillStyle = overcastGradient!;
  context.fillRect(0, 0, width, height);
};

const drawSnowParticles = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  dt: number,
  time: number,
) => {
  if (!viewer) return;

  const volume = getSnowVolume();
  const wind = getWindVector();
  refreshSnowProjection(volume, width, height, wind);
  smoothSnowDirection(dt);
  syncSnowParticles(false);

  const directionX = screenSnowDirection.x;
  const directionY = screenSnowDirection.y;
  const normalX = -directionY;
  const normalY = directionX;
  const fallBaseSpeed = 18 + settings.speed * 34;
  const padding = Math.max(100, Math.max(width, height) * 0.12);
  let nearDetailCount = 0;

  const farPath = new Path2D();
  const midPath = new Path2D();

  context.save();
  context.globalCompositeOperation = 'source-over';
  context.lineCap = 'round';
  context.globalAlpha = 1;

  for (let index = 0; index < snowParticles.length; index += 1) {
    const particle = snowParticles[index];
    const depth = particle.depth;
    const near = Math.min(Math.max((depth - 0.08) / 0.92, 0), 1);
    const nearCurve = near * near;
    const swayTime = time * (0.42 + particle.swaySeed * 0.24) + particle.phase;
    const sway = Math.sin(swayTime);
    const directionOffset = (particle.driftSeed - 0.5) * SNOW_DIRECTION_VARIATION
      + sway * (0.012 + settings.windPower * 0.06);
    const motionX = directionX - directionY * directionOffset;
    const motionY = directionY + directionX * directionOffset;
    const speed = fallBaseSpeed * particle.speedSeed * (0.62 + depth * 0.68);
    const lateralSway = sway
      * particle.swaySeed
      * (1.5 + settings.windPower * 12)
      * (0.35 + depth * 0.65);

    particle.x += (motionX * speed + normalX * lateralSway) * dt;
    particle.y += (motionY * speed + normalY * lateralSway) * dt;

    if (
      particle.x < -padding ||
      particle.x > width + padding ||
      particle.y < -padding ||
      particle.y > height + padding
    ) {
      wrapSnowParticle(particle, width, height, padding);
      continue;
    }

    const depthJitter = 0.86 + particle.sizeSeed * 0.24;
    const sizeScale = 0.45 + nearCurve * 5.6;
    const isNearDetail = depth >= 0.72 && nearDetailCount < MAX_NEAR_DETAIL_PARTICLES;

    if (isNearDetail) {
      nearDetailCount += 1;
      const radius = clamp(sizeScale * particle.sizeSeed * depthJitter, 1.1, 9.5);
      const sprite = getSnowflakeSprite(radius);
      context.drawImage(
        sprite.canvas,
        particle.x - sprite.center,
        particle.y - sprite.center,
      );
      continue;
    }

    const isMidDetail = depth >= 0.34;
    const simpleSize = Math.min(Math.max(0.58 + nearCurve * 2.7, 0.58), 4.1)
      * (0.9 + particle.sizeSeed * 0.14);
    const simpleLength = Math.min(
      Math.max(
        (0.35 + near * 3.6) * particle.sizeSeed * (isMidDetail ? 1 : 0.62),
        isMidDetail ? 0.8 : 0.5,
      ),
      isMidDetail ? 14 : 5.5,
    );
    const path = isMidDetail ? midPath : farPath;
    const drawDot = particle.shapeSeed < (isMidDetail ? 0.28 : 0.58);

    if (drawDot) {
      const dotHalfLength = simpleSize * 0.5;
      path.moveTo(
        particle.x - motionX * dotHalfLength,
        particle.y - motionY * dotHalfLength,
      );
      path.lineTo(
        particle.x + motionX * dotHalfLength,
        particle.y + motionY * dotHalfLength,
      );
      continue;
    }

    path.moveTo(particle.x, particle.y);
    path.lineTo(
      particle.x - motionX * simpleLength,
      particle.y - motionY * simpleLength,
    );
  }

  context.globalAlpha = 1;
  context.strokeStyle = '#e2eef2';
  context.lineWidth = 0.46;
  context.stroke(farPath);

  context.globalAlpha = 1;
  context.lineWidth = 0.78;
  context.stroke(midPath);

  context.restore();
};

const drawGroundMist = (context: CanvasRenderingContext2D, width: number, height: number) => {
  if (!settings.groundMist) return;

  const alpha = weatherStrength * getNearGroundFactor();
  if (alpha <= 0.01) return;

  const mistKey = `${width}:${height}:${Math.round(alpha * 100)}`;
  if (mistKey !== groundMistGradientKey) {
    groundMistGradient = context.createLinearGradient(0, height * 0.54, 0, height);
    groundMistGradient.addColorStop(0, 'rgba(224, 239, 244, 0)');
    groundMistGradient.addColorStop(0.72, `rgba(224, 239, 244, ${0.08 * alpha})`);
    groundMistGradient.addColorStop(1, `rgba(224, 239, 244, ${0.16 * alpha})`);
    groundMistGradientKey = mistKey;
  }
  context.fillStyle = groundMistGradient!;
  context.fillRect(0, 0, width, height);
};

const drawFrame = (dt: number, time: number) => {
  const context = canvasContext;
  if (!context) return;

  const width = resolution.x;
  const height = resolution.y;
  weatherStrength = settings.intensity * getHeightFactor();
  updateSceneAtmosphere();

  context.clearRect(0, 0, width, height);
  if (weatherStrength <= 0.01) {
    syncSnowParticles();
    return;
  }

  drawOvercast(context, width, height);
  drawGroundMist(context, width, height);
  drawSnowParticles(context, width, height, dt, time);
};

const animateSnow = (time: number) => {
  if (document.hidden) {
    lastFrameTime = time;
    animationFrameId = requestAnimationFrame(animateSnow);
    return;
  }

  const dt = Math.min((time - lastFrameTime) / 1000 || 0.016, 0.033);
  lastFrameTime = time;
  drawFrame(dt, time * 0.001);
  animationFrameId = requestAnimationFrame(animateSnow);
};

watch(() => settings.intensity, () => {
  syncSnowParticles();
});
watch(() => settings.fog, () => {
  lastAtmosphereBucket = -1;
  updateSceneAtmosphere();
});

onMounted(() => {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(animateSnow);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', resizeCanvas);
  snowParticles = [];
  snowflakeSpriteCache.clear();
  canvasContext = null;
  restoreSceneState();
});
</script>

<style scoped lang="scss">
.snow-scene {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #b2c0c5;
}

.snow-canvas {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: none;
}

.weather-panel {
  position: fixed;
  left: 16px;
  top: 76px;
  z-index: 2001;
  width: 286px;
  min-height: 334px;
  padding: 14px;
  color: #f7fcff;
  background: rgba(39, 57, 64, 0.76);
  border: 1px solid rgba(229, 244, 249, 0.28);
  border-radius: 8px;
  box-shadow: 0 14px 32px rgba(35, 58, 66, 0.28);
  backdrop-filter: blur(12px);
  user-select: none;

  &.collapsed {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    min-height: 42px;
    padding: 0;
    border-radius: 50%;
    background: rgba(84, 139, 157, 0.92);
  }
}

.panel-open,
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: #edfbff;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(232, 247, 251, 0.22);
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 0.18s,
    border-color 0.18s,
    background 0.18s;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(242, 251, 254, 0.46);
  }
}

.panel-open {
  width: 42px;
  height: 42px;
  border: 0;
  background: transparent;
}

.panel-close {
  position: absolute;
  top: 10px;
  right: 10px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding-right: 38px;
  font-size: 16px;
  font-weight: 600;
}

.reset-button {
  margin-left: auto;
}

.control-row {
  display: grid;
  grid-template-columns: 54px 1fr;
  align-items: center;
  gap: 12px;
  min-height: 34px;
  font-size: 13px;
  color: rgba(247, 253, 255, 0.9);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  font-size: 13px;
  color: rgba(247, 253, 255, 0.9);
}

:deep(.el-slider) {
  --el-slider-main-bg-color: #bdeaf5;
  --el-slider-runway-bg-color: rgba(231, 247, 251, 0.2);
  --el-slider-button-size: 14px;
  --el-slider-button-wrapper-size: 30px;
}

:deep(.el-switch) {
  --el-switch-on-color: #84cadb;
  --el-switch-off-color: rgba(231, 247, 251, 0.2);
}

@media (max-width: 640px) {
  .weather-panel {
    left: 10px;
    top: 64px;
    width: min(286px, calc(100vw - 20px));
  }
}
</style>
