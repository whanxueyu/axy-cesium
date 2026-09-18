/**
 * @description 测量分析案例共享工具模块
 * 提供：拾取、批量地形采样、规则网格、面积计算、沿线采样、
 *       通视检测、可视域扫描、坡度坡向、填挖方、淹没分析、网格着色等能力
 * 供 面积/填挖方/剖面/通视/坡度坡向/淹没 六个案例复用
 */
import * as Cesium from "cesium";
import * as turf from "@turf/turf";
import { isTerrainEnabled } from "@/modules/cesium/tools";

// ==================== 类型定义 ====================

export interface LonLat {
  lng: number;
  lat: number;
  height?: number;
}

export interface TerrainSample extends LonLat {
  height: number; // 地形海拔（米）
}

export interface GridSample extends TerrainSample {
  row: number;
  col: number;
  inside: boolean; // 是否位于多边形内部
}

export interface PolygonGridResult {
  points: GridSample[]; // 外接矩形全部网格点（含外部点），按 row-major 排列
  rows: number;
  cols: number;
  cellArea: number; // 单个单元格近似面积（米²）
  spacing: number; // 实际使用间距（超限自动放大后可能与入参不同）
  minHeight: number;
  maxHeight: number;
}

export interface ProfileSample extends TerrainSample {
  distance: number; // 距起点累计地表距离（米）
}

export interface LineOfSightResult {
  visible: boolean;
  obstruction?: Cesium.Cartesian3; // 遮挡点
  obstructionType?: "terrain" | "model";
}

export interface ViewshedResult {
  boundary: TerrainSample[]; // 可视域边界点（含高程），首点为观察点，闭合
  rayCount: number; // 总射线数
  blockedRayCount: number; // 被挡射线数
  area2D: number; // 可视域 2D 面积（米²）
}

export interface SlopeAspectCell {
  id?: string;
  row: number;
  col: number;
  center: LonLat;
  slope: number; // 坡度（度）
  aspect: number; // 坡向（度，0=北，顺时针）
  level: number; // 坡度分级下标
  area?: number;
}

export interface CutFillCell {
  id?: string;
  row: number;
  col: number;
  triangleIndex?: number;
  center: LonLat;
  h: number; // 地形高程
  dh: number; // 相对基准高程的高差（正=挖）
  area?: number;
  cutVolume?: number;
  fillVolume?: number;
  vertices?: [TerrainSample, TerrainSample, TerrainSample];
}

export interface CutFillResult {
  baseHeight: number;
  horizontalArea?: number;
  surfaceArea?: number;
  cutVolume: number; // 挖方量 m³
  fillVolume: number; // 填方量 m³
  netVolume: number; // 净方量（挖-填）m³
  cells: CutFillCell[];
  histogram: Array<{ range: string; volume: number }>; // 10 档高差-体积分布
}

export interface FloodResult {
  waterLevel: number;
  area: number; // 淹没面积 m²
  horizontalArea?: number;
  totalArea?: number;
  volume: number; // 淹没体积 m³
  maxDepth: number; // 最大水深 m
  averageDepth: number; // 平均水深 m
  floodedCount: number; // 淹没网格数
  totalCount: number; // 区域内有效网格数
  coverageRatio: number; // 淹没网格占比，0~1
  cells: FloodCell[]; // 被淹没的网格明细
}

export interface FloodCell {
  id?: string;
  row: number;
  col: number;
  triangleIndex?: number;
  center: LonLat;
  terrainHeight: number;
  depth: number;
  area: number;
  horizontalArea?: number;
  volume: number;
  vertices?: [TerrainSample, TerrainSample, TerrainSample];
}

export interface TerrainTriangle {
  id: string;
  row: number;
  col: number;
  triangleIndex: number;
  partIndex: number;
  vertices: [TerrainSample, TerrainSample, TerrainSample];
  center: TerrainSample;
  surfaceArea: number;
  horizontalArea: number;
  slope: number;
  aspect: number;
  level: number;
  coverageRatio: number;
}

export interface TerrainTriangleMesh {
  triangles: TerrainTriangle[];
  ring: TerrainSample[];
  rows: number;
  cols: number;
  spacing: number;
  minHeight: number;
  maxHeight: number;
  horizontalArea: number;
  surfaceArea: number;
}

export type TerrainAnalysisPrimitive = Cesium.Primitive | Cesium.GroundPrimitive;

// ==================== 常量 ====================

/** 单次 sampleTerrainMostDetailed 分片上限（避免大数组长时间阻塞） */
export const MAX_POINTS_PER_SAMPLE_CALL = 4096;

/** 网格总点数硬上限（超出自动翻倍间距） */
export const MAX_GRID_TOTAL_POINTS = 20000;

/** 坡度 5 级标准分级 */
export const SLOPE_LEVELS = [
  { min: 0, max: 5, name: "平缓坡 (<5°)", color: "#00ee7f" },
  { min: 5, max: 15, name: "缓坡 (5-15°)", color: "#a0f040" },
  { min: 15, max: 25, name: "中等坡 (15-25°)", color: "#ffd700" },
  { min: 25, max: 35, name: "陡坡 (25-35°)", color: "#ff8c00" },
  { min: 35, max: Infinity, name: "极陡坡 (>35°)", color: "#ff4500" },
];

// ==================== 拾取 ====================

/**
 * 屏幕坐标拾取地表点：pickPosition 失败回退 getPickRay + globe.pick
 * @param viewer
 * @param windowPosition 屏幕坐标
 */
export function pickPositionOnMap(
  viewer: Cesium.Viewer,
  windowPosition: Cesium.Cartesian2,
): Cesium.Cartesian3 | undefined {
  const cartesian = viewer.scene.pickPosition(windowPosition);
  if (cartesian) return cartesian;

  const ray = viewer.camera.getPickRay(windowPosition);
  if (!ray) return undefined;

  const picked = viewer.scene.globe.pick(ray, viewer.scene);
  if (!picked) return undefined;

  // 瓦片未加载时 globe.pick 可能命中地球背面（高度为负数千公里），
  // 这类点会导致实体被埋入地下或跨半球，直接丢弃
  const carto = Cesium.Cartographic.fromCartesian(picked);
  if (carto.height < -1000) return undefined;

  return picked;
}

// ==================== 地形采样 ====================

/**
 * 批量采样地形高程
 * @param viewer
 * @param points 经纬度点集
 * @returns 带回填高程的点集（顺序与入参一致）
 */
export async function sampleTerrainHeights(
  viewer: Cesium.Viewer,
  points: LonLat[],
): Promise<TerrainSample[]> {
  if (!points.length) return [];

  // 未加载地形时回退同步 globe.getHeight
  if (!isTerrainEnabled(viewer)) {
    return points.map((p) => {
      const carto = Cesium.Cartographic.fromDegrees(p.lng, p.lat);
      return { ...p, height: viewer.scene.globe.getHeight(carto) ?? 0 };
    });
  }

  const provider = viewer.terrainProvider || viewer.scene.terrainProvider;
  const results: TerrainSample[] = [];

  // 分片顺序请求，避免单次请求过大
  for (let i = 0; i < points.length; i += MAX_POINTS_PER_SAMPLE_CALL) {
    const chunk = points.slice(i, i + MAX_POINTS_PER_SAMPLE_CALL);
    try {
      const cartos = chunk.map((p) => Cesium.Cartographic.fromDegrees(p.lng, p.lat));
      const updated = await Cesium.sampleTerrainMostDetailed(provider, cartos);
      updated.forEach((carto, idx) => {
        const fallbackHeight = viewer.scene.globe.getHeight(carto) ?? 0;
        results.push({ ...chunk[idx], height: carto.height ?? fallbackHeight });
      });
    } catch (error) {
      console.warn("地形采样失败，回退当前已加载地形高度:", error);
      chunk.forEach((p) => {
        const cartographic = Cesium.Cartographic.fromDegrees(p.lng, p.lat);
        results.push({
          ...p,
          height: viewer.scene.globe.getHeight(cartographic) ?? 0,
        });
      });
    }
  }
  return results;
}

