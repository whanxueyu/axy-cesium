<template>
    <div class="side-panel">
        <div class="side-panel-title">
            <div>模拟射频链路雷达效果并计算链路联通性</div>
            <div>先检测两个坐标是否通视</div>
            <div>再根据参数计算通信距离是否足够</div>
            <el-button type="primary" @click="pickTarget">新增雷达</el-button>
            <el-button :disabled="radarList.length < 2" type="success" @click="checkVisibility">连通测试</el-button>
            <el-row>
                <el-col :span="8">输入频率</el-col>
                <el-col :span="13">
                    <el-input-number v-model="form.frequencyMHz"></el-input-number>
                </el-col>
                <el-col :span="3">MHz</el-col>
            </el-row>
            <el-row>
                <el-col :span="8">发射功率</el-col>
                <el-col :span="13">
                    <el-input-number v-model="form.txPower"></el-input-number>
                </el-col>
                <el-col :span="3">dBm</el-col>
            </el-row>
            <el-row>
                <el-col :span="8">Tx电缆衰减</el-col>
                <el-col :span="13">
                    <el-input-number v-model="form.txCableLoss"></el-input-number>
                </el-col>
                <el-col :span="3">dB</el-col>
            </el-row>
            <el-row>
                <el-col :span="8">发射天线增益</el-col>
                <el-col :span="13">
                    <el-input-number v-model="form.txAntennaGain"></el-input-number>
                </el-col>
                <el-col :span="3">dB</el-col>
            </el-row>
            <el-row>
                <el-col :span="8">接收天线增益</el-col>
                <el-col :span="13">
                    <el-input-number v-model="form.rxAntennaGain"></el-input-number>
                </el-col>
                <el-col :span="3">dB</el-col>
            </el-row>
            <el-row>
                <el-col :span="8">Rx电缆衰减</el-col>
                <el-col :span="13">
                    <el-input-number v-model="form.rxCableLoss"></el-input-number>
                </el-col>
                <el-col :span="3">dB</el-col>
            </el-row>
            <el-row>
                <el-col :span="8">接收灵敏度</el-col>
                <el-col :span="13">
                    <el-input-number v-model="form.rxSensitivity"></el-input-number>
                </el-col>
                <el-col :span="3">dBm</el-col>
            </el-row>
            <el-row>
                <el-col :span="8">衰减余量</el-col>
                <el-col :span="13">
                    <el-input-number disabled v-model="form.fadeMargin"></el-input-number>
                </el-col>
                <el-col :span="3">dB</el-col>
            </el-row>
            <div>最大通信距离: {{ form.maxDistanceKM.toFixed(2) }} 公里</div>
            <div>自由空间路径损耗: {{ form.fspl.toFixed(2) }} dB</div>
        </div>
        <div>
            <el-tree node-key="id" ref="treeRef" :data="radarList" :props="defaultProps">
                <template #default="{ data }">
                    <div class="custom-tree-node flex-sb-center" @dblclick="location(data)">
                        <div class="node-name">{{ data.name }}</div>
                        <div class="node-actions">
                            <el-icon size="16" color="#ee994E" @click="location(data.position)">
                                <Location />
                            </el-icon>
                            <!-- 仅对测试雷达显示删除按钮 -->
                            <el-icon v-if="data.id !== 'origin'" size="16" color="#ff404E"
                                @click.stop="deleteRadar(data)" style="margin-left: 5px;">
                                <Delete />
                            </el-icon>
                        </div>
                    </div>
                </template>
            </el-tree>
            <div v-if="visibilityResult !== null" class="result-box">
                <span :class="visibilityResult ? 'success' : 'error'">
                    {{ visibilityResult ? '✅ 两点通视，无遮挡' : '❌ 两点被地形遮挡' }}
                </span>
                <div v-if="!visibilityResult && obstructionPoint" class="obstruction-info">
                    遮挡位置: {{ obstructionInfo }}
                </div>
            </div>
            <div v-if="distanceResult !== null" class="result-box">
                <span :class="distanceResult ? 'success' : 'error'">
                    {{ distanceResult ? '✅ 两点距离符合要求' : '❌ 两点距离大于最大通信距离' }}
                </span>
                <div class="obstruction-info">
                    两点距离: {{ distance?.toFixed(2) }} km
                </div>
            </div>
        </div>
    </div>

    <Map @loaded="handleMapLoaded" mapType="BingAerial"></Map>
</template>

<script setup lang="ts">
import { Location, Delete } from "@element-plus/icons-vue";
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import Map from '@/components/cesium/map.vue'
import * as turf from "@turf/turf";
import EllipsoidGradientMaterialProperty from "./gradientMaterial.js"
import RFLinkBudget from "./RFLinkBudget.js"

