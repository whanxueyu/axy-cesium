<template>
  <div class="heatmap-scene">
    <CesiumMap
      map-type="gd"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      :duration="1.2"
      :load-terrain="false"
      @loaded="handleMapLoaded"
    />

    <div :class="['heatmap-panel', { collapsed: !showPanel }]">
      <button
        v-if="showPanel"
        class="icon-button panel-close"
        type="button"
        title="收起面板"
        @click="togglePanel"
      >
        <el-icon size="18">
          <Close />
        </el-icon>
      </button>
      <button
        v-else
        class="panel-open"
        type="button"
        title="打开参数面板"
        @click="togglePanel"
      >
        <el-icon size="22">
          <Grid />
        </el-icon>
      </button>

      <div v-if="showPanel" class="panel-content">
        <div class="panel-title">
          <el-icon size="18">
            <DataAnalysis />
          </el-icon>
          <span>热力图效果</span>
          <button
            class="icon-button reset-button"
            type="button"
            title="恢复默认参数"
            @click="resetSettings"
          >
            <el-icon size="17">
              <RefreshRight />
            </el-icon>
          </button>
        </div>

        <div class="panel-subtitle">
          Canvas 热力纹理 + Cesium 顶点位移
        </div>

        <div class="switch-row">
          <span>3D 隆起</span>
          <el-switch v-model="settings.is3DMode" />
        </div>

        <div class="control-row">
          <span>点位数量</span>
          <el-slider
            v-model="settings.pointCount"
            :min="20"
            :max="160"
            :step="10"
            :format-tooltip="formatCount"
          />
        </div>

        <div class="control-row">
          <span>热力半径</span>
          <el-slider
            v-model="settings.radius"
            :min="6"
            :max="36"
            :step="1"
            :format-tooltip="formatPixels"
          />
        </div>

        <div class="control-row">
          <span>基础高度</span>
          <el-slider
            v-model="settings.baseElevation"
            :min="0"
            :max="2400"
            :step="100"
            :format-tooltip="formatMeters"
          />
        </div>

        <div class="control-row">
          <span>热力强度</span>
          <el-slider
            v-model="settings.heatScale"
            :min="500"
            :max="5000"
            :step="100"
            :format-tooltip="formatValue"
          />
        </div>

        <div class="panel-actions">
          <el-button type="primary" @click="regeneratePoints">
            <el-icon><Refresh /></el-icon>
            重新生成
          </el-button>
          <el-button @click="resetCamera">
            <el-icon><Aim /></el-icon>
            重置视角
          </el-button>
        </div>

        <div class="legend">
          <span class="legend-label">低</span>
          <span class="legend-gradient"></span>
          <span class="legend-label">高</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from "vue";
import * as Cesium from "cesium";
import "cesium/Source/Widgets/widgets.css";
import { Aim, Close, DataAnalysis, Grid, Refresh, RefreshRight } from "@element-plus/icons-vue";
import CesiumMap from "@/components/cesium/map.vue";

interface HeatmapPoint {
  lnglat: [number, number];
  strength: number;
}

interface CanvasPoint {
  x: number;
  y: number;
  value: number;
  radius: number;
}

interface HeatmapBounds {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
}

interface HeatmapMesh {
  positions: Float64Array;
  normals: Float32Array;
  textureCoordinates: Float32Array;
  indices: Uint16Array;
  boundingSphere: Cesium.BoundingSphere;
}

const CANVAS_SIZE = 200;
const GRID_SIZE = 180;
const DISPLAY_MAX_VALUE = 5000;
const HEATMAP_HEIGHT_SCALE = 1100;

const cameraDestination = {
  longitude: 116.405,
  latitude: 39.91,
  height: 26000,
};

const cameraOrientation = {
  heading: 0,
  pitch: -48,
  roll: 0,
};

const settings = reactive({
  is3DMode: true,
  pointCount: 80,
  radius: 20,
  baseElevation: 200,
  heatScale: 3200,
});