/**
 * 采样单个点的地形高程
 */
export async function sampleOneTerrainHeight(
  viewer: Cesium.Viewer,
  point: LonLat,
): Promise<number> {
  const samples = await sampleTerrainHeights(viewer, [point]);
  return samples[0]?.height ?? 0;
}

// ==================== 规则网格 ====================

/**
 * 生成多边形外接矩形的规则网格（仅做 2D 内外判定，不采样高程）
 * @param polygonLngLats 多边形顶点（无需闭合）
 * @param spacingMeters 网格间距（米），超点数上限时自动翻倍
 */
export function generatePolygonGrid(
  polygonLngLats: LonLat[],
  spacingMeters: number,
): { points: GridSample[]; rows: number; cols: number; cellArea: number; spacing: number } {
  const closedRing = [...polygonLngLats, polygonLngLats[0]].map((p) => [p.lng, p.lat]);
  const polygonFeature = turf.polygon([closedRing]);

  let spacing = spacingMeters;

  // 点数超限时自动翻倍间距重新生成
  while (true) {
    const [minLng, minLat, maxLng, maxLat] = turf.bbox(polygonFeature);
    const midLat = (minLat + maxLat) / 2;
    const dLat = spacing / 111320;
    const dLng = spacing / (111320 * Math.cos((midLat * Math.PI) / 180));

    const rows = Math.ceil((maxLat - minLat) / dLat);
    const cols = Math.ceil((maxLng - minLng) / dLng);
    const points: GridSample[] = [];

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const lng = minLng + c * dLng;
        const lat = maxLat - r * dLat;
        const inside = turf.booleanPointInPolygon([lng, lat], polygonFeature);
        points.push({ lng, lat, row: r, col: c, inside, height: 0 });
      }
    }

    const insideCount = points.filter((p) => p.inside).length;
    const cellArea =
      dLat * 111320 * dLng * 111320 * Math.cos((midLat * Math.PI) / 180);

    if (insideCount <= MAX_GRID_TOTAL_POINTS || spacing >= 4000) {
      return { points, rows, cols, cellArea, spacing };
    }
    console.warn(`网格点数 ${insideCount} 超出上限，间距翻倍为 ${spacing * 2}m 重新生成`);
    spacing *= 2;
  }
}

/**
 * 生成多边形规则网格并批量采样高程
 */
export async function samplePolygonGrid(
  viewer: Cesium.Viewer,
  polygonLngLats: LonLat[],
  spacingMeters: number,
): Promise<PolygonGridResult> {
  const { points, rows, cols, cellArea, spacing } = generatePolygonGrid(
    polygonLngLats,
    spacingMeters,
  );

  // 只采样内部点，减少请求量
  const insidePoints = points.filter((p) => p.inside);
  const sampled = await sampleTerrainHeights(viewer, insidePoints);

  let idx = 0;
  const full = points.map((p) =>
    p.inside ? { ...p, height: sampled[idx++]?.height ?? 0 } : { ...p, height: 0 },
  );

  const heights = insidePoints.map((_, i) => sampled[i]?.height ?? 0);
  const minHeight = heights.length ? Math.min(...heights) : 0;
  const maxHeight = heights.length ? Math.max(...heights) : 0;

  return { points: full, rows, cols, cellArea, spacing, minHeight, maxHeight };
}

/** 构造 row,col -> 采样点 的查找表（仅内部点） */
export function buildGridHeightMap(grid: PolygonGridResult): Map<string, GridSample> {
  const map = new Map<string, GridSample>();
  grid.points.forEach((p) => {
    if (p.inside) map.set(`${p.row},${p.col}`, p);
  });
  return map;
}

// ==================== 面积计算 ====================

/**
 * WGS84 球面面积（turf.area，单位 m²）
 */
export function computeSphericalArea(polygonLngLats: LonLat[]): number {
  if (polygonLngLats.length < 3) return 0;
  const closedRing = [...polygonLngLats, polygonLngLats[0]].map((p) => [p.lng, p.lat]);
  return turf.area(turf.polygon([closedRing]));
}

/**
 * 水平面积：投影到首点 ENU 水平面后用鞋带公式计算（单位 m²）
 */
export function computePlanarArea(polygonLngLats: LonLat[]): number {
  if (polygonLngLats.length < 3) return 0;
  try {
    const first = polygonLngLats[0];
    const planeHeight = first.height ?? 0;
    const origin = Cesium.Cartesian3.fromDegrees(first.lng, first.lat, planeHeight);
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
    const inverse = Cesium.Matrix4.inverseTransformation(transform, new Cesium.Matrix4());
    const localPoints = polygonLngLats.map((p) => {
      const cartesian = Cesium.Cartesian3.fromDegrees(p.lng, p.lat, planeHeight);
      return Cesium.Matrix4.multiplyByPoint(inverse, cartesian, new Cesium.Cartesian3());
    });

    let area = 0;
    for (let i = 0; i < localPoints.length; i++) {
      const current = localPoints[i];
      const next = localPoints[(i + 1) % localPoints.length];
      area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area * 0.5);
  } catch (error) {
    console.warn("水平面积计算失败:", error);
    return 0;
  }
}

function densifyPolygonBoundary(polygonLngLats: LonLat[], edgeSpacing: number): LonLat[] {
  const densified: LonLat[] = [];
  for (let i = 0; i < polygonLngLats.length; i++) {
    const p1 = polygonLngLats[i];
    const p2 = polygonLngLats[(i + 1) % polygonLngLats.length];
    const c1 = Cesium.Cartesian3.fromDegrees(p1.lng, p1.lat, 0);
    const c2 = Cesium.Cartesian3.fromDegrees(p2.lng, p2.lat, 0);
    const edgeLen = Cesium.Cartesian3.distance(c1, c2);

    densified.push(p1);
    const n = Math.ceil(edgeLen / edgeSpacing);
    if (n > 1) {
      const line = turf.lineString([
        [p1.lng, p1.lat],
        [p2.lng, p2.lat],
      ]);
      for (let k = 1; k < n; k++) {
        const dist = Math.min(k * edgeSpacing, edgeLen - 1);
        if (dist <= 0) continue;
        const pt = turf.along(line, dist, { units: "meters" });
        const coord = pt.geometry.coordinates;
        densified.push({ lng: coord[0], lat: coord[1] });
      }
    }
  }
  return densified;
}

