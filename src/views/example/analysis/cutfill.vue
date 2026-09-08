<template>
  <div class="menubox box2">
    <el-switch
      v-model="isMeasuring"
      inline-prompt
      size="large"
      style="--el-switch-off-color: #ff4949"
      active-text="开启绘制"
      inactive-text="停止绘制"
    />
    <div class="param-item">
      <span class="param-label">网格间距：</span>
      <el-input-number v-model="gridSpacing" :min="10" :max="100" :step="10" size="small" />
      <span class="param-unit">米</span>
    </div>
    <div class="param-item">
      <span class="param-label">基准高程：</span>
      <el-radio-group v-model="baseMode" size="small">
        <el-radio value="avg">平均高程</el-radio>
        <el-radio value="manual">手动输入</el-radio>
      </el-radio-group>
    </div>
    <div class="param-item" v-if="baseMode === 'manual'">
      <span class="param-label">基准值：</span>
      <el-input-number v-model="manualBase" :min="0" :step="1" size="small" />
      <span class="param-unit">米</span>
    </div>
    <div class="result-box" v-if="computing">
      <div class="result-item">
        <span class="value">采样中...</span>
      </div>
    </div>
    <div class="result-box" v-else-if="result">
      <div class="result-item">
        <span class="label">基准高程：</span>
        <span class="value">{{ result.baseHeight.toFixed(2) }} m</span>
      </div>
      <div class="result-item">
        <span class="label">区域面积：</span>
        <span class="value">{{ Math.round(regionArea).toLocaleString() }} m²</span>
      </div>
      <div class="result-item">
        <span class="label">挖方量：</span>
        <span class="value">{{ Math.round(result.cutVolume).toLocaleString() }} m³</span>
      </div>
      <div class="result-item">
        <span class="label">填方量：</span>
        <span class="value">{{ Math.round(result.fillVolume).toLocaleString() }} m³</span>
      </div>
      <div class="result-item">
        <span class="label">净方量：</span>
        <span class="value">{{ Math.round(result.netVolume).toLocaleString() }} m³</span>
      </div>
    </div>
    <div class="result-box" v-else-if="hint">
      <div class="result-item">
        <span class="value">{{ hint }}</span>
      </div>
    </div>
    <div ref="chartRef" class="chart-box"></div>
    <div>
      <el-button type="danger" @click="handleClear">清除结果</el-button>
    </div>
  </div>
  <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import * as echarts from "echarts";
import Map from "@/components/cesium/map.vue";
import {
  buildGridPrimitive,
  computeCutFill,
  pickPositionOnMap,
  samplePolygonGrid,
  type CutFillCell,
  type CutFillResult,
  type LonLat,
  type PolygonGridResult,
} from "@/modules/cesium/analysisUtils";

var viewer: Cesium.Viewer;
const isMeasuring = ref(false);
const gridSpacing = ref(30);
const baseMode = ref<"avg" | "manual">("avg");
const manualBase = ref(0);
const computing = ref(false);
const hint = ref("");
const result = ref<CutFillResult | null>(null);
const regionArea = ref(0);
const chartRef = ref<HTMLDivElement>();

let chart: echarts.ECharts | null = null;
let gridResult: PolygonGridResult | null = null; // 采样网格缓存
let polygonLngLats: LonLat[] = []; // 已绘制区域（改间距重新采样用）
let gridPrimitive: Cesium.Primitive | null = null;
let boundaryEntity: Cesium.Entity | null = null;
let previewLineEntity: Cesium.Entity | null = null;
let labelEntity: Cesium.Entity | null = null;
let pointEntities: Cesium.Entity[] = [];
let positions: Cesium.Cartesian3[] = [];
let isDrawing = false;
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  // 让实体与真实地形正确遮挡
  viewer.scene.globe.depthTestAgainstTerrain = true;
  handleClickListener();
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