const showPanel = ref(true);
let viewer: Cesium.Viewer | null = null;
let heatmapPrimitive: Cesium.Primitive | null = null;
let heatmapMaterial: Cesium.Material | null = null;
let sourcePoints: HeatmapPoint[] = [];
let heatmapBounds: HeatmapBounds | null = null;
let heatmapBoundingSphere: Cesium.BoundingSphere | null = null;
let rebuildTimer: number | null = null;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatCount = (value: number) => `${Math.round(value)} 个`;
const formatPixels = (value: number) => `${Math.round(value)} px`;
const formatMeters = (value: number) => `${Math.round(value)} m`;
const formatValue = (value: number) => `${Math.round(value)}`;

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

/**
 * Canvas 热力图的最小实现：
 * 先把点绘制到灰度 shadow canvas，再用调色板生成最终纹理。
 * 同时缓存 alpha 通道，避免网格生成时重复调用 getImageData。
 */
class CanvasHeatmap {
  readonly width: number;
  readonly height: number;
  private readonly canvas: HTMLCanvasElement;
  private readonly shadowCanvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly shadowContext: CanvasRenderingContext2D;
  private readonly palette: Uint8ClampedArray;
  private readonly templates = new Map<number, HTMLCanvasElement>();
  private alphaData = new Uint8ClampedArray();
  private min = 0;
  private max = 1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.shadowCanvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.shadowCanvas.width = width;
    this.shadowCanvas.height = height;

    const context = this.canvas.getContext("2d");
    const shadowContext = this.shadowCanvas.getContext("2d");
    if (!context || !shadowContext) {
      throw new Error("当前浏览器不支持 Canvas 2D 上下文");
    }
    this.context = context;
    this.shadowContext = shadowContext;
    this.palette = this.createPalette();
  }

  render(points: CanvasPoint[], min: number, max: number) {
    this.min = min;
    this.max = Math.max(max, min + 1);
    this.shadowContext.clearRect(0, 0, this.width, this.height);
    this.context.clearRect(0, 0, this.width, this.height);

    for (const point of points) {
      const radius = Math.round(clamp(point.radius, 1, 80));
      const template = this.getPointTemplate(radius);
      const alpha = clamp(
        (point.value - this.min) / (this.max - this.min),
        0,
        1,
      );
      this.shadowContext.globalAlpha = alpha;
      this.shadowContext.drawImage(template, point.x - radius, point.y - radius);
    }
    this.shadowContext.globalAlpha = 1;

    const alphaImage = this.shadowContext.getImageData(
      0,
      0,
      this.width,
      this.height,
    );
    this.alphaData = new Uint8ClampedArray(alphaImage.data);

    const colorImage = this.context.createImageData(this.width, this.height);
    for (let index = 0; index < this.alphaData.length; index += 4) {
      const alpha = this.alphaData[index + 3];
      if (alpha === 0) continue;

      const paletteIndex = Math.min(255, alpha) * 4;
      colorImage.data[index] = this.palette[paletteIndex];
      colorImage.data[index + 1] = this.palette[paletteIndex + 1];
      colorImage.data[index + 2] = this.palette[paletteIndex + 2];
      colorImage.data[index + 3] = alpha;
    }
    this.context.putImageData(colorImage, 0, 0);
  }

  getValueAt(x: number, y: number) {
    if (!this.alphaData.length) return 0;
    const pixelX = clamp(Math.round(x), 0, this.width - 1);
    const pixelY = clamp(Math.round(y), 0, this.height - 1);
    const alpha = this.alphaData[(pixelY * this.width + pixelX) * 4 + 3];
    return ((this.max - this.min) * alpha) / 255 + this.min;
  }

  getDataUrl() {
    return this.canvas.toDataURL("image/png");
  }

  private createPalette() {
    const paletteCanvas = document.createElement("canvas");
    const paletteContext = paletteCanvas.getContext("2d");
    if (!paletteContext) {
      throw new Error("无法创建热力图调色板");
    }

    paletteCanvas.width = 256;
    paletteCanvas.height = 1;
    const gradient = paletteContext.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, "#1747ff");
    gradient.addColorStop(0.3, "#00b7ff");
    gradient.addColorStop(0.52, "#25d36b");
    gradient.addColorStop(0.72, "#ffe04b");
    gradient.addColorStop(0.9, "#ff6b2c");
    gradient.addColorStop(1, "#ff2638");
    paletteContext.fillStyle = gradient;
    paletteContext.fillRect(0, 0, 256, 1);
    return paletteContext.getImageData(0, 0, 256, 1).data;
  }

  private getPointTemplate(radius: number) {
    const cached = this.templates.get(radius);
    if (cached) return cached;

    const template = document.createElement("canvas");
    const templateContext = template.getContext("2d");
    if (!templateContext) {
      throw new Error("无法创建热力图点模板");
    }

    template.width = radius * 2;
    template.height = radius * 2;
    const gradient = templateContext.createRadialGradient(
      radius,
      radius,
      radius * 0.2,
      radius,
      radius,
      radius,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    templateContext.fillStyle = gradient;
    templateContext.fillRect(0, 0, radius * 2, radius * 2);
    this.templates.set(radius, template);
    return template;
  }
}