function triangleArea3D(
  a: Cesium.Cartesian3,
  b: Cesium.Cartesian3,
  c: Cesium.Cartesian3,
): number {
  return 0.5 * Cesium.Cartesian3.magnitude(
    Cesium.Cartesian3.cross(
      Cesium.Cartesian3.subtract(b, a, new Cesium.Cartesian3()),
      Cesium.Cartesian3.subtract(c, a, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    ),
  );
}

function terrainSampleToCartesian(sample: TerrainSample): Cesium.Cartesian3 {
  return Cesium.Cartesian3.fromDegrees(sample.lng, sample.lat, sample.height);
}

function terrainSampleKey(point: LonLat): string {
  return `${point.lng.toFixed(8)},${point.lat.toFixed(8)}`;
}

function getSlopeLevel(slope: number): number {
  for (let i = 0; i < SLOPE_LEVELS.length; i++) {
    if (slope >= SLOPE_LEVELS[i].min && slope < SLOPE_LEVELS[i].max) {
      return i;
    }
  }
  return SLOPE_LEVELS.length - 1;
}

function averageTerrainSample(samples: TerrainSample[]): TerrainSample {
  const count = Math.max(samples.length, 1);
  const sum = samples.reduce(
    (acc, sample) => ({
      lng: acc.lng + sample.lng,
      lat: acc.lat + sample.lat,
      height: acc.height + sample.height,
    }),
    { lng: 0, lat: 0, height: 0 },
  );
  return {
    lng: sum.lng / count,
    lat: sum.lat / count,
    height: sum.height / count,
  };
}

function getLocalTransform(samples: TerrainSample[]) {
  const center = averageTerrainSample(samples);
  const origin = Cesium.Cartesian3.fromDegrees(center.lng, center.lat, center.height);
  const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const inverse = Cesium.Matrix4.inverseTransformation(transform, new Cesium.Matrix4());
  return { center, transform, inverse };
}

function toLocalPoint(
  sample: TerrainSample,
  inverse: Cesium.Matrix4,
  height = sample.height,
): Cesium.Cartesian3 {
  return Cesium.Matrix4.multiplyByPoint(
    inverse,
    Cesium.Cartesian3.fromDegrees(sample.lng, sample.lat, height),
    new Cesium.Cartesian3(),
  );
}

function triangleArea2D(points: Cesium.Cartesian3[]): number {
  if (points.length < 3) return 0;
  const a = points[0];
  const b = points[1];
  const c = points[2];
  return Math.abs(
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) * 0.5,
  );
}

export function computeTerrainTriangleSurfaceArea(
  vertices: [TerrainSample, TerrainSample, TerrainSample],
): number {
  return triangleArea3D(
    terrainSampleToCartesian(vertices[0]),
    terrainSampleToCartesian(vertices[1]),
    terrainSampleToCartesian(vertices[2]),
  );
}

export function computeTerrainTriangleHorizontalArea(
  vertices: [TerrainSample, TerrainSample, TerrainSample],
): number {
  const { center, inverse } = getLocalTransform(vertices);
  const local = vertices.map((vertex) => toLocalPoint(vertex, inverse, center.height));
  return triangleArea2D(local);
}

export function computeTerrainPolygonSurfaceArea(points: TerrainSample[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 1; i < points.length - 1; i++) {
    area += computeTerrainTriangleSurfaceArea([points[0], points[i], points[i + 1]]);
  }
  return area;
}

function getTriangleSlopeAspect(
  vertices: [TerrainSample, TerrainSample, TerrainSample],
): { slope: number; aspect: number } {
  const { inverse } = getLocalTransform(vertices);
  const local = vertices.map((vertex) => toLocalPoint(vertex, inverse));
  const ab = Cesium.Cartesian3.subtract(local[1], local[0], new Cesium.Cartesian3());
  const ac = Cesium.Cartesian3.subtract(local[2], local[0], new Cesium.Cartesian3());
  const normal = Cesium.Cartesian3.cross(ab, ac, new Cesium.Cartesian3());
  if (normal.z < 0) {
    Cesium.Cartesian3.negate(normal, normal);
  }

  const horizontal = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
  const slope = Cesium.Math.toDegrees(Math.atan2(horizontal, Math.abs(normal.z)));
  const aspect = horizontal <= 1e-8
    ? 0
    : (Cesium.Math.toDegrees(Math.atan2(normal.x, normal.y)) + 360) % 360;
  return { slope, aspect };
}

type Coordinate2D = [number, number];

function normalizeCoordinateRing(ring: number[][]): Coordinate2D[] {
  const normalized: Coordinate2D[] = [];
  ring.forEach((coord) => {
    const lng = coord[0];
    const lat = coord[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const previous = normalized[normalized.length - 1];
    if (previous && Math.abs(previous[0] - lng) < 1e-12 && Math.abs(previous[1] - lat) < 1e-12) {
      return;
    }
    normalized.push([lng, lat]);
  });

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  if (
    first &&
    last &&
    normalized.length > 1 &&
    Math.abs(first[0] - last[0]) < 1e-12 &&
    Math.abs(first[1] - last[1]) < 1e-12
  ) {
    normalized.pop();
  }
  return normalized;
}

function triangulateCoordinateRing(ring: Coordinate2D[]): Coordinate2D[][] {
  if (ring.length < 3) return [];
  if (ring.length === 3) return [ring];

  const triangles: Coordinate2D[][] = [];
  for (let i = 1; i < ring.length - 1; i++) {
    triangles.push([ring[0], ring[i], ring[i + 1]]);
  }
  return triangles;
}

function coordinateTrianglesFromFeature(feature: any): Coordinate2D[][] {
  const triangles: Coordinate2D[][] = [];

  try {
    const tessellated = (turf as any).tesselate?.(feature);
    tessellated?.features?.forEach((item: any) => {
      const ring = item.geometry?.coordinates?.[0];
      if (!ring) return;
      triangles.push(...triangulateCoordinateRing(normalizeCoordinateRing(ring)));
    });
  } catch (error) {
    console.warn("三角面剖分失败，使用扇形剖分降级:", error);
  }

  if (triangles.length) return triangles;

  const geometry = feature.geometry;
  const polygonRings = geometry?.type === "Polygon"
    ? [geometry.coordinates?.[0]]
    : geometry?.type === "MultiPolygon"
      ? geometry.coordinates.map((polygon: number[][][]) => polygon[0])
      : [];

  polygonRings.forEach((ring: number[][] | undefined) => {
    if (!ring) return;
    triangles.push(...triangulateCoordinateRing(normalizeCoordinateRing(ring)));
  });

  return triangles;
}

function makeTriangleHeightInterpolator(
  vertices: [TerrainSample, TerrainSample, TerrainSample],
) {
  const { center, inverse } = getLocalTransform(vertices);
  const local = vertices.map((vertex) => toLocalPoint(vertex, inverse, center.height));
  const [a, b, c] = local;
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);

  return (lng: number, lat: number) => {
    if (Math.abs(denominator) < 1e-12) {
      return averageTerrainSample(vertices).height;
    }
    const point = toLocalPoint({ lng, lat, height: center.height }, inverse, center.height);
    const w1 = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
    const w2 = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;
    const w3 = 1 - w1 - w2;
    return vertices[0].height * w1 + vertices[1].height * w2 + vertices[2].height * w3;
  };
}

function createTerrainTriangle(
  vertices: [TerrainSample, TerrainSample, TerrainSample],
  row: number,
  col: number,
  triangleIndex: number,
  partIndex: number,
  coverageRatio: number,
): TerrainTriangle | null {
  const horizontalArea = computeTerrainTriangleHorizontalArea(vertices);
  const surfaceArea = computeTerrainTriangleSurfaceArea(vertices);
  if (horizontalArea <= 0 || surfaceArea <= 0) return null;

  const center = averageTerrainSample(vertices);
  const { slope, aspect } = getTriangleSlopeAspect(vertices);
  return {
    id: `${row},${col},${triangleIndex},${partIndex}`,
    row,
    col,
    triangleIndex,
    partIndex,
    vertices,
    center,
    surfaceArea,
    horizontalArea,
    slope,
    aspect,
    level: getSlopeLevel(slope),
    coverageRatio,
  };
}

