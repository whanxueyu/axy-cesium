<template>
    <div :class="['menubox box1', showPanel ? '' : 'hide']">
        <div class="menuclose" @click="handleShowPanel">
            <el-icon size="20">
                <Close />
            </el-icon>
        </div>
        <div class="el-tabs">
            <div class="itemList">
            </div>
        </div>
        <div class="menucell">
        </div>
        <div v-if="!showPanel" class="hideicon" @click="handleShowPanel">
            <el-icon size="30">
                <Grid />
            </el-icon>
        </div>
    </div>
    <Map @loaded="handleMapLoaded" mapType="BingAerial"></Map>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import { Grid, Close } from '@element-plus/icons-vue'
import Map from '@/components/cesium/map.vue'
import * as turf from "@turf/turf";
import EllipsoidElectricMaterialProperty from "./meterial.js"
var viewer: Cesium.Viewer;

const showPanel = ref(true)
const handleMapLoaded = (Viewer: Cesium.Viewer) => {
    viewer = Viewer;
    test()
}
const test = () => {
    // viewer.scene.globe.depthTestAgainstTerrain = true;
    // 中心点位置（100米高度避免地下）
    const centerPosition = Cesium.Cartesian3.fromDegrees(100.0, 40.0, 1500.0);

    const longRadius = 10000.0;
    const shortRadius = 2000.0;
    const directions = [];
    for (let i = 0; i < 24; i++) {
        const angle = i * 15;
        let name = `${angle}°`;

        // 为关键方向添加标识
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
    directions.forEach((direction, index) => {
        let randowNum = Math.random() * 0.7 + 0.3
        let currentLongRadius = longRadius * randowNum;
        let currentShottRadius = shortRadius * randowNum;
        const newPoint = turf.destination(
            centerLngLat,    // 中心点 [经度, 纬度]
            currentLongRadius * 0.95,             // 距离（公里）
            direction.angle, // 方位角（度）
            { units: 'meters' }
        );

        // 3. 将Turf结果转换回Cesium Cartesian3
        const newCartographic = Cesium.Cartographic.fromDegrees(
            newPoint.geometry.coordinates[0], // 经度
            newPoint.geometry.coordinates[1], // 纬度
            centerCartographic.height        // 保持相同高度
        );
        const nelLocation = Cesium.Cartesian3.fromRadians(
            newCartographic.longitude,
            newCartographic.latitude,
            newCartographic.height
        );

        // 4. 创建当地水平旋转（关键：pitch=-90°）
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
            nelLocation,
            new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(direction.angle + 270),
                Cesium.Math.toRadians(-90 + Math.random() * 20),
                Cesium.Math.toRadians(0)
            )
        );
        // 计算当前长度与最大长度的比例
        const ratio = currentLongRadius / longRadius;

        // 动态计算渐变过渡点
        let transition1 = 0.7; // 绿色开始点
        let transition2 = 1.2; // 黄色开始点
        let transition3 = 1.2; // 红色开始点
        if (ratio > 0.4) {
            transition1 = 0.8;
            transition2 = 1.2
            transition3 = 1.2
        }
        if (ratio > 0.5) {
            transition1 = 0.7;
            transition2 = 0.85
            transition3 = 1.2
        }
        if (ratio > 0.6) {
            transition1 = 0.6;
            transition2 = 0.8;
            transition3 = 1.2
        }
        if (ratio > 0.7) {
            transition1 = 0.5;
            transition2 = 0.7;
            transition3 = 1.2
        }
        if (ratio > 0.8) {
            transition1 = 0.4;
            transition2 = 0.6;
            transition3 = 0.85
        }
        if (ratio > 0.9) {
            transition1 = 0.4;
            transition2 = 0.5;
            transition3 = 0.7
        }

        viewer.entities.add({
            name: direction.name,
            position: nelLocation,
            orientation: orientation,
            ellipsoid: {
                // 关键修正：Y轴作为长轴（北/南方向）
                radii: new Cesium.Cartesian3(currentShottRadius, currentShottRadius, currentLongRadius),
                fill: true,
                outline: false,
                outlineColor: Cesium.Color.WHITE.withAlpha(0.7),
                slicePartitions: 36,
                stackPartitions: 36,
                material: new EllipsoidElectricMaterialProperty({
                    color1: Cesium.Color.BLUE,
                    color2: Cesium.Color.AQUA,
                    color3: Cesium.Color.YELLOW,
                    color4: Cesium.Color.RED,
                    direction: 0.0,      // 垂直渐变
                    transition1: transition1,   // 25%位置从蓝色过渡到绿色
                    transition2: transition2,    // 50%位置从绿色过渡到黄色
                    transition3: transition3
                })
            },
            point: {
                show: false,
                pixelSize: 5,
                color: Cesium.Color.RED,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
            },
        });
    });

    setTimeout(() => {
        viewer.zoomTo(viewer.entities);
    }, 2000);
}
const handleShowPanel = () => {
    showPanel.value = !showPanel.value;
}
onMounted(() => {
});
</script>

<style scoped lang="scss">
.menubox {
    position: absolute;
    z-index: 999;
    border-bottom-right-radius: 10px;
    // padding: 0 10px 10px;
    border: 1px solid rgba(139, 139, 139, 0.2);
    background-color: #222222;
    color: #fff;
    user-select: none;
    transition: all .3s;

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
        // border: 1px solid #00eeff;
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

    .demo-tabs {
        margin: 10px auto;
    }

    .itemList {
        width: 130px;
        display: flex;
        flex-wrap: nowrap;
        overflow-y: auto;
        // height: 600px;
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
                // height: 40px;
                // line-height: 32px;
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