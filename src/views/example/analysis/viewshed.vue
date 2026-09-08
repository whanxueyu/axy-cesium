<template>
  <div class="menubox box2">
    <el-radio-group v-model="mode" size="small">
      <el-radio value="los">两点通视</el-radio>
      <el-radio value="sector">可视域</el-radio>
    </el-radio-group>
    <el-switch
      v-model="isMeasuring"
      inline-prompt
      size="large"
      style="--el-switch-off-color: #ff4949"
      :active-text="mode === 'los' ? '开启绘制' : '拾取观察点'"
      inactive-text="停止绘制"
    />
    <div class="param-item">
      <span class="param-label">观察点高度：</span>
      <el-input-number v-model="obsHeight" :min="0" :max="500" :step="1" size="small" />
      <span class="param-unit">米</span>
    </div>

    <!-- 两点通视结果 -->
    <template v-if="mode === 'los'">
      <div class="result-box" v-if="losResult">
        <div class="result-item">
          <span class="label">通视情况：</span>
          <span class="value" :class="losResult.visible ? 'ok' : 'bad'">
            {{ losResult.visible ? "通视" : "不通视" }}
          </span>
        </div>
        <div class="result-item">
          <span class="label">两点距离：</span>
          <span class="value">{{ losResult.distance.toFixed(2) }} m</span>
        </div>
        <div class="result-item" v-if="!losResult.visible">
          <span class="label">遮挡点高程：</span>
          <span class="value">{{ losResult.obstructionHeight.toFixed(2) }} m</span>
        </div>
      </div>
      <div class="result-box" v-else-if="hint">
        <div class="result-item">
          <span class="value">{{ hint }}</span>
        </div>
      </div>
    </template>

    <!-- 可视域参数与结果 -->
    <template v-else>
      <div class="param-item">
        <span class="param-label">扫描半径：</span>
        <el-input-number v-model="radius" :min="500" :max="10000" :step="100" size="small" />
        <span class="param-unit">米</span>
      </div>
      <div class="param-item">
        <span class="param-label">起始方位角：</span>
        <el-input-number v-model="startAngle" :min="0" :max="360" :step="10" size="small" />
        <span class="param-unit">度</span>
      </div>
      <div class="param-item">
        <span class="param-label">结束方位角：</span>
        <el-input-number v-model="endAngle" :min="0" :max="360" :step="10" size="small" />
        <span class="param-unit">度</span>
      </div>
      <div class="param-item">
        <span class="param-label">角度步长：</span>
        <el-input-number v-model="angleStep" :min="0.5" :max="10" :step="0.5" size="small" />
        <span class="param-unit">度</span>
      </div>
      <el-button type="primary" :loading="computing" @click="startSectorAnalysis">开始分析</el-button>
      <div class="result-box" v-if="computing">
        <div class="result-item">
          <span class="value">分析中...</span>
        </div>
      </div>
      <div class="result-box" v-else-if="sectorResult">
        <div class="result-item">
          <span class="label">可视域面积：</span>
          <span class="value">{{ sectorResult.area.toFixed(2) }} m²</span>
        </div>
        <div class="result-item">
          <span class="label">总射线数：</span>
          <span class="value">{{ sectorResult.rayCount }} 条</span>
        </div>
        <div class="result-item">
          <span class="label">可见射线：</span>
          <span class="value">{{ sectorResult.rayCount - sectorResult.blocked }} 条</span>
        </div>
        <div class="result-item">
          <span class="label">被挡射线：</span>
          <span class="value">{{ sectorResult.blocked }} 条</span>
        </div>
      </div>
      <div class="result-box" v-else-if="hint">
        <div class="result-item">
          <span class="value">{{ hint }}</span>
        </div>
      </div>
    </template>

    <div>
      <el-button type="danger" @click="handleClear">清除结果</el-button>
    </div>
  </div>
  <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import Map from "@/components/cesium/map.vue";
import {
  computeViewshedSector,
  isLineOfSightClear,
  pickPositionOnMap,
} from "@/modules/cesium/analysisUtils";

var viewer: Cesium.Viewer;
const mode = ref<"los" | "sector">("los");
const isMeasuring = ref(false);
const obsHeight = ref(2);
const radius = ref(3000);
const startAngle = ref(0);
const endAngle = ref(360);
const angleStep = ref(1);
const computing = ref(false);
const hint = ref("");
const losResult = ref<{
  visible: boolean;
  distance: number;
  obstructionHeight: number;
} | null>(null);
const sectorResult = ref<{
  area: number;
  rayCount: number;
  blocked: number;
} | null>(null);

