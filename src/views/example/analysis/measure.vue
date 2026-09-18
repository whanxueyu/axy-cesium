<template>
  <div class="measure-page">
    <div :class="['measure-panel', { collapsed: !showPanel }]">
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
          <span>综合测量</span>
          <button class="icon-button reset-button" type="button" title="清空" @click="clearAll">
            <el-icon size="17">
              <RefreshRight />
            </el-icon>
          </button>
        </div>

        <el-radio-group
          v-model="measureMode"
          class="mode-tabs"
          size="small"
          @change="handleModeChange"
        >
          <el-radio-button value="position">坐标</el-radio-button>
          <el-radio-button value="distance">距离</el-radio-button>
          <el-radio-button value="area">面积</el-radio-button>
          <el-radio-button value="height">高度差</el-radio-button>
        </el-radio-group>

        <div v-if="measureMode === 'distance'" class="switch-row">
          <span>距离模式</span>
          <el-switch
            v-model="straightDistance"
            inline-prompt
            active-text="空间"
            inactive-text="贴地"
          />
        </div>

        <div v-if="measureMode === 'area'" class="area-controls">
          <div class="control-row">
            <span>面积类型</span>
            <el-radio-group
              v-model="areaMeasureMode"
              class="area-mode-tabs"
              size="small"
              @change="handleAreaModeChange"
            >
              <el-radio-button value="surface">贴地</el-radio-button>
              <el-radio-button value="horizontal">水平</el-radio-button>
              <el-radio-button value="compare">对比</el-radio-button>
            </el-radio-group>
          </div>
          <div class="control-row">
            <span>采样间距</span>
            <el-input-number v-model="edgeSpacing" :min="10" :max="100" :step="10" size="small" />
            <span>米</span>
          </div>
        </div>

        <div class="actions">
          <el-button size="small" :type="isMeasuring ? 'success' : 'primary'" @click="startMeasure">
            {{ isMeasuring ? "测量中" : "开始测量" }}
          </el-button>
          <el-button
            size="small"
            :disabled="!canFinish"
            :loading="calculating"
            @click="finishDrawing"
          >
            完成
          </el-button>
          <el-button size="small" type="danger" @click="clearAll">清空</el-button>
        </div>

        <div class="hint">{{ hintText }}</div>

        <div class="stats">
          <div>
            <span>当前点数</span>
            <strong>{{ positions.length }}</strong>
          </div>
          <div>
            <span>结果数量</span>
            <strong>{{ results.length }}</strong>
          </div>
        </div>

        <div class="result-list">
          <div v-if="!results.length" class="empty-result">暂无测量结果</div>
          <div v-for="item in results" :key="item.id" class="result-item">
            <div class="result-item__title">{{ item.title }}</div>
            <div class="result-item__value">{{ item.value }}</div>
            <div class="result-item__detail">{{ item.detail }}</div>
          </div>
        </div>
      </div>
    </div>

    <Map
      mapType="gd"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      :duration="1"
      @loaded="handleMapLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import * as Cesium from "cesium";
import { Close, Grid, RefreshRight } from "@element-plus/icons-vue";
import Map from "@/components/cesium/map.vue";
import {
  buildTerrainTriangleGroundPrimitive,
  computeTerrainDistance3D,
  computePlanarArea,
  computeSurfaceArea3D,
  pickPositionOnMap,
  type LonLat,
  type ProfileSample,
  type TerrainSample,
  type TerrainTriangle,
} from "@/modules/cesium/analysisUtils";

type MeasureMode = "position" | "distance" | "area" | "height";
type AreaMeasureMode = "surface" | "horizontal" | "compare";

interface MeasureResult {
  id: number;
  title: string;
  value: string;
  detail: string;
}

const cameraDestination = {
  longitude: 103.82,
  latitude: 36.02,
  height: 3600,
};

const cameraOrientation = {
  heading: 0,
  pitch: -42,
  roll: 0,
};