const generatePoints = (count: number): HeatmapPoint[] => {
  const random = createSeededRandom(Date.now());
  const clusters = [
    { longitude: 116.38, latitude: 39.94, spread: 0.055 },
    { longitude: 116.44, latitude: 39.91, spread: 0.045 },
    { longitude: 116.48, latitude: 39.87, spread: 0.04 },
    { longitude: 116.34, latitude: 39.89, spread: 0.035 },
  ];

  return Array.from({ length: count }, (_, index) => {
    const cluster = clusters[index % clusters.length];
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * cluster.spread;
    return {
      lnglat: [
        cluster.longitude + Math.cos(angle) * distance,
        cluster.latitude + Math.sin(angle) * distance,
      ],
      strength: 0.38 + random() * 0.62,
    };
  });
};

/**
 * 文章中的 BoundingSphere + ENU 思路：
 * 先在局部东-北-天坐标系里扩展一个包围圆，再转换为经纬度范围。
 */
const computeBoundingBounds = (points: HeatmapPoint[]): HeatmapBounds => {
  const positions = points.map(({ lnglat: [longitude, latitude] }) =>
    Cesium.Cartesian3.fromDegrees(longitude, latitude, 0),
  );
  const sphere = Cesium.BoundingSphere.fromPoints(positions);
  const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(sphere.center);
  const corners: Cesium.Cartesian3[] = [];
  const localAxis = new Cesium.Cartesian3(0, 1, 0);

  for (let angle = 45; angle < 360; angle += 90) {
    const rotation = Cesium.Matrix3.fromRotationZ(
      Cesium.Math.toRadians(angle),
      new Cesium.Matrix3(),
    );
    const direction = Cesium.Cartesian3.normalize(
      Cesium.Matrix3.multiplyByVector(rotation, localAxis, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    );
    const localOffset = Cesium.Cartesian3.multiplyByScalar(
      direction,
      Math.max(sphere.radius, 1),
      new Cesium.Cartesian3(),
    );
    corners.push(
      Cesium.Matrix4.multiplyByPoint(
        modelMatrix,
        localOffset,
        new Cesium.Cartesian3(),
      ),
    );
  }

  const coordinates = [...positions, ...corners].map((position) => {
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
    };
  });

  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.08, 0.006);
  const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.08, 0.006);

  return {
    minLongitude: minLongitude - longitudePadding,
    maxLongitude: maxLongitude + longitudePadding,
    minLatitude: minLatitude - latitudePadding,
    maxLatitude: maxLatitude + latitudePadding,
  };
};

