<template>
  <div class="clipping-page">
    <div :class="['clipping-panel', { collapsed: !showPanel }]">
      <button
        v-if="showPanel"
        class="icon-button panel-close"
        type="button"
        title="收起参数"
        @click="showPanel = false"
      >
        <el-icon size="18">
          <Close />
        </el-icon>
      </button>
      <button
        v-else
        class="panel-open"
        type="button"
        title="打开参数"
        @click="showPanel = true"
      >
        <el-icon size="22">
          <Grid />
        </el-icon>
      </button>

      <div v-if="showPanel" class="panel-content">
        <div class="panel-header">
          <div>
            <div class="panel-title">3D Tiles 剖切与裁剪</div>
            <div class="panel-subtitle">大雁塔倾斜摄影模型</div>
          </div>
          <el-icon class="header-icon" size="24">
            <Crop />
          </el-icon>
        </div>

        <div
          :class="['status-line', { ready: modelLoaded, error: Boolean(loadError) }]"
        >
          <span class="status-dot"></span>
          <span>{{ statusText }}</span>
        </div>

        <div class="control-section">
          <div class="section-title">裁剪模式</div>
          <el-radio-group v-model="clippingMode" size="small">
            <el-radio-button value="plane">平面剖切</el-radio-button>
            <el-radio-button value="box">盒裁剪</el-radio-button>
            <el-radio-button value="height">高度裁剪</el-radio-button>
          </el-radio-group>
          <div class="section-hint">{{ modeHint }}</div>
        </div>

        <div v-if="clippingMode === 'plane'" class="control-section">
          <div class="section-title">剖切面</div>
          <div class="control-row">
            <span class="control-label">方向</span>
            <el-radio-group v-model="planeAxis" size="small">
              <el-radio-button value="east">东西</el-radio-button>
              <el-radio-button value="north">南北</el-radio-button>
            </el-radio-group>
          </div>
          <div class="slider-row">
            <div class="slider-label">
              <span>位置</span>
              <strong>{{ formatMeters(planeOffset) }}</strong>
            </div>
            <el-slider
              v-model="planeOffset"
              :min="rangeMin"
              :max="rangeMax"
              :step="sliderStep"
              :disabled="!modelLoaded"
              :format-tooltip="formatMeters"
            />
          </div>
        </div>

        <div v-else-if="clippingMode === 'box'" class="control-section">
          <div class="section-title">保留盒尺寸</div>
          <div class="slider-row">
            <div class="slider-label">
              <span>东西半径</span>
              <strong>{{ formatMeters(boxHalfWidth) }}</strong>
            </div>
            <el-slider
              v-model="boxHalfWidth"
              :min="minimumBoxSize"
              :max="rangeMax"
              :step="sliderStep"
              :disabled="!modelLoaded"
              :format-tooltip="formatMeters"
            />
          </div>
          <div class="slider-row">
            <div class="slider-label">
              <span>南北半径</span>
              <strong>{{ formatMeters(boxHalfDepth) }}</strong>
            </div>
            <el-slider
              v-model="boxHalfDepth"
              :min="minimumBoxSize"
              :max="rangeMax"
              :step="sliderStep"
              :disabled="!modelLoaded"
              :format-tooltip="formatMeters"
            />
          </div>
          <div class="slider-row">
            <div class="slider-label">
              <span>高度半径</span>
              <strong>{{ formatMeters(boxHalfHeight) }}</strong>
            </div>
            <el-slider
              v-model="boxHalfHeight"
              :min="minimumBoxSize"
              :max="rangeMax"
              :step="sliderStep"
              :disabled="!modelLoaded"
              :format-tooltip="formatMeters"
            />
          </div>
        </div>

        <div v-else class="control-section">
          <div class="section-title">保留高度以上</div>
          <div class="slider-row">
            <div class="slider-label">
              <span>相对模型中心</span>
              <strong>{{ formatMeters(heightOffset) }}</strong>
            </div>
            <el-slider
              v-model="heightOffset"
              :min="rangeMin"
              :max="rangeMax"
              :step="sliderStep"
              :disabled="!modelLoaded"
              :format-tooltip="formatMeters"
            />
          </div>
        </div>

        <div class="control-section">
          <div class="section-title">显示</div>
          <div class="display-row">
            <span>启用裁剪</span>
            <el-switch v-model="clippingEnabled" :disabled="!modelLoaded" />
          </div>
          <div class="display-row">
            <span>边缘颜色</span>
            <el-color-picker v-model="edgeColor" size="small" />
          </div>
          <div class="control-row">
            <span class="control-label">边缘宽度</span>
            <el-input-number
              v-model="edgeWidth"
              size="small"
              :min="0"
              :max="10"
              :step="1"
              controls-position="right"
              :disabled="!modelLoaded"
            />
            <span class="unit">px</span>
          </div>
        </div>

        <div class="action-row">
          <el-button
            type="primary"
            size="small"
            :loading="loading"
            @click="loadTileset"
          >
            <el-icon><Refresh /></el-icon>
            重新加载
          </el-button>
          <el-button
            size="small"
            :disabled="!modelLoaded"
            @click="resetClipping"
          >
            <el-icon><RefreshRight /></el-icon>
            重置裁剪
          </el-button>
          <el-button
            size="small"
            :disabled="!modelLoaded"
            @click="resetCamera"
          >
            <el-icon><Location /></el-icon>
            重置视角
          </el-button>
        </div>

        <div v-if="loadError" class="error-message">{{ loadError }}</div>
      </div>
    </div>

    <Map
      mapType="gd_v"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      :duration="0"
      :show-layer-select="true"
      @loaded="handleMapLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import {
  Close,
  Crop,
  Grid,
  Location,
  Refresh,
  RefreshRight,
} from "@element-plus/icons-vue";
import Map from "@/components/cesium/map.vue";

