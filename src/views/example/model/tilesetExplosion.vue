<template>
  <div class="explosion-page">
    <aside :class="['explosion-panel', { collapsed: !showPanel }]">
      <button
        v-if="showPanel"
        class="icon-button panel-close"
        type="button"
        title="收起面板"
        @click="togglePanel"
      >
        <el-icon size="18"><Close /></el-icon>
      </button>
      <button
        v-else
        class="panel-open"
        type="button"
        title="打开面板"
        @click="togglePanel"
      >
        <el-icon size="22"><Grid /></el-icon>
      </button>

      <div v-if="showPanel" class="panel-content">
        <div class="panel-heading">
          <div>
            <div class="eyebrow">3D TILES FEATURE VIEW</div>
            <h1>构件单体化查看</h1>
          </div>
          <button
            class="icon-button"
            type="button"
            title="重新加载模型"
            :disabled="loading"
            @click="loadTileset"
          >
            <el-icon size="17"><RefreshRight /></el-icon>
          </button>
        </div>

        <div class="status-row">
          <span :class="['status-dot', { ready: modelReady, error: Boolean(loadError) }]"></span>
          <span>{{ statusText }}</span>
          <span class="feature-count">{{ loadedFeatureCount }} 构件</span>
        </div>

        <div v-if="loadError" class="error-message">{{ loadError }}</div>

        <div class="section">
          <div class="section-heading">
            <span>构件查看</span>
            <span class="section-caption">先点击一个建筑构件</span>
          </div>
          <div class="mode-note">
            单体化只保留选中构件；拉近镜头时会继续保持该构件可见。
          </div>
          <div class="control-row">
            <span>模型透明度</span>
            <strong>{{ Math.round(opacity * 100) }}%</strong>
          </div>
          <el-slider
            v-model="opacity"
            :min="0.15"
            :max="1"
            :step="0.05"
            :disabled="!modelReady"
            :show-tooltip="false"
            @input="applyFeatureAppearance"
          />
        </div>

        <div class="section">
          <div class="section-heading">
            <span>当前构件</span>
            <span class="section-caption">{{ selectedFeature ? "已选中" : "点击模型查看" }}</span>
          </div>
          <div v-if="selectedFeature" class="selection-tools">
            <span class="selection-id">Feature {{ selectedFeature.featureId }}</span>
            <div class="selection-actions">
              <button class="text-button" type="button" @click="flyToSelection">
                <el-icon><Aim /></el-icon>
                定位
              </button>
              <button class="text-button" type="button" @click="isolateSelectedFeature">
                <el-icon><View /></el-icon>
                单体化
              </button>
            </div>
          </div>
          <div v-if="selectedFeature" class="selection-mode">
            {{ selectedViewMode === "isolate" ? "单体化查看中" : "未进入单体查看" }}
          </div>
          <div v-if="selectedFeature" class="property-list">
            <div v-for="row in selectedFeature.properties" :key="row.name" class="property-row">
              <span>{{ row.name }}</span>
              <strong>{{ formatValue(row.value) }}</strong>
            </div>
          </div>
          <div v-else class="empty-state">
            <el-icon size="22"><Pointer /></el-icon>
            <span>左键选择构件，再选择单体化查看</span>
          </div>
        </div>

        <div class="panel-actions">
          <button class="action-button action-button--primary" type="button" @click="showAllFeatures">
            <el-icon><Refresh /></el-icon>
            显示全部构件
          </button>
          <button class="action-button" type="button" @click="resetView">
            <el-icon><Aim /></el-icon>
            复位视角
          </button>
        </div>
      </div>
    </aside>

    <CesiumMap
      :loadTerrain="false"
      :showLayerSelect="false"
      :showStatusBar="true"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      @loaded="handleMapLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from "vue";
import * as Cesium from "cesium";
import {
  Aim,
  Close,
  Grid,
  Pointer,
  Refresh,
  RefreshRight,
  View,
} from "@element-plus/icons-vue";
import CesiumMap from "@/components/cesium/map.vue";

interface PropertyRow {
  name: string;
  value: unknown;
}

interface Selection {
  feature: any;
  featureId: number;
  properties: PropertyRow[];
  position: Cesium.Cartesian3 | null;
}

const TILESET_URL =
  "https://jdvop.oss-cn-qingdao.aliyuncs.com/mapv-data/titleset/lanzhou/tileset.json";

const cameraDestination = {
  longitude: 103.82,
  latitude: 36.02,
  height: 3000,
};

const cameraOrientation = {
  heading: 0,
  pitch: -40,
  roll: 0,
};