function createClippedTerrainTriangles(
  baseVertices: [TerrainSample, TerrainSample, TerrainSample],
  polygon: any,
  row: number,
  col: number,
  triangleIndex: number,
): TerrainTriangle[] {
  const baseRing = [
    [baseVertices[0].lng, baseVertices[0].lat],
    [baseVertices[1].lng, baseVertices[1].lat],
    [baseVertices[2].lng, baseVertices[2].lat],
    [baseVertices[0].lng, baseVertices[0].lat],
  ];
  const basePolygon = turf.polygon([baseRing]);
  const intersection = turf.intersect(turf.featureCollection([polygon, basePolygon]));
  if (!intersection) return [];

  const baseHorizontalArea = computeTerrainTriangleHorizontalArea(baseVertices);
  if (baseHorizontalArea <= 0) return [];

  const interpolateHeight = makeTriangleHeightInterpolator(baseVertices);
  const triangles: TerrainTriangle[] = [];
  const coordTriangles = coordinateTrianglesFromFeature(intersection);

  coordTriangles.forEach((coordTriangle, index) => {
    if (coordTriangle.length < 3) return;
    const vertices = coordTriangle.slice(0, 3).map(([lng, lat]) => ({
      lng,
      lat,
      height: interpolateHeight(lng, lat),
    })) as [TerrainSample, TerrainSample, TerrainSample];

    const horizontalArea = computeTerrainTriangleHorizontalArea(vertices);
    const coverageRatio = Math.min(1, horizontalArea / baseHorizontalArea);
    const triangle = createTerrainTriangle(
      vertices,
      row,
      col,
      triangleIndex,
      index,
      coverageRatio,
    );
    if (triangle) triangles.push(triangle);
  });

  return triangles;
}

export async function sampleTerrainTriangleMesh(
  viewer: Cesium.Viewer,
  polygonLngLats: LonLat[],
  spacingMeters = 30,
): Promise<TerrainTriangleMesh> {
  if (polygonLngLats.length < 3) {
    return {
      triangles: [],
      ring: [],
      rows: 0,
      cols: 0,
      spacing: spacingMeters,
      minHeight: 0,
      maxHeight: 0,
      horizontalArea: 0,
      surfaceArea: 0,
    };
  }

  const boundary = densifyPolygonBoundary(polygonLngLats, spacingMeters);
  const grid = generatePolygonGrid(polygonLngLats, spacingMeters);
  const candidates = [...boundary, ...grid.points];
  const uniqueCandidates = Array.from(
    new Map(candidates.map((point) => [terrainSampleKey(point), point])).values(),
  );
  const samples = await sampleTerrainHeights(viewer, uniqueCandidates);
  const samplesByKey = new Map(samples.map((sample) => [terrainSampleKey(sample), sample]));
  const ring = boundary.map((point) =>
    samplesByKey.get(terrainSampleKey(point)) ?? { ...point, height: 0 },
  );
  const closedRing = [...polygonLngLats, polygonLngLats[0]].map((point) => [
    point.lng,
    point.lat,
  ]);
  const polygon = turf.polygon([closedRing]);

  const getGridSample = (row: number, col: number) => {
    const point = grid.points[row * (grid.cols + 1) + col];
    return point ? samplesByKey.get(terrainSampleKey(point)) : undefined;
  };

  const triangles: TerrainTriangle[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const c00 = getGridSample(row, col);
      const c01 = getGridSample(row, col + 1);
      const c11 = getGridSample(row + 1, col + 1);
      const c10 = getGridSample(row + 1, col);
      if (!c00 || !c01 || !c11 || !c10) continue;

      triangles.push(...createClippedTerrainTriangles([c00, c01, c11], polygon, row, col, 0));
      triangles.push(...createClippedTerrainTriangles([c00, c11, c10], polygon, row, col, 1));
    }
  }

  const heights = triangles.flatMap((triangle) => triangle.vertices.map((vertex) => vertex.height));
  const rawHorizontalArea = triangles.reduce((sum, triangle) => sum + triangle.horizontalArea, 0);
  const planarArea = computePlanarArea(polygonLngLats);
  const horizontalArea = Math.max(rawHorizontalArea, planarArea);
  const rawSurfaceArea = triangles.reduce((sum, triangle) => sum + triangle.surfaceArea, 0);
  const surfaceArea = Math.max(rawSurfaceArea, horizontalArea);

  return {
    triangles,
    ring,
    rows: grid.rows,
    cols: grid.cols,
    spacing: grid.spacing,
    minHeight: heights.length ? Math.min(...heights) : 0,
    maxHeight: heights.length ? Math.max(...heights) : 0,
    horizontalArea,
    surfaceArea,
  };
}

function isTerrainTriangleMesh(
  input: PolygonGridResult | TerrainTriangleMesh,
): input is TerrainTriangleMesh {
  return Array.isArray((input as TerrainTriangleMesh).triangles);
}

export async function computeSurfaceArea3D(
  viewer: Cesium.Viewer,
  polygonLngLats: LonLat[],
  edgeSpacing = 30,
): Promise<{ area: number; ring: TerrainSample[]; triangles: TerrainTriangle[] }> {
  if (polygonLngLats.length < 3) return { area: 0, ring: [], triangles: [] };
  const mesh = await sampleTerrainTriangleMesh(viewer, polygonLngLats, edgeSpacing);
  return { area: mesh.surfaceArea, ring: mesh.ring, triangles: mesh.triangles };
}

// ==================== 沿线采样（剖面） ====================

/**
 * 沿折线均匀采样地形高程（剖面数据）
 * @param lineLngLats 折线顶点（≥2 点）
 * @param spacingMeters 采样间距（米）
 */
export async function sampleTerrainAlongLine(
  viewer: Cesium.Viewer,
  lineLngLats: LonLat[],
  spacingMeters = 20,
): Promise<ProfileSample[]> {
  if (lineLngLats.length < 2) return [];

  // 1) 计算各段地表长度与总长
  const ellipsoid = viewer.scene.globe.ellipsoid;
  const segLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < lineLngLats.length - 1; i++) {
    const a = lineLngLats[i];
    const b = lineLngLats[i + 1];
    const geodesic = new Cesium.EllipsoidGeodesic(
      Cesium.Cartographic.fromDegrees(a.lng, a.lat),
      Cesium.Cartographic.fromDegrees(b.lng, b.lat),
      ellipsoid,
    );
    segLengths.push(geodesic.surfaceDistance);
    totalLength += geodesic.surfaceDistance;
  }
  if (totalLength <= 0) return [];

  // 2) 均匀取点
  const n = Math.max(1, Math.round(totalLength / spacingMeters));
  const samplePoints: LonLat[] = [];
  for (let k = 0; k <= n; k++) {
    const dist = Math.min(k * (totalLength / n), totalLength);
    // 定位 dist 所在段
    let segIndex = 0;
    let remaining = dist;
    while (segIndex < segLengths.length - 1 && remaining > segLengths[segIndex] + 1e-6) {
      remaining -= segLengths[segIndex];
      segIndex++;
    }
    const a = lineLngLats[segIndex];
    const b = lineLngLats[segIndex + 1];
    const fraction = segLengths[segIndex] > 0
      ? Math.min(1, Math.max(0, remaining / segLengths[segIndex]))
      : 0;
    const geodesic = new Cesium.EllipsoidGeodesic(
      Cesium.Cartographic.fromDegrees(a.lng, a.lat),
      Cesium.Cartographic.fromDegrees(b.lng, b.lat),
      ellipsoid,
    );
    const carto = geodesic.interpolateUsingFraction(fraction);
    samplePoints.push({
      lng: (carto.longitude * 180) / Math.PI,
      lat: (carto.latitude * 180) / Math.PI,
    });
  }

  // 3) 批量采样高程并回填距离
  const sampled = await sampleTerrainHeights(viewer, samplePoints);
  return sampled.map((p, k) => ({
    ...p,
    distance: Math.min(k * (totalLength / n), totalLength),
  }));
}