const showPanel = ref(true);
const measureMode = ref<MeasureMode>("position");
const areaMeasureMode = ref<AreaMeasureMode>("surface");
const isMeasuring = ref(false);
const straightDistance = ref(false);
const edgeSpacing = ref(30);
const calculating = ref(false);
const positions = ref<Cesium.Cartesian3[]>([]);
const results = ref<MeasureResult[]>([]);

let viewer: Cesium.Viewer | null = null;
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;
let allEntities: Cesium.Entity[] = [];
let sketchEntities: Cesium.Entity[] = [];
let activeShapeEntity: Cesium.Entity | null = null;
let groundPrimitives: Cesium.GroundPrimitive[] = [];
let obliqueTileset: Cesium.Cesium3DTileset | null = null;
let loadingObliqueTileset = false;
let resultId = 0;

const canFinish = computed(() => {
  if (!isMeasuring.value || calculating.value) return false;
  if (measureMode.value === "distance") return positions.value.length >= 2;
  if (measureMode.value === "area") return positions.value.length >= 3;
  if (measureMode.value === "height") return positions.value.length >= 2;
  return false;
});

const hintText = computed(() => {
  if (calculating.value) return "正在计算面积，请稍候";
  if (!isMeasuring.value) return "选择测量类型后点击开始测量";

  if (measureMode.value === "position") return "左键拾取坐标，可连续拾取多个点";
  if (measureMode.value === "distance") return "左键依次添加路径点，右键或点击完成结束距离测量";
  if (measureMode.value === "area") return "左键绘制面边界，至少 3 个点，右键或点击完成计算面积";
  return "左键选择两个点，自动计算空间距离、水平距离和高度差";
});

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.pickTranslucentDepth = true;
  bindMapEvents();
  // loadObliqueTileset();
};

const loadObliqueTileset = async () => {
  if (!viewer || obliqueTileset || loadingObliqueTileset) return;

  loadingObliqueTileset = true;
  try {
    obliqueTileset = await Cesium.Cesium3DTileset.fromUrl(
      "https://jdvop.oss-cn-qingdao.aliyuncs.com/mapv-data/titleset/lanzhou/tileset.json",
    );
    viewer.scene.primitives.add(obliqueTileset);
    await viewer.zoomTo(obliqueTileset);
  } catch (error) {
    console.error("综合测量倾斜摄影模型加载失败:", error);
    obliqueTileset = null;
  } finally {
    loadingObliqueTileset = false;
  }
};