const showPanel = ref(true);
const loading = ref(false);
const modelReady = ref(false);
const loadError = ref("");
const opacity = ref(1);
const selectedFeature = shallowRef<Selection | null>(null);
const loadedFeatureCount = ref(0);
const isolatedFeatureKey = ref<string | null>(null);
const selectedFeatureKey = ref<string | null>(null);
const selectedViewMode = ref<"none" | "isolate">("none");

let viewer: Cesium.Viewer | null = null;
let tileset: Cesium.Cesium3DTileset | null = null;
let eventHandler: Cesium.ScreenSpaceEventHandler | null = null;
let removeTileVisibleListener: (() => void) | null = null;
const loadedFeatures = new Set<any>();
const hiddenFeatures = new Set<any>();
const originalColors = new WeakMap<object, Cesium.Color>();
let featureKeys = new WeakMap<object, string>();

const statusText = computed(() => {
  if (loading.value) return "正在加载城市模型";
  if (loadError.value) return "模型加载失败";
  if (modelReady.value) return "模型已就绪";
  return "等待模型加载";
});

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const isFeature = (value: any): boolean => {
  return Boolean(
    value &&
      typeof value.getPropertyIds === "function" &&
      typeof value.getProperty === "function" &&
      "color" in value,
  );
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "--";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const text = String(value);
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
};

const getPropertyRows = (feature: any): PropertyRow[] => {
  try {
    return (feature.getPropertyIds?.([]) ?? []).map((name: string) => ({
      name,
      value: feature.getProperty(name),
    }));
  } catch {
    return [];
  }
};

const getFeatureKey = (feature: any): string => {
  const key = featureKeys.get(feature);
  if (key) return key;
  return `feature-${String(feature?.featureId ?? "unknown")}`;
};

const rememberFeature = (feature: any) => {
  if (!isFeature(feature)) return;
  if (!originalColors.has(feature)) {
    originalColors.set(
      feature,
      Cesium.Color.clone(feature.color, new Cesium.Color()),
    );
  }
  loadedFeatures.add(feature);
};

const applyFeatureAppearance = (features: Iterable<any> = loadedFeatures) => {
  for (const feature of features) {
    const featureKey = getFeatureKey(feature);
    const isOutsideIsolation =
      isolatedFeatureKey.value !== null && isolatedFeatureKey.value !== featureKey;
    feature.show = !hiddenFeatures.has(feature) && !isOutsideIsolation;
    const original = originalColors.get(feature) ?? Cesium.Color.WHITE;
    const color = Cesium.Color.clone(original, new Cesium.Color());
    color.alpha = opacity.value;
    if (selectedFeatureKey.value === featureKey) {
      color.red = 1;
      color.green = 0.;
      color.blue = 0.4;
      color.alpha = 1;
    }
    feature.color = color;
  }
  viewer?.scene.requestRender();
};

const isolateSelectedFeature = () => {
  const feature = selectedFeature.value?.feature;
  if (!feature) return;
  isolatedFeatureKey.value = selectedFeatureKey.value ?? getFeatureKey(feature);
  selectedViewMode.value = "isolate";
  applyFeatureAppearance();
};

const showAllFeatures = () => {
  isolatedFeatureKey.value = null;
  selectedViewMode.value = "none";
  hiddenFeatures.clear();
  applyFeatureAppearance();
};

const registerVisibleTile = (tile: Cesium.Cesium3DTile) => {
  const content = tile.content;
  if (!content || !content.featuresLength) return;

  const tileFeatures: any[] = [];
  const contentKey = content.url ?? content.uri ?? `tile-${tile.content?.featuresLength ?? 0}`;
  for (let index = 0; index < content.featuresLength; index += 1) {
    const feature = content.getFeature(index);
    rememberFeature(feature);
    featureKeys.set(
      feature,
      `${contentKey}#${String(feature.featureId ?? index)}`,
    );
    tileFeatures.push(feature);
  }
  loadedFeatureCount.value = loadedFeatures.size;
  applyFeatureAppearance(tileFeatures);
};

const buildSelection = (
  feature: any,
  position: Cesium.Cartesian2,
): Selection => {
  let pickedPosition: Cesium.Cartesian3 | null = null;
  if (viewer?.scene.pickPositionSupported) {
    pickedPosition = viewer.scene.pickPosition(position);
  }
  if (!pickedPosition && viewer) {
    pickedPosition = viewer.camera.pickEllipsoid(
      position,
      viewer.scene.globe.ellipsoid,
    ) ?? null;
  }
  return {
    feature,
    featureId: Number(feature.featureId ?? 0),
    properties: getPropertyRows(feature),
    position: pickedPosition,
  };
};