const toCanvasPoint = (
  point: HeatmapPoint,
  bounds: HeatmapBounds,
): CanvasPoint => {
  const longitudeRange = Math.max(bounds.maxLongitude - bounds.minLongitude, 0.0001);
  const latitudeRange = Math.max(bounds.maxLatitude - bounds.minLatitude, 0.0001);
  return {
    x: clamp(
      ((point.lnglat[0] - bounds.minLongitude) / longitudeRange) * CANVAS_SIZE,
      0,
      CANVAS_SIZE - 1,
    ),
    y: clamp(
      ((bounds.maxLatitude - point.lnglat[1]) / latitudeRange) * CANVAS_SIZE,
      0,
      CANVAS_SIZE - 1,
    ),
    value: point.strength * settings.heatScale,
    radius: settings.radius,
  };
};

const createMesh = (
  bounds: HeatmapBounds,
  heatmap: CanvasHeatmap,
): HeatmapMesh => {
  const vertexCount = GRID_SIZE * GRID_SIZE;
  const positions = new Float64Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const textureCoordinates = new Float32Array(vertexCount * 2);
  const indices = new Uint16Array((GRID_SIZE - 1) * (GRID_SIZE - 1) * 6);
  const ellipsoid = Cesium.Ellipsoid.WGS84;
  const longitudeStep =
    (bounds.maxLongitude - bounds.minLongitude) / (GRID_SIZE - 1);
  const latitudeStep =
    (bounds.maxLatitude - bounds.minLatitude) / (GRID_SIZE - 1);
  let vertexIndex = 0;
  let textureIndex = 0;
  let index = 0;

  for (let column = 0; column < GRID_SIZE; column += 1) {
    const longitude = bounds.minLongitude + longitudeStep * column;
    for (let row = 0; row < GRID_SIZE; row += 1) {
      const latitude = bounds.minLatitude + latitudeStep * row;
      const textureX = (column / (GRID_SIZE - 1)) * (CANVAS_SIZE - 1);
      const textureY =
        (1 - row / (GRID_SIZE - 1)) * (CANVAS_SIZE - 1);
      const heatValue = heatmap.getValueAt(textureX, textureY);
      const elevation = settings.is3DMode
        ? settings.baseElevation + heatValue * 0.12
        : settings.baseElevation;
      const position = Cesium.Cartesian3.fromDegrees(
        longitude,
        latitude,
        elevation,
      );
      const normal = ellipsoid.geodeticSurfaceNormal(
        position,
        new Cesium.Cartesian3(),
      );
      const currentVertex = column * GRID_SIZE + row;

      positions[vertexIndex] = position.x;
      positions[vertexIndex + 1] = position.y;
      positions[vertexIndex + 2] = position.z;
      normals[vertexIndex] = normal.x;
      normals[vertexIndex + 1] = normal.y;
      normals[vertexIndex + 2] = normal.z;
      textureCoordinates[textureIndex] = column / (GRID_SIZE - 1);
      textureCoordinates[textureIndex + 1] = row / (GRID_SIZE - 1);
      vertexIndex += 3;
      textureIndex += 2;

      if (column < GRID_SIZE - 1 && row < GRID_SIZE - 1) {
        const nextColumn = (column + 1) * GRID_SIZE + row;
        indices[index] = currentVertex;
        indices[index + 1] = currentVertex + 1;
        indices[index + 2] = nextColumn;
        indices[index + 3] = nextColumn;
        indices[index + 4] = nextColumn + 1;
        indices[index + 5] = currentVertex + 1;
        index += 6;
      }
    }
  }

  return {
    positions,
    normals,
    textureCoordinates,
    indices,
    boundingSphere: Cesium.BoundingSphere.fromVertices(Array.from(positions)),
  };
};

