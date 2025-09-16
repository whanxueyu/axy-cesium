<template>
    <div :class="['menubox box1', showPanel ? '' : 'hide']">
        <div class="menuclose" @click="handleShowPanel">
            <el-icon size="20">
                <Close />
            </el-icon>
        </div>
        <div class="el-tabs">
            绕点飞行
        </div>
        <div class="menucell">
            <div style="margin-bottom: 10px;">旋转速度：<el-input-number v-model="speed" :min="0.1" :max="5"
                    :step="0.1"></el-input-number></div>
            <div style="margin-bottom: 10px;">距离目标：<el-input-number v-model="distance" :min="100"
                    :step="100"></el-input-number></div>
            <el-button type="primary" @click="startFlight">开始</el-button>
            <el-button type="danger" @click="stopFlight">停止</el-button>
            <el-button type="warning" @click="pickTarget">选择目标</el-button>
        </div>
        <div v-if="!showPanel" class="hideicon" @click="handleShowPanel">
            <el-icon size="30">
                <Grid />
            </el-icon>
        </div>
    </div>
    <Map @loaded="onMapLoaded" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from 'cesium';
import Map from '@/components/cesium/map.vue';
import { Close, Grid } from '@element-plus/icons-vue';

// 三维视图实例
let viewer: Cesium.Viewer;

// UI状态
const showPanel = ref(true);
const speed = ref(1.0);       // 旋转速度（每秒旋转角度）
const distance = ref(2000);   // 固定距离目标点距离

// 目标点
const targetEntity = ref<Cesium.Entity | null>(null);  // 目标点实体
const targetCartesian = ref<Cesium.Cartesian3>();  // 目标点坐标

// 动画状态
let animationId: (() => void) | null = null;
let isFlying = ref(false);
let currentHeading = 0;  // 当前 Heading（弧度）

/**
 * 地图加载完成回调
 */
function onMapLoaded(mapViewer: Cesium.Viewer) {
    viewer = mapViewer;
    reset()
}

/**
 * 切换面板显示状态
 */
function handleShowPanel() {
    showPanel.value = !showPanel.value;
}

/**
 * 计算绕目标点的相机位置
 * @param target 目标点笛卡尔坐标
 * @param heading 当前方位角（弧度，0=北）
 * @param distance 水平旋转半径（米）
 * @param height 飞行高度（米）
 * @returns 相机新位置坐标
 */
function calculateCameraPosition(
    target: Cesium.Cartesian3,
    heading: number,
    distance: number,
    height: number
): Cesium.Cartesian3 {
    // 创建目标点的局部坐标系（东-北-上）
    const localFrame = Cesium.Transforms.eastNorthUpToFixedFrame(target);

    // 计算水平面偏移（heading 0=北，90°=东）
    const east = distance * Math.sin(heading);  // 东向分量
    const north = distance * Math.cos(heading); // 北向分量

    // 局部坐标系中的偏移向量
    const offset = new Cesium.Cartesian3(east, north, height);

    // 转换到全局坐标系
    return Cesium.Matrix4.multiplyByPoint(localFrame, offset, new Cesium.Cartesian3());
}

/**
 * 开始绕点飞行
 */
function startFlight() {
    if (!targetCartesian.value) {
        alert('请先选择目标点');
        return;
    }

    isFlying.value = true;
    currentHeading = 0;
    const startTime = performance.now();

    animationId = viewer.scene.postRender.addEventListener(() => {
        if (!isFlying.value) return;

        const now = performance.now();
        const elapsed = (now - startTime) / 1000;
        currentHeading = (elapsed * speed.value) % (2 * Math.PI);
        if (!targetCartesian.value) return
        // 计算新相机位置
        const newPosition = calculateCameraPosition(
            targetCartesian.value,
            currentHeading,
            distance.value,
            distance.value,
        );

        // 更新相机视角（保持朝向目标点）
        viewer.camera.setView({
            destination: newPosition,
            orientation: {
                heading: currentHeading + Math.PI, // 相机始终朝向目标点
                pitch: -Math.PI / 4,               // 固定俯仰角
                roll: 0
            }
        });
    });
}

/**
 * 停止飞行
 */
function stopFlight() {
    isFlying.value = false;

    if (animationId !== null) {
        viewer.scene.postRender.removeEventListener(animationId);
        animationId = null;
    }
}

/**
 * 选择目标点
 */
function pickTarget() {
    if (!viewer || !viewer.scene) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const ray = viewer.camera.getPickRay(movement.position);
        if (ray) {
            const position = viewer.scene.globe.pick(ray, viewer.scene);
            if (position) {
                // 移除旧的目标点
                if (targetEntity.value) {
                    viewer.entities.remove(targetEntity.value);
                }

                // 创建新目标点
                targetEntity.value = viewer.entities.add({
                    position: position,
                    point: {
                        pixelSize: 10,
                        color: Cesium.Color.RED,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    }
                });

                targetCartesian.value = position;

                // 使用HeadingPitchRange自然聚焦
                const offset = new Cesium.HeadingPitchRange(
                    0,                     // 初始方位角（北）
                    -Math.PI / 4,          // 俯仰角
                    distance.value         // 使用当前设置的距离
                );
                viewer.zoomTo(targetEntity.value, offset);
            }
        }

        handler.destroy();
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(108, 33.5, 24000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-50),
            roll: 0.0,
        },
        duration: 1
    });
}
</script>

<style scoped>
/* 保持原有样式不变 */
.menubox {
    position: absolute;
    z-index: 999;
    border-bottom-right-radius: 10px;
    border: 1px solid rgba(139, 139, 139, 0.2);
    background-color: #222222;
    color: #fff;
    user-select: none;
    transition: all .3s;
    padding: 20px;

    .menuclose {
        position: absolute;
        right: 4px;
        top: 4px;
        cursor: pointer;
        color: #00eeff;

        &:hover {
            color: #ffffff
        }
    }

    &.hide {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        padding: 0;
        background-color: #01a1fd;
        transition: all .3s;

        &:hover {
            box-shadow: 0 0 4px 1px #00eeff;
        }

        .el-tabs {
            display: none;
        }

        .menucell {
            display: none;
        }

        .menuclose {
            display: none;
        }

        .demo-tabs {
            display: none;
        }
    }

    &.box1 {
        left: 5px;
        top: 65px;
    }

    .hideicon {
        width: 30px;
        height: 30px;
        padding: 5px;
        transition: all .3s;
    }

    .el-tabs {
        display: flex;
        flex-direction: column;
        padding: 10px;
        gap: 10px;

        &>* {
            margin: 2px 0;
        }
    }

    .itemList {
        width: 130px;
        display: flex;
        flex-wrap: nowrap;
        overflow-y: auto;
        margin-top: 30px;
        flex-direction: column;
        overflow-x: hidden;

        .name {
            width: 100px;
            border: 1px solid #00eeff33;
            margin: 10px;

            &:active {
                cursor: grab;
            }

            .icon {
                width: 80px;
                height: 60px;
                padding: 5px;
                transition: all .3s;
            }

            .name {
                text-align: center;
            }

            &:hover,
            &.active {
                background-color: #00eeff33;
                border: 1px solid #00eeff;


                .icon {
                    width: 100px;
                    height: 80px;
                    padding: 0px;
                    transition: all .3s;
                }
            }
        }
    }

    .tab-body {
        width: 250px;

        .text {
            line-height: 24px;
            text-indent: 24px;
            text-align: start;
        }
    }
}

/* 其他样式保持不变 */
</style>