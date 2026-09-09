<template>
  <div class="rain-scene">
    <Map
      mapType="gd"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      :duration="1.2"
      :loadTerrain="false"
      :showStatusBar="false"
      :showCompass="false"
      @loaded="handleMapLoaded"
    ></Map>
    <canvas ref="rainCanvasRef" class="rain-canvas"></canvas>

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
          <span>真实雨效</span>
          <button class="icon-button reset-button" type="button" title="重置" @click="resetRain">
            <el-icon size="17">
              <RefreshRight />
            </el-icon>
          </button>
        </div>

        <div class="control-row">
          <span>雨量</span>
          <el-slider v-model="settings.intensity" :min="0.15" :max="1" :step="0.01"></el-slider>
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
          <span>雨速</span>
          <el-slider v-model="settings.speed" :min="0.5" :max="2.4" :step="0.01"></el-slider>
        </div>
        <div class="control-row">
          <span>雾化</span>
          <el-slider v-model="settings.fog" :min="0.1" :max="1" :step="0.01"></el-slider>
        </div>

        <div class="switch-row">
          <span>近地水雾</span>
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

interface RainParticle {
  east: number;
  north: number;
  height: number;
  depth: number;
  speedSeed: number;
  lengthSeed: number;
  widthSeed: number;
  alphaSeed: number;
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

const RAIN_TOP_HEIGHT = 3200;
const CLOUD_TOP_HEIGHT = 4300;
const MAX_RAIN_PARTICLES = 15000;
const NEAR_DETAIL_DISTANCE = 760;
const MID_DETAIL_DISTANCE = 1750;
const MAX_NEAR_DETAIL_PARTICLES = 1800;

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
  intensity: 0.86,
  windDirection: 115,
  windPower: 0.12,
  speed: 1.28,
  fog: 0.68,
  groundMist: true,
});

const showPanel = ref(true);
const rainCanvasRef = ref<HTMLCanvasElement | null>(null);
const resolution = new Cesium.Cartesian2(1, 1);

let viewer: Cesium.Viewer | null = null;
let sceneSnapshot: SceneSnapshot | null = null;
let canvasContext: CanvasRenderingContext2D | null = null;
let animationFrameId = 0;
let lastFrameTime = 0;
let lastAtmosphereBucket = -1;
let weatherStrength = settings.intensity;
let rainParticles: RainParticle[] = [];

const localOrigin = new Cesium.Cartesian3();
const localFrame = new Cesium.Matrix4();
const viewProjectionMatrix = new Cesium.Matrix4();
const localToClipMatrix = new Cesium.Matrix4();
const localStart = new Cesium.Cartesian3();
const localEnd = new Cesium.Cartesian3();
const screenStart = new Cesium.Cartesian2();
const screenEnd = new Cesium.Cartesian2();
const screenRainDirection = {
  x: 0,
  y: 1,
  pixelsPerMeter: 0,
  sampleDistance: 1,
};

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const resetRain = () => {
  settings.intensity = 0.86;
  settings.windDirection = 115;
  settings.windPower = 0.12;
  settings.speed = 1.28;
  settings.fog = 0.68;
  settings.groundMist = true;
  syncRainParticles(true);
  lastAtmosphereBucket = -1;
  updateSceneAtmosphere();
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  captureSceneState();
  applySceneSetup();
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
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#091016');
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
  if (height <= RAIN_TOP_HEIGHT) return 1;

  const t = (height - RAIN_TOP_HEIGHT) / (CLOUD_TOP_HEIGHT - RAIN_TOP_HEIGHT);
  return 1 - t * t * (3 - 2 * t);
};

const getHeightFactor = () => {
  if (!viewer) return getHeightFactorByHeight(cameraDestination.height);

  const height = viewer.camera.positionCartographic.height;
  return getHeightFactorByHeight(height);
};

const getNearGroundFactor = () => {
  if (!viewer) return 0;

  const height = viewer.camera.positionCartographic.height;
  if (height <= 420) return 1;
  if (height >= 1850) return 0;

  const t = (height - 420) / 1430;
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
  fog.density = 0.0001 + settings.fog * strength * 0.00056;
  fog.visualDensityScalar = 0.16 + settings.fog * strength * 0.7;
  fog.maxHeight = CLOUD_TOP_HEIGHT;
  fog.minimumBrightness = 0.035;
};