export async function computeTerrainDistance3D(
  viewer: Cesium.Viewer,
  lineLngLats: LonLat[],
  spacingMeters = 20,
): Promise<{ distance: number; samples: ProfileSample[] }> {
  const samples = await sampleTerrainAlongLine(viewer, lineLngLats, spacingMeters);
  if (samples.length < 2) {
    return { distance: 0, samples };
  }

  let distance = 0;
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    distance += Cesium.Cartesian3.distance(
      Cesium.Cartesian3.fromDegrees(previous.lng, previous.lat, previous.height),
      Cesium.Cartesian3.fromDegrees(current.lng, current.lat, current.height),
    );
  }

  return { distance, samples };
}

// ==================== 通视检测 ====================

/**
 * 检测两点之间是否通视（移植自 jamRadar.vue 的 isLineOfSightClear）
 * @param from 起点（世界坐标）
 * @param to 终点（世界坐标）
 */
export function isLineOfSightClear(
  viewer: Cesium.Viewer,
  from: Cesium.Cartesian3,
  to: Cesium.Cartesian3,
): LineOfSightResult {
  const distance = Cesium.Cartesian3.distance(from, to);
  const endpointTolerance = Math.max(0.5, Math.min(3, distance * 0.00001));

  // 创建从 A 到 B 的射线
  const direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(to, from, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );
  const ray = new Cesium.Ray(from, direction);
  const scene = viewer.scene as Cesium.Scene & {
    pickFromRay?: (ray: Cesium.Ray) => unknown;
    pickPositionFromRay?: (ray: Cesium.Ray) => Cesium.Cartesian3 | undefined;
  };

  // 检测与地形的交点
  const intersection = viewer.scene.globe.pick(ray, viewer.scene);
  if (intersection) {
    const intersectionDistance = Cesium.Cartesian3.distance(from, intersection);
    // 交点距离小于 AB 距离，说明被地形遮挡
    if (intersectionDistance > endpointTolerance && intersectionDistance < distance - endpointTolerance) {
      return { visible: false, obstruction: intersection, obstructionType: "terrain" };
    }
  }

  // 检测与 3D Tiles 等模型的交点
  const pickedObject = scene.pickFromRay?.(ray);
  if (Cesium.defined(pickedObject)) {
    const modelIntersection = scene.pickPositionFromRay?.(ray);
    if (Cesium.defined(modelIntersection)) {
      const intersectionDistance = Cesium.Cartesian3.distance(from, modelIntersection);
      if (intersectionDistance > endpointTolerance && intersectionDistance < distance - endpointTolerance) {
        return { visible: false, obstruction: modelIntersection, obstructionType: "model" };
      }
    }
  }

  // 无遮挡，两点通视
  return { visible: true };
}

// ==================== 可视域扫描 ====================

export interface ViewshedOptions {
  center: LonLat; // 观察点经纬度
  observerHeight: number; // 观察点高出地表（米）
  radius: number; // 扫描半径（米）
  startAngle?: number; // 起始方位角（度，0=正北，顺时针）
  endAngle?: number; // 结束方位角（度）
  angleStep?: number; // 角度步长（度）
  distanceStep?: number; // 距离步长（米）
}

/**
 * 扇形可视域扫描：从观察点向各方位发射射线，求每条射线的可视边界
 * @returns 可视域边界（首点为观察点地表点，闭合）与统计信息
 */
