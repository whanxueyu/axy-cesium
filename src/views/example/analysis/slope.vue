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

    <!-- 坡度分级图例 -->
    <div class="legend-box">
      <div v-for="level in SLOPE_LEVELS" :key="level.name" class="legend-item">
        <span class="legend-color" :style="{ backgroundColor: level.color }"></span>
        <span class="legend-text">{{ level.name }}</span>
      </div>
    </div>

    <div class="result-box" v-if="computing">
      <div class="result-item">
        <span class="value">采样中...</span>
      </div>
    </div>
    <div class="result-box" v-else-if="gridStats">
      <div class="result-item">
        <span class="label">平均坡度：</span>
        <span class="value">{{ gridStats.avgSlope.toFixed(2) }}°</span>
      </div>
      <div class="result-item">
        <span class="label">最大坡度：</span>
        <span class="value">{{ gridStats.maxSlope.toFixed(2) }}°</span>
      </div>
      <div class="result-item">
        <span class="label">网格数：</span>
        <span class="value">{{ gridStats.cellCount }} 个</span>
      </div>
    </div>
    <div class="result-box" v-else-if="hint">
      <div class="result-item">
        <span class="value">{{ hint }}</span>
      </div>
    </div>

    <div ref="chartRef" class="chart-box"></div>

    <el-button
      :type="queryMode ? 'warning' : 'primary'"
      @click="toggleQueryMode"
    >
      {{ queryMode ? "退出查询" : "查询坡度坡向" }}
    </el-button>

    <div class="result-box" v-if="queryResult">
      <div class="result-item">
        <span class="label">坡度：</span>
        <span class="value">{{ queryResult.slope.toFixed(2) }}°</span>
      </div>
      <div class="result-item">
        <span class="label">坡向：</span>
        <span class="value">{{ queryResult.aspect.toFixed(2) }}°（{{ queryResult.aspectName }}）</span>
      </div>
      <div class="result-item">
        <span class="label">分级：</span>
        <span class="value">{{ SLOPE_LEVELS[queryResult.level].name }}</span>
      </div>
    </div>

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
  buildGridHeightMap,
  buildGridPrimitive,
  computeSlopeAspect,
  pickPositionOnMap,
  samplePolygonGrid,
  SLOPE_LEVELS,
  type LonLat,
  type PolygonGridResult,
  type SlopeAspectCell,
} from "@/modules/cesium/analysisUtils";

var viewer: Cesium.Viewer;
const isMeasuring = ref(false);
const gridSpacing = ref(30);
const computing = ref(false);
const hint = ref("");
const gridStats = ref<{ avgSlope: number; maxSlope: number; cellCount: number } | null>(null);
const queryMode = ref(false);
const queryResult = ref<{
  slope: number;
  aspect: number;
  aspectName: string;
  level: number;
} | null>(null);
const chartRef = ref<HTMLDivElement>();

const ASPECT_NAMES = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];

let chart: echarts.ECharts | null = null;
let gridResult: PolygonGridResult | null = null;
let slopeCells: SlopeAspectCell[] = [];
let polygonLngLats: LonLat[] = [];
let gridPrimitive: Cesium.Primitive | null = null;
let boundaryEntity: Cesium.Entity | null = null;
let queryMarkerEntity: Cesium.Entity | null = null;
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
  [previewLineEntity, boundaryEntity, queryMarkerEntity, labelEntity].forEach((entity) => {
    if (entity) {
      viewer.entities.remove(entity);
    }
  });
  previewLineEntity = null;
  boundaryEntity = null;
  queryMarkerEntity = null;
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
  slopeCells = [];
  isDrawing = false;
  computing.value = false;
  gridStats.value = null;
  queryResult.value = null;
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
      material: Cesium.Color.YELLOW.withAlpha(0.1),
      outline: true,
      outlineColor: Cesium.Color.YELLOW,
    },
  });
};

/** 按坡度分级着色网格 */
const renderGrid = () => {
  if (gridPrimitive) {
    viewer.scene.primitives.remove(gridPrimitive);
    gridPrimitive = null;
  }
  if (!gridResult || !slopeCells.length) return;

  const cellLevel: Record<string, number> = {};
  slopeCells.forEach((c) => {
    cellLevel[`${c.row},${c.col}`] = c.level;
  });

  const colorOf = (row: number, col: number): Cesium.Color => {
    const level = cellLevel[`${row},${col}`];
    if (level === undefined) return Cesium.Color.GRAY.withAlpha(0.2);
    return Cesium.Color.fromCssColorString(SLOPE_LEVELS[level].color).withAlpha(0.7);
  };

  const primitive = buildGridPrimitive(gridResult, colorOf, 1.5);
  if (primitive) {
    viewer.scene.primitives.add(primitive);
    gridPrimitive = primitive;
  }
};