type ClippingMode = "plane" | "box" | "height";
type PlaneAxis = "east" | "north";

const TILESET_URL =
  "https://zouyaoji.top/vue-cesium/SampleData/Cesium3DTiles/Tilesets/dayanta/tileset.json";

const cameraDestination = {
  longitude: 108.964,
  latitude: 34.218,
  height: 4200,
};

const cameraOrientation = {
  heading: 25,
  pitch: -42,
  roll: 0,
};

const showPanel = ref(true);
const clippingMode = ref<ClippingMode>("plane");
const planeAxis = ref<PlaneAxis>("east");
const planeOffset = ref(0);
const boxHalfWidth = ref(70);
const boxHalfDepth = ref(70);
const boxHalfHeight = ref(70);
const heightOffset = ref(0);
const clippingEnabled = ref(true);
const edgeColor = ref("#29d3ff");
const edgeWidth = ref(3);
const modelRadius = ref(100);
const mapReady = ref(false);
const modelLoaded = ref(false);
const loading = ref(false);
const loadError = ref("");
const statusNote = ref("等待地图初始化");

let viewer: Cesium.Viewer | null = null;
let tileset: Cesium.Cesium3DTileset | null = null;
let clippingPlanes: Cesium.ClippingPlaneCollection | null = null;
let clippingGuideFill: Cesium.Primitive | null = null;
let clippingGuideOutline: Cesium.Primitive | null = null;
let clippingGuideKind: "plane" | "box" | null = null;
const clippingOriginInverse = new Cesium.Matrix4();
const clippingCenter = new Cesium.Cartesian3();

const GUIDE_FILL_ID = "tileset-clipping-guide-fill";
const GUIDE_OUTLINE_ID = "tileset-clipping-guide-outline";

const rangeMax = computed(() => Math.max(10, Math.ceil(modelRadius.value * 1.25)));
const rangeMin = computed(() => -rangeMax.value);
const minimumBoxSize = computed(() => Math.max(1, Math.ceil(modelRadius.value * 0.05)));
const sliderStep = computed(() => Math.max(1, Math.ceil(modelRadius.value / 100)));

const modeHint = computed(() => {
  if (clippingMode.value === "plane") {
    return "保留剖切面正向一侧，适合查看模型断面";
  }
  if (clippingMode.value === "box") {
    return "只保留模型中心盒体内的内容";
  }
  return "只保留模型中心以上的内容";
});

const statusText = computed(() => {
  if (!mapReady.value) return "等待地图初始化";
  if (loading.value) return "正在加载 3D Tiles";
  if (loadError.value) return "模型加载失败";
  if (!modelLoaded.value) return "等待模型";
  return `${statusNote.value} · 包围球半径 ${formatMeters(modelRadius.value)}`;
});

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  mapReady.value = true;
  statusNote.value = "正在连接模型资源";
  void loadTileset();
};

