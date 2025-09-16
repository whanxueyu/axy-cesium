<template>
    <div :class="['menubox box1', showPanel ? '' : 'hide']">
        <div class="menuclose" @click="handleShowPanel">
            <el-icon size="20">
                <Close />
            </el-icon>
        </div>
        <div class="el-tabs">
            定点旋转
        </div>
        <div class="menucell">
            <div style="margin-bottom: 10px;">旋转速度：<el-input-number :min="0" :max="3" v-model="rotateSpeed" :step="0.1"></el-input-number></div>
            <div style="margin-bottom: 10px;">视点高度：<el-input-number :min="0" v-model="height" :step="1"></el-input-number></div>
            <el-button type="warning" auto-insert-space @click="handlePickPosition">点选位置</el-button>
            <el-button type="primary" auto-insert-space @click="handleStart">开始</el-button>
            <el-button type="danger" auto-insert-space @click="handleStop">停止</el-button>
        </div>
        <div v-if="!showPanel" class="hideicon" @click="handleShowPanel">
            <el-icon size="30">
                <Grid />
            </el-icon>
        </div>
    </div>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import { Grid, Close } from '@element-plus/icons-vue'
import Map from '@/components/cesium/map.vue'
import { ElMessage } from 'element-plus';

var viewer: Cesium.Viewer;
const showPanel = ref(true);
const rotateSpeed = ref<number>(0.5);
const height = ref<number>(10000);
const targetPosition = ref<Cesium.Cartesian3 | null>(null);
const rotationHandler = ref<Cesium.ScreenSpaceEventHandler | null>(null);
let rotationClock: Cesium.Event.RemoveCallback | null = null;
let startTime: number | null = null;
let isRotating = false;
let initialHeading: number | null = null;

const handleMapLoaded = (Viewer: Cesium.Viewer) => {
    viewer = Viewer;
}

const handleShowPanel = () => {
    showPanel.value = !showPanel.value;
}

// 开始旋转
const handleStart = () => {
    if (!targetPosition.value) {
        alert("请先选择旋转中心点");
        return;
    }

    if (isRotating) return;

    isRotating = true;
    startTime = Cesium.JulianDate.now().secondsOfDay;
    initialHeading = viewer.camera.heading;

    // 添加时钟监听器实现旋转动画
    rotationClock = viewer.clock.onTick.addEventListener(() => {
        if (!targetPosition.value || !startTime) return;

        const currentTime = Cesium.JulianDate.now().secondsOfDay;
        const elapsedTime = currentTime - startTime;
        const angle = elapsedTime * parseFloat(rotateSpeed.value.toString()) * 0.5;

        // 更新相机朝向
        updateCameraOrientation(angle);
    });
}

// 更新相机朝向（固定位置，旋转视角）
const updateCameraOrientation = (angle: number) => {
    if (!targetPosition.value) return;

    // 获取目标点的地理坐标
    const cartographic = Cesium.Cartographic.fromCartesian(targetPosition.value);
    if (!cartographic) return;

    // 计算相机位置（在目标点上方）
    const heightValue = parseFloat(height.value.toString());
    const cameraPosition = Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        cartographic.height + heightValue
    );

    // 计算朝向角度
    const heading = initialHeading !== null ? initialHeading + angle : angle;
    const pitch = viewer.camera.pitch; // 保持原有俯仰角
    const roll = viewer.camera.roll;   // 保持原有翻滚角

    // 设置相机位置和朝向
    viewer.camera.setView({
        destination: cameraPosition,
        orientation: {
            heading: heading,
            pitch: pitch,
            roll: roll
        }
    });
}

// 停止旋转
const handleStop = () => {
    if (rotationClock) {
        rotationClock();
        rotationClock = null;
    }
    isRotating = false;
}

// 点选位置
const handlePickPosition = () => {
    if (!viewer) return;

    // 如果已有事件处理器，先移除
    if (rotationHandler.value) {
        rotationHandler.value.destroy();
    }

    // 创建新的屏幕空间事件处理器
    rotationHandler.value = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    // 监听鼠标左键点击事件
    rotationHandler.value.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        // 从射线与地球表面的交点获取位置
        const ray = viewer.camera.getPickRay(movement.position);
        if (ray) {
            const intersection = viewer.scene.globe.pick(ray, viewer.scene);
            if (intersection) {
                targetPosition.value = intersection;
                ElMessage.success('已选择位置');

                // 将相机移动到选定点上方
                const cartographic = Cesium.Cartographic.fromCartesian(intersection);
                if (cartographic) {
                    const cameraHeight = parseFloat(height.value.toString());
                    const cameraPosition = Cesium.Cartesian3.fromRadians(
                        cartographic.longitude,
                        cartographic.latitude,
                        cartographic.height + cameraHeight
                    );

                    viewer.camera.flyTo({
                        destination: cameraPosition,
                        orientation: {
                            heading: viewer.camera.heading,
                            pitch: viewer.camera.pitch,
                            roll: viewer.camera.roll
                        },
                        duration: 1.0
                    });
                }
            }
        }

        // 移除事件处理器
        if (rotationHandler.value) {
            rotationHandler.value.destroy();
            rotationHandler.value = null;
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

onMounted(() => {
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
</style>