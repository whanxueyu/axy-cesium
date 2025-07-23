import * as Cesium from 'cesium';

/**
 * EntityEditor 类用于编辑 Cesium 实体的属性，包括位置、旋转、缩放和多边形顶点。
 * 提供了创建锚点、处理鼠标事件以及更新实体属性的功能。
 */
interface AnchorPoints {
    position: Cesium.Entity | null;
    rotation: Cesium.Entity | null;
    scale: Cesium.Entity | null;
    polygon: Cesium.Entity[];
}

class EntityEditor {
    viewer: Cesium.Viewer;
    entity: Cesium.Entity;
    handler: Cesium.ScreenSpaceEventHandler;
    isEditing: boolean;
    anchorPoints: AnchorPoints;
    selectedAnchor: Cesium.Entity | null;
    rotationDisc: Cesium.Entity | null;
    rotationLine: Cesium.Entity | null;
    angleLabel: Cesium.Entity | null;
    lastPositions: Map<Cesium.Entity, Cesium.Cartesian3>;
    private hoveredAnchor: Cesium.Entity | null = null; // 新增这一行

    constructor(viewer: Cesium.Viewer, entity: Cesium.Entity) {
        this.viewer = viewer;
        this.entity = entity;
        this.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        this.isEditing = false;

        // 锚点配置
        this.anchorPoints = {
            position: null,
            rotation: null,
            scale: null,
            polygon: []
        };

        // 当前选中的锚点类型
        this.selectedAnchor = null;
        this.rotationDisc = null;
        this.rotationLine = null;
        this.angleLabel = null;
        this.lastPositions = new Map();
    }

    startEditing() {
        if (this.isEditing) return;
        this.isEditing = true;

        // 创建锚点
        this.createAnchors();

        // 设置鼠标事件处理
        this.setupEventHandlers();

        // 确保锚点始终在最上层
        this.keepAnchorsOnTop();
    }

    stopEditing() {
        this.isEditing = false;

        // 移除锚点和事件处理
        this.removeAnchors();
        this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);

