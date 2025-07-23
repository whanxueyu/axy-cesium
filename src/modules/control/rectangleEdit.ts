import * as Cesium from "cesium";

/**
 * 多边形编辑工具类
 * 支持拖拽中心点、拖拽边缘点、旋转修改坐标
 */
export class PolygonEditor {
    viewer: Cesium.Viewer;
    entity: Cesium.Entity;
    handler: Cesium.ScreenSpaceEventHandler;
    private onChangeCallback: (positions: Cesium.Cartesian3[]) => void;
    private isDragging = false;
    private isScaling = false;
    private isRotating = false;
    private anchorPoints: { [key: string]: Cesium.Entity } = {};
    private originalPositions: Cesium.Cartesian3[] = [];
    private rotation = 0;
    private draggingVertexIndex: number | null = null;

    constructor(
        viewer: Cesium.Viewer,
        entity: Cesium.Entity,
        onChange: (positions: Cesium.Cartesian3[]) => void
    ) {
        this.viewer = viewer;
        this.entity = entity;
        this.onChangeCallback = onChange;
        this.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        // 初始化时验证实体类型
        if (!this.entity.polygon) {
            throw new Error("Entity must have a polygon");
        }

        this.initAnchors();
        this.setupEventHandlers();
    }

    /**
     * 初始化顶点锚点
     */
    private initAnchors() {
        const positions = this.entity.polygon!.hierarchy.getValue(
            Cesium.JulianDate.now()
        ).positions;
        this.originalPositions = [...positions];

        // 创建每个顶点的锚点
        positions.forEach((pos, i) => {
            const key = `vertex-${i}`;
            this.anchorPoints[key] = this.viewer.entities.add({
                position: pos,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.RED.withAlpha(0.8),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                },
            });
        });

        // 创建中点缩放锚点
        this.createMidAnchorPoints(positions);

        // 创建中心点锚点（用于整体拖拽）
        const center = this.getPolygonCenter();
        this.anchorPoints.center = this.viewer.entities.add({
            position: center,
            point: {
                pixelSize: 12,
                color: Cesium.Color.GREEN.withAlpha(0.9),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
            },
        });

