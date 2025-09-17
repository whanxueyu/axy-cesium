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

const dataList = [
    // 原有Color案例
    {
        id: 'polyline001',
        name: "绿色实线（线宽5）",
        arcType: Cesium.ArcType.NONE,
        width: 5,
        material: Cesium.Color.GREENYELLOW, // 基础颜色材质
        shadows: Cesium.ShadowMode.CAST_ONLY,
        positions: [116.388, 39.92, 116.388, 39.895, 116.394, 39.905]
    },
    
    // 新增材质案例
    {
        id: 'polylineGlow',
        name: "黄色光晕线（线宽10）",
        arcType: Cesium.ArcType.GEODESIC,
        width: 10,
        material: new Cesium.PolylineGlowMaterialProperty({
            color: Cesium.Color.YELLOW,
            glowPower: 0.3 // 光晕强度
        }),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.4, 39.92, 116.4, 39.895,116.406, 39.905]
    },
    {
        id: 'polylineOutline',
        name: "边框线（线宽15，边框2）",
        arcType: Cesium.ArcType.RHUMB,
        width: 15,
        material: new Cesium.PolylineOutlineMaterialProperty({
            color: Cesium.Color.BLUE, // 内部颜色
            outlineColor: Cesium.Color.WHITE, // 边框颜色
            outlineWidth: 2 // 边框宽度
        }),
        shadows: Cesium.ShadowMode.ENABLED,
        positions: [116.412, 39.92, 116.412, 39.895, 116.418, 39.905]
    },
    {
        id: 'arrowPolyline',
        name: "带箭头的线（线宽15）",
        width: 15,
        material: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.RED),
        shadows: Cesium.ShadowMode.ENABLED,
        positions: [116.424, 39.92, 116.424, 39.895, 116.430, 39.905]
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