const bindMapEvents = () => {
  if (!viewer) return;

  mouseHandler?.destroy();
  mouseHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  mouseHandler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    handleMapClick(event.position);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  mouseHandler.setInputAction(() => {
    finishDrawing();
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
};

const startMeasure = () => {
  if (!viewer) return;
  clearSketch();
  positions.value = [];
  isMeasuring.value = true;
};

const stopMeasure = () => {
  isMeasuring.value = false;
  positions.value = [];
};

const handleModeChange = () => {
  clearSketch();
  stopMeasure();
};

const handleAreaModeChange = () => {
  if (isMeasuring.value && positions.value.length >= 2) {
    updatePolyline(positions.value.length > 2);
  }
};

const handleMapClick = (windowPosition: Cesium.Cartesian2) => {
  if (!viewer || !isMeasuring.value || calculating.value) return;

  const cartesian = pickPositionOnMap(viewer, windowPosition);
  if (!cartesian) return;

  if (measureMode.value === "position") {
    measurePosition(cartesian);
    return;
  }

  positions.value.push(cartesian);
  addPointMarker(cartesian, positions.value.length);

  if (measureMode.value === "distance") {
    updatePolyline(false);
  } else if (measureMode.value === "area") {
    updatePolyline(true);
  } else if (measureMode.value === "height" && positions.value.length >= 2) {
    finishDrawing();
  }
};

const measurePosition = (cartesian: Cesium.Cartesian3) => {
  const coordinate = toCoordinate(cartesian);
  addPointMarker(cartesian, results.value.length + 1);
  addLabel(
    cartesian,
    `经度 ${coordinate.lng.toFixed(6)}\n纬度 ${coordinate.lat.toFixed(6)}\n高程 ${coordinate.height.toFixed(2)}m`,
  );
  commitSketch();

  pushResult({
    title: "坐标测量",
    value: `${coordinate.lng.toFixed(6)}, ${coordinate.lat.toFixed(6)}`,
    detail: `高程 ${coordinate.height.toFixed(2)}m`,
  });
};

const finishDrawing = async () => {
  if (!viewer || !isMeasuring.value || calculating.value) return;

  if (measureMode.value === "distance") {
    await finishDistance();
  } else if (measureMode.value === "area") {
    await finishArea();
  } else if (measureMode.value === "height") {
    finishHeight();
  }
};

const finishDistance = async () => {
  if (positions.value.length < 2) return;
  calculating.value = true;
  const profiles: ProfileSample[][] = [];
  let segments: number[] = [];

  try {
    if (straightDistance.value) {
      segments = getSegmentDistances();
    } else {
      for (let index = 1; index < positions.value.length; index++) {
        const sampled = await computeTerrainDistance3D(
          viewer as Cesium.Viewer,
          [toLonLat(positions.value[index - 1]), toLonLat(positions.value[index])],
          Math.max(10, Math.min(edgeSpacing.value, 50)),
        );
        segments.push(sampled.distance);
        profiles.push(sampled.samples);
      }
    }

    if (!segments.length) return;
    if (activeShapeEntity) {
      removeEntity(activeShapeEntity);
      activeShapeEntity = null;
    }

    if (!straightDistance.value) {
      drawSampledDistancePath(profiles);
    } else {
      updatePolyline(false);
    }

    const total = segments.reduce((sum, distance) => sum + distance, 0);
    const lastPosition = positions.value[positions.value.length - 1];

    addDistanceSegmentLabels(segments, profiles);
    addLabel(lastPosition, `总距离 ${formatMeters(total)}\n${segments.length} 段`);
    commitSketch();
    pushResult({
      title: straightDistance.value ? "空间距离" : "贴地距离",
      value: formatMeters(total),
      detail: `分段：${formatSegments(segments)}；最长段 ${formatMeters(Math.max(...segments))}`,
    });
    stopMeasure();
  } finally {
    calculating.value = false;
  }
};

const finishArea = async () => {
  if (!viewer || positions.value.length < 3) return;

  calculating.value = true;
  const lngLats = positions.value.map(toLonLat);

  try {
    let surfaceArea = 0;
    let groundRing = lngLats;
    let groundTriangles: TerrainTriangle[] = [];
    if (areaMeasureMode.value !== "horizontal") {
      const measured = await computeSurfaceArea3D(viewer, lngLats, edgeSpacing.value);
      surfaceArea = measured.area;
      groundRing = measured.ring.length ? measured.ring : lngLats;
      groundTriangles = measured.triangles;
    }
    const horizontalHeight = getHorizontalAreaHeight(groundRing);
    const horizontalArea = computePlanarArea(
      lngLats.map((point) => ({ ...point, height: horizontalHeight })),
    );

    if (areaMeasureMode.value !== "horizontal") {
      drawGroundArea(groundRing, groundTriangles);
      addLabel(
        getGroundAreaLabelPosition(lngLats, groundTriangles),
        `贴地面积\n${formatArea(surfaceArea)}`,
        new Cesium.Cartesian2(0, -42),
      );
    }
    if (areaMeasureMode.value !== "surface") {
      drawHorizontalArea(positions.value, horizontalHeight);
      addLabel(
        getHorizontalAreaLabelPosition(positions.value, horizontalHeight),
        `水平面积\n${formatArea(horizontalArea)}`,
        new Cesium.Cartesian2(0, -42),
      );
    }

    commitSketch();
    pushResult({
      title: getAreaResultTitle(),
      value: getAreaResultValue(surfaceArea, horizontalArea),
      detail: `贴地采样间距 ${edgeSpacing.value}m，水平面高程 ${horizontalHeight.toFixed(2)}m`,
    });
    stopMeasure();
  } catch (error) {
    console.error("综合测量面积计算失败:", error);
  } finally {
    calculating.value = false;
  }
};

const finishHeight = () => {
  if (positions.value.length < 2) return;

  const [start, end] = positions.value;
  const startCarto = Cesium.Cartographic.fromCartesian(start);
  const endCarto = Cesium.Cartographic.fromCartesian(end);
  const startHeight = startCarto.height;
  const endHeight = endCarto.height;
  const heightDiff = endHeight - startHeight;
  const spatialDistance = Cesium.Cartesian3.distance(start, end);
  const horizontalDistance = getSurfaceDistance(start, end);
  const angle = getInclinationAngle(heightDiff, horizontalDistance);
  const projectedEnd = Cesium.Cartesian3.fromRadians(
    endCarto.longitude,
    endCarto.latitude,
    startHeight,
  );
  const startCoordinate = toCoordinate(start);
  const endCoordinate = toCoordinate(end);

  drawHeightTriangle(start, end, projectedEnd, horizontalDistance, heightDiff);
  addLabel(start, `起点\n${formatCoordinate(startCoordinate)}`, new Cesium.Cartesian2(-52, -34));
  addLabel(end, `终点\n${formatCoordinate(endCoordinate)}`, new Cesium.Cartesian2(52, -34));
  addLabel(
    Cesium.Cartesian3.midpoint(start, end, new Cesium.Cartesian3()),
    `高度差 ${formatSignedMeters(heightDiff)}\n空间距离 ${formatMeters(spatialDistance)}\n夹角 ${formatSignedAngle(angle)}`,
    new Cesium.Cartesian2(0, -48),
  );
  commitSketch();

  pushResult({
    title: "三角高度差测量",
    value: formatSignedMeters(heightDiff),
    detail: `起点 ${formatCoordinate(startCoordinate)}；终点 ${formatCoordinate(endCoordinate)}；空间距离 ${formatMeters(spatialDistance)}，水平距离 ${formatMeters(horizontalDistance)}，连线与水平面夹角 ${formatSignedAngle(angle)}`,
  });
  stopMeasure();
};

const addDistanceSegmentLabels = (segments: number[], profiles: ProfileSample[][] = []) => {
  for (let index = 1; index < positions.value.length; index++) {
    const start = positions.value[index - 1];
    const end = positions.value[index];
    const profile = profiles[index - 1];
    const midpoint = profile?.length
      ? Cesium.Cartesian3.fromDegrees(
        profile[Math.floor(profile.length / 2)].lng,
        profile[Math.floor(profile.length / 2)].lat,
        profile[Math.floor(profile.length / 2)].height + 1,
      )
      : Cesium.Cartesian3.midpoint(start, end, new Cesium.Cartesian3());
    addLabel(midpoint, `第 ${index} 段\n${formatMeters(segments[index - 1])}`);
  }
};

const drawSampledDistancePath = (profiles: ProfileSample[][]) => {
  profiles.forEach((profile) => {
    if (profile.length < 2) return;
    addEntity({
      polyline: {
        positions: profile.map((point) =>
          Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.height + 0.35),
        ),
        width: 3,
        clampToGround: false,
        material: Cesium.Color.CYAN.withAlpha(0.95),
        depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.CYAN.withAlpha(0.95),
          gapColor: Cesium.Color.BLACK.withAlpha(0.18),
          dashLength: 14,
          dashPattern: 255,
        }),
      },
    });
  });
};