        // 创建旋转控制点
        this.anchorPoints.rotate = this.viewer.entities.add({
            position: this.getRotateControlPosition(positions),
            point: {
                pixelSize: 10,
                color: Cesium.Color.YELLOW.withAlpha(0.8),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
            },
        });
    }

    /**
     * 创建中点缩放锚点
     */
    private createMidAnchorPoints(positions: Cesium.Cartesian3[]) {
        for (let i = 0; i < positions.length; i++) {
            const nextIndex = (i + 1) % positions.length;
            const midPos = Cesium.Cartesian3.midpoint(
                positions[i],
                positions[nextIndex],
                new Cesium.Cartesian3()
            );

            const key = `mid-${i}`;
            this.anchorPoints[key] = this.viewer.entities.add({
                position: midPos,
                point: {
                    pixelSize: 8,
                    color: Cesium.Color.BLUE.withAlpha(0.7),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                },
            });
        }
    }

    /**
     * 获取旋转控制点位置（中心点上方）
     */
    private getRotateControlPosition(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 {
        // 将 Cartesian3 转换为 cartographic
        const cartographics = positions.map((pos) => Cesium.Cartographic.fromCartesian(pos));

        const lons = cartographics.map((c) => c.longitude);
        const lats = cartographics.map((c) => c.latitude);

        const west = Math.min(...lons);
        const east = Math.max(...lons);
        const south = Math.min(...lats);
        const north = Math.max(...lats);

        const rectangle = Cesium.Rectangle.fromDegrees(west, south, east, north);
        const center = Cesium.Rectangle.center(rectangle);

        // 在中心点上方0.1弧度处放置旋转控制点
        return Cesium.Cartesian3.fromRadians(center.longitude, center.latitude + 0.1);
    }

    /**
     * 设置事件监听器
     */
    private setupEventHandlers() {
        // 鼠标按下事件
        this.handler.setInputAction(
            (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
                const pickedObject = this.viewer.scene.pick(movement.position);
                if (pickedObject && pickedObject.id) {
                    const id = pickedObject.id.id;
                    this.disableCameraControl();
                    if (id in this.anchorPoints) {
                        if (id.startsWith("rotate")) {
                            this.isRotating = true;
                        } else if (id.startsWith("mid-")) {
                            this.isScaling = true;
                        } else if (id.startsWith("vertex-")) {
                            this.isDragging = true;
                            this.draggingVertexIndex = parseInt(id.split("-")[1]);
                        } else if (id === "center") {
                            this.isDragging = true;
                            this.draggingVertexIndex = null; // 表示整体拖拽
                        }

                        // 记录原始位置
                        this.originalPositions = [
                            ...this.entity.polygon!.hierarchy.getValue(Cesium.JulianDate.now()).positions,
                        ];
                    } else if (pickedObject.id === this.entity) {
                        this.isDragging = true;
                        this.draggingVertexIndex = null; // 表示整体拖拽
                        this.originalPositions = [
                            ...this.entity.polygon!.hierarchy.getValue(Cesium.JulianDate.now()).positions,
                        ];
                    }
                }
            },
            Cesium.ScreenSpaceEventType.LEFT_DOWN
        );

        // 鼠标移动事件
        this.handler.setInputAction(
            (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
                const newPosition = this.viewer.scene.camera.pickEllipsoid(movement.endPosition);
                if (!newPosition) return;

                if (this.isDragging || this.isScaling || this.isRotating) {
                    // 更新多边形形状和锚点位置
                    this.updatePolygonShape(movement, newPosition);
                    this.updateAnchors();

                    // 触发回调函数返回最新坐标
                    const currentPositions = this.entity.polygon!.hierarchy.getValue(
                        Cesium.JulianDate.now()
                    ).positions;
                    this.onChangeCallback(currentPositions);
                }
            },
            Cesium.ScreenSpaceEventType.MOUSE_MOVE
        );

        // 鼠标释放事件
        this.handler.setInputAction(() => {
            this.isDragging = false;
            this.isScaling = false;
            this.isRotating = false;
            this.draggingVertexIndex = null;
            this.originalPositions = [];
            this.enableCameraControl();
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    /**
     * 更新多边形形状
     */
    private updatePolygonShape(
        movement: Cesium.ScreenSpaceEventHandler.MotionEvent,
        newPosition: Cesium.Cartesian3
    ) {
        if (this.isDragging) {
            if (this.draggingVertexIndex !== null) {
                // 拖拽单个顶点
                this.updateVertexPosition(this.draggingVertexIndex, newPosition);
            } else {
                // 整体拖拽（中心点或整个多边形）
                const startCartesian = this.viewer.scene.camera.pickEllipsoid(movement.startPosition);
                const endCartesian = this.viewer.scene.camera.pickEllipsoid(movement.endPosition);

                if (startCartesian && endCartesian) {
                    const start = Cesium.Cartographic.fromCartesian(startCartesian);
                    const end = Cesium.Cartographic.fromCartesian(endCartesian);

                    const delta = {
                        x: end.longitude - start.longitude,
                        y: end.latitude - start.latitude,
                    };

                    // 应用平移
                    this.applyTranslation(delta);
                }
            }
        } else if (this.isScaling) {
            // 应用缩放
            this.applyScaling(newPosition);
        } else if (this.isRotating) {
            // 应用旋转
            this.applyRotation(newPosition);
        }
    }

    /**
     * 更新单个顶点位置
     */
    private updateVertexPosition(index: number, newPosition: Cesium.Cartesian3) {
        const positions = [...this.originalPositions];
        positions[index] = newPosition;

        this.entity.polygon!.hierarchy = new Cesium.ConstantProperty(
            new Cesium.PolygonHierarchy(positions)
        );
    }
    private disableCameraControl() {
        this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
        this.viewer.scene.screenSpaceCameraController.enableRotate = false;
        this.viewer.scene.screenSpaceCameraController.enableZoom = false;
        this.viewer.scene.screenSpaceCameraController.enableTilt = false;
        this.viewer.scene.screenSpaceCameraController.enableLook = false;
    }

    private enableCameraControl() {
        this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
        this.viewer.scene.screenSpaceCameraController.enableRotate = true;
        this.viewer.scene.screenSpaceCameraController.enableZoom = true;
        this.viewer.scene.screenSpaceCameraController.enableTilt = true;
        this.viewer.scene.screenSpaceCameraController.enableLook = true;
    }

    /**
     * 应用平移变换
     */
    private applyTranslation(delta: { x: number; y: number }) {
        const updatedPositions = this.originalPositions.map((pos) => {
            const cartographic = Cesium.Cartographic.fromCartesian(pos);
            return Cesium.Cartesian3.fromRadians(
                cartographic.longitude + delta.x,
                cartographic.latitude + delta.y,
                cartographic.height
            );
        });

        this.entity.polygon!.hierarchy = new Cesium.ConstantProperty(
            new Cesium.PolygonHierarchy(updatedPositions)
        );
    }

    /**
     * 应用缩放变换
     */
    private applyScaling(controlPoint: Cesium.Cartesian3) {
        const center = this.getPolygonCenter();
        const updatedPositions = this.originalPositions.map((pos) => {
            const vector = Cesium.Cartesian3.subtract(pos, center, new Cesium.Cartesian3());
            const distanceToControl = Cesium.Cartesian3.distance(center, controlPoint);
            const distanceToVertex = Cesium.Cartesian3.distance(center, pos);

            // 简单的比例缩放
            const scale = distanceToControl / Math.max(0.0001, distanceToVertex);
            return Cesium.Cartesian3.add(
                center,
                Cesium.Cartesian3.multiplyByScalar(vector, scale, new Cesium.Cartesian3()),
                new Cesium.Cartesian3()
            );
        });

        this.entity.polygon!.hierarchy = new Cesium.ConstantProperty(
            new Cesium.PolygonHierarchy(updatedPositions)
        );
    }

    /**
     * 应用旋转变换
     */
    private applyRotation(controlPoint: Cesium.Cartesian3) {
        const center = this.getPolygonCenter();
        const centerCartographic = Cesium.Cartographic.fromCartesian(center);
        const controlCartographic = Cesium.Cartographic.fromCartesian(controlPoint);

        // 计算当前控制点相对于中心的角度
        const currentAngle = Math.atan2(
            controlCartographic.latitude - centerCartographic.latitude,
            controlCartographic.longitude - centerCartographic.longitude
        );

        // 计算旋转角度（相对于原始位置）
        const originalControlPos = this.anchorPoints.rotate.position?.getValue(
            Cesium.JulianDate.now()
        );
        if (!originalControlPos) return;

        const originalCartographic = Cesium.Cartographic.fromCartesian(originalControlPos);
        const originalAngle = Math.atan2(
            originalCartographic.latitude - centerCartographic.latitude,
            originalCartographic.longitude - centerCartographic.longitude
        );

        const rotationDelta = currentAngle - originalAngle;

        // 实现旋转变换
        const updatedPositions = this.originalPositions.map((pos) => {
            const cartographic = Cesium.Cartographic.fromCartesian(pos);
            const dx = cartographic.longitude - centerCartographic.longitude;
            const dy = cartographic.latitude - centerCartographic.latitude;

            // 应用旋转
            const rotatedX = dx * Math.cos(rotationDelta) - dy * Math.sin(rotationDelta);
            const rotatedY = dx * Math.sin(rotationDelta) + dy * Math.cos(rotationDelta);

            return Cesium.Cartesian3.fromRadians(
                centerCartographic.longitude + rotatedX,
                centerCartographic.latitude + rotatedY,
                cartographic.height
            );
        });

        this.entity.polygon!.hierarchy = new Cesium.ConstantProperty(
            new Cesium.PolygonHierarchy(updatedPositions)
        );
    }

    /**
     * 获取多边形中心点
     */
    /**
  * 获取多边形中心点
  */
    private getPolygonCenter(): Cesium.Cartesian3 {
        const positions = this.entity.polygon!.hierarchy.getValue(
            Cesium.JulianDate.now()
        ).positions;

        // 计算几何中心
        const sum = positions.reduce(
            (acc, pos) => {
                const carto = Cesium.Cartographic.fromCartesian(pos);
                acc.lon += carto.longitude;
                acc.lat += carto.latitude;
                return acc;
            },
            { lon: 0, lat: 0 }
        );

        // 计算平均经纬度
        const centerLon = sum.lon / positions.length;
        const centerLat = sum.lat / positions.length;

        return Cesium.Cartesian3.fromRadians(centerLon, centerLat);
    }
    /**
     * 更新锚点位置
     */
    private updateAnchors() {
        const positions = this.entity.polygon!.hierarchy.getValue(
            Cesium.JulianDate.now()
        ).positions;

        // 更新顶点锚点
        Object.keys(this.anchorPoints).forEach((key) => {
            if (key.startsWith("vertex-")) {
                const index = parseInt(key.split("-")[1]);
                if (positions[index]) {
                    this.anchorPoints[key].position = positions[index];
                }
            } else if (key.startsWith("mid-")) {
                const index = parseInt(key.split("-")[1]);
                const nextIndex = (index + 1) % positions.length;
                this.anchorPoints[key].position = Cesium.Cartesian3.midpoint(
                    positions[index],
                    positions[nextIndex],
                    new Cesium.Cartesian3()
                );
            } else if (key === "center") {
                // 更新中心点位置
                this.anchorPoints.center.position = this.getPolygonCenter();
            } else if (key === "rotate") {
                // 更新旋转控制点位置
                this.anchorPoints.rotate.position = this.getRotateControlPosition(positions);
            }
        });
    }

    /**
     * 停止编辑
     */
    stopEditing() {
        // 移除事件处理器
        this.handler.destroy();

        // 移除所有锚点实体
        Object.values(this.anchorPoints).forEach(anchor => {
            this.viewer.entities.remove(anchor);
        });

        // 清空锚点集合
        this.anchorPoints = {};
    }
}