const loadTileset = async () => {
  if (!viewer || loading.value) return;

  loading.value = true;
  modelLoaded.value = false;
  loadError.value = "";
  statusNote.value = "正在请求模型";
  removeTileset();

  try {
    const nextTileset = await Cesium.Cesium3DTileset.fromUrl(TILESET_URL);
    if (!viewer) {
      nextTileset.destroy();
      return;
    }

    tileset = nextTileset;
    viewer.scene.primitives.add(nextTileset);
    updateModelRange(nextTileset);
    applyClipping();
    modelLoaded.value = true;
    updateClippingGuide();
    statusNote.value = "模型已加载，正在请求细节瓦片";

    nextTileset.initialTilesLoaded.addEventListener(() => {
      if (tileset === nextTileset) {
        statusNote.value = "模型细节已加载";
      }
    });

    await focusTileset();
  } catch (error) {
    console.error("3D Tiles 剖切案例加载失败:", error);
    loadError.value = "模型加载失败，请检查网络后重新加载";
    statusNote.value = "加载失败";
  } finally {
    loading.value = false;
  }
};

const updateModelRange = (nextTileset: Cesium.Cesium3DTileset) => {
  modelRadius.value = Math.max(nextTileset.boundingSphere.radius, 1);
  planeOffset.value = 0;
  heightOffset.value = 0;

  const defaultHalfSize = clamp(modelRadius.value * 0.72, minimumBoxSize.value, rangeMax.value);
  boxHalfWidth.value = defaultHalfSize;
  boxHalfDepth.value = defaultHalfSize;
  boxHalfHeight.value = defaultHalfSize;
};

const buildClippingPlanes = () => {
  const originMatrix = getClippingOriginMatrix();
  const center = originMatrix
    ? getClippingCenter(originMatrix)
    : Cesium.Cartesian3.ZERO;

  if (clippingMode.value === "plane") {
    const normal =
      planeAxis.value === "east"
        ? new Cesium.Cartesian3(1, 0, 0)
        : new Cesium.Cartesian3(0, 1, 0);
    return [
      new Cesium.ClippingPlane(
        normal,
        -Cesium.Cartesian3.dot(normal, center) - planeOffset.value,
      ),
    ];
  }

  if (clippingMode.value === "height") {
    const normal = new Cesium.Cartesian3(0, 0, 1);
    return [
      new Cesium.ClippingPlane(
        normal,
        -Cesium.Cartesian3.dot(normal, center) - heightOffset.value,
      ),
    ];
  }

  const createBoxPlane = (normal: Cesium.Cartesian3, halfSize: number) =>
    new Cesium.ClippingPlane(
      normal,
      halfSize - Cesium.Cartesian3.dot(normal, center),
    );

  return [
    createBoxPlane(new Cesium.Cartesian3(1, 0, 0), boxHalfWidth.value),
    createBoxPlane(new Cesium.Cartesian3(-1, 0, 0), boxHalfWidth.value),
    createBoxPlane(new Cesium.Cartesian3(0, 1, 0), boxHalfDepth.value),
    createBoxPlane(new Cesium.Cartesian3(0, -1, 0), boxHalfDepth.value),
    createBoxPlane(new Cesium.Cartesian3(0, 0, 1), boxHalfHeight.value),
    createBoxPlane(new Cesium.Cartesian3(0, 0, -1), boxHalfHeight.value),
  ];
};

const applyClipping = () => {
  if (!tileset) return;

  const planes = buildClippingPlanes();
  const color = Cesium.Color.fromCssColorString(edgeColor.value);
  const unionClippingRegions = clippingMode.value === "box";

  if (!clippingPlanes) {
    clippingPlanes = new Cesium.ClippingPlaneCollection({
      planes,
      enabled: clippingEnabled.value,
      unionClippingRegions,
      edgeColor: color,
      edgeWidth: edgeWidth.value,
    });
    tileset.clippingPlanes = clippingPlanes;
    updateClippingGuide();
    return;
  }

  if (clippingPlanes.length !== planes.length) {
    clippingPlanes.removeAll();
    planes.forEach((plane) => clippingPlanes?.add(plane));
  } else {
    for (let index = 0; index < planes.length; index += 1) {
      const currentPlane = clippingPlanes.get(index);
      const nextPlane = planes[index];
      currentPlane.normal = nextPlane.normal;
      currentPlane.distance = nextPlane.distance;
    }
  }
  clippingPlanes.enabled = clippingEnabled.value;
  clippingPlanes.unionClippingRegions = unionClippingRegions;
  clippingPlanes.edgeColor = color;
  clippingPlanes.edgeWidth = edgeWidth.value;
  updateClippingGuide();
};

