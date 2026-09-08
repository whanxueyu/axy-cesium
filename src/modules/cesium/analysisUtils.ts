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
}

export interface ViewshedResult {
  boundary: TerrainSample[]; // 可视域边界点（含高程），首点为观察点，闭合
  rayCount: number; // 总射线数
  blockedRayCount: number; // 被挡射线数
  area2D: number; // 可视域 2D 面积（米²）
}

export interface SlopeAspectCell {
  row: number;
  col: number;
  center: LonLat;
  slope: number; // 坡度（度）
  aspect: number; // 坡向（度，0=北，顺时针）
  level: number; // 坡度分级下标
}

export interface CutFillCell {
  row: number;
  col: number;
  center: LonLat;
  h: number; // 地形高程
  dh: number; // 相对基准高程的高差（正=挖）
}

export interface CutFillResult {
  baseHeight: number;
  cutVolume: number; // 挖方量 m³
  fillVolume: number; // 填方量 m³
  netVolume: number; // 净方量（挖-填）m³
  cells: CutFillCell[];
  histogram: Array<{ range: string; volume: number }>; // 10 档高差-体积分布
}

export interface FloodResult {
  waterLevel: number;
  area: number; // 淹没面积 m²
  volume: number; // 淹没体积 m³
  maxDepth: number; // 最大水深 m
  averageDepth: number; // 平均水深 m
  floodedCount: number; // 淹没网格数
  totalCount: number; // 区域内有效网格数
  coverageRatio: number; // 淹没网格占比，0~1
  cells: FloodCell[]; // 被淹没的网格明细
}

export interface FloodCell {
  row: number;
  col: number;
  center: LonLat;
  terrainHeight: number;
  depth: number;
  area: number;
  volume: number;
}

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
        results.push({ ...chunk[idx], height: carto.height ?? 0 });
      });
    } catch (error) {
      console.warn("地形采样失败，该分片默认高度 0:", error);
      chunk.forEach((p) => results.push({ ...p, height: 0 }));
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
 * 平面面积：投影到首点切平面后用 Cesium.PolygonPipeline 计算（单位 m²）
 */
export function computePlanarArea(polygonLngLats: LonLat[]): number {
  if (polygonLngLats.length < 3) return 0;
  const positions = polygonLngLats.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, 0));
  try {
    return Math.abs(Cesium.PolygonPipeline.computeArea2D(positions));
  } catch (error) {
    console.warn("平面面积计算失败:", error);
    return 0;
  }
}

/**
 * 3D 贴地面积（近似）：边界按 edgeSpacing 加密 → 采样高程 →
 * 借用 Cesium.PolygonGeometry 的三角化（内部 earcut，支持凹多边形）求三角形面积和
 * @param viewer
 * @param polygonLngLats 多边形顶点（无需闭合）
 * @param edgeSpacing 边界加密间距（米）
 */
export async function computeSurfaceArea3D(
  viewer: Cesium.Viewer,
  polygonLngLats: LonLat[],
  edgeSpacing = 30,
): Promise<{ area: number; ring: TerrainSample[] }> {
  if (polygonLngLats.length < 3) return { area: 0, ring: [] };

  // 1) 边界加密
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

  // 2) 采样高程
  const sampled = await sampleTerrainHeights(viewer, densified);

  // 3) 三角化并求和
  try {
    const geom = Cesium.PolygonGeometry.createGeometry(
      new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(
          sampled.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.height)),
        ),
        perPositionHeight: true,
        vertexFormat: Cesium.VertexFormat.POSITION_ONLY,
      }),
    );
    if (!geom) return { area: 0, ring: sampled };

    const positions = geom.attributes.position.values as Float64Array;
    const indices = geom.indices;
    let area = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const a = new Cesium.Cartesian3(
        positions[indices[i] * 3],
        positions[indices[i] * 3 + 1],
        positions[indices[i] * 3 + 2],
      );
      const b = new Cesium.Cartesian3(
        positions[indices[i + 1] * 3],
        positions[indices[i + 1] * 3 + 1],
        positions[indices[i + 1] * 3 + 2],
      );
      const c = new Cesium.Cartesian3(
        positions[indices[i + 2] * 3],
        positions[indices[i + 2] * 3 + 1],
        positions[indices[i + 2] * 3 + 2],
      );
      area += 0.5 * Cesium.Cartesian3.magnitude(
        Cesium.Cartesian3.cross(
          Cesium.Cartesian3.subtract(b, a, new Cesium.Cartesian3()),
          Cesium.Cartesian3.subtract(c, a, new Cesium.Cartesian3()),
          new Cesium.Cartesian3(),
        ),
      );
    }
    return { area, ring: sampled };
  } catch (error) {
    // 几何非法（自交等）时回退绕首点扇形三角化（近似）
    console.warn("三角化失败，回退扇形近似:", error);
    const first = sampled[0];
    const anchor = Cesium.Cartesian3.fromDegrees(first.lng, first.lat, first.height);
    let area = 0;
    for (let i = 1; i < sampled.length - 1; i++) {
      const b = Cesium.Cartesian3.fromDegrees(sampled[i].lng, sampled[i].lat, sampled[i].height);
      const c = Cesium.Cartesian3.fromDegrees(
        sampled[i + 1].lng,
        sampled[i + 1].lat,
        sampled[i + 1].height,
      );
      area += 0.5 * Cesium.Cartesian3.magnitude(
        Cesium.Cartesian3.cross(
          Cesium.Cartesian3.subtract(b, anchor, new Cesium.Cartesian3()),
          Cesium.Cartesian3.subtract(c, anchor, new Cesium.Cartesian3()),
          new Cesium.Cartesian3(),
        ),
      );
    }
    return { area, ring: sampled };
  }
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

  // 创建从 A 到 B 的射线
  const direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(to, from, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );
  const ray = new Cesium.Ray(from, direction);

  // 检测与地形的交点
  const intersection = viewer.scene.globe.pick(ray, viewer.scene);
  if (intersection) {
    const intersectionDistance = Cesium.Cartesian3.distance(from, intersection);
    // 交点距离小于 AB 距离，说明被地形遮挡
    if (intersectionDistance < distance) {
      return { visible: false, obstruction: intersection };
    }
  }

  // 检测与 3D Tiles 等模型的交点
  const pickedObject = viewer.scene.pickFromRay(ray);
  if (Cesium.defined(pickedObject) && pickedObject.id) {
    const modelIntersection = viewer.scene.pickPositionFromRay(ray);
    if (Cesium.defined(modelIntersection)) {
      const intersectionDistance = Cesium.Cartesian3.distance(from, modelIntersection);
      if (intersectionDistance < distance) {
        return { visible: false, obstruction: modelIntersection };
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
export function computeSlopeAspect(grid: PolygonGridResult): SlopeAspectCell[] {
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

// ==================== 填挖方 ====================

/**
 * 填挖方计算：每格相对基准高程的高差 × 单元格面积
 * @param baseHeight 基准高程（缺省取所有网格平均高程）
 */
export function computeCutFill(grid: PolygonGridResult, baseHeight?: number): CutFillResult {
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
export function computeFlood(grid: PolygonGridResult, waterLevel: number): FloodResult {
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