const createHeatmapVertexShader = (is3DMode: boolean) => `
  in vec3 position3DHigh;
  in vec3 position3DLow;
  in vec3 normal;
  in vec2 st;
  in float batchId;

  uniform sampler2D image_0;

  out vec3 v_positionEC;
  out vec3 v_normalEC;
  out vec2 v_st;

  void main()
  {
    vec4 p = czm_computePosition();
    v_positionEC = (czm_modelViewRelativeToEye * p).xyz;
    v_normalEC = czm_normal * normal;
    v_st = st;
${is3DMode ? `
    vec4 positionWC = czm_inverseModelView * vec4(v_positionEC, 1.0);
    vec4 heatColor = texture(image_0, st);
    // Use the original heat intensity encoded in alpha, rather than the
    // color red channel which becomes flat across the orange/red palette.
    float heatValue = clamp((heatColor.a - 0.08) / 0.88, 0.0, 1.0);
    heatValue = pow(heatValue, 1.25);
    vec3 upDirection = normalize(positionWC.xyz);
    p += vec4(heatValue * ${HEATMAP_HEIGHT_SCALE.toFixed(1)} * upDirection, 0.0);
` : ""}
    gl_Position = czm_modelViewProjectionRelativeToEye * p;
  }
`;

const createHeatmapPrimitive = (
  bounds: HeatmapBounds,
  points: HeatmapPoint[],
) => {
  if (!viewer) return null;

  const heatmap = new CanvasHeatmap(CANVAS_SIZE, CANVAS_SIZE);
  heatmap.render(
    points.map((point) => toCanvasPoint(point, bounds)),
    0,
    DISPLAY_MAX_VALUE,
  );
  const mesh = createMesh(bounds, heatmap);

  const geometry = new Cesium.Geometry({
    attributes: {
      position: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: mesh.positions,
      }),
      normal: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
        values: mesh.normals,
      }),
      st: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.FLOAT,
        componentsPerAttribute: 2,
        values: mesh.textureCoordinates,
      }),
      bitangent: undefined,
      tangent: undefined,
      color: undefined
    },
    indices: mesh.indices,
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: mesh.boundingSphere,
  });

  heatmapMaterial = new Cesium.Material({
    fabric: {
      type: "Image",
      uniforms: {
        image: heatmap.getDataUrl(),
      },
    },
  });
  heatmapBoundingSphere = mesh.boundingSphere;

  const appearance = new Cesium.MaterialAppearance({
    material: heatmapMaterial,
    vertexShaderSource: createHeatmapVertexShader(settings.is3DMode),
    translucent: true,
    closed: false,
    faceForward: true,
  });

  return viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({ geometry }),
      appearance,
      asynchronous: false,
      allowPicking: false,
    }),
  );
};

const removeHeatmapPrimitive = () => {
  if (viewer && heatmapPrimitive) {
    viewer.scene.primitives.remove(heatmapPrimitive);
  }
  heatmapPrimitive = null;
  heatmapMaterial = null;
  heatmapBoundingSphere = null;
};

const buildHeatmap = () => {
  if (!viewer) return;
  removeHeatmapPrimitive();
  if (sourcePoints.length !== settings.pointCount) {
    sourcePoints = generatePoints(settings.pointCount);
  }

  const bounds = computeBoundingBounds(sourcePoints);
  heatmapBounds = bounds;
  heatmapPrimitive = createHeatmapPrimitive(bounds, sourcePoints);
};

const scheduleBuild = () => {
  if (rebuildTimer !== null) {
    window.clearTimeout(rebuildTimer);
  }
  rebuildTimer = window.setTimeout(() => {
    rebuildTimer = null;
    buildHeatmap();
  }, 90);
};

const resetCamera = () => {
  if (!viewer) return;
  if (heatmapBoundingSphere) {
    viewer.camera.cancelFlight();
    viewer.camera.viewBoundingSphere(heatmapBoundingSphere);
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    viewer.scene.requestRender();
    return;
  }
  const destination = heatmapBounds
    ? {
        longitude: (heatmapBounds.minLongitude + heatmapBounds.maxLongitude) / 2,
        latitude: (heatmapBounds.minLatitude + heatmapBounds.maxLatitude) / 2,
        height: 38000,
      }
    : cameraDestination;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      destination.longitude,
      destination.latitude,
      destination.height,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(cameraOrientation.heading),
      pitch: Cesium.Math.toRadians(cameraOrientation.pitch),
      roll: Cesium.Math.toRadians(cameraOrientation.roll),
    },
    duration: 1.2,
  });
};