let losLineEntity: Cesium.Entity | null = null;
let obstructionEntity: Cesium.Entity | null = null;
let sectorPolygonEntity: Cesium.Entity | null = null;
let observerEntity: Cesium.Entity | null = null;
let labelEntity: Cesium.Entity | null = null;
let pointEntities: Cesium.Entity[] = [];
let losPoints: Cesium.Cartesian3[] = []; // 两点通视的 2 个点
let observerPos: Cesium.Cartesian3 | null = null; // 可视域观察点
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  // 让实体与真实地形正确遮挡
  viewer.scene.globe.depthTestAgainstTerrain = true;
  mouseHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  bindActions();
  reset();
};

const reset = () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(103.82, 36.02, 3000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-40),
      roll: 0.0,
    },
    duration: 1,
  });
};

/** 清除全部实体与结果（保留模式与参数） */
const handleClear = () => {
  [losLineEntity, obstructionEntity, sectorPolygonEntity, observerEntity, labelEntity].forEach(
    (entity) => {
      if (entity) viewer.entities.remove(entity);
    },
  );
  losLineEntity = null;
  obstructionEntity = null;
  sectorPolygonEntity = null;
  observerEntity = null;
  labelEntity = null;
  pointEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  pointEntities = [];
  losPoints = [];
  observerPos = null;
  losResult.value = null;
  sectorResult.value = null;
  computing.value = false;
  hint.value = "";
};

const addPointMarker = (position: Cesium.Cartesian3, index: number) => {
  const point = viewer.entities.add({
    position: position,
    point: {
      pixelSize: 8,
      color: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.MAX_VALUE,
    },
    label: {
      text: `${index}`,
      font: "bold 14pt monospace",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      pixelOffset: new Cesium.Cartesian2(0, 10),
      disableDepthTestDistance: Number.MAX_VALUE,
    },
  });
  pointEntities.push(point);
};

const addLabel = (position: Cesium.Cartesian3, text: string) => {
  if (labelEntity) {
    viewer.entities.remove(labelEntity);
  }
  labelEntity = viewer.entities.add({
    position: position,
    label: {
      text: text,
      font: "bold 14pt monospace",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -9),
      disableDepthTestDistance: Number.MAX_VALUE,
    },
  });
};

/** 两点通视：左键拾取 2 点后自动计算 */
const onLosClick = (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
  if (!isMeasuring.value) return;

  if (losPoints.length >= 2) {
    // 开始新的一组
    [losLineEntity, obstructionEntity].forEach((entity) => {
      if (entity) viewer.entities.remove(entity);
    });
    losLineEntity = null;
    obstructionEntity = null;
    pointEntities.forEach((entity) => {
      viewer.entities.remove(entity);
    });
    pointEntities = [];
    losPoints = [];
    losResult.value = null;
  }

  const cartesian = pickPositionOnMap(viewer, event.position);
  if (!cartesian) return;

  losPoints.push(cartesian);
  addPointMarker(cartesian, losPoints.length);
  addLabel(cartesian, `点${losPoints.length}`);

  if (losPoints.length === 2) {
    computeLos();
  }
};

/** 计算两点通视 */
const computeLos = () => {
  const from = raisePoint(losPoints[0]);
  const to = raisePoint(losPoints[1]);
  const result = isLineOfSightClear(viewer, from, to);

  const distance = Cesium.Cartesian3.distance(losPoints[0], losPoints[1]);
  losResult.value = {
    visible: result.visible,
    distance,
    obstructionHeight: result.obstruction
      ? Cesium.Cartographic.fromCartesian(result.obstruction).height
      : 0,
  };

  // 通视绿线 / 不通视红线
  losLineEntity = viewer.entities.add({
    polyline: {
      positions: [from, to],
      width: 3,
      material: result.visible ? Cesium.Color.LIME : Cesium.Color.RED,
      clampToGround: false,
    },
  });

  // 遮挡点黄点标记
  if (result.obstruction) {
    obstructionEntity = viewer.entities.add({
      position: result.obstruction,
      point: {
        pixelSize: 10,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.MAX_VALUE,
      },
      label: {
        text: "遮挡点",
        font: "bold 14pt monospace",
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12),
        disableDepthTestDistance: Number.MAX_VALUE,
      },
    });
  }
};