var viewer: Cesium.Viewer;
const defaultProps = {
    children: "children",
    label: "name",
};
const position = Cesium.Cartesian3.fromDegrees(111.5744, 28.1478, 520.0);
const radarList = ref([{
    id: "origin",
    name: "初始雷达",
    position: position,
}])
const form = ref({
    frequencyMHz: 2440, // 工作频率
    txPower: 23, // 发射功率
    txAntennaGain: 9, // 发射天线增益
    rxAntennaGain: 24, // 接收天线增益
    txCableLoss: 0.9, // 发射端电缆损耗
    rxCableLoss: 0.9, // 接收端电缆损耗
    rxSensitivity: -90, // 接收灵敏度
    fadeMargin: 24, // 衰减余量
    maxDistanceKM: 0,
    fspl:0
});
const visibilityResult = ref<boolean | null>(null);
const distanceResult = ref<boolean | null>(null);
const obstructionPoint = ref<Cesium.Cartesian3 | null>(null);
const obstructionInfo = ref<string>("");
const distance = ref<number>();

const handleMapLoaded = (Viewer: Cesium.Viewer) => {
    viewer = Viewer;
    addJamRadar(position)
}

const addJamRadar = (centerPosition: Cesium.Cartesian3) => {
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // 中心点位置
    const longRadius = 100.0;
    const shortRadius = 20.0;

    const directions = [];
    for (let i = 0; i < 24; i++) {
        const angle = i * 15;
        let name = `${angle}°`;
        if (angle === 0) name = '0° (北)';
        else if (angle === 90) name = '90° (东)';
        else if (angle === 180) name = '180° (南)';
        else if (angle === 270) name = '270° (西)';
        directions.push({ name, angle });
    }

    const centerCartographic = Cesium.Cartographic.fromCartesian(centerPosition);
    const centerLngLat = [
        Cesium.Math.toDegrees(centerCartographic.longitude),
        Cesium.Math.toDegrees(centerCartographic.latitude)
    ];

    directions.forEach((direction) => {
        let randowNum = Math.random() * 0.7 + 0.3
        let currentLongRadius = longRadius * randowNum;
        let currentShottRadius = shortRadius * randowNum;

        const newPoint = turf.destination(
            centerLngLat,
            currentLongRadius * 0.95,
            direction.angle,
            { units: 'meters' }
        );

        const newCartographic = Cesium.Cartographic.fromDegrees(
            newPoint.geometry.coordinates[0],
            newPoint.geometry.coordinates[1],
            centerCartographic.height
        );

        const nelLocation = Cesium.Cartesian3.fromRadians(
            newCartographic.longitude,
            newCartographic.latitude,
            newCartographic.height
        );

        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
            nelLocation,
            new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(direction.angle + 270),
                Cesium.Math.toRadians(-90 + Math.random() * 20),
                Cesium.Math.toRadians(0)
            )
        );

        viewer.entities.add({
            name: direction.name,
            position: nelLocation,
            orientation: orientation,
            ellipsoid: {
                radii: new Cesium.Cartesian3(currentShottRadius, currentShottRadius, currentLongRadius),
                fill: true,
                outline: false,
                outlineColor: Cesium.Color.WHITE.withAlpha(0.7),
                slicePartitions: 36,
                stackPartitions: 36,
                material: new EllipsoidGradientMaterialProperty({
                    color1: Cesium.Color.BLUE,
                    color2: Cesium.Color.AQUA,
                    color3: Cesium.Color.YELLOW,
                    color4: Cesium.Color.RED,
                    direction: 0.0,
                    transition1: 0.2,
                    transition2: 0.4,
                    transition3: 0.55,
                    threshold1: 0.0,
                    threshold2: 0.5,
                    threshold3: 0.55,
                    transitionWidth: 0.05
                })
            }
        });
    });
}

// 添加雷达功能
function pickTarget() {
    if (!viewer || !viewer.scene) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const ray = viewer.camera.getPickRay(movement.position);
        if (ray) {
            const position = viewer.scene.globe.pick(ray, viewer.scene);
            if (position) {
                radarList.value.push({
                    id: new Date().getTime() + "",
                    name: "测试雷达",
                    position: position,
                })
                addJamRadar(position)
            }
        }

        handler.destroy();
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// 定位到雷达位置
const location = (position: Cesium.Cartesian3) => {
    viewer.camera.flyTo({
        destination: position,
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: Cesium.Math.toRadians(0),
        }
    });
}

