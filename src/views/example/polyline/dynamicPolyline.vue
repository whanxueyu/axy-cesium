<template>
    <div class="side-panel">
        <el-tree node-key="id" ref="treeRef" :data="dataList" :props="defaultProps" show-checkbox
            :default-checked-keys="checkList" @check-change="checkListChange" default-expand-all>
            <template #default="{ data }">
                <div class="custom-tree-node flex-sb-center" @dblclick="location(data)">
                    <div class="node-name">{{ data.name }}</div>
                    <div @click="location(data)">
                        <el-icon size="16" color="#ff404E">
                            <Location />
                        </el-icon>
                    </div>
                </div>
            </template>
        </el-tree>
    </div>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { Location} from "@element-plus/icons-vue";
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue'
const defaultProps = {
    children: "children",
    label: "name",
};
const mapLoaded = ref(false)
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

// material类型
// ColorMaterialProperty
// CompositeMaterialProperty
// GridMaterialProperty
// ImageMaterialProperty
// PolylineGlowMaterialProperty
// PolylineOutlineMaterialProperty
// StripeMaterialProperty
// 完整dataList扩展示例
const dataList = [
    // 原有Color案例
    {
        id: 'polyline001',
        name: "绿色实线",
        arcType: Cesium.ArcType.NONE,
        width: 5,
        material: Cesium.Color.GREENYELLOW, // 基础颜色材质
        shadows: Cesium.ShadowMode.CAST_ONLY,
        positions: [115.5, 37, 115.5, 38, 116.5, 39]
    },
    
    // 新增材质案例
    {
        id: 'polylineGlow',
        name: "黄色光晕线",
        arcType: Cesium.ArcType.GEODESIC,
        width: 8,
        material: new Cesium.PolylineGlowMaterialProperty({
            color: Cesium.Color.YELLOW,
            glowPower: 0.3 // 光晕强度
        }),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116, 38, 117, 39, 118, 40]
    },
    {
        id: 'polylineOutline',
        name: "蓝色带边框线",
        arcType: Cesium.ArcType.RHUMB,
        width: 5,
        material: new Cesium.PolylineOutlineMaterialProperty({
            color: Cesium.Color.BLUE, // 内部颜色
            outlineColor: Cesium.Color.WHITE, // 边框颜色
            outlineWidth: 2 // 边框宽度
        }),
        shadows: Cesium.ShadowMode.ENABLED,
        positions: [114, 38, 115, 39, 116, 40]
    },
    {
        id: 'gridMaterial',
        name: "红色网格线",
        arcType: Cesium.ArcType.NONE,
        width: 6,
        material: new Cesium.ImageMaterialProperty({
            image: './textures/line-color-aqua.png',
            repeat: new Cesium.Cartesian2(10, 1),
            transparent: true,
        }),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [115.5, 38.5, 116.5, 39.5, 117.5, 40.5]
    },
    {
        id: 'imageMaterial',
        name: "蓝色发光箭头",
        arcType: Cesium.ArcType.GEODESIC,
        width: 40,
        material: new Cesium.ImageMaterialProperty({
            image: './textures/line-arrow-dovetail.png',
            repeat: new Cesium.Cartesian2(10, 1),
            transparent: true,
        }),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [113.5, 38.5, 115.5, 39.5, 116, 40]
    },
    {
        id: 'stripeMaterial',
        name: "蓝色箭头",
        arcType: Cesium.ArcType.GEODESIC,
        width: 12,
        material: new Cesium.ImageMaterialProperty({
            image: './textures/line-arrow-blue.png',
            repeat: new Cesium.Cartesian2(50, 1),
            transparent: true,
        }),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [113, 38, 114, 39, 116, 40]
    },
    // 示例：让网格线图案流动
    // {
    //     id: 'animatedGrid',
    //     name: "流动网格线",
    //     arcType: Cesium.ArcType.NONE,
    //     width: 6,
    //     material: new Cesium.ImageMaterialProperty({
    //         image: './textures/line-color-aqua.png',
    //         repeat: new Cesium.CallbackProperty((time, result) => {
    //             // 使用时间计算动态重复间隔
    //             const seconds = time?.secondsOfDay??0;
    //             return new Cesium.Cartesian2(
    //                 10 + (seconds % 20), // 水平方向动态变化
    //                 1
    //             );
    //         }, false),
    //         transparent: true,
    //     }),
    //     shadows: Cesium.ShadowMode.DISABLED,
    //     positions: [115.5, 38.5, 116.5, 39.5, 117.5, 40.5]
    // },
    {
        id: 'blinkingArrow',
        name: "闪烁箭头",
        arcType: Cesium.ArcType.GEODESIC,
        width: 40,
        material: new Cesium.ImageMaterialProperty({
            image: './textures/line-arrow-dovetail.png',
            repeat: new Cesium.CallbackProperty((time, result) => {
                // 使用时间计算动态重复间隔
                const seconds = time?.secondsOfDay??0;
                return new Cesium.Cartesian2(
                    10 + (seconds % 20), // 水平方向动态变化
                    1
                );
            }, false),
            transparent: true,
        }),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [113.5, 38.5, 115.5, 39.5, 116, 40]
    },
];
const checkListChange = (value: { [key: string]: any; }, check: boolean) => {
    const entity = viewer?.entities?.getById(value.id);
    if (entity) {
        entity.show = check
    }
}

const checkList = ref<string[]>()
checkList.value = dataList.map(item => item.id)

const addLine = () => {
    dataList.forEach(item => {
        viewer.entities.add({
            id: item.id,
            polyline: {
                arcType:item.arcType ?? Cesium.ArcType.GEODESIC,
                shadows: item.shadows ?? Cesium.ShadowMode.ENABLED,
                positions: Cesium.Cartesian3.fromDegreesArray(item.positions), 
                width: item.width ?? 5,
                material: item.material??Cesium.Color.RED,
            },
        })
    })
}
const location = (data:any) => {
    const entity = viewer?.entities?.getById(data.id);
    if (entity) {
        viewer.zoomTo(entity)
    }
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    // viewer.clock.shouldAnimate = true;
    addLine()
    mapLoaded.value = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.405, 39.875, 2500),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-40),
            roll: 0.0,
        },
        duration: 1
    });
}
</script>

<style scoped>
.side-panel {
    position: absolute;
    padding: 10px;
    top: 10px;
    left: 10px;
    background-color: rgba(255, 255, 255, 0.8);
    z-index: 999;
}
.custom-tree-node{
    width: 100%;
    display: flex;
    justify-content: space-between;
}
.node-name{
    width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: start;
}
</style>