const drawHeightTriangle = (
  start: Cesium.Cartesian3,
  end: Cesium.Cartesian3,
  projectedEnd: Cesium.Cartesian3,
  horizontalDistance: number,
  heightDiff: number,
) => {
  addEntity({
    polyline: {
      positions: [start, end],
      width: 4,
      material: Cesium.Color.ORANGE,
      depthFailMaterial: createDepthFailMaterial(Cesium.Color.ORANGE),
    },
  });
  addEntity({
    polyline: {
      positions: [start, projectedEnd],
      width: 3,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.CYAN,
      }),
      depthFailMaterial: createDepthFailMaterial(Cesium.Color.CYAN),
    },
  });
  addEntity({
    polyline: {
      positions: [projectedEnd, end],
      width: 3,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.YELLOW,
      }),
      depthFailMaterial: createDepthFailMaterial(Cesium.Color.YELLOW),
    },
  });
  addEntity({
    position: projectedEnd,
    point: {
      pixelSize: 7,
      color: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  const horizontalMidpoint = Cesium.Cartesian3.midpoint(start, projectedEnd, new Cesium.Cartesian3());
  const verticalMidpoint = Cesium.Cartesian3.midpoint(projectedEnd, end, new Cesium.Cartesian3());
  addLabel(horizontalMidpoint, `水平距离\n${formatMeters(horizontalDistance)}`, new Cesium.Cartesian2(0, 28));
  addLabel(verticalMidpoint, `高度差\n${formatSignedMeters(heightDiff)}`, new Cesium.Cartesian2(46, -8));
};

const updatePolyline = (closed: boolean) => {
  if (!viewer || positions.value.length < 2) return;
  if (activeShapeEntity) {
    removeEntity(activeShapeEntity);
    activeShapeEntity = null;
  }

  const rawLinePositions = closed && positions.value.length > 2
    ? [...positions.value, positions.value[0]]
    : [...positions.value];
  const shouldDrawHorizontalPreview = measureMode.value === "area"
    && areaMeasureMode.value === "horizontal";
  const linePositions = shouldDrawHorizontalPreview
    ? getHorizontalAreaPositions(rawLinePositions, getHorizontalAreaHeight(positions.value.map(toLonLat)))
    : rawLinePositions;
  const clampToGround = measureMode.value === "area"
    ? !shouldDrawHorizontalPreview
    : !straightDistance.value;

  activeShapeEntity = addEntity({
    polyline: {
      positions: linePositions,
      width: 3,
      clampToGround,
      arcType: shouldDrawHorizontalPreview ? Cesium.ArcType.NONE : Cesium.ArcType.GEODESIC,
      material: closed
        ? Cesium.Color.YELLOW.withAlpha(0.86)
        : Cesium.Color.CYAN.withAlpha(0.86),
    },
  });
};

const drawGroundArea = (ring: TerrainSample[], triangles: TerrainTriangle[]) => {
  if (!viewer || ring.length < 3) return;

  const groundPrimitive = buildTerrainTriangleGroundPrimitive(
    triangles,
    () => Cesium.Color.YELLOW.withAlpha(0.34),
  );
  if (groundPrimitive) {
    viewer.scene.primitives.add(groundPrimitive);
    groundPrimitives.push(groundPrimitive);
  }

  const surfacePositions = ring.map((point) =>
    Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.height + 0.25),
  );
  addEntity({
    polyline: {
      positions: [...surfacePositions, surfacePositions[0]],
      width: 3,
      clampToGround: false,
      material: Cesium.Color.YELLOW.withAlpha(0.98),
      depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.YELLOW.withAlpha(0.95),
        gapColor: Cesium.Color.BLACK.withAlpha(0.18),
        dashLength: 14,
        dashPattern: 255,
      }),
    },
  });
};

