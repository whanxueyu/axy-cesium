<template>
  <div class="fog-scene">
    <Map
      mapType="gd"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      :duration="1.4"
      :loadTerrain="true"
      @loaded="handleMapLoaded"
    ></Map>

    <div :class="['fog-panel', { collapsed: !showPanel }]">
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
          <span>高度雾</span>
          <button class="icon-button reset-button" type="button" title="重置" @click="resetFog">
            <el-icon size="17">
              <RefreshRight />
            </el-icon>
          </button>
        </div>

        <div class="switch-row">
          <span>启用</span>
          <el-switch v-model="settings.enabled"></el-switch>
        </div>
        <div class="control-row">
          <span>浓度</span>
          <el-slider
            v-model="settings.density"
            :min="0.1"
            :max="1.6"
            :step="0.01"
            :format-tooltip="formatRatio"
          ></el-slider>
        </div>
        <div class="control-row">
          <span>雾顶</span>
          <el-slider
            v-model="settings.topHeight"
            :min="400"
            :max="4200"
            :step="10"
            :format-tooltip="formatMeters"
          ></el-slider>
        </div>
        <div class="control-row">
          <span>雾底</span>
          <el-slider
            v-model="settings.baseHeight"
            :min="-200"
            :max="1400"
            :step="10"
            :format-tooltip="formatMeters"
          ></el-slider>
        </div>
        <div class="control-row">
          <span>起雾</span>
          <el-slider
            v-model="settings.startDistance"
            :min="0"
            :max="900"
            :step="10"
            :format-tooltip="formatMeters"
          ></el-slider>
        </div>
        <div class="control-row">
          <span>贴地</span>
          <el-slider
            v-model="settings.valleyStrength"
            :min="0"
            :max="1"
            :step="0.01"
            :format-tooltip="formatRatio"
          ></el-slider>
        </div>
        <div class="control-row">
          <span>扰动</span>
          <el-slider
            v-model="settings.noiseStrength"
            :min="0"
            :max="0.55"
            :step="0.01"
            :format-tooltip="formatRatio"
          ></el-slider>
        </div>
        <div class="switch-row">
          <span>流动</span>
          <el-switch v-model="settings.flow"></el-switch>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue';
import * as Cesium from 'cesium';
import Map from '@/components/cesium/map.vue';
import { Close, Cloudy, Grid, RefreshRight } from '@element-plus/icons-vue';

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

const cameraDestination = {
  longitude: 110.31,
  latitude: 31.48,
  height: 3000,
};

const cameraOrientation = {
  heading: 60,
  pitch: -15,
  roll: 0,
};

const settings = reactive({
  enabled: true,
  density: 0.84,
  topHeight: 1700,
  baseHeight: 60,
  startDistance: 100,
  valleyStrength: 0.82,
  noiseStrength: 0.22,
  flow: true,
});

const showPanel = ref(true);
const fogColor = Cesium.Color.fromCssColorString('#dce2df');

let viewer: Cesium.Viewer | null = null;
let sceneSnapshot: SceneSnapshot | null = null;
let heightFogStage: Cesium.PostProcessStage | null = null;
let stageStartTime = 0;

const heightFogFragmentShader = `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float u_earthRadiusOnCamera;
uniform float u_fogBaseHeight;
uniform float u_fogTopHeight;
uniform float u_globalDensity;
uniform float u_startDistance;
uniform float u_valleyStrength;
uniform float u_noiseStrength;
uniform float u_flowEnabled;
uniform float u_time;
uniform vec4 u_fogColor;

in vec2 v_textureCoordinates;

const int SAMPLE_COUNT = 10;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float hash21(vec2 value) {
  vec2 p = fract(value * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float valueNoise(vec2 value) {
  vec2 i = floor(value);
  vec2 f = fract(value);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

bool getWorldCoordinate(vec2 texCoords, out vec3 positionWC) {
  float depthOrLogDepth = texture(depthTexture, texCoords).r;

  if (depthOrLogDepth <= 0.0 || depthOrLogDepth >= 0.999999) {
    return false;
  }

  vec4 eyeCoordinate = czm_windowToEyeCoordinates(gl_FragCoord.xy, depthOrLogDepth);
  eyeCoordinate /= eyeCoordinate.w;

  vec4 worldCoordinate = czm_inverseView * eyeCoordinate;
  worldCoordinate /= worldCoordinate.w;
  positionWC = worldCoordinate.xyz;

  return true;
}

float getRoughHeight(vec3 worldCoordinate) {
  return length(worldCoordinate) - u_earthRadiusOnCamera;
}

float getLayerDensity(float height, vec3 worldCoordinate) {
  float fogDepth = max(u_fogTopHeight - u_fogBaseHeight, 1.0);
  float heightRatio = saturate((height - u_fogBaseHeight) / fogDepth);
  float layerMask = 1.0 - smoothstep(0.72, 1.0, heightRatio);
  float lowLayer = pow(1.0 - heightRatio, 1.35);
  float valleyLayer = mix(1.0, lowLayer, u_valleyStrength);

  vec2 noisePosition = worldCoordinate.xy * 0.00055;
  noisePosition += vec2(u_time * 0.012, -u_time * 0.008) * u_flowEnabled;
  float coarseNoise = valueNoise(noisePosition);
  float fineNoise = valueNoise(noisePosition * 2.4 + vec2(9.2, 17.7));
  float noise = mix(1.0, 0.66 + 0.54 * (coarseNoise * 0.72 + fineNoise * 0.28), u_noiseStrength);

  return max(layerMask * valleyLayer * noise, 0.0);
}

float integrateHeightFog(vec3 positionWC) {
  vec3 cameraWC = czm_viewerPositionWC;
  vec3 ray = positionWC - cameraWC;
  float rayLength = length(ray);

  if (rayLength <= u_startDistance) {
    return 0.0;
  }

  vec3 rayDirection = ray / rayLength;
  float startDistance = min(u_startDistance, rayLength);
  float marchLength = rayLength - startDistance;
  float stepLength = marchLength / float(SAMPLE_COUNT);
  float densitySum = 0.0;

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    float sampleDistance = startDistance + (float(i) + 0.5) * stepLength;
    vec3 sampleWC = cameraWC + rayDirection * sampleDistance;
    float sampleHeight = getRoughHeight(sampleWC);
    densitySum += getLayerDensity(sampleHeight, sampleWC);
  }

  float opticalDepth = densitySum * stepLength * u_globalDensity * 0.00125;
  float fog = 1.0 - exp(-opticalDepth);
  float distanceFade = smoothstep(u_startDistance, u_startDistance + 360.0, rayLength);

  return saturate(fog * distanceFade);
}

void main(void) {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  vec3 positionWC;

  if (!getWorldCoordinate(v_textureCoordinates, positionWC)) {
    out_FragColor = color;
    return;
  }

  float fogAmount = integrateHeightFog(positionWC);
  float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 softenedColor = mix(color.rgb, vec3(luminance), fogAmount * 0.34);
  vec3 finalColor = mix(softenedColor, u_fogColor.rgb, fogAmount);

  out_FragColor = vec4(finalColor, color.a);
}
`;

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const formatMeters = (value: number) => `${Math.round(value)}m`;

