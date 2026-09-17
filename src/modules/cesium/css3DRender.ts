import * as Cesium from "cesium";

export interface CSS3DWorldPlaneOptions {
  position: Cesium.Cartesian3;
  width?: number;
  height?: number;
  pixelWidth?: number;
  pixelHeight?: number;
  heading?: number;
  anchor?: "center" | "bottom";
  html?: string;
  className?: string;
  pointerEvents?: "auto" | "none";
  backfaceCulling?: boolean;
  show?: boolean;
  zIndex?: number;
}

type ProjectedPoint = {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
};

type Homography = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * A DOM plane whose four corners are driven by four Cesium world positions.
 *
 * The DOM element is transformed with a CSS 3D matrix. The matrix is solved
 * from the projected world corners, so the plane keeps real perspective when
 * the camera moves around it.
 */
export class CSS3DWorldPlane {
  private readonly viewer: Cesium.Viewer;
  private readonly container: HTMLElement;
  private readonly element: HTMLDivElement;
  private readonly position: Cesium.Cartesian3;
  private readonly width: number;
  private readonly height: number;
  private readonly pixelWidth: number;
  private readonly pixelHeight: number;
  private readonly anchor: "center" | "bottom";
  private readonly heading: number;
  private backfaceCulling: boolean;
  private readonly pointerEvents: "auto" | "none";
  private readonly customZIndex?: number;
  private visible: boolean;
  private destroyed = false;
  private readonly occluder: Cesium.EllipsoidalOccluder;
  private readonly pickPosition = new Cesium.Cartesian3();
  private readonly postRenderHandler = () => this.update();
  private readonly resizeHandler = () => this.update();

  constructor(viewer: Cesium.Viewer, options: CSS3DWorldPlaneOptions) {
    this.viewer = viewer;
    this.container = viewer.container;
    this.position = Cesium.Cartesian3.clone(options.position);
    this.width = options.width ?? 2400;
    this.height = options.height ?? 1200;
    this.pixelWidth = options.pixelWidth ?? 420;
    this.pixelHeight = options.pixelHeight ?? 210;
    this.anchor = options.anchor ?? "center";
    this.heading = options.heading ?? 0;
    this.backfaceCulling = options.backfaceCulling ?? false;
    this.pointerEvents = options.pointerEvents ?? "none";
    this.customZIndex = options.zIndex;
    this.visible = options.show ?? true;
    this.occluder = new Cesium.EllipsoidalOccluder(
      viewer.scene.globe.ellipsoid,
      viewer.camera.positionWC,
    );

    if (getComputedStyle(this.container).position === "static") {
      this.container.style.position = "relative";
    }

    this.element = document.createElement("div");
    this.element.className = [
      "cesium-css3d-world-plane",
      options.className ?? "",
    ]
      .filter(Boolean)
      .join(" ");
    this.element.dataset.css3dWorldPlane = "true";
    this.element.style.position = "absolute";
    this.element.style.left = "0";
    this.element.style.top = "0";
    this.element.style.width = `${this.pixelWidth}px`;
    this.element.style.height = `${this.pixelHeight}px`;
    this.element.style.transformOrigin = "0 0 0";
    this.element.style.transformStyle = "preserve-3d";
    this.element.style.pointerEvents = this.pointerEvents;
    this.element.style.display = "none";
    this.element.style.willChange = "transform";
    this.element.innerHTML = options.html ?? "";
    this.container.appendChild(this.element);

    viewer.scene.postRender.addEventListener(this.postRenderHandler);
    window.addEventListener("resize", this.resizeHandler);
    this.update();
  }