const handleClear = () => {
  [previewLineEntity, boundaryEntity, labelEntity].forEach((entity) => {
    if (entity) {
      viewer.entities.remove(entity);
    }
  });
  previewLineEntity = null;
  boundaryEntity = null;
  labelEntity = null;
  pointEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  pointEntities = [];
  if (gridPrimitive) {
    viewer.scene.primitives.remove(gridPrimitive);
    gridPrimitive = null;
  }
  positions = [];
  polygonLngLats = [];
  gridResult = null;
  isDrawing = false;
  computing.value = false;
  result.value = null;
  regionArea.value = 0;
  hint.value = "";
  chart?.clear();
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

const updatePreviewLine = () => {
  if (previewLineEntity) {
    viewer.entities.remove(previewLineEntity);
  }
  if (positions.length < 2) return;
  previewLineEntity = viewer.entities.add({
    polyline: {
      positions: [...positions],
      width: 3,
      material: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.YELLOW,
        glowPower: 0.3,
      }),
      clampToGround: false,
    },
  });
};

/** 区域边界轮廓线 */
const drawBoundary = () => {
  if (boundaryEntity) {
    viewer.entities.remove(boundaryEntity);
  }
  boundaryEntity = viewer.entities.add({
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(positions),
      perPositionHeight: true,
      material: Cesium.Color.YELLOW.withAlpha(0.15),
      outline: true,
      outlineColor: Cesium.Color.YELLOW,
    },
  });
};

/** 按高差着色网格：正=挖（红），负=填（青），接近 0 灰 */
const renderGrid = () => {
  if (gridPrimitive) {
    viewer.scene.primitives.remove(gridPrimitive);
    gridPrimitive = null;
  }
  if (!gridResult || !result.value) return;

  // 注意：不能用全局 Map，组件名 Map 会遮蔽全局构造函数
  const cellMap: Record<string, CutFillCell> = {};
  result.value.cells.forEach((c) => {
    cellMap[`${c.row},${c.col}`] = c;
  });
  const maxAbs = result.value.cells.reduce((m, c) => Math.max(m, Math.abs(c.dh)), 0.001);

  const colorOf = (row: number, col: number): Cesium.Color => {
    const cell = cellMap[`${row},${col}`];
    if (!cell) return Cesium.Color.GRAY.withAlpha(0.2);
    const t = Math.min(Math.abs(cell.dh) / maxAbs, 1);
    if (cell.dh > 0.5) return Cesium.Color.fromCssColorString("#ff4757").withAlpha(0.25 + 0.55 * t);
    if (cell.dh < -0.5) return Cesium.Color.fromCssColorString("#00d2ff").withAlpha(0.25 + 0.55 * t);
    return Cesium.Color.fromCssColorString("#9aa0a6").withAlpha(0.35);
  };

  const primitive = buildGridPrimitive(gridResult, colorOf, 1.5);
  if (primitive) {
    viewer.scene.primitives.add(primitive);
    gridPrimitive = primitive;
  }
};

/** 10 档高差-体积直方图 */
const renderChart = () => {
  if (!result.value) return;
  if (!chart && chartRef.value) {
    chart = echarts.init(chartRef.value);
  }
  if (!chart) return;

  chart.setOption({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(34,34,34,0.9)",
      borderColor: "#555",
      textStyle: { color: "#fff" },
    },
    grid: { left: 60, right: 12, top: 20, bottom: 35 },
    xAxis: {
      type: "category",
      data: result.value.histogram.map((h) => h.range),
      axisLabel: {
        color: "#aaa",
        fontSize: 9,
        rotate: 40,
        formatter: (value: string) => value.split(" ~ ")[0],
      },
      axisLine: { lineStyle: { color: "#666" } },
    },
    yAxis: {
      type: "value",
      name: "m³",
      nameTextStyle: { color: "#aaa" },
      axisLabel: { color: "#aaa" },
      splitLine: { lineStyle: { color: "#333" } },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 22,
        data: result.value.histogram.map((h, i) => {
          const lo = parseFloat(h.range.split(" ~ ")[0]);
          const hi = parseFloat(h.range.split(" ~ ")[1]);
          const color = lo >= 0 ? "#ff4757" : hi <= 0 ? "#00d2ff" : "#9aa0a6";
          return { value: Number(h.volume.toFixed(2)), itemStyle: { color }, _i: i };
        }),
      },
    ],
  });
};

