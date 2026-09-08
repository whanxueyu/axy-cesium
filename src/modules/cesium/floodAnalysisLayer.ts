import * as Cesium from "cesium";
import {
  buildGridPrimitive,
  type FloodResult,
  type LonLat,
  type PolygonGridResult,
} from "@/modules/cesium/analysisUtils";

interface FloodAnalysisLayerOptions {
  getWaterLevel: () => number;
}

const WATER_COLOR = Cesium.Color.fromCssColorString("#00c8ff").withAlpha(0.48);
const WATER_VOLUME_COLOR = Cesium.Color.fromCssColorString("#0ea5e9").withAlpha(0.48);
const BOUNDARY_COLOR = Cesium.Color.fromCssColorString("#ffd700");
const SHALLOW_FLOOD_COLOR = Cesium.Color.fromCssColorString("#67e8f9");
const DEEP_FLOOD_COLOR = Cesium.Color.fromCssColorString("#1d4ed8");

export class FloodAnalysisLayer {
  private viewer: Cesium.Viewer;
  private getWaterLevel: () => number;
  private previewLineEntity: Cesium.Entity | null = null;
  private boundaryEntity: Cesium.Entity | null = null;
  private waterSurfaceEntity: Cesium.Entity | null = null;
  private waterVolumeEntity: Cesium.Entity | null = null;
  private labelEntity: Cesium.Entity | null = null;
  private pointEntities: Cesium.Entity[] = [];
  private depthPrimitive: Cesium.Primitive | null = null;

  constructor(viewer: Cesium.Viewer, options: FloodAnalysisLayerOptions) {
    this.viewer = viewer;
    this.getWaterLevel = options.getWaterLevel;
  }

  clear() {
    this.clearDraft();
    this.clearAnalysis();
  }

  clearDraft() {
    this.removeEntity("previewLineEntity");
    this.removeEntity("labelEntity");
    this.pointEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.pointEntities = [];
    this.requestRender();
  }

  clearAnalysis() {
    this.removeEntity("boundaryEntity");
    this.removeEntity("waterSurfaceEntity");
    this.removeEntity("waterVolumeEntity");
    this.removeDepthPrimitive();
    this.requestRender();
  }

  destroy() {
    this.clear();
  }

  drawDraft(positions: Cesium.Cartesian3[], closed = false, showVertexLabel = true) {
    this.drawPointMarkers(positions);
    this.drawPreviewLine(positions, closed);
    if (showVertexLabel) {
      this.drawVertexLabel(positions);
    } else {
      this.clearVertexLabel();
    }
  }

  clearVertexLabel() {
    this.removeEntity("labelEntity");
  }

  renderAnalysisArea(
    polygonLngLats: LonLat[],
    boundaryPositions: Cesium.Cartesian3[],
    grid: PolygonGridResult,
  ) {
    this.drawBoundary(boundaryPositions);
    this.drawWaterBody(polygonLngLats, grid.minHeight - Math.max(grid.spacing * 0.2, 2));
    this.drawDraft(boundaryPositions, true, false);
    this.requestRender();
  }

  renderFloodDepth(grid: PolygonGridResult | null, result: FloodResult | null) {
    this.removeDepthPrimitive();
    if (!grid || !result || result.floodedCount === 0 || result.maxDepth <= 0) {
      this.requestRender();
      return;
    }

    const depthByCell = new Map<string, number>();
    result.cells.forEach((cell) => {
      depthByCell.set(`${cell.row},${cell.col}`, cell.depth);
    });

    const primitive = buildGridPrimitive(
      grid,
      (row, col) => {
        const depth = depthByCell.get(`${row},${col}`);
        if (!depth) return new Cesium.Color(0, 0, 0, 0);

        const t = Math.min(depth / result.maxDepth, 1);
        const color = Cesium.Color.lerp(
          SHALLOW_FLOOD_COLOR,
          DEEP_FLOOD_COLOR,
          t,
          new Cesium.Color(),
        );
        color.alpha = 0.28 + 0.52 * t;
        return color;
      },
      2,
    );

    if (primitive) {
      this.depthPrimitive = this.viewer.scene.primitives.add(primitive);
    }
    this.requestRender();
  }

  private drawPointMarkers(positions: Cesium.Cartesian3[]) {
    this.pointEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.pointEntities = positions.map((position, index) =>
      this.viewer.entities.add({
        position,
        point: {
          pixelSize: 8,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.MAX_VALUE,
        },
        label: {
          text: `${index + 1}`,
          font: "bold 14pt monospace",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, 10),
          disableDepthTestDistance: Number.MAX_VALUE,
        },
      }),
    );
  }

  private drawPreviewLine(positions: Cesium.Cartesian3[], closed: boolean) {
    this.removeEntity("previewLineEntity");
    if (positions.length < 2) return;

    const linePositions = closed && positions.length > 2
      ? [...positions, positions[0]]
      : [...positions];
    this.previewLineEntity = this.viewer.entities.add({
      polyline: {
        positions: linePositions,
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          color: BOUNDARY_COLOR,
          glowPower: 0.3,
        }),
        clampToGround: false,
      },
    });
  }

  private drawVertexLabel(positions: Cesium.Cartesian3[]) {
    this.removeEntity("labelEntity");
    const lastPosition = positions[positions.length - 1];
    if (!lastPosition) return;

    this.labelEntity = this.viewer.entities.add({
      position: lastPosition,
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
  }

  private drawBoundary(positions: Cesium.Cartesian3[]) {
    this.removeEntity("boundaryEntity");
    if (positions.length < 3) return;

    this.boundaryEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        perPositionHeight: true,
        material: BOUNDARY_COLOR.withAlpha(0.12),
        outline: true,
        outlineColor: BOUNDARY_COLOR,
      },
    });
  }

  private drawWaterBody(polygonLngLats: LonLat[], bottomHeight: number) {
    this.removeEntity("waterSurfaceEntity");
    this.removeEntity("waterVolumeEntity");
    if (polygonLngLats.length < 3) return;

    const hierarchy = new Cesium.PolygonHierarchy(
      polygonLngLats.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat)),
    );
    const dynamicWaterLevel = new Cesium.CallbackProperty(() => this.getWaterLevel(), false);

    this.waterVolumeEntity = this.viewer.entities.add({
      polygon: {
        hierarchy,
        height: dynamicWaterLevel,
        extrudedHeight: bottomHeight,
        perPositionHeight: false,
        closeTop: false,
        closeBottom: false,
        material: WATER_VOLUME_COLOR,
      },
    });

    this.waterSurfaceEntity = this.viewer.entities.add({
      polygon: {
        hierarchy,
        height: dynamicWaterLevel,
        perPositionHeight: false,
        material: WATER_COLOR,
      },
    });
  }

  private removeDepthPrimitive() {
    if (this.depthPrimitive) {
      this.viewer.scene.primitives.remove(this.depthPrimitive);
      this.depthPrimitive = null;
    }
  }

  private removeEntity(
    key:
      | "previewLineEntity"
      | "boundaryEntity"
      | "waterSurfaceEntity"
      | "waterVolumeEntity"
      | "labelEntity",
  ) {
    const entity = this[key];
    if (entity) {
      this.viewer.entities.remove(entity);
      this[key] = null;
    }
  }

  private requestRender() {
    this.viewer.scene.requestRender();
  }
}