const getClippingOriginMatrix = () => {
  if (!tileset) return undefined;

  // Cesium keeps this matrix private in the type declarations, but exposes it
  // at runtime as the exact local frame used by the tileset clipping planes.
  const runtimeTileset = tileset as Cesium.Cesium3DTileset & {
    clippingPlanesOriginMatrix?: Cesium.Matrix4;
  };
  return (
    runtimeTileset.clippingPlanesOriginMatrix ??
    Cesium.Transforms.eastNorthUpToFixedFrame(tileset.boundingSphere.center)
  );
};

const getClippingCenter = (originMatrix: Cesium.Matrix4) => {
  if (!tileset) {
    return Cesium.Cartesian3.ZERO;
  }

  Cesium.Matrix4.inverseTransformation(originMatrix, clippingOriginInverse);
  return Cesium.Matrix4.multiplyByPoint(
    clippingOriginInverse,
    tileset.boundingSphere.center,
    clippingCenter,
  );
};

const getPlaneGuideRotation = () => {
  if (clippingMode.value === "height") {
    return Cesium.Matrix3.clone(Cesium.Matrix3.IDENTITY);
  }

  if (planeAxis.value === "east") {
    // The guide plane is an XY plane with a +Z normal. Rotate it so that it
    // spans the local north/up axes and its normal points east.
    return new Cesium.Matrix3(
      0, 0, 1,
      1, 0, 0,
      0, 1, 0,
    );
  }

  // Span the local east/up axes and use north as the plane normal.
  return new Cesium.Matrix3(
    1, 0, 0,
    0, 0, 1,
    0, 1, 0,
  );
};

const clearClippingGuide = () => {
  if (viewer && clippingGuideFill) {
    viewer.scene.primitives.remove(clippingGuideFill);
  }
  if (viewer && clippingGuideOutline) {
    viewer.scene.primitives.remove(clippingGuideOutline);
  }
  clippingGuideFill = null;
  clippingGuideOutline = null;
  clippingGuideKind = null;
};

const ensureClippingGuide = (color: Cesium.Color) => {
  if (!viewer) return;

  const guideKind = clippingMode.value === "box" ? "box" : "plane";
  if (clippingGuideKind === guideKind && clippingGuideFill && clippingGuideOutline) {
    return;
  }
  clearClippingGuide();

  const fillGeometry =
    guideKind === "box"
      ? Cesium.BoxGeometry.createGeometry(
        Cesium.BoxGeometry.fromDimensions({
          dimensions: new Cesium.Cartesian3(1, 1, 1),
          vertexFormat: Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
        }),
      )
      : Cesium.PlaneGeometry.createGeometry(
        new Cesium.PlaneGeometry({
          vertexFormat: Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
        }),
      );
  const outlineGeometry =
    guideKind === "box"
      ? Cesium.BoxOutlineGeometry.createGeometry(
        Cesium.BoxOutlineGeometry.fromDimensions({
          dimensions: new Cesium.Cartesian3(1, 1, 1),
        }),
      )
      : Cesium.PlaneOutlineGeometry.createGeometry();

  if (!fillGeometry || !outlineGeometry) return;

  const fillInstance = new Cesium.GeometryInstance({
    geometry: fillGeometry,
    id: GUIDE_FILL_ID,
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(
        color.withAlpha(0.1),
      ),
    },
  });
  const outlineInstance = new Cesium.GeometryInstance({
    geometry: outlineGeometry,
    id: GUIDE_OUTLINE_ID,
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(
        color.withAlpha(0.95),
      ),
    },
  });

  clippingGuideFill = viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: fillInstance,
      appearance: new Cesium.PerInstanceColorAppearance({
        flat: true,
        translucent: true,
        closed: false,
      }),
      asynchronous: false,
      allowPicking: false,
      cull: false,
    }),
  );
  clippingGuideOutline = viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: outlineInstance,
      appearance: new Cesium.PerInstanceColorAppearance({
        flat: true,
        translucent: true,
        closed: false,
      }),
      asynchronous: false,
      allowPicking: false,
      cull: false,
    }),
  );
  clippingGuideKind = guideKind;
};

