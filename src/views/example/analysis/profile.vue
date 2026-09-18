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
      <span class="param-label">采样间距：</span>
      <el-input-number v-model="sampleSpacing" :min="10" :max="100" :step="10" size="small" />
      <span class="param-unit">米</span>
    </div>
    <div class="result-box" v-if="calculating">
      <div class="result-item">
        <span class="value">采样中...</span>
      </div>
    </div>
    <div class="result-box" v-else-if="resultVisible">
      <div class="result-item">
        <span class="label">总长度：</span>
        <span class="value">{{ totalLength.toFixed(2) }} m</span>
      </div>
      <div class="result-item">
        <span class="label">最高高程：</span>
        <span class="value">{{ maxHeight.toFixed(2) }} m</span>
      </div>
      <div class="result-item">
        <span class="label">最低高程：</span>
        <span class="value">{{ minHeight.toFixed(2) }} m</span>
      </div>
      <div class="result-item">
        <span class="label">平均高程：</span>
        <span class="value">{{ avgHeight.toFixed(2) }} m</span>
      </div>
      <div class="result-item">
        <span class="label">最大高差：</span>
        <span class="value">{{ (maxHeight - minHeight).toFixed(2) }} m</span>
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
import { onUnmounted, ref } from "vue";
import * as Cesium from "cesium";
import * as echarts from "echarts";
import Map from "@/components/cesium/map.vue";
import {
  pickPositionOnMap,
  sampleTerrainAlongLine,
  type ProfileSample,
} from "@/modules/cesium/analysisUtils";

var viewer: Cesium.Viewer;
const isMeasuring = ref(false);
const sampleSpacing = ref(20);
const calculating = ref(false);
const resultVisible = ref(false);
const hint = ref("");
const totalLength = ref(0);
const maxHeight = ref(0);
const minHeight = ref(0);
const avgHeight = ref(0);
const chartRef = ref<HTMLDivElement>();

let chart: echarts.ECharts | null = null;
let profileEntity: Cesium.Entity | null = null; // 剖面线（贴地）
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
  [previewLineEntity, profileEntity, labelEntity].forEach((entity) => {
    if (entity) {
      viewer.entities.remove(entity);
    }
  });
  previewLineEntity = null;
  profileEntity = null;
  labelEntity = null;
  pointEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  pointEntities = [];
  positions = [];
  isDrawing = false;
  calculating.value = false;
  resultVisible.value = false;
  hint.value = "";
  totalLength.value = 0;
  maxHeight.value = 0;
  minHeight.value = 0;
  avgHeight.value = 0;
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
        color: Cesium.Color.BLUE,
        glowPower: 0.3,
      }),
      clampToGround: true,
      arcType: Cesium.ArcType.GEODESIC,
    },
  });
};

/** 使用地形采样路径绘制贴地剖面线 */
const drawProfileLine = (samples: ProfileSample[]) => {
  if (profileEntity) {
    viewer.entities.remove(profileEntity);
  }
  profileEntity = viewer.entities.add({
    polyline: {
      positions: samples.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat)),
      width: 4,
      material: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.YELLOW,
        glowPower: 0.35,
      }),
      clampToGround: true,
      arcType: Cesium.ArcType.GEODESIC,
    },
  });
};

/** 剖面折线图 */
const renderChart = (samples: ProfileSample[]) => {
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
      formatter: (params: any) => {
        const p = params[0];
        return `距离 ${Number(p.axisValue).toFixed(0)} m<br/>高程 ${p.data[1].toFixed(2)} m`;
      },
    },
    grid: { left: 55, right: 15, top: 20, bottom: 35 },
    xAxis: {
      type: "value",
      name: "距离(m)",
      nameTextStyle: { color: "#aaa" },
      axisLabel: { color: "#aaa" },
      axisLine: { lineStyle: { color: "#666" } },
      splitLine: { lineStyle: { color: "#333" } },
    },
    yAxis: {
      type: "value",
      name: "高程(m)",
      nameTextStyle: { color: "#aaa" },
      axisLabel: { color: "#aaa" },
      splitLine: { lineStyle: { color: "#333" } },
      scale: true,
    },
    series: [
      {
        type: "line",
        data: samples.map((s) => [Number(s.distance.toFixed(1)), Number(s.height.toFixed(2))]),
        showSymbol: false,
        lineStyle: { color: "#00d2ff", width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(0, 210, 255, 0.45)" },
            { offset: 1, color: "rgba(0, 210, 255, 0.05)" },
          ]),
        },
      },
    ],
  });
};

/** 右键结束绘制 → 采样生成剖面 */
const finishDrawing = () => {
  if (!isMeasuring.value || !isDrawing) return;
  isDrawing = false;

  // 移除临时标签
  if (labelEntity) {
    viewer.entities.remove(labelEntity);
    labelEntity = null;
  }

  if (positions.length < 2) {
    hint.value = "至少需要 2 个点才能生成剖面";
    return;
  }

  const lngLats = positions.map((p) => {
    const carto = Cesium.Cartographic.fromCartesian(p);
    return {
      lng: Cesium.Math.toDegrees(carto.longitude),
      lat: Cesium.Math.toDegrees(carto.latitude),
    };
  });

  hint.value = "";
  resultVisible.value = false;
  calculating.value = true;
  sampleTerrainAlongLine(viewer, lngLats, sampleSpacing.value)
    .then((samples) => {
      if (!samples.length) {
        hint.value = "采样失败，请重试";
        return;
      }
      totalLength.value = samples[samples.length - 1].distance;
      const heights = samples.map((s) => s.height);
      maxHeight.value = Math.max(...heights);
      minHeight.value = Math.min(...heights);
      avgHeight.value = heights.reduce((a, b) => a + b, 0) / heights.length;
      resultVisible.value = true;
      drawProfileLine(samples);
      renderChart(samples);
    })
    .catch((error) => {
      console.error("剖面采样失败:", error);
      hint.value = "剖面采样失败，请重试";
    })
    .finally(() => {
      calculating.value = false;
    });
};

const handleClickListener = () => {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  // 左键点击添加折点
  handler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!isMeasuring.value) return;

      if (!isDrawing) {
        isDrawing = true;
        positions = [];
        resultVisible.value = false;
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

onUnmounted(() => {
  if (mouseHandler) {
    mouseHandler.destroy();
  }
  if (chart) {
    chart.dispose();
    chart = null;
  }
  if (viewer) {
    [previewLineEntity, profileEntity, labelEntity].forEach((entity) => {
      if (entity) viewer.entities.remove(entity);
    });
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