// 检查两点是否通视
const checkVisibility = () => {
    if (radarList.value.length !== 2) return;

    const pointA = radarList.value[0].position;
    const pointB = radarList.value[1].position;

    // 清除之前的可视化结果
    clearVisualization();

    // 执行通视检测
    const result = isLineOfSightClear(pointA, pointB);

    // 显示结果
    visibilityResult.value = result;

    distanceResult.value = false;

    // 如果有遮挡，显示遮挡点信息
    if (!result && obstructionPoint.value) {
        const cartographic = Cesium.Cartographic.fromCartesian(obstructionPoint.value);
        const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
        const lng = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
        const height = cartographic.height.toFixed(1);
        obstructionInfo.value = `纬度: ${lat}°, 经度: ${lng}°, 高度: ${height}m`;
    } else {
        // 创建计算器实例
        const calculator = new RFLinkBudget();

        // 设置参数
        calculator.setParameters({
            txPower: form.value.txPower,
            txAntennaGain: form.value.txAntennaGain,
            rxAntennaGain: form.value.rxAntennaGain,
            frequencyMHz: form.value.frequencyMHz,
            txCableLoss: form.value.txCableLoss,
            rxCableLoss: form.value.rxCableLoss,
            rxSensitivity: form.value.rxSensitivity,
            fadeMargin: form.value.fadeMargin
        });

        // 计算并获取结果
        const results = calculator.getResults();
        form.value.maxDistanceKM = results.maxDistanceKM;
        form.value.fspl = results.fspl;
        // 计算距离,如果两点距离大于最大通信距离 maxDistanceKM 则无法通讯
        distance.value = (Cesium.Cartesian3.distance(pointA,pointB)/1000);
        console.log('Distance:', distance.value, 'km');
        if (distance.value > results.maxDistanceKM) {
            distanceResult.value = false;
        } else {
            distanceResult.value = true
        }
    }
    // 可视化结果
    visualizeResult(pointA, pointB, visibilityResult.value, distanceResult.value);
}

// 清除可视化结果
const clearVisualization = () => {
    // 移除之前的可视化实体
    viewer.entities.removeAll();

    // 重新添加剩余的雷达
    radarList.value.forEach(radar => {
        addJamRadar(radar.position);
    });
}

// 可视化检测结果
const visualizeResult = (pointA: Cesium.Cartesian3, pointB: Cesium.Cartesian3, isClear: boolean, isConnected: boolean) => {
    viewer.entities.add({
        polyline: {
            positions: [pointA, pointB],
            width: 3,
            material: !isClear ? Cesium.Color.RED: isConnected? Cesium.Color.GREEN : new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.BLUE,
                gapColor: Cesium.Color.TRANSPARENT,
                dashLength: 8
            }),
            clampToGround: false
        }
    });

    // 如果有遮挡点，标记遮挡位置
    if (!isClear && obstructionPoint.value) {
        viewer.entities.add({
            position: obstructionPoint.value,
            point: {
                pixelSize: 10,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.RED,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            label: {
                text: '遮挡点',
                font: '14px sans-serif',
                fillColor: Cesium.Color.WHITE,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -20),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
    }
}

// 检查两点之间是否通视
const isLineOfSightClear = (pointA: Cesium.Cartesian3, pointB: Cesium.Cartesian3): boolean => {
    // 计算两点之间的距离
    const distance = Cesium.Cartesian3.distance(pointA, pointB);

    // 创建从A到B的射线
    const direction = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.subtract(pointB, pointA, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
    );

    const ray = new Cesium.Ray(pointA, direction);

    // 检测与地形的交点
    const intersection = viewer.scene.globe.pick(ray, viewer.scene);

    // 如果有交点，检查是否在两点之间
    if (intersection) {
        const intersectionDistance = Cesium.Cartesian3.distance(pointA, intersection);

        // 如果交点距离小于AB距离，说明被地形遮挡
        if (intersectionDistance < distance) {
            obstructionPoint.value = intersection;
            return false;
        }
    }

    // 检测与3D Tiles等模型的交点
    const pickedObject = viewer.scene.pickFromRay(ray);
    if (Cesium.defined(pickedObject) && pickedObject.id) {
        // 获取交点位置
        const intersection = viewer.scene.pickPositionFromRay(ray);

        if (Cesium.defined(intersection)) {
            const intersectionDistance = Cesium.Cartesian3.distance(pointA, intersection);

            // 如果交点距离小于AB距离，说明被模型遮挡
            if (intersectionDistance < distance) {
                obstructionPoint.value = intersection;
                return false;
            }
        }
    }

    // 无遮挡，两点通视
    obstructionPoint.value = null;
    return true;
}

// 删除雷达
const deleteRadar = (radar: any) => {
    // 确保不能删除初始雷达
    if (radar.id === 'origin') {
        return;
    }

    // 从雷达列表中移除
    radarList.value = radarList.value.filter(r => r.id !== radar.id);

    // 清除可视化结果
    clearVisualization();

    // 重置通视结果
    visibilityResult.value = null;
    distanceResult.value = null;

    // 提示用户
    console.log(`已删除雷达: ${radar.name}`);
}

onMounted(() => {
});
</script>

<style scoped>
.side-panel {
    position: absolute;
    padding: 10px;
    top: 10px;
    left: 10px;
    color: #333;
    text-align: start;
    background-color: rgba(255, 255, 255, 0.8);
    z-index: 999;
    border-radius: 4px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.side-panel-title {
    margin-bottom: 10px;
}

.custom-tree-node {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.node-name {
    width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: start;
}

.node-actions {
    display: flex;
    align-items: center;
}

.result-box {
    margin-top: 10px;
    padding: 8px;
    border-radius: 4px;
}

.success {
    color: #67C23A;
}

.error {
    color: #F56C6C;
}

.obstruction-info {
    margin-top: 5px;
    font-size: 12px;
    color: #606266;
    padding-left: 20px;
}
</style>