const getWindVector = () => {
  const direction = Cesium.Math.toRadians(settings.windDirection);
  return {
    x: Math.sin(direction) * settings.windPower,
    y: Math.cos(direction) * settings.windPower,
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

const getRainVolume = () => {
  const cameraHeight = viewer?.camera.positionCartographic.height ?? cameraDestination.height;
  const radius = clamp(760 + cameraHeight * 0.45, 820, 2400);
  const top = Math.min(RAIN_TOP_HEIGHT, Math.max(360, cameraHeight + 900));
  const bottom = Math.max(8, Math.min(top - 160, cameraHeight - 1400));

  return {
    radius,
    bottom,
    top,
    height: top - bottom,
  };
};

const getSpeedFactor = () => (settings.speed - 0.5) / 1.9;

const updateScreenRainDirection = (
  volume: ReturnType<typeof getRainVolume>,
  width: number,
  height: number,
  wind: ReturnType<typeof getWindVector>,
) => {
  if (!viewer) return;

  const cameraHeight = viewer.camera.positionCartographic.height;
  const sampleHeight = clamp(
    cameraHeight - Math.min(360, volume.height * 0.28),
    volume.bottom + 80,
    volume.top - 80,
  );
  const baseFallSpeed = 115 + settings.speed * 190;
  const lateralSpeed = baseFallSpeed * 0.5;
  const velocityLength = Math.hypot(wind.x * lateralSpeed, wind.y * lateralSpeed, baseFallSpeed) || 1;
  const sampleTailMeters = 32;

  localStart.x = 0;
  localStart.y = 0;
  localStart.z = sampleHeight;
  localEnd.x = -(wind.x * lateralSpeed / velocityLength) * sampleTailMeters;
  localEnd.y = -(wind.y * lateralSpeed / velocityLength) * sampleTailMeters;
  localEnd.z = sampleHeight + (baseFallSpeed / velocityLength) * sampleTailMeters;

  if (
    !projectLocalPoint(localStart.x, localStart.y, localStart.z, width, height, screenStart) ||
    !projectLocalPoint(localEnd.x, localEnd.y, localEnd.z, width, height, screenEnd)
  ) {
    screenRainDirection.x = 0;
    screenRainDirection.y = 1;
    screenRainDirection.pixelsPerMeter = 0;
    screenRainDirection.sampleDistance = 1;
    return;
  }

  const dx = screenEnd.x - screenStart.x;
  const dy = screenEnd.y - screenStart.y;
  const projectedLength = Math.hypot(dx, dy);
  if (projectedLength < 0.35) {
    screenRainDirection.x = 0;
    screenRainDirection.y = 1;
    screenRainDirection.pixelsPerMeter = 0;
    screenRainDirection.sampleDistance = 1;
    return;
  }

  screenRainDirection.x = dx / projectedLength;
  screenRainDirection.y = dy / projectedLength;
  screenRainDirection.pixelsPerMeter = projectedLength / sampleTailMeters;
  screenRainDirection.sampleDistance = Math.max(Math.abs(sampleHeight - cameraHeight), 1);
};

const createRainParticle = (spread = true): RainParticle => {
  const particle: RainParticle = {
    east: 0,
    north: 0,
    height: 0,
    depth: Math.random(),
    speedSeed: 0.72 + Math.random() * 0.56,
    lengthSeed: 0.72 + Math.random() * 0.62,
    widthSeed: 0.72 + Math.random() * 0.62,
    alphaSeed: 0.68 + Math.random() * 0.32,
  };
  resetRainParticle(particle, spread);
  return particle;
};

const resetRainParticle = (particle: RainParticle, spread = false) => {
  const volume = getRainVolume();

  particle.east = (Math.random() * 2 - 1) * volume.radius;
  particle.north = (Math.random() * 2 - 1) * volume.radius;
  particle.height = spread
    ? volume.bottom + Math.random() * volume.height
    : volume.top - Math.random() * Math.min(90, volume.height);
  particle.depth = Math.random();
  particle.speedSeed = 0.72 + Math.random() * 0.56;
  particle.lengthSeed = 0.72 + Math.random() * 0.62;
  particle.widthSeed = 0.72 + Math.random() * 0.62;
  particle.alphaSeed = 0.68 + Math.random() * 0.32;
};

const syncRainParticles = (refresh = false) => {
  const target = weatherStrength > 0.01
    ? Math.round(MAX_RAIN_PARTICLES * (0.22 + weatherStrength * 0.78))
    : 0;

  if (refresh) {
    rainParticles = Array.from({ length: target }, () => createRainParticle(true));
    return;
  }

  while (rainParticles.length < target) {
    rainParticles.push(createRainParticle(true));
  }
  if (rainParticles.length > target) {
    rainParticles.splice(target);
  }
};

const resizeCanvas = () => {
  const canvas = rainCanvasRef.value;
  if (!canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  resolution.x = width;
  resolution.y = height;

  canvasContext = canvas.getContext('2d', { alpha: true });
  if (canvasContext) {
    canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasContext.imageSmoothingEnabled = true;
  }
  syncRainParticles(true);
};

const drawAtmosphere = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const darkness = 0.1 + weatherStrength * 0.34;
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(3, 8, 12, ${darkness})`;
  context.fillRect(0, 0, width, height);

  const veil = context.createLinearGradient(0, 0, 0, height);
  const fogAlpha = settings.fog * weatherStrength;
  veil.addColorStop(0, `rgba(104, 126, 138, ${0.08 * fogAlpha})`);
  veil.addColorStop(0.46, `rgba(132, 150, 158, ${0.12 * fogAlpha})`);
  veil.addColorStop(1, `rgba(150, 164, 170, ${0.04 * fogAlpha})`);
  context.fillStyle = veil;
  context.fillRect(0, 0, width, height);

  const radius = Math.max(width, height) * 0.74;
  const vignette = context.createRadialGradient(width * 0.5, height * 0.5, radius * 0.28, width * 0.5, height * 0.5, radius);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, `rgba(0, 0, 0, ${0.16 + weatherStrength * 0.2})`);
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
};

const drawRainParticles = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  dt: number,
) => {
  if (!viewer) return;

  syncRainParticles(false);
  updateLocalFrame();
  updateProjectionMatrix();

  const speedFactor = getSpeedFactor();
  const volume = getRainVolume();
  const wind = getWindVector();
  const cameraHeight = viewer.camera.positionCartographic.height;
  const nearDistanceSq = NEAR_DETAIL_DISTANCE * NEAR_DETAIL_DISTANCE;
  const midDistanceSq = MID_DETAIL_DISTANCE * MID_DETAIL_DISTANCE;
  const visualRange = Math.max(MID_DETAIL_DISTANCE * 1.1, volume.radius * 1.2);
  const baseFallSpeed = 115 + settings.speed * 190;
  const baseTailMeters = 10 + speedFactor * 58;
  const padding = Math.max(160, Math.max(width, height) * 0.18);
  let nearDetailCount = 0;

  updateScreenRainDirection(volume, width, height, wind);

  const farPath = new Path2D();
  const midPath = new Path2D();
  const farDotPath = new Path2D();
  const midDotPath = new Path2D();

  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';

  for (const particle of rainParticles) {
    const fallSpeed = baseFallSpeed * particle.speedSeed;
    const lateralSpeed = fallSpeed * 0.5;
    const eastSpeed = wind.x * lateralSpeed;
    const northSpeed = wind.y * lateralSpeed;

    particle.east += eastSpeed * dt;
    particle.north += northSpeed * dt;
    particle.height -= fallSpeed * dt;

    if (
      particle.height < volume.bottom ||
      Math.abs(particle.east) > volume.radius ||
      Math.abs(particle.north) > volume.radius
    ) {
      resetRainParticle(particle, false);
      continue;
    }

    const relativeHeight = particle.height - cameraHeight;
    const distanceSq = particle.east * particle.east
      + particle.north * particle.north
      + relativeHeight * relativeHeight;
    const distance = Math.sqrt(Math.max(distanceSq, 1));
    const near = 1 - clamp((distance - 80) / visualRange, 0, 1);
    const nearCurve = near * near;

    localStart.x = particle.east;
    localStart.y = particle.north;
    localStart.z = particle.height;
    if (!projectLocalPoint(localStart.x, localStart.y, localStart.z, width, height, screenStart)) continue;
    if (
      screenStart.x < -padding ||
      screenStart.x > width + padding ||
      screenStart.y < -padding ||
      screenStart.y > height + padding
    ) {
      continue;
    }

    const depthJitter = 0.86 + particle.depth * 0.28;
    const sizeScale = 0.34 + nearCurve * 2.16;
    const opacityScale = 0.28 + nearCurve * 0.92;
    const isNearDetail = distanceSq <= nearDistanceSq && nearDetailCount < MAX_NEAR_DETAIL_PARTICLES;

    if (isNearDetail) {
      nearDetailCount += 1;
      const velocityLength = Math.hypot(eastSpeed, northSpeed, fallSpeed) || 1;
      const tailMeters = baseTailMeters * particle.lengthSeed * (0.72 + nearCurve * 0.58);

      localEnd.x = particle.east - (eastSpeed / velocityLength) * tailMeters;
      localEnd.y = particle.north - (northSpeed / velocityLength) * tailMeters;
      localEnd.z = particle.height + (fallSpeed / velocityLength) * tailMeters;

      if (!projectLocalPoint(localEnd.x, localEnd.y, localEnd.z, width, height, screenEnd)) continue;

      const dx = screenEnd.x - screenStart.x;
      const dy = screenEnd.y - screenStart.y;
      const projectedLength = Math.hypot(dx, dy);
      const alpha = Math.min(
        (0.16 + weatherStrength * 0.44) * particle.alphaSeed * opacityScale * depthJitter,
        0.76,
      );
      const lineWidth = clamp(sizeScale * particle.widthSeed * depthJitter, 0.42, 3.2);

      if (projectedLength < 1.2) {
        const radius = clamp(lineWidth * 0.76, 0.38, 1.8);
        context.fillStyle = `rgba(220, 240, 248, ${alpha * 0.72})`;
        context.beginPath();
        context.arc(screenStart.x, screenStart.y, radius, 0, Math.PI * 2);
        context.fill();
        continue;
      }

      const lengthLimit = (58 + speedFactor * 46) * (0.84 + near * 0.3);
      const scale = projectedLength > lengthLimit ? lengthLimit / projectedLength : 1;
      const tailX = screenStart.x + dx * scale;
      const tailY = screenStart.y + dy * scale;
      const gradient = context.createLinearGradient(screenStart.x, screenStart.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(235, 247, 255, ${alpha})`);
      gradient.addColorStop(0.42, `rgba(188, 218, 232, ${alpha * 0.48})`);
      gradient.addColorStop(1, 'rgba(188, 218, 232, 0)');

      context.strokeStyle = gradient;
      context.lineWidth = lineWidth;
      context.beginPath();
      context.moveTo(screenStart.x, screenStart.y);
      context.lineTo(tailX, tailY);
      context.stroke();
      continue;
    }

    const isMidDetail = distanceSq <= midDistanceSq;
    const simpleTailMeters = baseTailMeters
      * particle.lengthSeed
      * (isMidDetail ? 0.9 : 0.58);
    const perspectiveScale = clamp(screenRainDirection.sampleDistance / distance, 0.12, 1.1);
    const simpleLength = screenRainDirection.pixelsPerMeter * simpleTailMeters * perspectiveScale;
    const simpleSize = clamp(0.32 + nearCurve * 1.7, 0.32, 2.2) * (0.9 + particle.widthSeed * 0.16);

    if (simpleLength < 0.55 || screenRainDirection.pixelsPerMeter <= 0) {
      const dotPath = isMidDetail ? midDotPath : farDotPath;
      dotPath.rect(
        screenStart.x - simpleSize * 0.5,
        screenStart.y - simpleSize * 0.5,
        simpleSize,
        simpleSize,
      );
      continue;
    }

    const lineLength = clamp(simpleLength, isMidDetail ? 0.7 : 0.45, isMidDetail ? 18 : 7);
    const path = isMidDetail ? midPath : farPath;
    path.moveTo(screenStart.x, screenStart.y);
    path.lineTo(
      screenStart.x + screenRainDirection.x * lineLength,
      screenStart.y + screenRainDirection.y * lineLength,
    );
  }

  context.globalAlpha = Math.min(0.42, 0.1 + weatherStrength * 0.24);
  context.strokeStyle = '#c3dbe5';
  context.lineWidth = 0.42;
  context.stroke(farPath);
  context.fillStyle = '#c3dbe5';
  context.fill(farDotPath);

  context.globalAlpha = Math.min(0.62, 0.16 + weatherStrength * 0.34);
  context.lineWidth = 0.72;
  context.stroke(midPath);
  context.fill(midDotPath);

  context.restore();
};