const updateClippingGuideColor = (color: Cesium.Color) => {
  if (clippingGuideFill?.ready) {
    const attributes = clippingGuideFill.getGeometryInstanceAttributes(
      GUIDE_FILL_ID,
    );
    if (attributes?.color) {
      attributes.color = Cesium.ColorGeometryInstanceAttribute.toValue(
        color.withAlpha(0.1),
        attributes.color,
      );
    }
  }

  if (clippingGuideOutline?.ready) {
    const attributes = clippingGuideOutline.getGeometryInstanceAttributes(
      GUIDE_OUTLINE_ID,
    );
    if (attributes?.color) {
      attributes.color = Cesium.ColorGeometryInstanceAttribute.toValue(
        color.withAlpha(0.95),
        attributes.color,
      );
    }
  }
};

const getClippingGuideModelMatrix = (
  originMatrix: Cesium.Matrix4,
): Cesium.Matrix4 => {
  const localPosition = new Cesium.Cartesian3();
  const center = getClippingCenter(originMatrix);
  let localRotation = Cesium.Matrix3.clone(Cesium.Matrix3.IDENTITY);
  let scale = new Cesium.Cartesian3();

  if (clippingMode.value === "box") {
    Cesium.Cartesian3.clone(center, localPosition);
    scale = new Cesium.Cartesian3(
      boxHalfWidth.value * 2,
      boxHalfDepth.value * 2,
      boxHalfHeight.value * 2,
    );
  } else {
    const planeSize = Math.max(modelRadius.value * 2.2, 100);
    // PlaneGeometry has no depth. The third component is kept at one so the
    // guide remains a true zero-thickness surface.
    scale = new Cesium.Cartesian3(planeSize, planeSize, 1);
    Cesium.Cartesian3.clone(center, localPosition);

    if (clippingMode.value === "height") {
      localPosition.z += heightOffset.value;
    } else if (planeAxis.value === "east") {
      localPosition.x += planeOffset.value;
      localRotation = getPlaneGuideRotation();
    } else {
      localPosition.y += planeOffset.value;
      localRotation = getPlaneGuideRotation();
    }
  }

  const localTransform = Cesium.Matrix4.fromRotationTranslation(
    localRotation,
    localPosition,
    new Cesium.Matrix4(),
  );
  Cesium.Matrix4.multiply(
    localTransform,
    Cesium.Matrix4.fromScale(scale, new Cesium.Matrix4()),
    localTransform,
  );

  return Cesium.Matrix4.multiply(
    originMatrix,
    localTransform,
    new Cesium.Matrix4(),
  );
};

const updateClippingGuide = () => {
  if (!viewer || !tileset || !modelLoaded.value) return;

  const originMatrix = getClippingOriginMatrix();
  if (!originMatrix) return;

  const color = Cesium.Color.fromCssColorString(edgeColor.value);
  ensureClippingGuide(color);
  updateClippingGuideColor(color);

  const modelMatrix = getClippingGuideModelMatrix(originMatrix);
  if (clippingGuideFill) {
    clippingGuideFill.modelMatrix = modelMatrix;
  }
  if (clippingGuideOutline) {
    clippingGuideOutline.modelMatrix = modelMatrix;
  }
};

const focusTileset = () => {
  if (!viewer || !tileset) return;

  const offset = new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(25),
    Cesium.Math.toRadians(-35),
    Math.max(modelRadius.value * 3.4, 120),
  );

  viewer.camera.cancelFlight();
  return new Promise<void>((resolve) => {
    viewer?.camera.flyToBoundingSphere(tileset!.boundingSphere, {
      offset,
      duration: 1.2,
      complete: resolve,
      cancel: resolve,
    });
  });
};

const resetCamera = () => {
  void focusTileset();
};

const resetClipping = () => {
  clippingMode.value = "plane";
  planeAxis.value = "east";
  planeOffset.value = 0;
  heightOffset.value = 0;
  const defaultHalfSize = clamp(modelRadius.value * 0.72, minimumBoxSize.value, rangeMax.value);
  boxHalfWidth.value = defaultHalfSize;
  boxHalfDepth.value = defaultHalfSize;
  boxHalfHeight.value = defaultHalfSize;
  clippingEnabled.value = true;
  edgeColor.value = "#29d3ff";
  edgeWidth.value = 3;
};