export async function computeViewshedSector(
  viewer: Cesium.Viewer,
  options: ViewshedOptions,
): Promise<ViewshedResult> {
  const { center, observerHeight, radius } = options;
  const startAngle = options.startAngle ?? 0;
  const endAngle = options.endAngle ?? 360;
  const angleStep = options.angleStep ?? 1;
  const distanceStep = options.distanceStep ?? 50;

  // 观察点地表高程与视线高程
  const baseH = await sampleOneTerrainHeight(viewer, center);
  const eyeH = baseH + observerHeight;

  // 1) 生成全部射线行进点（先不采样）
  const rayAngles: number[] = [];
  const span = endAngle < startAngle ? endAngle - startAngle + 360 : endAngle - startAngle;
  for (let az = startAngle; az <= startAngle + span; az += angleStep) {
    rayAngles.push(az % 360);
  }

  const rayPoints: Array<Array<{ lng: number; lat: number }>> = rayAngles.map((az) => {
    const pts: Array<{ lng: number; lat: number }> = [];
    for (let d = distanceStep; d <= radius; d += distanceStep) {
      const dest = turf.destination([center.lng, center.lat], d, az, { units: "meters" });
      pts.push({ lng: dest.geometry.coordinates[0], lat: dest.geometry.coordinates[1] });
    }
    return pts;
  });

  // 2) 高程获取（混合策略）：先同步 globe.getHeight（已加载瓦片零网络），misses 批量补采
  const allPoints = rayPoints.flat();
  const heightMap = new Map<string, number>();
  const misses: LonLat[] = [];
  allPoints.forEach((p) => {
    const key = `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
    if (heightMap.has(key)) return;
    const h = viewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(p.lng, p.lat));
    if (h !== undefined) {
      heightMap.set(key, h);
    } else {
      misses.push(p);
    }
  });
  if (misses.length) {
    const sampled = await sampleTerrainHeights(viewer, misses);
    sampled.forEach((p) => {
      heightMap.set(`${p.lng.toFixed(6)},${p.lat.toFixed(6)}`, p.height);
    });
  }

  // 3) 逐射线求可视边界
  const boundary: TerrainSample[] = [{ ...center, height: baseH }];
  let blockedRayCount = 0;

  rayPoints.forEach((pts) => {
    if (!pts.length) {
      blockedRayCount++;
      return;
    }
    let lastVisible = pts[0];
    let lastVisibleH = heightMap.get(`${lastVisible.lng.toFixed(6)},${lastVisible.lat.toFixed(6)}`) ?? 0;
    let blocked = false;

    for (const p of pts) {
      const h = heightMap.get(`${p.lng.toFixed(6)},${p.lat.toFixed(6)}`) ?? 0;
      // 平地球近似：视线高程恒为观察点高程，地形高于视线即被挡
      if (h > eyeH) {
        blocked = true;
        break;
      }
      lastVisible = p;
      lastVisibleH = h;
    }

    if (blocked) {
      blockedRayCount++;
      // 边界取被挡前的最后一个可见点
      boundary.push({ lng: lastVisible.lng, lat: lastVisible.lat, height: lastVisibleH });
    } else {
      // 全程可见，边界取半径处端点
      const endP = pts[pts.length - 1];
      boundary.push({
        lng: endP.lng,
        lat: endP.lat,
        height: heightMap.get(`${endP.lng.toFixed(6)},${endP.lat.toFixed(6)}`) ?? 0,
      });
    }
  });

  // 4) 面积
  let area2D = 0;
  if (boundary.length >= 4) {
    const ring = [...boundary, boundary[0]].map((p) => [p.lng, p.lat]);
    try {
      area2D = turf.area(turf.polygon([ring]));
    } catch (error) {
      console.warn("可视域面积计算失败:", error);
    }
  }

  return { boundary, rayCount: rayAngles.length, blockedRayCount, area2D };
}

// ==================== 坡度坡向 ====================

/**
 * 基于规则网格计算坡度与坡向（Horn 中心差分，边界退化为一阶差分）
 */
export function computeSlopeAspect(input: PolygonGridResult | TerrainTriangleMesh): SlopeAspectCell[] {
  if (isTerrainTriangleMesh(input)) {
    return input.triangles.map((triangle) => ({
      id: triangle.id,
      row: triangle.row,
      col: triangle.col,
      center: {
        lng: triangle.center.lng,
        lat: triangle.center.lat,
        height: triangle.center.height,
      },
      slope: triangle.slope,
      aspect: triangle.aspect,
      level: triangle.level,
      area: triangle.surfaceArea,
    }));
  }

  const grid = input;
  const heightMap = buildGridHeightMap(grid);
  const cells: SlopeAspectCell[] = [];

  // 单元格东西/南北向实际边长（米）= 网格间距
  const dxMeters = grid.spacing;
  const dyMeters = grid.spacing;

  const getH = (r: number, c: number): number | undefined => {
    return heightMap.get(`${r},${c}`)?.height;
  };

  grid.points.forEach((p) => {
    if (!p.inside) return;
    const { row, col } = p;

    const hCenter = getH(row, col);
    if (hCenter === undefined) return;

    // 东西向差分
    const hEast = getH(row, col + 1);
    const hWest = getH(row, col - 1);
    let dzdx: number | undefined;
    if (hEast !== undefined && hWest !== undefined) {
      dzdx = (hEast - hWest) / (2 * dxMeters);
    } else if (hEast !== undefined) {
      dzdx = (hEast - hCenter) / dxMeters;
    } else if (hWest !== undefined) {
      dzdx = (hCenter - hWest) / dxMeters;
    }

    // 南北向差分（row-1 为北）
    const hNorth = getH(row - 1, col);
    const hSouth = getH(row + 1, col);
    let dzdy: number | undefined;
    if (hNorth !== undefined && hSouth !== undefined) {
      dzdy = (hNorth - hSouth) / (2 * dyMeters);
    } else if (hNorth !== undefined) {
      dzdy = (hNorth - hCenter) / dyMeters;
    } else if (hSouth !== undefined) {
      dzdy = (hCenter - hSouth) / dyMeters;
    }

    if (dzdx === undefined || dzdy === undefined) return;

    // 坡度（度）
    const slope = (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
    // 坡向：最陡下降方向，0=北，顺时针
    const aspect = ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360;
    // 分级
    let level = SLOPE_LEVELS.length - 1;
    for (let i = 0; i < SLOPE_LEVELS.length; i++) {
      if (slope >= SLOPE_LEVELS[i].min && slope < SLOPE_LEVELS[i].max) {
        level = i;
        break;
      }
    }

    cells.push({ row, col, center: { lng: p.lng, lat: p.lat }, slope, aspect, level });
  });

  return cells;
}

interface ScalarTerrainVertex extends TerrainSample {
  value: number;
}

function interpolateScalarVertex(
  a: ScalarTerrainVertex,
  b: ScalarTerrainVertex,
): ScalarTerrainVertex {
  const denominator = b.value - a.value;
  const t = Math.abs(denominator) < 1e-12
    ? 0
    : Math.min(1, Math.max(0, -a.value / denominator));
  return {
    lng: a.lng + (b.lng - a.lng) * t,
    lat: a.lat + (b.lat - a.lat) * t,
    height: a.height + (b.height - a.height) * t,
    value: 0,
  };
}

function clipScalarPolygon(
  vertices: ScalarTerrainVertex[],
  keep: (value: number) => boolean,
): ScalarTerrainVertex[] {
  if (!vertices.length) return [];

  const clipped: ScalarTerrainVertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    const currentInside = keep(current.value);
    const nextInside = keep(next.value);

    if (currentInside && nextInside) {
      clipped.push(next);
    } else if (currentInside && !nextInside) {
      clipped.push(interpolateScalarVertex(current, next));
    } else if (!currentInside && nextInside) {
      clipped.push(interpolateScalarVertex(current, next), next);
    }
  }

  const normalized: ScalarTerrainVertex[] = [];
  clipped.forEach((vertex) => {
    const previous = normalized[normalized.length - 1];
    if (
      previous &&
      Math.abs(previous.lng - vertex.lng) < 1e-12 &&
      Math.abs(previous.lat - vertex.lat) < 1e-12 &&
      Math.abs(previous.height - vertex.height) < 1e-8
    ) {
      return;
    }
    normalized.push(vertex);
  });
  return normalized;
}

function scalarPolygonToTriangles(
  polygon: ScalarTerrainVertex[],
): Array<[ScalarTerrainVertex, ScalarTerrainVertex, ScalarTerrainVertex]> {
  if (polygon.length < 3) return [];
  const triangles: Array<[ScalarTerrainVertex, ScalarTerrainVertex, ScalarTerrainVertex]> = [];
  for (let i = 1; i < polygon.length - 1; i++) {
    triangles.push([polygon[0], polygon[i], polygon[i + 1]]);
  }
  return triangles;
}

function scalarTriangleToTerrainTriangle(
  triangle: [ScalarTerrainVertex, ScalarTerrainVertex, ScalarTerrainVertex],
): [TerrainSample, TerrainSample, TerrainSample] {
  return triangle.map((vertex) => ({
    lng: vertex.lng,
    lat: vertex.lat,
    height: vertex.height,
  })) as [TerrainSample, TerrainSample, TerrainSample];
}

// ==================== 填挖方 ====================

/**
 * 填挖方计算：每格相对基准高程的高差 × 单元格面积
 * @param baseHeight 基准高程（缺省取所有网格平均高程）
 */
export function computeCutFill(
  input: PolygonGridResult | TerrainTriangleMesh,
  baseHeight?: number,
): CutFillResult {
  if (isTerrainTriangleMesh(input)) {
    const mesh = input;
    const weightedHeight = mesh.triangles.reduce((sum, triangle) => {
      const avgHeight = averageTerrainSample(triangle.vertices).height;
      return sum + avgHeight * triangle.horizontalArea;
    }, 0);
    const weightedArea = mesh.triangles.reduce((sum, triangle) => sum + triangle.horizontalArea, 0);
    const base = baseHeight ?? (weightedArea > 0 ? weightedHeight / weightedArea : 0);

    let cutVolume = 0;
    let fillVolume = 0;
    const cells: CutFillCell[] = [];

    mesh.triangles.forEach((triangle) => {
      const scalarVertices: ScalarTerrainVertex[] = triangle.vertices.map((vertex) => ({
        ...vertex,
        value: vertex.height - base,
      }));
      const cutPolygons = scalarPolygonToTriangles(
        clipScalarPolygon(scalarVertices, (value) => value >= -1e-8),
      );
      const fillPolygons = scalarPolygonToTriangles(
        clipScalarPolygon(scalarVertices, (value) => value <= 1e-8),
      );

      cutPolygons.forEach((scalarTriangle, index) => {
        const avgDh = scalarTriangle.reduce((sum, vertex) => sum + vertex.value, 0) / 3;
        if (avgDh <= 1e-8) return;
        const vertices = scalarTriangleToTerrainTriangle(scalarTriangle);
        const horizontalArea = computeTerrainTriangleHorizontalArea(vertices);
        const surfaceArea = computeTerrainTriangleSurfaceArea(vertices);
        const volume = horizontalArea * avgDh;
        const center = averageTerrainSample(vertices);
        cutVolume += volume;
        cells.push({
          id: `${triangle.id},cut,${index}`,
          row: triangle.row,
          col: triangle.col,
          triangleIndex: triangle.triangleIndex,
          center,
          h: center.height,
          dh: avgDh,
          area: surfaceArea,
          cutVolume: volume,
          fillVolume: 0,
          vertices,
        });
      });

      fillPolygons.forEach((scalarTriangle, index) => {
        const avgDh = scalarTriangle.reduce((sum, vertex) => sum + vertex.value, 0) / 3;
        if (avgDh >= -1e-8) return;
        const vertices = scalarTriangleToTerrainTriangle(scalarTriangle);
        const horizontalArea = computeTerrainTriangleHorizontalArea(vertices);
        const surfaceArea = computeTerrainTriangleSurfaceArea(vertices);
        const volume = horizontalArea * -avgDh;
        const center = averageTerrainSample(vertices);
        fillVolume += volume;
        cells.push({
          id: `${triangle.id},fill,${index}`,
          row: triangle.row,
          col: triangle.col,
          triangleIndex: triangle.triangleIndex,
          center,
          h: center.height,
          dh: avgDh,
          area: surfaceArea,
          cutVolume: 0,
          fillVolume: volume,
          vertices,
        });
      });
    });

    const histogram: Array<{ range: string; volume: number }> = [];
    const dhs = cells.map((cell) => cell.dh);
    if (dhs.length) {
      const minDh = Math.min(...dhs);
      const maxDh = Math.max(...dhs);
      const binWidth = maxDh > minDh ? (maxDh - minDh) / 10 : 1;
      for (let i = 0; i < 10; i++) {
        const lo = minDh + i * binWidth;
        const hi = minDh + (i + 1) * binWidth;
        let volume = 0;
        cells.forEach((cell) => {
          if ((i === 9 ? cell.dh <= hi : cell.dh < hi) && cell.dh >= lo) {
            volume += (cell.cutVolume ?? 0) + (cell.fillVolume ?? 0);
          }
        });
        histogram.push({ range: `${lo.toFixed(1)} ~ ${hi.toFixed(1)}m`, volume });
      }
    }

    return {
      baseHeight: base,
      horizontalArea: mesh.horizontalArea,
      surfaceArea: mesh.surfaceArea,
      cutVolume,
      fillVolume,
      netVolume: cutVolume - fillVolume,
      cells,
      histogram,
    };
  }

  const grid = input;
  const insidePoints = grid.points.filter((p) => p.inside);
  const heights = insidePoints.map((p) => p.height);

  const base = baseHeight ?? (heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : 0);

  let cutVolume = 0;
  let fillVolume = 0;
  const cells: CutFillCell[] = [];

  insidePoints.forEach((p) => {
    const dh = p.height - base;
    const cell: CutFillCell = {
      row: p.row,
      col: p.col,
      center: { lng: p.lng, lat: p.lat },
      h: p.height,
      dh,
    };
    cells.push(cell);
    if (dh > 0) cutVolume += dh * grid.cellArea;
    else fillVolume += -dh * grid.cellArea;
  });

  // 10 档高差-体积直方图
  const histogram: Array<{ range: string; volume: number }> = [];
  const dhs = cells.map((c) => c.dh);
  if (dhs.length) {
    const minDh = Math.min(...dhs);
    const maxDh = Math.max(...dhs);
    const binWidth = maxDh > minDh ? (maxDh - minDh) / 10 : 1;
    for (let i = 0; i < 10; i++) {
      const lo = minDh + i * binWidth;
      const hi = minDh + (i + 1) * binWidth;
      let volume = 0;
      cells.forEach((c) => {
        if ((i === 9 ? c.dh <= hi : c.dh < hi) && c.dh >= lo) {
          volume += Math.abs(c.dh) * grid.cellArea;
        }
      });
      histogram.push({ range: `${lo.toFixed(1)} ~ ${hi.toFixed(1)}m`, volume });
    }
  }

  return {
    baseHeight: base,
    cutVolume,
    fillVolume,
    netVolume: cutVolume - fillVolume,
    cells,
    histogram,
  };
}

// ==================== 淹没分析 ====================

/**
 * 淹没计算：地形高程低于水位的网格计入淹没
 */
export function computeFlood(
  input: PolygonGridResult | TerrainTriangleMesh,
  waterLevel: number,
): FloodResult {
  if (isTerrainTriangleMesh(input)) {
    const mesh = input;
    let area = 0;
    let horizontalArea = 0;
    let volume = 0;
    let maxDepth = 0;
    const cells: FloodCell[] = [];

    mesh.triangles.forEach((triangle) => {
      const scalarVertices: ScalarTerrainVertex[] = triangle.vertices.map((vertex) => ({
        ...vertex,
        value: waterLevel - vertex.height,
      }));
      const floodedTriangles = scalarPolygonToTriangles(
        clipScalarPolygon(scalarVertices, (value) => value > 1e-8),
      );

      floodedTriangles.forEach((scalarTriangle, index) => {
        const avgDepth = scalarTriangle.reduce((sum, vertex) => sum + vertex.value, 0) / 3;
        if (avgDepth <= 1e-8) return;
        const vertices = scalarTriangleToTerrainTriangle(scalarTriangle);
        const triangleHorizontalArea = computeTerrainTriangleHorizontalArea(vertices);
        const triangleSurfaceArea = computeTerrainTriangleSurfaceArea(vertices);
        const cellVolume = triangleHorizontalArea * avgDepth;
        const center = averageTerrainSample(vertices);

        scalarTriangle.forEach((vertex) => {
          maxDepth = Math.max(maxDepth, vertex.value);
        });
        area += triangleSurfaceArea;
        horizontalArea += triangleHorizontalArea;
        volume += cellVolume;
        cells.push({
          id: `${triangle.id},flood,${index}`,
          row: triangle.row,
          col: triangle.col,
          triangleIndex: triangle.triangleIndex,
          center,
          terrainHeight: center.height,
          depth: avgDepth,
          area: triangleSurfaceArea,
          horizontalArea: triangleHorizontalArea,
          volume: cellVolume,
          vertices,
        });
      });
    });

    return {
      waterLevel,
      area,
      horizontalArea,
      totalArea: mesh.surfaceArea,
      volume,
      maxDepth,
      averageDepth: horizontalArea > 0 ? volume / horizontalArea : 0,
      floodedCount: cells.length,
      totalCount: mesh.triangles.length,
      coverageRatio: mesh.horizontalArea > 0 ? horizontalArea / mesh.horizontalArea : 0,
      cells,
    };
  }

  const grid = input;
  const insidePoints = grid.points.filter((p) => p.inside);
  let area = 0;
  let volume = 0;
  let maxDepth = 0;
  let floodedCount = 0;
  const cells: FloodCell[] = [];

  insidePoints.forEach((p) => {
    const depth = waterLevel - p.height;
    if (depth > 0) {
      const cellArea = grid.cellArea;
      const cellVolume = depth * cellArea;
      floodedCount++;
      area += cellArea;
      volume += cellVolume;
      if (depth > maxDepth) maxDepth = depth;
      cells.push({
        row: p.row,
        col: p.col,
        center: { lng: p.lng, lat: p.lat },
        terrainHeight: p.height,
        depth,
        area: cellArea,
        volume: cellVolume,
      });
    }
  });

  return {
    waterLevel,
    area,
    volume,
    maxDepth,
    averageDepth: area > 0 ? volume / area : 0,
    floodedCount,
    totalCount: insidePoints.length,
    coverageRatio: insidePoints.length ? floodedCount / insidePoints.length : 0,
    cells,
  };
}

/**
 * 提取水位等值线（marching squares）：返回一个或多个闭合环（经纬度）
 */
export function extractContourRings(
  grid: PolygonGridResult,
  waterLevel: number,
): LonLat[][] {
  const heightMap = buildGridHeightMap(grid);
  const getP = (r: number, c: number): GridSample | undefined => heightMap.get(`${r},${c}`);

  // 1) 逐单元格收集跨越水位线的等值线段
  const segments: Array<[LonLat, LonLat]> = [];

  // 边两端跨越水位线时，线性插值出等值点
  const interpolate = (a: GridSample, b: GridSample): LonLat | null => {
    const h1 = a.height;
    const h2 = b.height;
    if ((h1 < waterLevel) === (h2 < waterLevel)) return null; // 未跨越
    if (h2 === h1) return null;
    const t = (waterLevel - h1) / (h2 - h1);
    return { lng: a.lng + t * (b.lng - a.lng), lat: a.lat + t * (b.lat - a.lat) };
  };

  grid.points.forEach((p) => {
    if (!p.inside) return;
    const { row, col } = p;
    const c00 = getP(row, col);
    const c01 = getP(row, col + 1); // 东
    const c11 = getP(row + 1, col + 1); // 东南
    const c10 = getP(row + 1, col); // 南
    if (!c00 || !c01 || !c11 || !c10) return;

    // 四条边（上、右、下、左）上的等值点，保持边序
    const pts: LonLat[] = [];
    const edgePairs: Array<[GridSample, GridSample]> = [
      [c00, c01],
      [c01, c11],
      [c10, c11],
      [c00, c10],
    ];
    edgePairs.forEach(([a, b]) => {
      const pt = interpolate(a, b);
      if (pt) pts.push(pt);
    });

    // 2 个跨越点 → 1 条线段；4 个（鞍点歧义）→ 按边序两两配对
    if (pts.length === 2) {
      segments.push([pts[0], pts[1]]);
    } else if (pts.length === 4) {
      segments.push([pts[0], pts[1]]);
      segments.push([pts[2], pts[3]]);
    }
  });

  if (!segments.length) return [];

  // 2) 缝合边段为闭合环（邻接表）
  const adj = new Map<string, number[]>(); // 端点key -> 边段下标列表
  const keyOf = (p: LonLat) => `${p.lng.toFixed(7)},${p.lat.toFixed(7)}`;
  segments.forEach((seg, i) => {
    [keyOf(seg[0]), keyOf(seg[1])].forEach((k) => {
      const list = adj.get(k) ?? [];
      list.push(i);
      adj.set(k, list);
    });
  });

  const visited = new Array(segments.length).fill(false);
  const rings: LonLat[][] = [];

  for (let i = 0; i < segments.length; i++) {
    if (visited[i]) continue;
    visited[i] = true;

    const ring: LonLat[] = [segments[i][0], segments[i][1]];
    let currentKey = keyOf(segments[i][1]);
    let closed = false;

    // 沿邻接边段首尾相接
    for (let step = 0; step < segments.length; step++) {
      const candidates = (adj.get(currentKey) ?? []).filter((idx) => !visited[idx]);
      if (!candidates.length) break;
      const nextIdx = candidates[0];
      visited[nextIdx] = true;
      const seg = segments[nextIdx];
      // 找与 currentKey 匹配的端点，另一端为延伸点
      const aKey = keyOf(seg[0]);
      const bKey = keyOf(seg[1]);
      const extendPoint = aKey === currentKey ? seg[1] : seg[0];
      const newKey = aKey === currentKey ? bKey : aKey;
      ring.push(extendPoint);
      if (newKey === keyOf(ring[0])) {
        closed = true;
        break;
      }
      currentKey = newKey;
    }

    // 未自然闭合时手动闭合（近似），保证多边形可用
    if (!closed && ring.length > 2) {
      ring.push({ ...ring[0] });
    }
    rings.push(ring);
  }

  return rings;
}

// ==================== 网格着色 Primitive ====================

export function buildTerrainTrianglePrimitive<T extends {
  vertices?: [TerrainSample, TerrainSample, TerrainSample];
}>(
  triangles: T[],
  colorOf: (triangle: T) => Cesium.Color,
  heightOffset = 1.5,
): Cesium.Primitive | null {
  const instances: Cesium.GeometryInstance[] = [];

  triangles.forEach((triangle) => {
    if (!triangle.vertices) return;
    const color = colorOf(triangle);
    if (color.alpha <= 0) return;

    const positions = triangle.vertices.map((vertex) =>
      Cesium.Cartesian3.fromDegrees(vertex.lng, vertex.lat, vertex.height + heightOffset),
    );

    instances.push(
      new Cesium.GeometryInstance({
        geometry: new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(positions),
          perPositionHeight: true,
          vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        },
      }),
    );
  });

  if (!instances.length) return null;

  return new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: true,
    }),
    asynchronous: false,
  });
}

export function buildTerrainTriangleGroundPrimitive<T extends {
  vertices?: [TerrainSample, TerrainSample, TerrainSample];
}>(
  triangles: T[],
  colorOf: (triangle: T) => Cesium.Color,
): Cesium.GroundPrimitive | null {
  const instances: Cesium.GeometryInstance[] = [];

  triangles.forEach((triangle, index) => {
    if (!triangle.vertices) return;
    const color = colorOf(triangle);
    if (color.alpha <= 0) return;

    const positions = triangle.vertices.map((vertex) =>
      Cesium.Cartesian3.fromDegrees(vertex.lng, vertex.lat),
    );

    instances.push(
      new Cesium.GeometryInstance({
        id: `terrain-triangle-${index}`,
        geometry: new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(positions),
          vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        },
      }),
    );
  });

  if (!instances.length) return null;

  return new Cesium.GroundPrimitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: true,
    }),
    classificationType: Cesium.ClassificationType.TERRAIN,
    asynchronous: true,
  });
}

/**
 * 构建逐格着色 Primitive（填挖方/坡度分级用，避免数千 entity 卡顿）
 * @param grid 已采样网格
 * @param colorOf 每个单元格的颜色函数（入参为单元格左上角点 row/col）
 * @param heightOffset 抬高高度（米），避免与地形 z-fighting
 */
export function buildGridPrimitive(
  grid: PolygonGridResult,
  colorOf: (row: number, col: number) => Cesium.Color,
  heightOffset = 1.5,
): Cesium.Primitive | null {
  const heightMap = buildGridHeightMap(grid);
  const instances: Cesium.GeometryInstance[] = [];

  grid.points.forEach((p) => {
    if (!p.inside) return;
    const { row, col } = p;
    // 单元格四个角点均需在区域内
    const c00 = heightMap.get(`${row},${col}`);
    const c01 = heightMap.get(`${row},${col + 1}`);
    const c11 = heightMap.get(`${row + 1},${col + 1}`);
    const c10 = heightMap.get(`${row + 1},${col}`);
    if (!c00 || !c01 || !c11 || !c10) return;

    const corners = [c00, c01, c11, c10].map((cp) =>
      Cesium.Cartesian3.fromDegrees(cp.lng, cp.lat, cp.height + heightOffset),
    );

    instances.push(
      new Cesium.GeometryInstance({
        geometry: new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(corners),
          perPositionHeight: true,
          vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(colorOf(row, col)),
        },
      }),
    );
  });

  if (!instances.length) return null;

  return new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: true,
    }),
    asynchronous: false,
  });
}