  private update(): void {
    if (this.destroyed || !this.visible) {
      this.element.style.display = "none";
      return;
    }

    const corners = this.getWorldCorners();
    const projectedCorners = corners.map((corner) => this.project(corner));
    const projectedCenter = this.project(this.position);

    if (
      projectedCorners.some((corner) => corner === undefined) ||
      projectedCenter === undefined
    ) {
      this.element.style.display = "none";
      return;
    }

    const camera = this.viewer.camera;
    this.occluder.cameraPosition = camera.positionWC;

    if (
      this.viewer.scene.mode === Cesium.SceneMode.SCENE3D &&
      !this.occluder.isPointVisible(this.position)
    ) {
      this.element.style.display = "none";
      return;
    }

    const axes = this.getAxes();
    if (this.backfaceCulling && !this.isFrontFacing(axes.widthAxis, axes.up)) {
      this.element.style.display = "none";
      return;
    }

    if (this.isDepthOccluded(projectedCenter)) {
      this.element.style.display = "none";
      return;
    }

    const points = projectedCorners as ProjectedPoint[];
    const homography = CSS3DWorldPlane.solveHomography(
      [
        [0, 0],
        [this.pixelWidth, 0],
        [this.pixelWidth, this.pixelHeight],
        [0, this.pixelHeight],
      ],
      points.map((point) => [point.x, point.y]),
    );

    if (!homography) {
      this.element.style.display = "none";
      return;
    }

    this.element.style.transform = CSS3DWorldPlane.toCSSMatrix3d(homography);
    this.element.style.zIndex =
      this.customZIndex === undefined
        ? String(this.getDepthZIndex())
        : String(this.customZIndex);
    this.element.style.display = "block";
  }

  private getWorldCorners(): Cesium.Cartesian3[] {
    const axes = this.getAxes();
    const halfWidth = this.width / 2;
    const topOffset = this.anchor === "bottom" ? this.height : this.height / 2;
    const bottomOffset = this.anchor === "bottom" ? 0 : -this.height / 2;

    const topLeft = Cesium.Cartesian3.clone(this.position);
    const topRight = Cesium.Cartesian3.clone(this.position);
    const bottomRight = Cesium.Cartesian3.clone(this.position);
    const bottomLeft = Cesium.Cartesian3.clone(this.position);

    this.addScaled(topLeft, axes.widthAxis, -halfWidth);
    this.addScaled(topLeft, axes.up, topOffset);

    this.addScaled(topRight, axes.widthAxis, halfWidth);
    this.addScaled(topRight, axes.up, topOffset);

    this.addScaled(bottomRight, axes.widthAxis, halfWidth);
    this.addScaled(bottomRight, axes.up, bottomOffset);

    this.addScaled(bottomLeft, axes.widthAxis, -halfWidth);
    this.addScaled(bottomLeft, axes.up, bottomOffset);

    return [topLeft, topRight, bottomRight, bottomLeft];
  }

  private getAxes(): {
    widthAxis: Cesium.Cartesian3;
    up: Cesium.Cartesian3;
  } {
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(
      this.position,
      this.viewer.scene.globe.ellipsoid,
    );
    const eastColumn = Cesium.Matrix4.getColumn(
      frame,
      0,
      new Cesium.Cartesian4(),
    );
    const northColumn = Cesium.Matrix4.getColumn(
      frame,
      1,
      new Cesium.Cartesian4(),
    );
    const upColumn = Cesium.Matrix4.getColumn(
      frame,
      2,
      new Cesium.Cartesian4(),
    );
    const east = new Cesium.Cartesian3(
      eastColumn.x,
      eastColumn.y,
      eastColumn.z,
    );
    const north = new Cesium.Cartesian3(
      northColumn.x,
      northColumn.y,
      northColumn.z,
    );
    const up = new Cesium.Cartesian3(upColumn.x, upColumn.y, upColumn.z);

    const cosHeading = Math.cos(this.heading);
    const sinHeading = Math.sin(this.heading);
    const widthAxis = Cesium.Cartesian3.normalize(
      new Cesium.Cartesian3(
        east.x * cosHeading + north.x * sinHeading,
        east.y * cosHeading + north.y * sinHeading,
        east.z * cosHeading + north.z * sinHeading,
      ),
      new Cesium.Cartesian3(),
    );

    return { widthAxis, up };
  }

  private addScaled(
    target: Cesium.Cartesian3,
    direction: Cesium.Cartesian3,
    scalar: number,
  ): void {
    target.x += direction.x * scalar;
    target.y += direction.y * scalar;
    target.z += direction.z * scalar;
  }

  private project(position: Cesium.Cartesian3): ProjectedPoint | undefined {
    const scene = this.viewer.scene;
    const canvasPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
      scene,
      position,
    );