const drawHorizontalArea = (sourcePositions: Cesium.Cartesian3[], planeHeight: number) => {
  if (!viewer || sourcePositions.length < 3) return;
  const flatPositions = getHorizontalAreaPositions(sourcePositions, planeHeight);

  addEntity({
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(flatPositions),
      perPositionHeight: true,
      arcType: Cesium.ArcType.NONE,
      material: Cesium.Color.CYAN.withAlpha(0.34),
      outline: true,
      outlineColor: Cesium.Color.CYAN,
    },
  });
  addEntity({
    polyline: {
      positions: [...flatPositions, flatPositions[0]],
      width: 3,
      clampToGround: false,
      arcType: Cesium.ArcType.NONE,
      material: Cesium.Color.CYAN.withAlpha(0.95),
    },
  });
};

const createDepthFailMaterial = (color: Cesium.Color) => {
  return new Cesium.PolylineDashMaterialProperty({
    color: color.withAlpha(0.95),
    gapColor: Cesium.Color.BLACK.withAlpha(0.15),
    dashLength: 14,
    dashPattern: 255,
  });
};

const getHorizontalAreaHeight = (points: LonLat[]) => {
  const heights = points.map((point) => point.height ?? 0);
  return heights.length ? Math.max(...heights) + 2 : 0;
};

