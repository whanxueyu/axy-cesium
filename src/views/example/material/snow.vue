<template>
  <div class="snow-scene">
    <Map
      mapType="gd"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      :duration="1.4"
      :loadTerrain="true"
      @loaded="handleMapLoaded"
    ></Map>

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
          <span>程序化雪</span>
          <button class="icon-button reset-button" type="button" title="重置" @click="resetSnow">
            <el-icon size="17">
              <RefreshRight />
            </el-icon>
          </button>
        </div>

        <div class="switch-row">
          <span>降雪效果</span>
          <el-switch v-model="settings.fallingEnabled"></el-switch>
        </div>

        <div class="control-row">
          <span>降雪强度</span>
          <el-slider v-model="settings.intensity" :min="0" :max="1" :step="0.01"></el-slider>
        </div>
        <div class="control-row">
          <span>降雪速度</span>
          <el-slider v-model="settings.speed" :min="0.6" :max="2.4" :step="0.01"></el-slider>
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
          <span>雾化</span>
          <el-slider v-model="settings.fog" :min="0" :max="1" :step="0.01"></el-slider>
        </div>

        <div class="switch-row">
          <span>地面积雪</span>
          <el-switch v-model="settings.groundEnabled"></el-switch>
        </div>
        <div class="control-row">
          <span>积雪覆盖</span>
          <el-slider v-model="settings.coverage" :min="0" :max="1" :step="0.01"></el-slider>
        </div>
        <div class="control-row">
          <span>积雪增长</span>
          <el-slider v-model="settings.accumulationRate" :min="0" :max="1" :step="0.01"></el-slider>
        </div>
        <div class="control-row">
          <span>融化速度</span>
          <el-slider v-model="settings.meltRate" :min="0" :max="1" :step="0.01"></el-slider>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue';
import * as Cesium from 'cesium';
import Map from '@/components/cesium/map.vue';
import { Close, Cloudy, Grid, RefreshRight } from '@element-plus/icons-vue';

interface SceneSnapshot {
  globeLighting: boolean;
  globeMaterial: Cesium.Material | undefined;
  resolutionScale: number;
}

const RuntimeCesium = Cesium as any;

const SNOW_STATE_SIZE = 128;
const SNOW_AREA_RADIUS = 9000;
const SNOW_AREA_EDGE = 1700;
const SNOW_TOP_HEIGHT = 3800;
const SNOW_FADE_START_HEIGHT = 3200;
const SNOW_FADE_END_HEIGHT = 8000;
const SNOW_STATE_UPDATE_INTERVAL = 180;
const SNOW_POST_PROCESS_SCALE = 0.72;

const cameraDestination = {
  longitude: 116,
  latitude: 39.88,
  height: 1800,
};

const cameraOrientation = {
  heading: 28,
  pitch: -34,
  roll: 0,
};

const settings = reactive({
  fallingEnabled: true,
  groundEnabled: true,
  intensity: 0.72,
  coverage: 0.78,
  windDirection: 110,
  windPower: 0.24,
  speed: 1.15,
  fog: 0.32,
  accumulationRate: 0.55,
  meltRate: 0.08,
});

const showPanel = ref(true);

let viewer: Cesium.Viewer | null = null;
let sceneSnapshot: SceneSnapshot | null = null;
let snowMaterial: Cesium.Material | null = null;
let snowStage: Cesium.PostProcessStage | null = null;
let snowStateTexture: any = null;
let removePreUpdateListener: (() => void) | null = null;
let simulationTime = 0;
let lastSimulationTimestamp = 0;
let lastSnowStateTimestamp = 0;

const snowStateData = new Uint8Array(SNOW_STATE_SIZE * SNOW_STATE_SIZE * 4);
const snowStateSource = {
  width: SNOW_STATE_SIZE,
  height: SNOW_STATE_SIZE,
  arrayBufferView: snowStateData,
};