/** 用缓存网格按当前基准高程重算（不重新采样） */
const computeFromGrid = () => {
  if (!gridResult) return;
  const base = baseMode.value === "manual" ? manualBase.value : undefined;
  result.value = computeCutFill(gridResult, base);
  regionArea.value = result.value.cells.length * gridResult.cellArea;
  renderGrid();
  renderChart();
};

/** 重新采样（间距变更时） */
const resample = async () => {
  if (!polygonLngLats.length || !gridResult) return;
  computing.value = true;
  try {
    gridResult = await samplePolygonGrid(viewer, polygonLngLats, gridSpacing.value);
    computeFromGrid();
  } catch (error) {
    console.error("网格采样失败:", error);
    hint.value = "网格采样失败，请重试";
  } finally {
    computing.value = false;
  }
};

/** 右键结束绘制 */
const finishDrawing = () => {
  if (!isMeasuring.value || !isDrawing) return;
  isDrawing = false;

  // 移除临时标签
  if (labelEntity) {
    viewer.entities.remove(labelEntity);
    labelEntity = null;
  }

  if (positions.length < 3) {
    hint.value = "至少需要 3 个点才能构成面";
    return;
  }

  polygonLngLats = positions.map((p) => {
    const carto = Cesium.Cartographic.fromCartesian(p);
    return {
      lng: Cesium.Math.toDegrees(carto.longitude),
      lat: Cesium.Math.toDegrees(carto.latitude),
    };
  });

  hint.value = "";
  computing.value = true;
  samplePolygonGrid(viewer, polygonLngLats, gridSpacing.value)
    .then((g) => {
      gridResult = g;
      drawBoundary();
      computeFromGrid();
    })
    .catch((error) => {
      console.error("网格采样失败:", error);
      hint.value = "网格采样失败，请重试";
    })
    .finally(() => {
      computing.value = false;
    });
};

const handleClickListener = () => {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  // 左键点击添加顶点
  handler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!isMeasuring.value) return;

      if (!isDrawing) {
        isDrawing = true;
        positions = [];
        result.value = null;
        hint.value = "";
        chart?.clear();
      }

      const cartesian = pickPositionOnMap(viewer, event.position);
      if (!cartesian) return;

      positions.push(cartesian);
      addPointMarker(cartesian, positions.length);
      updatePreviewLine();

      // 最后一个点上显示顶点数
      if (labelEntity) {
        viewer.entities.remove(labelEntity);
      }
      labelEntity = viewer.entities.add({
        position: cartesian,
        label: {
          text: `点${positions.length}`,
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
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );

  // 右键结束绘制
  handler.setInputAction(() => {
    finishDrawing();
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  mouseHandler = handler;
};

// 基准高程变化 → 缓存网格重算
watch([baseMode, manualBase], () => {
  computeFromGrid();
});

// 网格间距变化 → 重新采样
watch(gridSpacing, () => {
  if (gridResult && !computing.value) {
    resample();
  }
});

onUnmounted(() => {
  if (mouseHandler) {
    mouseHandler.destroy();
  }
  if (chart) {
    chart.dispose();
    chart = null;
  }
  if (viewer) {
    [previewLineEntity, boundaryEntity, labelEntity].forEach((entity) => {
      if (entity) viewer.entities.remove(entity);
    });
    pointEntities.forEach((entity) => {
      viewer.entities.remove(entity);
    });
    if (gridPrimitive) {
      viewer.scene.primitives.remove(gridPrimitive);
      gridPrimitive = null;
    }
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
    width: 410px;
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
      }
    }
  }

  .chart-box {
    width: 380px;
    height: 220px;
    margin: 0 auto;
  }
}
</style>