        // 停止监听 postRender
        this.viewer.scene.postRender.removeEventListener(this.updateAnchorsPositionOnMove);
    }

    createAnchors() {
        // 创建位置锚点（中心点）
        this.anchorPoints.position = this.createAnchor('position');

        // 创建旋转锚点（顶部）
        this.anchorPoints.rotation = this.createAnchor('rotation');
        this.rotationDisc = this.createRotationDisc();

        // 创建缩放锚点（右下角）
        this.anchorPoints.scale = this.createAnchor('scale');

        // 如果是多边形，创建多边形编辑锚点
        if (this.entity.polygon) {
            this.initPolygonAnchors();
        }
    }

    createAnchor(type: string) {
        let position;
        const basePos = this.entity.position?.getValue(Cesium.JulianDate.now());

        if (type === 'position') {
            position = basePos;
        } else if (type === 'rotation') {
            if (basePos)
                position = Cesium.Cartesian3.add(basePos, new Cesium.Cartesian3(0, 0, 10), new Cesium.Cartesian3());
        } else if (type === 'scale') {
            if (basePos)
                position = Cesium.Cartesian3.add(basePos, new Cesium.Cartesian3(10, -10, 0), new Cesium.Cartesian3());
        }

        const anchorEntity = this.viewer.entities.add({
            position: position,
            billboard: {
                image: this.getAnchorIcon(type),
                scale: new Cesium.CallbackProperty(() =>
                    this.selectedAnchor === anchorEntity ? 1.5 : 1.0,
                    false),
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                verticalOrigin: Cesium.VerticalOrigin.CENTER
            },
            point: {
                pixelSize: 8,
                outlineWidth: 2,
                color: new Cesium.CallbackProperty(() => {
                    return this.selectedAnchor === anchorEntity ?
                        Cesium.Color.WHITE :
                        this.getAnchorColor(type);
                }, false)
            }
        });

        return anchorEntity;
    }

    private getAnchorIcon(type: string): string {
        switch (type) {
            case 'scale':
                return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 21L19.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M16.5 4.5H19.5V7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M21 19.5L4.5 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M7.5 19.5H4.5V16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                `);
            default:
                return '';
        }
    }

    private getAnchorColor(type: string): Cesium.Color {
        switch (type) {
            case 'position': return Cesium.Color.RED;
            case 'rotation': return Cesium.Color.YELLOW;
            case 'scale': return Cesium.Color.CYAN;
            default: return Cesium.Color.BLUE;
        }
    }

    // 创建旋转圆盘
    createRotationDisc() {
        const radius = 15; // 圆盘半径

        return this.viewer.entities.add({
            position: this.anchorPoints.rotation?.position,
            ellipse: {
                semiMajorAxis: radius,
                semiMinorAxis: radius,
                material: Cesium.Color.fromCssColorString('#FFD700').withAlpha(0.3), // 金色半透明
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString('#FFD700'),
                outlineWidth: 2
            },
            name: 'rotation-disc'
        });
    }

    setupEventHandlers() {
        this.handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
            const pickedObject = this.viewer.scene.pick(movement.position);

            if (pickedObject && pickedObject.id) {
                // 检查是否点击了锚点
                if (this.isAnchor(pickedObject.id)) {
                    this.selectedAnchor = pickedObject.id;
                    // 阻止地图拖动：禁用相机控制
                    this.disableCameraControl();
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        this.handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
            if (this.selectedAnchor) {
                const cartesian = this.viewer.scene.camera.pickEllipsoid(
                    movement.endPosition,
                    this.viewer.scene.globe.ellipsoid
                );

                if (cartesian) {
                    // 更新锚点位置
                    this.selectedAnchor.position = new Cesium.ConstantPositionProperty(cartesian);

                    // 根据锚点类型更新实体属性
                    this.updateEntityProperties(this.selectedAnchor, cartesian);
                }
            }

            // 悬停检测
            const pickedObject = this.viewer.scene.pick(movement.endPosition);
            if (pickedObject && pickedObject.id) {
                if (this.isAnchor(pickedObject.id)) {
                    this.hoveredAnchor = pickedObject.id;
                }
            } else if (this.hoveredAnchor) {
                this.hoveredAnchor = null;
            }
            this.updateAnchorHoverState();
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.handler.setInputAction(() => {
            this.selectedAnchor = null;
            // 恢复相机控制
            this.enableCameraControl();
            // 清理辅助元素
            this.cleanupAssistanceElements();
            // 松开鼠标时更新多边形
            if (this.entity.polygon) {
                this.updatePolygon();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    private isAnchor(entity: any): boolean {
        return (
            entity === this.anchorPoints.position ||
            entity === this.anchorPoints.rotation ||
            entity === this.anchorPoints.scale ||
            this.anchorPoints.polygon.includes(entity)
        );
    }

    private updateAnchorHoverState() {
        // 更新所有锚点的悬停状态显示
        Object.values(this.anchorPoints).forEach(anchor => {
            if (anchor instanceof Array) {
                anchor.forEach(a => {
                    if (a.billboard) {
                        a.billboard.scale = new Cesium.ConstantProperty(this.hoveredAnchor === a ? 1.8 : 1.0);
                    }
                });
            } else if (anchor && anchor.billboard) {
                anchor.billboard.scale = new Cesium.ConstantProperty(this.hoveredAnchor === anchor ? 1.8 : 1.0);
            }
        });
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

    private cleanupAssistanceElements() {
        if (this.rotationLine) {
            this.viewer.entities.remove(this.rotationLine);
            this.rotationLine = null;
        }

        if (this.angleLabel) {
            this.viewer.entities.remove(this.angleLabel);
            this.angleLabel = null;
        }
    }

    updateEntityProperties(anchor: Cesium.Entity, newPosition: Cesium.Cartesian3) {
        if (anchor === this.anchorPoints.position) {
            // 更新实体位置
            this.entity.position = new Cesium.ConstantPositionProperty(newPosition);

            // 同步更新旋转锚点和缩放锚点
            this.updateRelatedAnchors(newPosition);
        } else if (anchor === this.anchorPoints.rotation) {
            const entityPos = this.entity.position?.getValue(Cesium.JulianDate.now());
            if (entityPos === undefined) return;
            if (this.rotationLine) {
                this.viewer.entities.remove(this.rotationLine);
                this.rotationLine = null;
            }
            const angle = this.calculateRotationAngle(entityPos, newPosition);

            // 更新实体方向
            this.entity.orientation = new Cesium.CallbackProperty(() => {
                return Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, angle);
            }, false);

            // 创建辅助线和角度显示
            this.rotationLine = this.viewer.entities.add({
                polyline: {
                    positions: [entityPos, newPosition],
                    material: Cesium.Color.YELLOW.withAlpha(0.5),
                    width: 2
                }
            });

            const angleDeg = Cesium.Math.toDegrees(angle);
            this.showAngleLabel(newPosition, angleDeg);
        } else if (anchor === this.anchorPoints.scale) {
            const entityPos = this.entity.position?.getValue(Cesium.JulianDate.now());
            if (entityPos === undefined) return;

            const distance = Cesium.Cartesian3.distance(entityPos, newPosition);

            // 基础大小
            const baseDistance = 10; // 与createAnchor中偏移量一致

            // 计算缩放比例
            const scale = distance / baseDistance * 2;

            // 更新实体缩放属性
            if (this.entity.model) {
                this.entity.model.scale = new Cesium.ConstantProperty(scale);
            } else if (this.entity.billboard) {
                this.entity.billboard.scale = new Cesium.ConstantProperty(scale);
            }
        }
    }

    private updateRelatedAnchors(entityPos: Cesium.Cartesian3) {
        // 同步更新旋转锚点
        if (this.anchorPoints.rotation) {
            const rotatedPos = Cesium.Cartesian3.add(
                entityPos,
                new Cesium.Cartesian3(0, 0, 10),
                new Cesium.Cartesian3()
            );
            this.anchorPoints.rotation.position = new Cesium.ConstantPositionProperty(rotatedPos);

            // 同步更新旋转圆盘位置
            if (this.rotationDisc) {
                this.rotationDisc.position = new Cesium.ConstantPositionProperty(rotatedPos);
            }
        }

        // 同步更新缩放锚点
        if (this.anchorPoints.scale) {
            const scaledPos = Cesium.Cartesian3.add(
                entityPos,
                new Cesium.Cartesian3(10, -10, 0),
                new Cesium.Cartesian3()
            );
            this.anchorPoints.scale.position = new Cesium.ConstantPositionProperty(scaledPos);
        }
    }

    calculateRotationAngle(center: Cesium.Cartesian3, point: Cesium.Cartesian3) {
        // 计算从中心点到给定点的角度
        const vector = Cesium.Cartesian3.subtract(point, center, new Cesium.Cartesian3());
        const horizontalVector = new Cesium.Cartesian3(vector.x, vector.y, 0);
        const angle = Cesium.Math.toDegrees(Math.atan2(horizontalVector.y, horizontalVector.x));

        // 返回相对于正东方向的角度
        return Cesium.Math.toRadians(angle);
    }

    showAngleLabel(position: Cesium.Cartesian3, angle: number) {
        // 移除旧的标签
        if (this.angleLabel) {
            this.viewer.entities.remove(this.angleLabel);
            this.angleLabel = null;
        }

        // 创建新的角度标签
        this.angleLabel = this.viewer.entities.add({
            position: position,
            label: {
                text: `${angle.toFixed(1)}°`,
                font: '14px sans-serif',
                fillColor: Cesium.Color.YELLOW,
                backgroundColor: Cesium.Color.fromCssColorString('#333333').withAlpha(0.7),
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                showBackground: true,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                pixelOffset: new Cesium.Cartesian2(0, -15)
            }
        });
    }

    initPolygonAnchors() {
        // 创建多边形顶点锚点
        const polygon = this.entity.polygon;
        if (!polygon) return;

        const hierarchy = polygon.hierarchy;
        if (hierarchy instanceof Cesium.CallbackProperty) {
            // 对于动态多边形，需要使用采样值
            const sampleTime = Cesium.JulianDate.now();
            const value = hierarchy.getValue(sampleTime);
            if (value && 'positions' in value && Array.isArray(value.positions)) {
                value.positions.forEach((position: Cesium.Cartesian3, index: number) => {
                    const anchor = this.createPolygonAnchor(position, index);
                    this.anchorPoints.polygon.push(anchor);
                });
            }
        } else if (hierarchy && 'positions' in hierarchy && Array.isArray(hierarchy.positions)) {
            // 对于静态多边形
            hierarchy.positions.forEach((position, index) => {
                const anchor = this.createPolygonAnchor(position, index);
                this.anchorPoints.polygon.push(anchor);
            });
        }
    }

    createPolygonAnchor(position: Cesium.Cartesian3, index: number) {
        // 创建多边形顶点锚点
        return this.viewer.entities.add({
            position: position,
            point: {
                color: Cesium.Color.BLUE,
                pixelSize: 6,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2
            },
            name: `polygon-anchor-${index}`
        });
    }

    removeAnchors() {
        // 移除所有锚点
        Object.values(this.anchorPoints).forEach(anchor => {
            if (anchor instanceof Array) {
                anchor.forEach(a => this.viewer.entities.remove(a));
            } else if (anchor) {
                this.viewer.entities.remove(anchor);
            }
        });

        // 移除辅助元素
        if (this.rotationDisc) {
            this.viewer.entities.remove(this.rotationDisc);
        }

        // 清空锚点记录
        this.anchorPoints = {
            position: null,
            rotation: null,
            scale: null,
            polygon: []
        };

        this.rotationDisc = null;
        this.rotationLine = null;
        this.angleLabel = null;
    }

    updatePolygon() {
        // 获取所有多边形锚点的当前位置
        const updatedPositions = this.anchorPoints.polygon
            .sort((a, b) => {
                // 直接使用 name 字符串进行排序
                const aName = a.name?.getValue(Cesium.JulianDate.now()) || '';
                const bName = b.name?.getValue(Cesium.JulianDate.now()) || '';
                const aIndexMatch = aName.match(/polygon-anchor-(\d+)/);
                const bIndexMatch = bName.match(/polygon-anchor-(\d+)/);
                const aIndex = aIndexMatch ? parseInt(aIndexMatch[1], 10) : Infinity;
                const bIndex = bIndexMatch ? parseInt(bIndexMatch[1], 10) : Infinity;
                return aIndex - bIndex;
            })
            .map(anchor => anchor.position?.getValue(Cesium.JulianDate.now()));

        // 更新多边形实体
        let points: Cesium.Cartesian3[] = [];
        if (updatedPositions.length > 0) {
            points = updatedPositions.filter((pos): pos is Cesium.Cartesian3 => !!pos);
        }

        this.entity.polygon = new Cesium.PolygonGraphics({
            hierarchy: new Cesium.CallbackProperty(() => points, false),
            material: this.entity.polygon?.material,
            outline: this.entity.polygon?.outline,
            outlineColor: this.entity.polygon?.outlineColor
        });
    }

    // 保持锚点始终可见
    keepAnchorsOnTop() {
        this.viewer.scene.postRender.addEventListener(this.updateAnchorsPositionOnMove);
    }

    updateAnchorsPositionOnMove = () => {
        Object.values(this.anchorPoints).forEach(anchor => {
            if (anchor instanceof Array) {
                anchor.forEach(a => {
                    const pos = a.position?.getValue(Cesium.JulianDate.now());
                    if (pos) {
                        // 只有当位置变化超过阈值时才更新
                        const lastPos = this.lastPositions.get(a);
                        if (!lastPos || !Cesium.Cartesian3.equalsEpsilon(pos, lastPos, Cesium.Math.EPSILON6)) {
                            a.position = new Cesium.ConstantPositionProperty(pos);
                            this.lastPositions.set(a, pos);
                        }
                    }
                });
            } else if (anchor) {
                const pos = anchor.position?.getValue(Cesium.JulianDate.now());
                if (pos) {
                    const lastPos = this.lastPositions.get(anchor);
                    if (!lastPos || !Cesium.Cartesian3.equalsEpsilon(pos, lastPos, Cesium.Math.EPSILON6)) {
                        anchor.position = new Cesium.ConstantPositionProperty(pos);
                        this.lastPositions.set(anchor, pos);
                    }
                }
            }
        });
    };
}

export default EntityEditor;