const removeTileset = () => {
  clearClippingGuide();
  if (viewer && tileset) {
    viewer.scene.primitives.remove(tileset);
  }
  tileset = null;
  clippingPlanes = null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatMeters = (value: number) => {
  const sign = value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1000) {
    return `${sign}${(absoluteValue / 1000).toFixed(2)} km`;
  }
  return `${sign}${Math.round(absoluteValue)} m`;
};

watch(
  [
    clippingMode,
    planeAxis,
    planeOffset,
    boxHalfWidth,
    boxHalfDepth,
    boxHalfHeight,
    heightOffset,
    clippingEnabled,
    edgeColor,
    edgeWidth,
  ],
  applyClipping,
  { flush: "sync" },
);

onUnmounted(() => {
  removeTileset();
  viewer = null;
});
</script>

<style scoped lang="scss">
.clipping-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.clipping-panel {
  position: absolute;
  top: 64px;
  left: 14px;
  z-index: 2001;
  width: 350px;
  max-height: calc(100vh - 82px);
  padding: 14px;
  overflow-y: auto;
  color: #f5fbff;
  user-select: none;
  background: rgba(12, 22, 31, 0.9);
  border: 1px solid rgba(154, 215, 232, 0.24);
  border-radius: 8px;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);

  &.collapsed {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    padding: 0;
    overflow: hidden;
    border-radius: 50%;
    background: rgba(10, 112, 137, 0.94);
  }
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding-right: 34px;
}

.panel-title {
  color: #f3fbff;
  font-size: 16px;
  font-weight: 600;
}

.panel-subtitle {
  margin-top: 4px;
  color: rgba(218, 239, 247, 0.68);
  font-size: 12px;
}

.header-icon {
  color: #46d9ed;
}

.icon-button,
.panel-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: #dff9ff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(209, 238, 247, 0.16);
  border-radius: 6px;
  cursor: pointer;
}

.panel-close {
  position: absolute;
  top: 10px;
  right: 10px;
}

.panel-open {
  width: 42px;
  height: 42px;
  border: 0;
  background: transparent;
}

.status-line {
  display: flex;
  align-items: center;
  min-height: 30px;
  gap: 8px;
  padding: 7px 9px;
  color: rgba(223, 240, 247, 0.82);
  font-size: 12px;
  line-height: 1.4;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 5px;

  &.ready {
    color: #bfffee;
  }

  &.error {
    color: #ffb8b8;
  }
}

.status-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  background: #f1b94c;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(241, 185, 76, 0.65);
}

.status-line.ready .status-dot {
  background: #3ee6a1;
  box-shadow: 0 0 8px rgba(62, 230, 161, 0.65);
}

.status-line.error .status-dot {
  background: #ff6b6b;
  box-shadow: 0 0 8px rgba(255, 107, 107, 0.65);
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  color: #a9d9e8;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.section-hint {
  color: rgba(221, 239, 245, 0.64);
  font-size: 12px;
  line-height: 1.4;
}

.control-row,
.display-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 30px;
  color: rgba(235, 247, 250, 0.88);
  font-size: 13px;
}

.display-row {
  grid-template-columns: 1fr auto;
}

.control-label {
  white-space: nowrap;
}

.unit {
  color: rgba(222, 241, 247, 0.62);
  font-size: 12px;
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.slider-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(225, 242, 247, 0.78);
  font-size: 12px;

  strong {
    color: #f1fbff;
    font-weight: 600;
  }
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding-top: 2px;
}

.error-message {
  padding: 8px 9px;
  color: #ffb7b7;
  font-size: 12px;
  line-height: 1.45;
  background: rgba(133, 36, 52, 0.3);
  border: 1px solid rgba(255, 117, 117, 0.2);
  border-radius: 5px;
}

:deep(.el-radio-group) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

:deep(.control-row .el-radio-group) {
  grid-column: 2 / 4;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

:deep(.el-radio-button__inner) {
  width: 100%;
  padding-right: 7px;
  padding-left: 7px;
}

:deep(.el-slider) {
  --el-slider-main-bg-color: #28c9dd;
  --el-slider-runway-bg-color: rgba(222, 231, 244, 0.2);
}

:deep(.el-input-number--small) {
  width: 100%;
}

:deep(.el-color-picker--small) {
  height: 28px;
}

:deep(.el-button--small) {
  min-height: 28px;
}

@media (max-width: 640px) {
  .clipping-panel {
    top: 58px;
    left: 10px;
    width: min(350px, calc(100vw - 20px));
    max-height: calc(100vh - 70px);
  }
}
</style>