const snowOrigin = Cesium.Cartesian3.fromDegrees(
  cameraDestination.longitude,
  cameraDestination.latitude,
  0,
);
const snowFrame = Cesium.Transforms.eastNorthUpToFixedFrame(
  snowOrigin,
  Cesium.Ellipsoid.WGS84,
);
const snowWorldToLocal = Cesium.Matrix4.inverseTransformation(
  snowFrame,
  new Cesium.Matrix4(),
);
const snowEast = new Cesium.Cartesian3(snowFrame[0], snowFrame[1], snowFrame[2]);
const snowNorth = new Cesium.Cartesian3(snowFrame[4], snowFrame[5], snowFrame[6]);
const snowUp = new Cesium.Cartesian3(snowFrame[8], snowFrame[9], snowFrame[10]);
const cameraLocal = new Cesium.Cartesian3();
const windLocal = new Cesium.Cartesian3();
const screenVelocity = new Cesium.Cartesian2(0, 170);
const snowResolution = new Cesium.Cartesian2(1, 1);
const velocityWorld = new Cesium.Cartesian3();
const velocityScratch = new Cesium.Cartesian3();
const sampleStartWorld = new Cesium.Cartesian3();
const sampleEndWorld = new Cesium.Cartesian3();
const sampleWindowStart = new Cesium.Cartesian2();
const sampleWindowEnd = new Cesium.Cartesian2();