const drawGroundMist = (context: CanvasRenderingContext2D, width: number, height: number) => {
  if (!settings.groundMist) return;

  const alpha = weatherStrength * getNearGroundFactor();
  if (alpha <= 0.01) return;

  const mist = context.createLinearGradient(0, height * 0.5, 0, height);
  mist.addColorStop(0, 'rgba(188, 207, 216, 0)');
  mist.addColorStop(0.75, `rgba(188, 207, 216, ${0.09 * alpha})`);
  mist.addColorStop(1, `rgba(188, 207, 216, ${0.16 * alpha})`);
  context.fillStyle = mist;
  context.fillRect(0, 0, width, height);
};

const drawFrame = (dt: number) => {
  const context = canvasContext;
  if (!context) return;

  const width = resolution.x;
  const height = resolution.y;
  weatherStrength = settings.intensity * getHeightFactor();
  updateSceneAtmosphere();

  context.clearRect(0, 0, width, height);
  if (weatherStrength <= 0.01) {
    syncRainParticles();
    return;
  }

  drawAtmosphere(context, width, height);
  drawRainParticles(context, width, height, dt);
  drawGroundMist(context, width, height);
};

const animateRain = (time: number) => {
  if (document.hidden) {
    lastFrameTime = time;
    animationFrameId = requestAnimationFrame(animateRain);
    return;
  }

  const dt = Math.min((time - lastFrameTime) / 1000 || 0.016, 0.033);
  lastFrameTime = time;
  drawFrame(dt);
  animationFrameId = requestAnimationFrame(animateRain);
};