const getHorizontalAreaPositions = (
  sourcePositions: Cesium.Cartesian3[],
  planeHeight: number,
) => {
  if (!sourcePositions.length) return [];

  const firstCartographic = Cesium.Cartographic.fromCartesian(sourcePositions[0]);
  const origin = Cesium.Cartesian3.fromRadians(
    firstCartographic.longitude,
    firstCartographic.latitude,
    planeHeight,
  );
  const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const inverse = Cesium.Matrix4.inverseTransformation(transform, new Cesium.Matrix4());

  return sourcePositions.map((position) => {
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    const projected = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      planeHeight,
    );
    const local = Cesium.Matrix4.multiplyByPoint(
      inverse,
      projected,
      new Cesium.Cartesian3(),
    );
    local.z = 0;
    return Cesium.Matrix4.multiplyByPoint(transform, local, new Cesium.Cartesian3());
  });
};

const getAreaCenter = (points: LonLat[]): LonLat => {
  const total = points.reduce(
    (sum, point) => ({
      lng: sum.lng + point.lng,
      lat: sum.lat + point.lat,
      height: sum.height + (point.height ?? 0),
    }),
    { lng: 0, lat: 0, height: 0 },
  );
  const count = Math.max(points.length, 1);
  return {
    lng: total.lng / count,
    lat: total.lat / count,
    height: total.height / count,
  };
};

const getGroundAreaLabelPosition = (
  points: LonLat[],
  triangles: TerrainTriangle[] = [],
) => {
  if (triangles.length) {
    const weighted = triangles.reduce(
      (sum, triangle) => {
        const weight = Math.max(triangle.horizontalArea, 1);
        return {
          lng: sum.lng + triangle.center.lng * weight,
          lat: sum.lat + triangle.center.lat * weight,
          height: sum.height + triangle.center.height * weight,
          weight: sum.weight + weight,
        };
      },
      { lng: 0, lat: 0, height: 0, weight: 0 },
    );
    return Cesium.Cartesian3.fromDegrees(
      weighted.lng / weighted.weight,
      weighted.lat / weighted.weight,
      weighted.height / weighted.weight + 2,
    );
  }

  const center = getAreaCenter(points);
  const cartographic = Cesium.Cartographic.fromDegrees(center.lng, center.lat);
  const sampledHeight = viewer?.scene.globe.getHeight(cartographic);
  const fallbackHeight = points.length
    ? points.reduce((sum, point) => sum + (point.height ?? 0), 0) / points.length
    : 0;
  const groundHeight = typeof sampledHeight === "number" && Number.isFinite(sampledHeight)
    ? sampledHeight
    : fallbackHeight;

  return Cesium.Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    groundHeight + 2,
  );
};