const SNOW_FRAGMENT_SHADER = `
#define SNOW_USE_DEPTH

uniform sampler2D colorTexture;
#ifdef SNOW_USE_DEPTH
uniform sampler2D depthTexture;
#endif

uniform vec3 snowCameraLocal;
uniform vec3 snowEast;
uniform vec3 snowNorth;
uniform vec3 snowUp;
uniform vec3 snowWind;
uniform vec2 snowScreenVelocity;
uniform vec2 snowResolution;
uniform float snowTime;
uniform float snowIntensity;
uniform float snowSpeed;
uniform float snowFog;
uniform float snowAreaRadius;
uniform float snowAreaEdge;
uniform float snowTopHeight;

in vec2 v_textureCoordinates;

float snowHash21(vec2 value)
{
    return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 snowRayEye(vec2 uv)
{
    vec2 ndc = vec2(
        uv.x * 2.0 - 1.0,
        (1.0 - uv.y) * 2.0 - 1.0
    );
    vec4 farPoint = czm_inverseProjection * vec4(ndc, 1.0, 1.0);
    return normalize(farPoint.xyz / farPoint.w);
}

float snowSurfaceDistance(vec2 uv, vec3 rayEye)
{
#ifdef SNOW_USE_DEPTH
    float depth = czm_readDepth(depthTexture, uv);
    if (depth < 0.99999)
    {
        vec2 ndc = vec2(
            uv.x * 2.0 - 1.0,
            (1.0 - uv.y) * 2.0 - 1.0
        );
        vec4 surfaceEye = czm_inverseProjection * vec4(ndc, depth, 1.0);
        surfaceEye /= surfaceEye.w;
        return clamp(dot(surfaceEye.xyz, rayEye), 4.0, 4600.0);
    }
#endif
    return 4600.0;
}

float snowScreenFlake(
    vec2 screenPosition,
    float cellSize,
    float radius,
    float chance,
    float seed,
    float speedScale
)
{
    float windBend = clamp(length(snowWind.xy) * 0.055, 0.0, 1.0);
    vec2 animated = screenPosition - snowScreenVelocity * snowTime * snowSpeed * speedScale;
    animated.x += sin(screenPosition.y * 0.012 + snowTime * (1.8 + seed)) * 12.0 * windBend;

    vec2 grid = animated / cellSize + vec2(seed * 37.0, seed * -19.0);
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float selected = step(snowHash21(cell + seed * 13.7), chance);
    vec2 center = vec2(
        snowHash21(cell + vec2(seed, 8.1)),
        snowHash21(cell + vec2(5.4, seed))
    ) - 0.5;
    center *= 0.68;
    float flakeRadius = radius * (0.72 + snowHash21(cell + seed * 31.0) * 0.55);
    float distanceToCenter = length(local - center);
    float edge = max(fwidth(distanceToCenter) * 1.6, 0.012);
    float disc = 1.0 - smoothstep(
        flakeRadius - edge,
        flakeRadius + edge,
        distanceToCenter
    );

    return selected * disc * (0.62 + snowHash21(cell + seed * 71.0) * 0.38);
}

float snowAreaMask(vec3 point)
{
    float radialDistance = length(point.xy);
    float radialMask = 1.0 - smoothstep(
        snowAreaRadius - snowAreaEdge,
        snowAreaRadius,
        radialDistance
    );
    float floorMask = smoothstep(0.0, 120.0, point.z);
    float ceilingMask = 1.0 - smoothstep(
        snowTopHeight - 460.0,
        snowTopHeight,
        point.z
    );
    return radialMask * floorMask * ceilingMask;
}

float snowLayer(
    vec3 rayLocal,
    float surfaceDistance,
    vec2 screenPosition,
    float layerDistance,
    float cellSize,
    float radius,
    float chance,
    float seed,
    float speedScale
)
{
    float depthMask = 1.0 - smoothstep(
        surfaceDistance - 30.0,
        surfaceDistance + 20.0,
        layerDistance
    );
    vec3 point = snowCameraLocal + rayLocal * layerDistance;
    float area = snowAreaMask(point);
    return area * depthMask * snowScreenFlake(
        screenPosition,
        cellSize,
        radius,
        chance,
        seed,
        speedScale
    );
}

void main()
{
    vec4 sceneColor = texture(colorTexture, v_textureCoordinates);
    float intensity = clamp(snowIntensity, 0.0, 1.0);

    if (intensity <= 0.001)
    {
        out_FragColor = sceneColor;
        return;
    }

    vec3 rayEye = snowRayEye(v_textureCoordinates);
    vec3 rayWorld = normalize((czm_inverseView * vec4(rayEye, 0.0)).xyz);
    vec3 rayLocal = vec3(
        dot(rayWorld, snowEast),
        dot(rayWorld, snowNorth),
        dot(rayWorld, snowUp)
    );

    float surfaceDistance = snowSurfaceDistance(
        v_textureCoordinates,
        rayEye
    );
    vec2 screenPosition = v_textureCoordinates * snowResolution;
    float density =
        snowLayer(rayLocal, surfaceDistance, screenPosition, 120.0, 62.0, 0.105, 0.34, 1.3, 1.32) * 0.95 +
        snowLayer(rayLocal, surfaceDistance, screenPosition, 260.0, 46.0, 0.086, 0.32, 2.7, 1.12) * 0.82 +
        snowLayer(rayLocal, surfaceDistance, screenPosition, 560.0, 32.0, 0.068, 0.38, 4.1, 0.92) * 0.62 +
        snowLayer(rayLocal, surfaceDistance, screenPosition, 1180.0, 23.0, 0.052, 0.45, 6.6, 0.72) * 0.45 +
        snowLayer(rayLocal, surfaceDistance, screenPosition, 2200.0, 17.0, 0.042, 0.55, 9.2, 0.56) * 0.32;

    float flakeAlpha = 1.0 - exp(
        -density * (0.72 + snowFog * 0.48) * intensity
    );
    flakeAlpha = clamp(flakeAlpha, 0.0, 0.44);

    float lowMist = snowFog * intensity * 0.012 * (
        1.0 - smoothstep(650.0, 3400.0, surfaceDistance)
    );
    float finalAlpha = clamp(flakeAlpha + lowMist, 0.0, 0.48);
    vec3 snowColor = vec3(0.95, 0.98, 1.0);

    out_FragColor = vec4(
        mix(sceneColor.rgb, snowColor, finalAlpha),
        sceneColor.a
    );
}
`;

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const clamp = (value: number, min: number, max: number) => (
  Math.min(Math.max(value, min), max)
);

