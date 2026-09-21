<template>
  <div class="inspection-page">
    <aside :class="['inspection-panel', { collapsed: !showPanel }]">
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
            <div class="eyebrow">3D TILES INSPECTOR</div>
            <h1>城市构件检查</h1>
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

        <div class="section">
          <div class="section-heading">
            <span>专题着色</span>
            <span class="section-caption">悬停查看构件</span>
          </div>
          <el-radio-group v-model="themeMode" size="small" @change="applyTheme">
            <el-radio-button value="original">原始</el-radio-button>
            <el-radio-button value="height">高度</el-radio-button>
            <el-radio-button value="property">属性</el-radio-button>
            <el-radio-button value="status">状态</el-radio-button>
          </el-radio-group>

          <el-select
            v-if="themeMode === 'property'"
            v-model="themeProperty"
            class="property-select"
            size="small"
            placeholder="选择专题属性"
            :disabled="!propertyOptions.length"
            @change="applyTheme"
          >
            <el-option
              v-for="property in propertyOptions"
              :key="property"
              :label="property"
              :value="property"
            />
          </el-select>

          <div v-if="themeMode === 'height'" class="legend">
            <span class="legend-swatch legend-swatch--low"></span>
            <span>低</span>
            <span class="legend-track"></span>
            <span>高</span>
            <span class="legend-swatch legend-swatch--high"></span>
          </div>
          <div v-else-if="themeMode !== 'original' && categoryLegend.length" class="category-legend">
            <span v-for="item in categoryLegend" :key="item.value" class="category-item">
              <i :style="{ backgroundColor: item.color }"></i>
              {{ item.value }}
            </span>
          </div>
          <div v-if="themeMode !== 'original'" class="rule-note">{{ themeRuleText }}</div>
        </div>

        <div v-if="loadError" class="error-message">{{ loadError }}</div>

        <div class="section">
          <div class="section-heading">
            <span>当前构件</span>
            <span class="section-caption">{{ selectedFeature ? "已选中" : "点击模型查看" }}</span>
          </div>
          <div v-if="selectedFeature" class="selection-tools">
            <span class="selection-id">Feature {{ selectedFeature.featureId }}</span>
            <div class="selection-actions">
              <button
                class="text-button"
                type="button"
                title="定位到当前构件"
                @click="flyToSelection"
              >
                <el-icon><Aim /></el-icon>
                定位
              </button>
              <button
                class="text-button text-button--muted"
                type="button"
                title="清除当前选择"
                @click="clearSelection"
              >
                <el-icon><Close /></el-icon>
                清除
              </button>
            </div>
          </div>
          <div v-if="selectedFeature" class="property-list">
            <div v-for="row in selectedFeature.properties" :key="row.name" class="property-row">
              <span class="property-name">{{ row.name }}</span>
              <span class="property-value">{{ formatPropertyValue(row.value) }}</span>
            </div>
          </div>
          <div v-else class="empty-state">
            <el-icon size="22"><Pointer /></el-icon>
            <span>左键拾取构件，查看属性并高亮轮廓</span>
          </div>
        </div>

        <div class="panel-footer">
          <span>数据源</span>
          <span>兰州城市白膜</span>
        </div>
      </div>
    </aside>

    <Map
      :loadTerrain="false"
      :showLayerSelect="false"
      :showStatusBar="true"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      @loaded="handleMapLoaded"
    />

    <div
      v-if="hoverInfo.visible"
      class="hover-label"
      :style="{ left: `${hoverInfo.x}px`, top: `${hoverInfo.y}px` }"
    >
      {{ hoverInfo.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import * as Cesium from "cesium";
import {
  Aim,
  Close,
  Grid,
  Pointer,
  RefreshRight,
} from "@element-plus/icons-vue";
import Map from "@/components/cesium/map.vue";

type ThemeMode = "original" | "height" | "property" | "status";

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

interface FeatureDescriptor {
  propertyIds: string[];
  properties: Record<string, unknown>;
  heightValue: number;
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
const themeMode = ref<ThemeMode>("original");
const themeProperty = ref("");
const selectedFeature = ref<Selection | null>(null);
const loadedFeatureCount = ref(0);
const propertyOptions = ref<string[]>([]);
const categoryLegendVersion = ref(0);
const hoverInfo = ref({
  visible: false,
  x: 0,
  y: 0,
  text: "",
});

let viewer: Cesium.Viewer | null = null;
let tileset: Cesium.Cesium3DTileset | null = null;
let eventHandler: Cesium.ScreenSpaceEventHandler | null = null;
let removeTileVisibleListener: (() => void) | null = null;
let hoveredFeature: any = null;
const loadedFeatures = new Set<any>();
const originalColors = new WeakMap<object, Cesium.Color>();
let featureDescriptors = new WeakMap<object, FeatureDescriptor>();
let themeFrameId: number | null = null;
let themeGeneration = 0;
let heightMin = Number.POSITIVE_INFINITY;
let heightMax = Number.NEGATIVE_INFINITY;
const propertyNameSet = new globalThis.Set<string>();
const categoryColors = new globalThis.Map<string, globalThis.Map<string, Cesium.Color>>();
const categoryValues = new globalThis.Map<string, string[]>();
const CATEGORY_PALETTE = [
  "#1677ff",
  "#13c2c2",
  "#52c41a",
  "#faad14",
  "#f5222d",
  "#722ed1",
  "#eb2f96",
  "#fa541c",
];
const DERIVED_STATUS_COLORS: Record<string, string> = {
  低层建筑: "#52c41a",
  中层建筑: "#faad14",
  高层建筑: "#f5222d",
  未分类: "#8c8c8c",
};

const isHeightProperty = (property: string): boolean =>
  /height|elevation|level/i.test(property) || /(^|[_-])z($|[_-])/i.test(property);

const isStatusProperty = (property: string): boolean =>
  /status|state|condition/i.test(property);

const heightPropertyName = computed(
  () => propertyOptions.value.find(isHeightProperty) ?? "",
);
const statusPropertyName = computed(
  () => propertyOptions.value.find(isStatusProperty) ?? "",
);
const statusFallbackPropertyName = computed(() => {
  if (statusPropertyName.value) return "";
  return (
    propertyOptions.value.find((property) =>
      /^(floor|storey|stories)$/i.test(property),
    ) ?? heightPropertyName.value
  );
});
const statusCategoryKey = computed(() => {
  if (statusPropertyName.value) return statusPropertyName.value;
  if (statusFallbackPropertyName.value) return "__derived_status__";
  return "__missing_status__";
});
const activeCategoryProperty = computed(() =>
  themeMode.value === "property" ? themeProperty.value : statusCategoryKey.value,
);
const themeRuleText = computed(() => {
  if (themeMode.value === "height") {
    return heightPropertyName.value
      ? `高度规则：使用属性 ${heightPropertyName.value}；无值时使用瓦片高程`
      : "高度规则：未找到数值高度属性，使用构件所在瓦片高程";
  }
  if (themeMode.value === "status") {
    return statusPropertyName.value
      ? `状态规则：使用属性 ${statusPropertyName.value}，空值归为“未分类”`
      : statusFallbackPropertyName.value
        ? `状态规则：未找到状态字段，按 ${statusFallbackPropertyName.value} 推导：1-3 层为低层建筑，4-9 层为中层建筑，10 层以上为高层建筑`
        : "状态规则：未找到状态或楼层字段，当前全部归为“未分类”";
  }
  return activeCategoryProperty.value
    ? `分类规则：按属性 ${activeCategoryProperty.value} 的实际值着色，空值归为“未分类”`
    : "分类规则：请先等待构件属性加载";
});
const categoryLegend = computed(() => {
  categoryLegendVersion.value;
  const property = activeCategoryProperty.value;
  if (!property) return [];
  const colors = categoryColors.get(property);
  const values = categoryValues.get(property) ?? [];
  return values.slice(0, 8).map((value) => ({
    value,
    color: colors?.get(value)?.toCssColorString() ?? "#8c8c8c",
  }));
});

const statusText = computed(() => {
  if (loading.value) return "正在加载城市模型";
  if (loadError.value) return "模型加载失败";
  if (modelReady.value) return "模型已就绪";
  return "等待模型加载";
});

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const isPickableFeature = (value: any): boolean => {
  return Boolean(
    value &&
      typeof value.getPropertyIds === "function" &&
      typeof value.getProperty === "function" &&
      "color" in value,
  );
};

const normalizePropertyValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const formatPropertyValue = (value: unknown): string => {
  const text = normalizePropertyValue(value);
  return text.length > 64 ? `${text.slice(0, 61)}...` : text || "--";
};

const getPropertyValue = (feature: any, name: string): unknown => {
  try {
    return feature?.getProperty?.(name);
  } catch {
    return undefined;
  }
};

const getPropertyIds = (feature: any): string[] => {
  try {
    return feature?.getPropertyIds?.([]) ?? [];
  } catch {
    return [];
  }
};

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getDescriptorNumericValue = (
  propertyIds: string[],
  properties: Record<string, unknown>,
): number | null => {
  const candidates = [
    ...propertyIds.filter(isHeightProperty),
    ...propertyIds.filter((property) => !isHeightProperty(property)),
  ];
  for (const property of candidates) {
    const value = toFiniteNumber(properties[property]);
    if (value !== null && isHeightProperty(property)) return value;
  }
  return null;
};

const rememberFeature = (feature: any, fallbackHeight = 0) => {
  if (!isPickableFeature(feature)) return;
  if (!originalColors.has(feature)) {
    originalColors.set(
      feature,
      Cesium.Color.clone(feature.color ?? Cesium.Color.WHITE, new Cesium.Color()),
    );
  }
  if (featureDescriptors.has(feature)) return;

  const propertyIds = getPropertyIds(feature).filter(
    (property) => property && property.length < 80,
  );
  const properties = Object.fromEntries(
    propertyIds.map((property) => [property, getPropertyValue(feature, property)]),
  );
  const numericValue = getDescriptorNumericValue(propertyIds, properties);
  const heightValue = numericValue ?? fallbackHeight;
  featureDescriptors.set(feature, { propertyIds, properties, heightValue });
  loadedFeatures.add(feature);

  let propertyListChanged = false;
  propertyIds.forEach((property) => {
    if (!propertyNameSet.has(property)) {
      propertyNameSet.add(property);
      propertyListChanged = true;
    }
  });
  if (propertyListChanged) {
    propertyOptions.value = Array.from(propertyNameSet).sort((a, b) =>
      a.localeCompare(b),
    );
  }

  if (Number.isFinite(heightValue)) {
    heightMin = Math.min(heightMin, heightValue);
    heightMax = Math.max(heightMax, heightValue);
  }

  if (!themeProperty.value) {
    themeProperty.value =
      propertyOptions.value.find((property) =>
        !isHeightProperty(property) && !isStatusProperty(property),
      ) ?? propertyOptions.value[0] ?? "";
  }
};

const colorFromRamp = (ratio: number): Cesium.Color => {
  const value = Math.max(0, Math.min(1, ratio));
  const low = Cesium.Color.fromCssColorString("#36cfc9");
  const high = Cesium.Color.fromCssColorString("#ff7a45");
  return Cesium.Color.lerp(low, high, value, new Cesium.Color());
};

const getCategoryColor = (propertyName: string, value: string): Cesium.Color => {
  let colors = categoryColors.get(propertyName);
  if (!colors) {
    colors = new globalThis.Map<string, Cesium.Color>();
    categoryColors.set(propertyName, colors);
  }
  if (!colors.has(value)) {
    const values = categoryValues.get(propertyName) ?? [];
    const colorText =
      propertyName === "__derived_status__"
        ? DERIVED_STATUS_COLORS[value] ?? DERIVED_STATUS_COLORS["未分类"]
        : CATEGORY_PALETTE[values.length % CATEGORY_PALETTE.length];
    const color = Cesium.Color.fromCssColorString(
      colorText,
    );
    colors.set(value, color);
    values.push(value);
    categoryValues.set(propertyName, values);
    categoryLegendVersion.value += 1;
  }
  return Cesium.Color.clone(colors.get(value)!, new Cesium.Color());
};

const getStatusCategory = (descriptor?: FeatureDescriptor): string => {
  if (statusPropertyName.value) {
    return normalizePropertyValue(
      descriptor?.properties[statusPropertyName.value],
    ) || "未分类";
  }
  if (!statusFallbackPropertyName.value) return "未分类";
  const floor = toFiniteNumber(
    descriptor?.properties[statusFallbackPropertyName.value],
  );
  if (floor === null) return "未分类";
  if (floor <= 3) return "低层建筑";
  if (floor <= 9) return "中层建筑";
  return "高层建筑";
};

const getThemeColor = (feature: any): Cesium.Color => {
  if (themeMode.value === "original") {
    return Cesium.Color.clone(
      originalColors.get(feature) ?? Cesium.Color.WHITE,
      new Cesium.Color(),
    );
  }

  if (themeMode.value === "height") {
    const descriptor = featureDescriptors.get(feature);
    const min = Number.isFinite(heightMin) ? heightMin : 0;
    const max = Number.isFinite(heightMax) && heightMax > min ? heightMax : min + 1;
    return colorFromRamp(((descriptor?.heightValue ?? min) - min) / (max - min));
  }

  const descriptor = featureDescriptors.get(feature);
  if (themeMode.value === "status") {
    return getCategoryColor(statusCategoryKey.value, getStatusCategory(descriptor));
  }
  const propertyName = activeCategoryProperty.value;
  const value = propertyName
    ? normalizePropertyValue(descriptor?.properties[propertyName]) || "未分类"
    : "未分类";
  return getCategoryColor(propertyName || "__missing__", value);
};

const applyFeatureAppearance = (feature: any) => {
  if (!isPickableFeature(feature)) return;
  if (selectedFeature.value?.feature === feature) {
    feature.show = true;
    feature.color = Cesium.Color.fromCssColorString("#fff566");
    return;
  }
  feature.show = true;
  if (hoveredFeature === feature && !silhouetteSupported.value) {
    feature.color = Cesium.Color.fromCssColorString("#ffffff");
    return;
  }
  feature.color = getThemeColor(feature);
};

const silhouetteSupported = ref(false);
let silhouetteBlue: any = null;
let silhouetteGreen: any = null;
let silhouetteStage: any = null;

const cancelThemeUpdate = () => {
  themeGeneration += 1;
  if (themeFrameId !== null) {
    cancelAnimationFrame(themeFrameId);
    themeFrameId = null;
  }
};

const applyTheme = () => {
  cancelThemeUpdate();
  const generation = themeGeneration;
  const features = Array.from(loadedFeatures);
  let index = 0;
  const applyChunk = () => {
    if (generation !== themeGeneration) return;
    const end = Math.min(index + 400, features.length);
    for (; index < end; index += 1) {
      applyFeatureAppearance(features[index]);
    }
    viewer?.scene.requestRender();
    if (index < features.length) {
      themeFrameId = requestAnimationFrame(applyChunk);
    } else {
      themeFrameId = null;
    }
  };
  if (features.length) themeFrameId = requestAnimationFrame(applyChunk);
  else viewer?.scene.requestRender();
};

const updateHoverLabel = (
  pickedFeature: any,
  position: Cesium.Cartesian2,
) => {
  if (!isPickableFeature(pickedFeature)) {
    hoverInfo.value.visible = false;
    return;
  }
  hoverInfo.value = {
    visible: true,
    x: position.x + 12,
    y: position.y + 12,
    text: `Feature ${pickedFeature.featureId}`,
  };
};

const buildSelection = (
  feature: any,
  position: Cesium.Cartesian2,
): Selection => {
  const properties = getPropertyIds(feature).map((name) => ({
    name,
    value: getPropertyValue(feature, name),
  }));
  let pickedPosition: Cesium.Cartesian3 | null = null;
  if (viewer?.scene.pickPositionSupported) {
    pickedPosition = viewer.scene.pickPosition(position);
  }
  if (!pickedPosition && viewer) {
    pickedPosition = viewer.camera.pickEllipsoid(
      position,
      viewer.scene.globe.ellipsoid,
    );
  }
  return {
    feature,
    featureId: Number(feature.featureId ?? 0),
    properties,
    position: pickedPosition,
  };
};

const clearSelection = () => {
  selectedFeature.value = null;
  if (silhouetteGreen) silhouetteGreen.selected = [];
  applyTheme();
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

const handleMouseMove = (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
  if (!viewer) return;
  const pickedFeature = viewer.scene.pick(movement.endPosition);
  const previousFeature = hoveredFeature;
  if (isPickableFeature(pickedFeature)) rememberFeature(pickedFeature);
  hoveredFeature = isPickableFeature(pickedFeature) ? pickedFeature : null;
  updateHoverLabel(pickedFeature, movement.endPosition);
  if (silhouetteBlue) {
    silhouetteBlue.selected =
      hoveredFeature && hoveredFeature !== selectedFeature.value?.feature
        ? [hoveredFeature]
        : [];
  }
  if (previousFeature && previousFeature !== hoveredFeature) {
    applyFeatureAppearance(previousFeature);
  }
  if (hoveredFeature && hoveredFeature !== selectedFeature.value?.feature) {
    applyFeatureAppearance(hoveredFeature);
  }
};

const handleLeftClick = (
  movement: Cesium.ScreenSpaceEventHandler.PositionedEvent,
) => {
  if (!viewer) return;
  const pickedFeature = viewer.scene.pick(movement.position);
  if (!isPickableFeature(pickedFeature)) {
    clearSelection();
    return;
  }
  if (selectedFeature.value?.feature === pickedFeature) {
    clearSelection();
    return;
  }
  rememberFeature(pickedFeature);
  selectedFeature.value = buildSelection(pickedFeature, movement.position);
  if (silhouetteGreen) silhouetteGreen.selected = [pickedFeature];
  applyTheme();
};

const configurePicking = () => {
  if (!viewer) return;
  eventHandler?.destroy();
  eventHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  eventHandler.setInputAction(
    handleMouseMove,
    Cesium.ScreenSpaceEventType.MOUSE_MOVE,
  );
  eventHandler.setInputAction(
    handleLeftClick,
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );

  silhouetteSupported.value =
    Cesium.PostProcessStageLibrary.isSilhouetteSupported(viewer.scene);
  if (!silhouetteSupported.value) return;

  silhouetteBlue =
    Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
  silhouetteBlue.uniforms.color = Cesium.Color.fromCssColorString("#39d9ff");
  silhouetteBlue.uniforms.length = 0.01;
  silhouetteBlue.selected = [];

  silhouetteGreen =
    Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
  silhouetteGreen.uniforms.color = Cesium.Color.fromCssColorString("#fff566");
  silhouetteGreen.uniforms.length = 0.015;
  silhouetteGreen.selected = [];

  silhouetteStage = Cesium.PostProcessStageLibrary.createSilhouetteStage([
    silhouetteBlue,
    silhouetteGreen,
  ]);
  viewer.scene.postProcessStages.add(silhouetteStage);
};

const handleVisibleTile = (tile: Cesium.Cesium3DTile) => {
  const content = tile.content;
  if (!content || !content.featuresLength) return;
  const fallbackHeight = Cesium.Cartographic.fromCartesian(
    tile.boundingSphere.center,
  ).height;
  for (let index = 0; index < content.featuresLength; index += 1) {
    const feature = content.getFeature(index);
    rememberFeature(feature, fallbackHeight);
    applyFeatureAppearance(feature);
  }
  loadedFeatureCount.value = loadedFeatures.size;
  if (themeMode.value === "height") applyTheme();
};

const clearTileset = () => {
  if (!viewer || !tileset) return;
  removeTileVisibleListener?.();
  removeTileVisibleListener = null;
  viewer.scene.primitives.remove(tileset);
  tileset = null;
  cancelThemeUpdate();
  if (silhouetteStage) viewer.scene.postProcessStages.remove(silhouetteStage);
  silhouetteStage = null;
  silhouetteBlue = null;
  silhouetteGreen = null;
  loadedFeatures.clear();
  featureDescriptors = new WeakMap<object, FeatureDescriptor>();
  propertyNameSet.clear();
  categoryColors.clear();
  categoryValues.clear();
  categoryLegendVersion.value += 1;
  heightMin = Number.POSITIVE_INFINITY;
  heightMax = Number.NEGATIVE_INFINITY;
  propertyOptions.value = [];
  themeProperty.value = "";
  selectedFeature.value = null;
  hoveredFeature = null;
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
    viewer.scene.primitives.add(nextTileset);
    removeTileVisibleListener = nextTileset.tileVisible.addEventListener(
      handleVisibleTile,
    );
    await viewer.zoomTo(nextTileset);
    modelReady.value = true;
    configurePicking();
  } catch (error) {
    console.error("城市构件检查模型加载失败:", error);
    loadError.value = "模型加载失败，请检查网络或 3D Tiles 地址";
  } finally {
    loading.value = false;
  }
};

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
  cancelThemeUpdate();
  removeTileVisibleListener?.();
  removeTileVisibleListener = null;
  eventHandler?.destroy();
  eventHandler = null;
  if (viewer && silhouetteStage) viewer.scene.postProcessStages.remove(silhouetteStage);
  if (viewer && tileset) viewer.scene.primitives.remove(tileset);
  viewer = null;
  tileset = null;
});
</script>

<style scoped lang="scss">
.inspection-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.inspection-panel {
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
.selection-tools,
.panel-footer,
.selection-actions {
  display: flex;
  align-items: center;
}

.panel-heading,
.section-heading,
.selection-tools,
.panel-footer {
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
.text-button {
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
  flex: 0 0 auto;
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
  gap: 9px;
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

.property-select {
  width: 100%;
}

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(226, 246, 250, 0.58);
  font-size: 11px;
}

.legend-track {
  height: 4px;
  flex: 1;
  background: linear-gradient(90deg, #36cfc9, #ff7a45);
  border-radius: 2px;
}

.legend-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &--low {
    background: #36cfc9;
  }

  &--high {
    background: #ff7a45;
  }
}

.category-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  color: rgba(226, 246, 250, 0.72);
  font-size: 11px;
}

.category-item {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  i {
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
  }
}

.rule-note {
  color: rgba(226, 246, 250, 0.5);
  font-size: 10px;
  line-height: 1.45;
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
  font-variant-numeric: tabular-nums;
}

.selection-actions {
  gap: 8px;
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

  &--muted {
    color: rgba(226, 246, 250, 0.58);
  }
}

.property-list {
  max-height: 220px;
  overflow-y: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}

.property-row {
  display: grid;
  grid-template-columns: minmax(90px, 0.8fr) minmax(0, 1.2fr);
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
}

.property-name {
  overflow: hidden;
  color: rgba(226, 246, 250, 0.56);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property-value {
  overflow: hidden;
  color: rgba(245, 251, 253, 0.9);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92px;
  gap: 8px;
  color: rgba(226, 246, 250, 0.56);
  font-size: 12px;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(226, 246, 250, 0.13);
  border-radius: 5px;
}

.panel-footer {
  padding-top: 2px;
  color: rgba(226, 246, 250, 0.48);
  font-size: 11px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);

  span:last-child {
    color: rgba(226, 246, 250, 0.82);
  }
}

.hover-label {
  position: absolute;
  z-index: 2002;
  padding: 4px 7px;
  color: #f5fdff;
  font-size: 11px;
  pointer-events: none;
  background: rgba(4, 15, 22, 0.88);
  border: 1px solid rgba(125, 223, 241, 0.38);
  border-radius: 4px;
  transform: translateY(-100%);
}

:deep(.el-radio-group) {
  display: flex;
  width: 100%;
}

:deep(.el-radio-button) {
  flex: 1;
}

:deep(.el-radio-button__inner) {
  width: 100%;
  padding: 7px 4px;
  color: rgba(226, 246, 250, 0.72);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(226, 246, 250, 0.14);
  box-shadow: none;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-left-color: rgba(226, 246, 250, 0.14);
}

:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  color: #07171d;
  background: #73dbea;
  border-color: #73dbea;
  box-shadow: -1px 0 0 0 #73dbea;
}

:deep(.el-select__wrapper) {
  color: #e7fbff;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(209, 238, 247, 0.16) inset;
}

:deep(.el-select__selected-item) {
  color: #e7fbff;
}

@media (max-width: 640px) {
  .inspection-panel {
    top: 64px;
    left: 10px;
    width: min(360px, calc(100vw - 20px));
  }
}
</style>