const getHorizontalAreaLabelPosition = (
  sourcePositions: Cesium.Cartesian3[],
  planeHeight: number,
) => {
  const flatPositions = getHorizontalAreaPositions(sourcePositions, planeHeight);
  const center = flatPositions.reduce(
    (sum, position) => Cesium.Cartesian3.add(sum, position, sum),
    new Cesium.Cartesian3(),
  );
  return Cesium.Cartesian3.divideByScalar(
    center,
    Math.max(flatPositions.length, 1),
    new Cesium.Cartesian3(),
  );
};

const getAreaResultTitle = () => {
  if (areaMeasureMode.value === "surface") return "贴地面积测量";
  if (areaMeasureMode.value === "horizontal") return "水平面积测量";
  return "面积对比测量";
};

const getAreaResultValue = (surfaceArea: number, horizontalArea: number) => {
  if (areaMeasureMode.value === "surface") return `贴地 ${formatArea(surfaceArea)}`;
  if (areaMeasureMode.value === "horizontal") return `水平 ${formatArea(horizontalArea)}`;
  return `贴地 ${formatArea(surfaceArea)} / 水平 ${formatArea(horizontalArea)}`;
};

const addPointMarker = (position: Cesium.Cartesian3, index: number) => {
  addEntity({
    position,
    point: {
      pixelSize: 9,
      color: Cesium.Color.fromCssColorString("#22d3ee"),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: String(index),
      font: "bold 12px Microsoft YaHei",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
};

const addLabel = (
  position: Cesium.Cartesian3,
  text: string,
  pixelOffset = new Cesium.Cartesian2(0, -34),
  heightReference?: Cesium.HeightReference,
) => {
  addEntity({
    position,
    label: {
      text,
      font: "bold 13px Microsoft YaHei",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 3,
      showBackground: true,
      backgroundColor: Cesium.Color.BLACK.withAlpha(0.55),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset,
      heightReference,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
};

const addEntity = (options: Cesium.Entity.ConstructorOptions) => {
  if (!viewer) throw new Error("viewer is not ready");
  const entity = viewer.entities.add(options);
  allEntities.push(entity);
  sketchEntities.push(entity);
  return entity;
};

const removeEntity = (entity: Cesium.Entity) => {
  if (!viewer) return;
  viewer.entities.remove(entity);
  allEntities = allEntities.filter((item) => item !== entity);
  sketchEntities = sketchEntities.filter((item) => item !== entity);
};

const commitSketch = () => {
  sketchEntities = [];
  activeShapeEntity = null;
};

const clearSketch = () => {
  if (!viewer) return;
  sketchEntities.forEach((entity) => viewer?.entities.remove(entity));
  allEntities = allEntities.filter((entity) => !sketchEntities.includes(entity));
  sketchEntities = [];
  activeShapeEntity = null;
  positions.value = [];
};

const clearAll = () => {
  if (viewer) {
    allEntities.forEach((entity) => viewer?.entities.remove(entity));
    groundPrimitives.forEach((primitive) => viewer?.scene.primitives.remove(primitive));
  }
  allEntities = [];
  groundPrimitives = [];
  sketchEntities = [];
  activeShapeEntity = null;
  positions.value = [];
  results.value = [];
  isMeasuring.value = false;
  calculating.value = false;
};

const pushResult = (result: Omit<MeasureResult, "id">) => {
  resultId += 1;
  results.value.unshift({
    id: resultId,
    ...result,
  });
};

const getSegmentDistances = () => {
  const distances: number[] = [];
  for (let index = 1; index < positions.value.length; index++) {
    const start = positions.value[index - 1];
    const end = positions.value[index];
    distances.push(straightDistance.value
      ? Cesium.Cartesian3.distance(start, end)
      : getSurfaceDistance(start, end));
  }
  return distances;
};

const getSurfaceDistance = (start: Cesium.Cartesian3, end: Cesium.Cartesian3) => {
  const startCarto = Cesium.Cartographic.fromCartesian(start);
  const endCarto = Cesium.Cartographic.fromCartesian(end);
  const geodesic = new Cesium.EllipsoidGeodesic(
    startCarto,
    endCarto,
    Cesium.Ellipsoid.WGS84,
  );
  return geodesic.surfaceDistance;
};

const toCoordinate = (position: Cesium.Cartesian3) => {
  const cartographic = Cesium.Cartographic.fromCartesian(position);
  return {
    lng: Cesium.Math.toDegrees(cartographic.longitude),
    lat: Cesium.Math.toDegrees(cartographic.latitude),
    height: cartographic.height,
  };
};

const toLonLat = (position: Cesium.Cartesian3): LonLat => {
  const coordinate = toCoordinate(position);
  return {
    lng: coordinate.lng,
    lat: coordinate.lat,
    height: coordinate.height,
  };
};

const formatMeters = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(3)} km`;
  return `${value.toFixed(2)} m`;
};

const formatSignedMeters = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} m`;
};

const formatSegments = (segments: number[]) => {
  return segments.map((distance, index) => `第 ${index + 1} 段 ${formatMeters(distance)}`).join("，");
};

const getInclinationAngle = (heightDiff: number, horizontalDistance: number) => {
  return Cesium.Math.toDegrees(Math.atan2(heightDiff, Math.max(horizontalDistance, 0.001)));
};

const formatCoordinate = (coordinate: { lng: number; lat: number; height: number }) => {
  return `${coordinate.lng.toFixed(6)}, ${coordinate.lat.toFixed(6)}, ${coordinate.height.toFixed(2)}m`;
};

const formatSignedAngle = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}°`;
};

const formatArea = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(3)} km²`;
  return `${value.toFixed(2)} m²`;
};

onUnmounted(() => {
  mouseHandler?.destroy();
  clearAll();
  if (viewer && obliqueTileset) {
    viewer.scene.primitives.remove(obliqueTileset);
    obliqueTileset = null;
  }
  viewer = null;
});
</script>

<style scoped lang="scss">
.measure-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.measure-panel {
  position: absolute;
  left: 16px;
  top: 72px;
  z-index: 2001;
  width: 338px;
  padding: 14px;
  color: #f7fbff;
  background: rgba(10, 18, 25, 0.84);
  border: 1px solid rgba(198, 226, 238, 0.18);
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
    padding: 0;
    border-radius: 50%;
    background: rgba(13, 123, 144, 0.92);
  }
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-title {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding-right: 38px;
  font-size: 16px;
  font-weight: 600;
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

.reset-button {
  margin-left: auto;
}

.switch-row,
.control-row {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  font-size: 13px;
  color: rgba(241, 249, 252, 0.88);
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hint {
  min-height: 20px;
  padding: 8px 10px;
  color: rgba(230, 246, 250, 0.88);
  font-size: 13px;
  line-height: 1.45;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 6px;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  div {
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.07);
    border-radius: 6px;
  }

  span {
    display: block;
    color: rgba(230, 246, 250, 0.72);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 2px;
    font-size: 18px;
  }
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 230px;
  overflow-y: auto;
}

.empty-result,
.result-item {
  padding: 10px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.empty-result {
  color: rgba(230, 246, 250, 0.68);
  font-size: 13px;
  text-align: center;
}

.result-item__title {
  color: #a7f3ff;
  font-size: 13px;
}

.result-item__value {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 700;
}

.result-item__detail {
  margin-top: 4px;
  color: rgba(230, 246, 250, 0.74);
  font-size: 12px;
  line-height: 1.45;
}

:deep(.el-radio-group) {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

:deep(.el-radio-button__inner) {
  width: 100%;
  padding-left: 0;
  padding-right: 0;
}

@media (max-width: 640px) {
  .measure-panel {
    left: 10px;
    top: 64px;
    width: min(338px, calc(100vw - 20px));
  }
}
</style>