watch(() => settings.intensity, () => {
  syncRainParticles();
});
watch(() => settings.fog, () => {
  lastAtmosphereBucket = -1;
  updateSceneAtmosphere();
});

onMounted(() => {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(animateRain);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', resizeCanvas);
  restoreSceneState();
});
</script>

<style scoped lang="scss">
.rain-scene {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #080d11;
}

.rain-canvas {
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
  color: #f4fbff;
  background: rgba(9, 17, 23, 0.78);
  border: 1px solid rgba(201, 227, 238, 0.18);
  border-radius: 8px;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.32);
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
    background: rgba(13, 123, 144, 0.9);
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
  color: #dff8ff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(209, 238, 247, 0.16);
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 0.18s,
    border-color 0.18s,
    background 0.18s;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(218, 242, 248, 0.36);
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
  color: rgba(241, 249, 252, 0.86);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  font-size: 13px;
  color: rgba(241, 249, 252, 0.86);
}

:deep(.el-slider) {
  --el-slider-main-bg-color: #68d5ed;
  --el-slider-runway-bg-color: rgba(226, 242, 247, 0.18);
  --el-slider-button-size: 14px;
  --el-slider-button-wrapper-size: 30px;
}

:deep(.el-switch) {
  --el-switch-on-color: #2eb7cc;
  --el-switch-off-color: rgba(226, 242, 247, 0.18);
}

@media (max-width: 640px) {
  .weather-panel {
    left: 10px;
    top: 64px;
    width: min(286px, calc(100vw - 20px));
  }
}
</style>