const formatRatio = (value: number) => value.toFixed(2);

const resetFog = () => {
  settings.enabled = true;
  settings.density = 0.84;
  settings.topHeight = 1700;
  settings.baseHeight = 60;
  settings.startDistance = 100;
  settings.valleyStrength = 0.82;
  settings.noiseStrength = 0.22;
  settings.flow = true;
  syncStageState();
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  captureSceneState();
  applySceneSetup();
  addHeightFogStage();
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
  scene.fog.enabled = false;
  scene.fog.renderable = false;
  scene.highDynamicRange = scene.highDynamicRangeSupported;
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.enableLighting = true;
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#1d2624');
  viewer.resolutionScale = 1;
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

const getEarthRadiusOnCamera = () => {
  if (!viewer) return Cesium.Ellipsoid.WGS84.maximumRadius;

  return Cesium.Cartesian3.magnitude(viewer.camera.positionWC)
    - viewer.camera.positionCartographic.height;
};

const addHeightFogStage = () => {
  if (!viewer || heightFogStage) return;

  stageStartTime = performance.now();
  heightFogStage = new Cesium.PostProcessStage({
    name: 'axy_height_fog',
    fragmentShader: heightFogFragmentShader,
    sampleMode: Cesium.PostProcessStageSampleMode.LINEAR,
    uniforms: {
      u_earthRadiusOnCamera: getEarthRadiusOnCamera,
      u_fogBaseHeight: () => Math.min(settings.baseHeight, settings.topHeight - 10),
      u_fogTopHeight: () => Math.max(settings.topHeight, settings.baseHeight + 10),
      u_globalDensity: () => settings.density,
      u_startDistance: () => settings.startDistance,
      u_valleyStrength: () => settings.valleyStrength,
      u_noiseStrength: () => settings.noiseStrength,
      u_flowEnabled: () => (settings.flow ? 1 : 0),
      u_time: () => (performance.now() - stageStartTime) * 0.001,
      u_fogColor: () => fogColor,
    },
  });
  heightFogStage.enabled = settings.enabled;
  viewer.scene.postProcessStages.add(heightFogStage);
};

const removeHeightFogStage = () => {
  if (!viewer || !heightFogStage) return;

  viewer.scene.postProcessStages.remove(heightFogStage);
  heightFogStage = null;
};

const syncStageState = () => {
  if (!heightFogStage) return;

  heightFogStage.enabled = settings.enabled;
};

watch(() => settings.enabled, syncStageState);

onBeforeUnmount(() => {
  removeHeightFogStage();
  restoreSceneState();
  viewer = null;
});
</script>

<style scoped lang="scss">
.fog-scene {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #1d2624;
}

.fog-panel {
  position: fixed;
  left: 16px;
  top: 76px;
  z-index: 2001;
  width: 286px;
  min-height: 390px;
  padding: 14px;
  color: #f6fbf8;
  background: rgba(22, 35, 32, 0.78);
  border: 1px solid rgba(222, 235, 228, 0.22);
  border-radius: 8px;
  box-shadow: 0 14px 32px rgba(17, 25, 24, 0.32);
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
    background: rgba(77, 123, 111, 0.92);
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
  color: #eefbf5;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(231, 242, 237, 0.22);
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 0.18s,
    border-color 0.18s,
    background 0.18s;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(244, 250, 247, 0.46);
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
  color: rgba(246, 251, 248, 0.9);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  font-size: 13px;
  color: rgba(246, 251, 248, 0.9);
}

:deep(.el-slider) {
  --el-slider-main-bg-color: #acd6c4;
  --el-slider-runway-bg-color: rgba(233, 243, 238, 0.2);
  --el-slider-button-size: 14px;
  --el-slider-button-wrapper-size: 30px;
}

:deep(.el-switch) {
  --el-switch-on-color: #79b89b;
  --el-switch-off-color: rgba(233, 243, 238, 0.2);
}

@media (max-width: 640px) {
  .fog-panel {
    left: 10px;
    top: 64px;
    width: min(286px, calc(100vw - 20px));
  }
}
</style>