const regeneratePoints = () => {
  sourcePoints = generatePoints(settings.pointCount);
  buildHeatmap();
};

const resetSettings = () => {
  settings.is3DMode = true;
  settings.pointCount = 80;
  settings.radius = 20;
  settings.baseElevation = 200;
  settings.heatScale = 3200;
  sourcePoints = generatePoints(settings.pointCount);
  buildHeatmap();
  resetCamera();
};

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  sourcePoints = generatePoints(settings.pointCount);
  buildHeatmap();
  resetCamera();
};

watch(
  () => [
    settings.is3DMode,
    settings.pointCount,
    settings.radius,
    settings.baseElevation,
    settings.heatScale,
  ],
  scheduleBuild,
);

onBeforeUnmount(() => {
  if (rebuildTimer !== null) {
    window.clearTimeout(rebuildTimer);
  }
  removeHeatmapPrimitive();
  heatmapMaterial = null;
  viewer = null;
});
</script>

<style scoped lang="scss">
.heatmap-scene {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #07131c;
}

.heatmap-panel {
  position: fixed;
  top: 76px;
  left: 16px;
  z-index: 2001;
  width: 300px;
  padding: 14px;
  color: #f4fbff;
  background: rgba(7, 20, 31, 0.84);
  border: 1px solid rgba(165, 224, 246, 0.28);
  border-radius: 8px;
  box-shadow: 0 14px 34px rgba(0, 11, 19, 0.36);
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
    background: rgba(12, 83, 117, 0.92);
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
  gap: 8px;
  min-height: 30px;
  padding-right: 38px;
  font-size: 16px;
  font-weight: 600;
}

.panel-subtitle {
  margin-top: -5px;
  color: rgba(208, 235, 245, 0.66);
  font-size: 12px;
}

.panel-close {
  position: absolute;
  top: 10px;
  right: 10px;
}

.panel-open,
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: #eafaff;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(218, 245, 252, 0.24);
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 0.18s,
    border-color 0.18s,
    background 0.18s;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(242, 251, 254, 0.5);
  }
}

.panel-open {
  width: 42px;
  height: 42px;
  border: 0;
  background: transparent;
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
  color: rgba(239, 250, 255, 0.9);
  font-size: 13px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  color: rgba(239, 250, 255, 0.9);
  font-size: 13px;
}

.panel-actions {
  display: flex;
  gap: 8px;
  padding-top: 3px;
}

.panel-actions :deep(.el-button) {
  flex: 1;
  margin: 0;
}

.panel-actions :deep(.el-icon) {
  margin-right: 4px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
}

.legend-label {
  color: rgba(239, 250, 255, 0.62);
  font-size: 11px;
}

.legend-gradient {
  flex: 1;
  height: 8px;
  background: linear-gradient(
    90deg,
    #1747ff 0%,
    #00b7ff 30%,
    #25d36b 52%,
    #ffe04b 72%,
    #ff6b2c 90%,
    #ff2638 100%
  );
  border-radius: 4px;
}

:deep(.el-slider) {
  --el-slider-main-bg-color: #65d4ee;
  --el-slider-runway-bg-color: rgba(228, 247, 253, 0.2);
  --el-slider-button-size: 14px;
  --el-slider-button-wrapper-size: 30px;
}

:deep(.el-switch) {
  --el-switch-on-color: #32b9d7;
  --el-switch-off-color: rgba(228, 247, 253, 0.24);
}

@media (max-width: 640px) {
  .heatmap-panel {
    top: 64px;
    left: 10px;
    width: min(300px, calc(100vw - 20px));
  }
}
</style>