const getSnowHeightFactorByHeight = (height: number) => {
  if (height <= SNOW_FADE_START_HEIGHT) return 1;
  if (height >= SNOW_FADE_END_HEIGHT) return 0;

  const progress = (
    height - SNOW_FADE_START_HEIGHT
  ) / (SNOW_FADE_END_HEIGHT - SNOW_FADE_START_HEIGHT);
  return 1 - progress * progress * (3 - 2 * progress);
};

const getCameraHeight = () => {
  if (!viewer) return cameraDestination.height;
  return Math.max(viewer.camera.positionCartographic.height, 0);
};

const getSnowHeightFactor = () => getSnowHeightFactorByHeight(getCameraHeight());

const jsStateNoise = (x: number, y: number) => {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const fillSnowState = () => {
  for (let y = 0; y < SNOW_STATE_SIZE; y += 1) {
    for (let x = 0; x < SNOW_STATE_SIZE; x += 1) {
      const noise = jsStateNoise(x + 0.37, y + 0.61);
      const broadVariation = Math.sin(x * 0.11) * Math.cos(y * 0.08) * 0.045;
      const value = clamp(0.58 + noise * 0.28 + broadVariation, 0.08, 1);
      const index = (y * SNOW_STATE_SIZE + x) * 4;
      const encoded = Math.round(value * 255);
      snowStateData[index] = encoded;
      snowStateData[index + 1] = encoded;
      snowStateData[index + 2] = encoded;
      snowStateData[index + 3] = 255;
    }
  }
};

const createSnowStateTexture = () => {
  if (!viewer) return null;

  const sampler = new RuntimeCesium.Sampler({
    wrapS: RuntimeCesium.TextureWrap.CLAMP_TO_EDGE,
    wrapT: RuntimeCesium.TextureWrap.CLAMP_TO_EDGE,
    minificationFilter: RuntimeCesium.TextureMinificationFilter.LINEAR,
    magnificationFilter: RuntimeCesium.TextureMagnificationFilter.LINEAR,
  });

  return new RuntimeCesium.Texture({
    context: (viewer.scene as any).context,
    width: SNOW_STATE_SIZE,
    height: SNOW_STATE_SIZE,
    pixelFormat: RuntimeCesium.PixelFormat.RGBA,
    pixelDatatype: RuntimeCesium.PixelDatatype.UNSIGNED_BYTE,
    source: snowStateSource,
    flipY: false,
    sampler,
  });
};

const uploadSnowState = () => {
  if (!snowStateTexture) return;

  snowStateTexture.copyFrom({
    source: snowStateSource,
    skipColorSpaceConversion: true,
  });
};

const getSnowVelocity = () => {
  const direction = Cesium.Math.toRadians(settings.windDirection);
  const horizontalSpeed = settings.windPower * (7 + settings.speed * 11);

  windLocal.x = Math.sin(direction) * horizontalSpeed;
  windLocal.y = Math.cos(direction) * horizontalSpeed;
  windLocal.z = 0;
};

const updateSnowResolution = () => {
  if (!viewer) return;

  const { canvas } = viewer.scene;
  snowResolution.x = Math.max(canvas.clientWidth, 1);
  snowResolution.y = Math.max(canvas.clientHeight, 1);
};

const updateScreenSnowVelocity = () => {
  if (!viewer) return;

  const scene = viewer.scene;
  const verticalSpeed = 18 + settings.speed * 30;
  const targetFallSpeed = 115 + settings.speed * 58;
  const fallbackWind = Math.sin(
    Cesium.Math.toRadians(settings.windDirection),
  ) * settings.windPower * 95;

  Cesium.Cartesian3.multiplyByScalar(snowEast, windLocal.x, velocityWorld);
  Cesium.Cartesian3.multiplyByScalar(snowNorth, windLocal.y, velocityScratch);
  Cesium.Cartesian3.add(velocityWorld, velocityScratch, velocityWorld);
  Cesium.Cartesian3.multiplyByScalar(snowUp, -verticalSpeed, velocityScratch);
  Cesium.Cartesian3.add(velocityWorld, velocityScratch, velocityWorld);

  const sampleDistance = clamp(getCameraHeight() * 0.38, 420, 1600);
  Cesium.Cartesian3.multiplyByScalar(
    viewer.camera.directionWC,
    sampleDistance,
    velocityScratch,
  );
  Cesium.Cartesian3.add(
    viewer.camera.positionWC,
    velocityScratch,
    sampleStartWorld,
  );
  Cesium.Cartesian3.add(sampleStartWorld, velocityWorld, sampleEndWorld);

  const startWindow = Cesium.SceneTransforms.worldToWindowCoordinates(
    scene,
    sampleStartWorld,
    sampleWindowStart,
  );
  const endWindow = Cesium.SceneTransforms.worldToWindowCoordinates(
    scene,
    sampleEndWorld,
    sampleWindowEnd,
  );

  if (!startWindow || !endWindow) {
    screenVelocity.x = fallbackWind;
    screenVelocity.y = -targetFallSpeed;
    return;
  }

  let projectedX = endWindow.x - startWindow.x;
  let projectedY = endWindow.y - startWindow.y;

  if (
    !Number.isFinite(projectedX) ||
    !Number.isFinite(projectedY) ||
    Math.abs(projectedX) + Math.abs(projectedY) < 0.001
  ) {
    screenVelocity.x = fallbackWind;
    screenVelocity.y = -targetFallSpeed;
    return;
  }

  if (projectedY < 0) {
    projectedX *= -1;
    projectedY *= -1;
  }

  const driftRatio = clamp(projectedX / Math.max(projectedY, 1), -1.35, 1.35);
  screenVelocity.x = driftRatio * targetFallSpeed + fallbackWind * 0.25;
  screenVelocity.y = -targetFallSpeed;
};

const updateCameraUniforms = () => {
  if (!viewer) return;

  updateSnowResolution();
  Cesium.Matrix4.multiplyByPoint(
    snowWorldToLocal,
    viewer.camera.positionWC,
    cameraLocal,
  );
  getSnowVelocity();
  updateScreenSnowVelocity();
};

const getSnowMaterialSource = (hasTerrainNormals: boolean) => {
  const terrainTiltMask = hasTerrainNormals
    ? '1.0 - smoothstep(0.34, 1.18, materialInput.slope)'
    : '1.0';

  return `
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec3 surfaceVectorWorld = (
        czm_inverseView * vec4(-materialInput.positionToEyeEC, 0.0)
    ).xyz;
    vec3 localPosition = snowCameraLocal + vec3(
        dot(surfaceVectorWorld, snowEast),
        dot(surfaceVectorWorld, snowNorth),
        dot(surfaceVectorWorld, snowUp)
    );
    float radialDistance = length(localPosition.xy);
    float areaMask = 1.0 - smoothstep(
        snowRadius - snowEdge,
        snowRadius,
        radialDistance
    );
    vec2 snowUv = localPosition.xy / (snowRadius * 2.0) + 0.5;
    float state = texture(
        snowState,
        clamp(snowUv, vec2(0.002), vec2(0.998))
    ).r;
    float terrainMask = ${terrainTiltMask};
    float accumulation = clamp(
        areaMask *
        state *
        snowCoverage *
        terrainMask *
        1.18,
        0.0,
        0.94
    );

    material.diffuse = mix(vec3(0.86, 0.91, 0.94), vec3(0.99, 1.0, 1.0), state);
    material.alpha = accumulation;
    material.specular = 0.16 * accumulation;
    material.shininess = 26.0;
    return material;
}
`;
};

const createSnowMaterial = () => {
  if (!viewer) return;

  fillSnowState();
  snowStateTexture = createSnowStateTexture();

  if (!snowStateTexture) return;

  const placeholder = document.createElement('canvas');
  placeholder.width = 1;
  placeholder.height = 1;

  const terrainProvider = (
    (viewer as any).terrainProvider ??
    (viewer.scene.globe as any).terrainProvider
  );
  const hasTerrainNormals = Boolean(terrainProvider?.hasVertexNormals);
  const material = new Cesium.Material({
    translucent: true,
    fabric: {
      uniforms: {
        snowState: placeholder,
        snowCameraLocal: cameraLocal,
        snowEast,
        snowNorth,
        snowUp,
        snowRadius: SNOW_AREA_RADIUS,
        snowEdge: SNOW_AREA_EDGE,
        snowCoverage: settings.coverage * getSnowHeightFactor(),
      },
      source: getSnowMaterialSource(hasTerrainNormals),
    },
  });

  // Fabric infers sampler2D from the placeholder. Replacing the value with
  // the live WebGL texture keeps the same GPU texture while the data changes.
  material.uniforms.snowState = snowStateTexture;
  snowMaterial = material;
  viewer.scene.globe.material = material;
};

const createSnowStage = () => {
  if (!viewer) return;

  const hasDepthTexture = Boolean((viewer.scene as any).context?.depthTexture);
  const fragmentShader = hasDepthTexture
    ? SNOW_FRAGMENT_SHADER
    : SNOW_FRAGMENT_SHADER.replace('#define SNOW_USE_DEPTH\n', '');

  snowStage = new Cesium.PostProcessStage({
    name: 'local-depth-snowfall',
    fragmentShader,
    textureScale: SNOW_POST_PROCESS_SCALE,
    sampleMode: Cesium.PostProcessStageSampleMode.LINEAR,
    uniforms: {
      snowCameraLocal: () => cameraLocal,
      snowEast: () => snowEast,
      snowNorth: () => snowNorth,
      snowUp: () => snowUp,
      snowWind: () => windLocal,
      snowScreenVelocity: () => screenVelocity,
      snowResolution: () => snowResolution,
      snowTime: () => simulationTime,
      snowIntensity: () => (
        settings.fallingEnabled
          ? settings.intensity * getSnowHeightFactor()
          : 0
      ),
      snowSpeed: () => 1.25 + settings.speed * 0.85,
      snowFog: () => settings.fog,
      snowAreaRadius: SNOW_AREA_RADIUS,
      snowAreaEdge: SNOW_AREA_EDGE,
      snowTopHeight: SNOW_TOP_HEIGHT,
    },
  });

  snowStage.enabled = settings.fallingEnabled && getSnowHeightFactor() > 0.001;
  viewer.scene.postProcessStages.add(snowStage);
};

const updateSnowState = (timestamp: number, deltaSeconds: number) => {
  if (
    !snowStateTexture ||
    timestamp - lastSnowStateTimestamp < SNOW_STATE_UPDATE_INTERVAL
  ) {
    return;
  }

  lastSnowStateTimestamp = timestamp;
  if (!settings.groundEnabled) return;

  const snowGain = settings.intensity * settings.accumulationRate * 0.012;
  const melt = settings.meltRate * 0.006;

  for (let y = 0; y < SNOW_STATE_SIZE; y += 1) {
    for (let x = 0; x < SNOW_STATE_SIZE; x += 1) {
      const index = (y * SNOW_STATE_SIZE + x) * 4;
      const current = snowStateData[index] / 255;
      const noise = 0.55 + jsStateNoise(x + 8.1, y + 3.7) * 0.45;
      const next = clamp(
        current + (snowGain * noise - melt) * deltaSeconds,
        0.02,
        1,
      );
      const encoded = Math.round(next * 255);
      snowStateData[index] = encoded;
      snowStateData[index + 1] = encoded;
      snowStateData[index + 2] = encoded;
    }
  }

  uploadSnowState();
};

const updateSnowFrame = () => {
  if (!viewer) return;

  const timestamp = performance.now();
  if (lastSimulationTimestamp === 0) {
    lastSimulationTimestamp = timestamp;
  }
  const deltaSeconds = clamp(
    (timestamp - lastSimulationTimestamp) / 1000,
    0.001,
    0.08,
  );
  lastSimulationTimestamp = timestamp;
  simulationTime += deltaSeconds;

  updateCameraUniforms();
  updateSnowState(timestamp, deltaSeconds);

  if (snowMaterial) {
    snowMaterial.uniforms.snowCoverage = settings.groundEnabled
      ? settings.coverage * getSnowHeightFactor()
      : 0;
  }

  if (snowStage) {
    snowStage.enabled = settings.fallingEnabled && getSnowHeightFactor() > 0.001;
  }
};

const captureSceneState = () => {
  if (!viewer || sceneSnapshot) return;

  sceneSnapshot = {
    globeLighting: viewer.scene.globe.enableLighting,
    globeMaterial: viewer.scene.globe.material,
    resolutionScale: viewer.resolutionScale,
  };
};

const applySceneSetup = () => {
  if (!viewer) return;

  viewer.scene.globe.enableLighting = false;
  viewer.resolutionScale = Math.min(viewer.resolutionScale, 0.92);
  viewer.clock.shouldAnimate = true;
  updateCameraUniforms();
  createSnowMaterial();
  createSnowStage();
  removePreUpdateListener = viewer.scene.preUpdate.addEventListener(updateSnowFrame);
};

const restoreSceneState = () => {
  if (!viewer || !sceneSnapshot) return;

  if (removePreUpdateListener) {
    removePreUpdateListener();
    removePreUpdateListener = null;
  }

  if (snowStage) {
    viewer.scene.postProcessStages.remove(snowStage);
    snowStage = null;
  }

  if (viewer.scene.globe.material === snowMaterial) {
    viewer.scene.globe.material = sceneSnapshot.globeMaterial;
  }

  if (snowMaterial) {
    snowMaterial.destroy();
    snowMaterial = null;
  }

  if (snowStateTexture && !snowStateTexture.isDestroyed()) {
    snowStateTexture.destroy();
  }
  snowStateTexture = null;

  viewer.scene.globe.enableLighting = sceneSnapshot.globeLighting;
  viewer.resolutionScale = sceneSnapshot.resolutionScale;
};

const resetSnow = () => {
  settings.fallingEnabled = true;
  settings.groundEnabled = true;
  settings.intensity = 0.72;
  settings.coverage = 0.78;
  settings.windDirection = 110;
  settings.windPower = 0.24;
  settings.speed = 1.15;
  settings.fog = 0.32;
  settings.accumulationRate = 0.55;
  settings.meltRate = 0.08;
  simulationTime = 0;
  lastSimulationTimestamp = performance.now();
  lastSnowStateTimestamp = 0;
  fillSnowState();
  uploadSnowState();
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  captureSceneState();
  applySceneSetup();
};

onBeforeUnmount(() => {
  restoreSceneState();
  viewer = null;
  sceneSnapshot = null;
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

.weather-panel {
  position: fixed;
  left: 16px;
  top: 76px;
  z-index: 2001;
  width: 300px;
  max-height: calc(100vh - 92px);
  padding: 14px;
  overflow-y: auto;
  color: #f7fcff;
  background: rgba(39, 57, 64, 0.82);
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
    max-height: 42px;
    padding: 0;
    overflow: hidden;
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
  gap: 11px;
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
  grid-template-columns: 66px 1fr;
  align-items: center;
  gap: 10px;
  min-height: 32px;
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
    width: min(300px, calc(100vw - 20px));
  }
}
</style>