/** 分级面积占比柱状图 */
const renderChart = () => {
  if (!gridResult || !slopeCells.length) return;
  if (!chart && chartRef.value) {
    chart = echarts.init(chartRef.value);
  }
  if (!chart) return;

  const counts = new Array(SLOPE_LEVELS.length).fill(0);
  slopeCells.forEach((c) => {
    counts[c.level]++;
  });
  const total = counts.reduce((a, b) => a + b, 0);

  chart.setOption({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(34,34,34,0.9)",
      borderColor: "#555",
      textStyle: { color: "#fff" },
      formatter: (params: any) => {
        const p = params[0];
        return `${SLOPE_LEVELS[p.dataIndex].name}<br/>占比 ${p.value}%`;
      },
    },
    grid: { left: 50, right: 12, top: 20, bottom: 35 },
    xAxis: {
      type: "category",
      data: ["<5°", "5-15°", "15-25°", "25-35°", ">35°"],
      axisLabel: { color: "#aaa", fontSize: 11 },
      axisLine: { lineStyle: { color: "#666" } },
    },
    yAxis: {
      type: "value",
      name: "%",
      nameTextStyle: { color: "#aaa" },
      axisLabel: { color: "#aaa" },
      splitLine: { lineStyle: { color: "#333" } },
      max: 100,
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 30,
        data: counts.map((n) => Number(((n / total) * 100).toFixed(1))),
        itemStyle: {
          color: (params: any) => SLOPE_LEVELS[params.dataIndex].color,
        },
      },
    ],
  });
};

/** 单点查询：找最近网格的坡度坡向 */
const queryAt = (cartesian: Cesium.Cartesian3) => {
  if (!slopeCells.length) {
    hint.value = "请先绘制区域生成坡度网格";
    return;
  }
  const carto = Cesium.Cartographic.fromCartesian(cartesian);
  const lng = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);

  let nearest = slopeCells[0];
  let minDist = Infinity;
  slopeCells.forEach((c) => {
    const dLng = c.center.lng - lng;
    const dLat = c.center.lat - lat;
    const d = dLng * dLng + dLat * dLat;
    if (d < minDist) {
      minDist = d;
      nearest = c;
    }
  });

  queryResult.value = {
    slope: nearest.slope,
    aspect: nearest.aspect,
    aspectName: ASPECT_NAMES[Math.round(nearest.aspect / 45) % 8],
    level: nearest.level,
  };

  if (queryMarkerEntity) {
    viewer.entities.remove(queryMarkerEntity);
  }
  // 标记点落到该网格的地表高程上
  const heightMap = gridResult ? buildGridHeightMap(gridResult) : null;
  const sample = heightMap?.get(`${nearest.row},${nearest.col}`);
  const markerHeight = (sample?.height ?? 0) + 1.5;
  queryMarkerEntity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(nearest.center.lng, nearest.center.lat, markerHeight),
    point: {
      pixelSize: 10,
      color: Cesium.Color.MAGENTA,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.MAX_VALUE,
    },
  });
};

const toggleQueryMode = () => {
  queryMode.value = !queryMode.value;
  if (!queryMode.value) {
    if (queryMarkerEntity) {
      viewer.entities.remove(queryMarkerEntity);
      queryMarkerEntity = null;
    }
    queryResult.value = null;
  } else {
    hint.value = "";
  }
};

/** 右键结束绘制 → 采样 + 坡度坡向计算 */
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
      slopeCells = computeSlopeAspect(g);
      if (!slopeCells.length) {
        hint.value = "区域内无有效网格，请增大间距或重试";
        return;
      }
      const avg = slopeCells.reduce((a, c) => a + c.slope, 0) / slopeCells.length;
      const max = slopeCells.reduce((a, c) => Math.max(a, c.slope), 0);
      gridStats.value = { avgSlope: avg, maxSlope: max, cellCount: slopeCells.length };
      drawBoundary();
      renderGrid();
      renderChart();
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

  // 左键点击：查询模式 → 单点查询；绘制模式 → 添加顶点
  handler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (queryMode.value) {
        const cartesian = pickPositionOnMap(viewer, event.position);
        if (cartesian) queryAt(cartesian);
        return;
      }

      if (!isMeasuring.value) return;

      if (!isDrawing) {
        isDrawing = true;
        positions = [];
        gridStats.value = null;
        queryResult.value = null;
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

// 网格间距变化 → 重新采样
watch(gridSpacing, () => {
  if (gridResult && !computing.value) {
    if (!polygonLngLats.length) return;
    computing.value = true;
    samplePolygonGrid(viewer, polygonLngLats, gridSpacing.value)
      .then((g) => {
        gridResult = g;
        slopeCells = computeSlopeAspect(g);
        const avg = slopeCells.length
          ? slopeCells.reduce((a, c) => a + c.slope, 0) / slopeCells.length
          : 0;
        const max = slopeCells.length
          ? slopeCells.reduce((a, c) => Math.max(a, c.slope), 0)
          : 0;
        gridStats.value = { avgSlope: avg, maxSlope: max, cellCount: slopeCells.length };
        renderGrid();
        renderChart();
      })
      .catch((error) => {
        console.error("网格采样失败:", error);
      })
      .finally(() => {
        computing.value = false;
      });
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
    [previewLineEntity, boundaryEntity, queryMarkerEntity, labelEntity].forEach((entity) => {
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
  }

  .legend-box {
    margin-top: 10px;
    padding: 6px;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 4px;

    .legend-item {
      display: flex;
      align-items: center;
      margin: 3px 0;

      .legend-color {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        margin-right: 6px;
        flex-shrink: 0;
      }

      .legend-text {
        color: #ccc;
        font-size: 13px;
      }
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

  .el-button {
    margin: 10px 5px 0 0;
  }
}
</style>