    if (!canvasPosition) {
      return undefined;
    }

    const containerRect = this.container.getBoundingClientRect();
    const canvasRect = scene.canvas.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    return {
      x: canvasPosition.x + offsetX,
      y: canvasPosition.y + offsetY,
      canvasX: canvasPosition.x,
      canvasY: canvasPosition.y,
    };
  }

  private isFrontFacing(
    widthAxis: Cesium.Cartesian3,
    up: Cesium.Cartesian3,
  ): boolean {
    const normal = Cesium.Cartesian3.cross(
      widthAxis,
      up,
      new Cesium.Cartesian3(),
    );
    const toCamera = Cesium.Cartesian3.subtract(
      this.viewer.camera.positionWC,
      this.position,
      new Cesium.Cartesian3(),
    );
    return Cesium.Cartesian3.dot(normal, toCamera) > 0;
  }

  private isDepthOccluded(center: ProjectedPoint): boolean {
    const scene = this.viewer.scene;
    if (
      this.viewer.scene.mode !== Cesium.SceneMode.SCENE3D ||
      !scene.pickPositionSupported
    ) {
      return false;
    }

    try {
      const pickedPosition = scene.pickPosition(
        new Cesium.Cartesian2(center.canvasX, center.canvasY),
        this.pickPosition,
      );
      if (!pickedPosition) {
        return false;
      }

      const cameraPosition = this.viewer.camera.positionWC;
      const anchorDistance = Cesium.Cartesian3.distance(
        cameraPosition,
        this.position,
      );
      const pickedDistance = Cesium.Cartesian3.distance(
        cameraPosition,
        pickedPosition,
      );
      const tolerance = Math.max(5, anchorDistance * 0.0005);
      return pickedDistance + tolerance < anchorDistance;
    } catch {
      return false;
    }
  }

  private getDepthZIndex(): number {
    const distance = Cesium.Cartesian3.distance(
      this.viewer.camera.positionWC,
      this.position,
    );
    return Math.max(1, Math.min(100000, Math.round(100000000 / distance)));
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.update();
  }

  public setBackfaceCulling(enabled: boolean): void {
    this.backfaceCulling = enabled;
    this.update();
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setHTML(html: string): void {
    this.element.innerHTML = html;
    this.update();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.viewer.scene.postRender.removeEventListener(this.postRenderHandler);
    window.removeEventListener("resize", this.resizeHandler);
    this.element.remove();
  }

  private static toCSSMatrix3d(homography: Homography): string {
    const [a, b, c, d, e, f, g, h] = homography;
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
  }

  private static solveHomography(
    source: Array<[number, number]>,
    target: Array<[number, number]>,
  ): Homography | undefined {
    if (source.length !== 4 || target.length !== 4) {
      return undefined;
    }

    const matrix: number[][] = [];
    for (let index = 0; index < 4; index += 1) {
      const [x, y] = source[index];
      const [u, v] = target[index];
      matrix.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
      matrix.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
    }

    for (let column = 0; column < 8; column += 1) {
      let pivotRow = column;
      for (let row = column + 1; row < 8; row += 1) {
        if (
          Math.abs(matrix[row][column]) >
          Math.abs(matrix[pivotRow][column])
        ) {
          pivotRow = row;
        }
      }

      if (Math.abs(matrix[pivotRow][column]) < 1e-10) {
        return undefined;
      }

      [matrix[column], matrix[pivotRow]] = [
        matrix[pivotRow],
        matrix[column],
      ];

      const pivot = matrix[column][column];
      for (let cell = column; cell < 9; cell += 1) {
        matrix[column][cell] /= pivot;
      }

      for (let row = 0; row < 8; row += 1) {
        if (row === column) {
          continue;
        }

        const factor = matrix[row][column];
        if (Math.abs(factor) < 1e-12) {
          continue;
        }

        for (let cell = column; cell < 9; cell += 1) {
          matrix[row][cell] -= factor * matrix[column][cell];
        }
      }
    }

    return [
      matrix[0][8],
      matrix[1][8],
      matrix[2][8],
      matrix[3][8],
      matrix[4][8],
      matrix[5][8],
      matrix[6][8],
      matrix[7][8],
    ];
  }
}