const handleLeftClick = (
  movement: Cesium.ScreenSpaceEventHandler.PositionedEvent,
) => {
  if (!viewer) return;
  const picked = viewer.scene.pick(movement.position);
  if (!isFeature(picked)) {
    selectedFeature.value = null;
    selectedFeatureKey.value = null;
    isolatedFeatureKey.value = null;
    selectedViewMode.value = "none";
    applyFeatureAppearance();
    return;
  }
  selectedFeature.value = buildSelection(picked, movement.position);
  selectedFeatureKey.value = getFeatureKey(picked);
  if (isolatedFeatureKey.value && isolatedFeatureKey.value !== selectedFeatureKey.value) {
    isolatedFeatureKey.value = null;
    selectedViewMode.value = "none";
  }
  applyFeatureAppearance();
};

const configurePicking = () => {
  if (!viewer) return;
  eventHandler?.destroy();
  eventHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  eventHandler.setInputAction(
    handleLeftClick,
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );
};

const flyToSelection = () => {
  const position = selectedFeature.value?.position;
  if (!viewer || !position) return;
  viewer.camera.flyToBoundingSphere(
    new Cesium.BoundingSphere(position, 35),
    {
      offset: new Cesium.HeadingPitchRange(
        viewer.camera.heading,
        Cesium.Math.toRadians(-35),
        220,
      ),
      duration: 0.8,
    },
  );
};

const clearTileset = () => {
  if (!viewer || !tileset) return;
  removeTileVisibleListener?.();
  removeTileVisibleListener = null;
  viewer.scene.primitives.remove(tileset);
  tileset = null;
  loadedFeatures.clear();
  hiddenFeatures.clear();
  selectedFeature.value = null;
  selectedFeatureKey.value = null;
  isolatedFeatureKey.value = null;
  selectedViewMode.value = "none";
  featureKeys = new WeakMap<object, string>();
  loadedFeatureCount.value = 0;
};

const loadTileset = async () => {
  if (!viewer || loading.value) return;
  loading.value = true;
  modelReady.value = false;
  loadError.value = "";
  clearTileset();

  try {
    const nextTileset = await Cesium.Cesium3DTileset.fromUrl(TILESET_URL, {
      maximumScreenSpaceError: 12,
      dynamicScreenSpaceError: true,
    });
    if (!viewer) return;
    tileset = nextTileset;
    tileset.colorBlendMode = Cesium.Cesium3DTileColorBlendMode.MIX;
    viewer.scene.primitives.add(tileset);
    removeTileVisibleListener = tileset.tileVisible.addEventListener(
      registerVisibleTile,
    );
    await viewer.zoomTo(tileset);
    modelReady.value = true;
    configurePicking();
  } catch (error) {
    console.error("构件单体化模型加载失败:", error);
    loadError.value = "模型加载失败，请检查网络或 3D Tiles 地址";
  } finally {
    loading.value = false;
  }
};

// const resetScene = () => {
//   opacity.value = 1;
//   selectedFeature.value = null;
//   selectedFeatureKey.value = null;
//   showAllFeatures();
// };

const resetView = () => {
  if (!viewer) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      cameraDestination.longitude,
      cameraDestination.latitude,
      cameraDestination.height,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(cameraOrientation.heading),
      pitch: Cesium.Math.toRadians(cameraOrientation.pitch),
      roll: 0,
    },
    duration: 0.8,
  });
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  loadTileset();
};

onUnmounted(() => {
  removeTileVisibleListener?.();
  removeTileVisibleListener = null;
  eventHandler?.destroy();
  eventHandler = null;
  if (viewer && tileset) viewer.scene.primitives.remove(tileset);
  viewer = null;
  tileset = null;
});
</script>