/** 可视域：左键拾取观察点 */
const onSectorClick = (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
  if (!isMeasuring.value) return;

  const cartesian = pickPositionOnMap(viewer, event.position);
  if (!cartesian) return;

  observerPos = cartesian;
  if (observerEntity) {
    viewer.entities.remove(observerEntity);
  }
  observerEntity = viewer.entities.add({
    position: cartesian,
    point: {
      pixelSize: 10,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.MAX_VALUE,
    },
  });
  addLabel(cartesian, "观察点");
};

/** 可视域扇形扫描分析 */
const startSectorAnalysis = async () => {
  if (!observerPos) {
    hint.value = "请先拾取观察点";
    return;
  }
  const carto = Cesium.Cartographic.fromCartesian(observerPos);
  computing.value = true;
  hint.value = "";
  try {
    const r = await computeViewshedSector(viewer, {
      center: {
        lng: Cesium.Math.toDegrees(carto.longitude),
        lat: Cesium.Math.toDegrees(carto.latitude),
      },
      observerHeight: obsHeight.value,
      radius: radius.value,
      startAngle: startAngle.value,
      endAngle: endAngle.value,
      angleStep: angleStep.value,
    });

    sectorResult.value = {
      area: r.area2D,
      rayCount: r.rayCount,
      blocked: r.blockedRayCount,
    };

    // 绿色半透明可视域多边形（边界高程抬升 1.5m）
    if (sectorPolygonEntity) {
      viewer.entities.remove(sectorPolygonEntity);
    }
    sectorPolygonEntity = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(
          r.boundary.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.height + 1.5)),
        ),
        perPositionHeight: true,
        material: Cesium.Color.GREEN.withAlpha(0.35),
        outline: true,
        outlineColor: Cesium.Color.LIME,
      },
    });
  } catch (error) {
    console.error("可视域分析失败:", error);
    hint.value = "可视域分析失败，请重试";
  } finally {
    computing.value = false;
  }
};

/** 地表点抬升观察点高度 */
const raisePoint = (p: Cesium.Cartesian3) => {
  const carto = Cesium.Cartographic.fromCartesian(p);
  return Cesium.Cartesian3.fromDegrees(
    Cesium.Math.toDegrees(carto.longitude),
    Cesium.Math.toDegrees(carto.latitude),
    carto.height + obsHeight.value,
  );
};

/** 按当前模式绑定交互 */
const bindActions = () => {
  if (!mouseHandler) return;
  // 右键无操作（contextmenu 已全局禁用）
  mouseHandler.setInputAction(() => {}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  mouseHandler.setInputAction(
    mode.value === "los" ? onLosClick : onSectorClick,
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );
};

// 模式切换 → 清空结果并重绑交互
watch(mode, () => {
  handleClear();
  bindActions();
});

onUnmounted(() => {
  if (mouseHandler) {
    mouseHandler.destroy();
  }
  if (viewer) {
    [losLineEntity, obstructionEntity, sectorPolygonEntity, observerEntity, labelEntity].forEach(
      (entity) => {
        if (entity) viewer.entities.remove(entity);
      },
    );
    pointEntities.forEach((entity) => {
      viewer.entities.remove(entity);
    });
  }
});
</script>

<style scoped lang="scss">
.menubox {
  position: absolute;
  z-index: 999;
  border-bottom-right-radius: 10px;
  border: 1px solid rgba(139, 139, 139, 0.2);
  background-color: #222222;
  color: #fff;
  user-select: none;
  transition: all 0.3s;
  padding: 10px;

  &.box2 {
    left: 5px;
    top: 65px;
    width: 300px;
  }

  .param-item {
    display: flex;
    align-items: center;
    margin-top: 10px;

    .param-label {
      color: #aaa;
      font-size: 14px;
      white-space: nowrap;
    }

    .param-unit {
      color: #aaa;
      font-size: 13px;
      margin-left: 5px;
    }

    :deep(.el-radio__label) {
      color: #ccc;
      font-size: 13px;
    }
  }

  .result-box {
    margin: 10px 0;
    padding: 8px;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 4px;

    .result-item {
      margin: 5px 0;
      font-size: 14px;

      .label {
        color: #aaa;
        margin-right: 5px;
      }

      .value {
        color: #00eeff;
        font-weight: bold;

        &.ok {
          color: #00ee7f;
        }

        &.bad {
          color: #ff4757;
        }
      }
    }
  }

  .el-button {
    margin: 10px 5px 0 0;
  }
}
</style>