<style scoped lang="scss">
.explosion-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.explosion-panel {
  position: absolute;
  top: 72px;
  left: 16px;
  z-index: 2001;
  width: 360px;
  max-height: calc(100vh - 88px);
  padding: 16px;
  overflow-y: auto;
  color: #f5fbff;
  background: rgba(8, 18, 26, 0.9);
  border: 1px solid rgba(190, 226, 240, 0.18);
  border-radius: 8px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(12px);
  user-select: none;

  &.collapsed {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
    background: rgba(10, 133, 151, 0.95);
  }
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-heading,
.status-row,
.section-heading,
.control-row,
.selection-tools,
.selection-actions {
  display: flex;
  align-items: center;
}

.panel-heading,
.section-heading,
.control-row,
.selection-tools {
  justify-content: space-between;
}

.panel-heading {
  padding-right: 38px;

  h1 {
    margin: 4px 0 0;
    font-size: 19px;
    letter-spacing: 0;
  }
}

.eyebrow {
  color: #73dbea;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.icon-button,
.panel-open,
.text-button,
.action-button,
.floor-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(211, 240, 247, 0.16);
  cursor: pointer;
}

.icon-button {
  width: 30px;
  height: 30px;
  padding: 0;
  color: #e3fbff;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.panel-close {
  position: absolute;
  top: 10px;
  right: 10px;
}

.panel-open {
  width: 44px;
  height: 44px;
  padding: 0;
  color: #f5fdff;
  background: transparent;
  border: 0;
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.status-row {
  gap: 7px;
  color: rgba(229, 247, 251, 0.78);
  font-size: 12px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f0a33b;

  &.ready {
    background: #42d392;
  }

  &.error {
    background: #f56c6c;
  }
}

.feature-count {
  margin-left: auto;
  color: #7ddff1;
  font-variant-numeric: tabular-nums;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-heading {
  color: rgba(244, 251, 253, 0.94);
  font-size: 13px;
  font-weight: 600;
}

.section-caption {
  color: rgba(226, 246, 250, 0.48);
  font-size: 11px;
  font-weight: 400;
}

.control-row {
  color: rgba(226, 246, 250, 0.68);
  font-size: 12px;

  strong {
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

.mode-note {
  padding: 8px 9px;
  color: rgba(226, 246, 250, 0.62);
  font-size: 11px;
  line-height: 1.5;
  background: rgba(255, 255, 255, 0.045);
  border-left: 2px solid #73dbea;
}

.selection-mode {
  color: #73dbea;
  font-size: 11px;
}

.floor-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  max-height: 126px;
  overflow-y: auto;
}

.floor-button {
  flex-direction: column;
  gap: 2px;
  min-height: 44px;
  padding: 5px;
  color: #dff9ff;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 5px;

  &:hover {
    color: #07171d;
    background: #73dbea;
    border-color: #73dbea;
  }

  span {
    font-size: 12px;
    font-weight: 600;
  }

  small {
    color: rgba(226, 246, 250, 0.54);
    font-size: 10px;
  }

  &:hover small {
    color: rgba(7, 23, 29, 0.68);
  }
}

.error-message {
  padding: 8px 10px;
  color: #ffd0d0;
  font-size: 12px;
  line-height: 1.45;
  background: rgba(183, 55, 55, 0.22);
  border: 1px solid rgba(255, 142, 142, 0.28);
  border-radius: 5px;
}

.selection-tools {
  gap: 10px;
}

.selection-id {
  color: #7ddff1;
  font-size: 12px;
}

.selection-actions {
  gap: 7px;
}

.text-button {
  gap: 4px;
  padding: 3px 6px;
  color: #9cecf5;
  font-size: 11px;
  background: transparent;
  border-color: transparent;
  border-radius: 4px;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }
}

.property-list {
  max-height: 170px;
  overflow-y: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}

.property-row {
  display: grid;
  grid-template-columns: minmax(90px, 0.8fr) minmax(0, 1.2fr);
  gap: 10px;
  padding: 6px 0;
  color: rgba(226, 246, 250, 0.56);
  font-size: 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  strong {
    overflow: hidden;
    color: rgba(245, 251, 253, 0.9);
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
  gap: 8px;
  color: rgba(226, 246, 250, 0.56);
  font-size: 12px;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(226, 246, 250, 0.13);
  border-radius: 5px;
}

.panel-actions {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 8px;
}

.action-button {
  gap: 6px;
  min-height: 32px;
  padding: 0 8px;
  color: #dff9ff;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 5px;

  &:hover {
    color: #07171d;
    background: #73dbea;
    border-color: #73dbea;
  }

  &--primary {
    color: #07171d;
    background: #73dbea;
    border-color: #73dbea;
  }
}

:deep(.el-slider) {
  margin: 0 4px;
}

:deep(.el-slider__runway) {
  height: 4px;
  margin: 8px 0;
  background: rgba(255, 255, 255, 0.14);
}

:deep(.el-slider__bar) {
  height: 4px;
  background: #5ed6e9;
}

:deep(.el-slider__button) {
  width: 12px;
  height: 12px;
  border-color: #8be8f5;
}

@media (max-width: 640px) {
  .explosion-panel {
    top: 64px;
    left: 10px;
    width: min(360px, calc(100vw - 20px));
  }
}
</style>
