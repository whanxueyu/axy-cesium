<template>
    <div class="side-panel">
        <el-row>
            <el-col :span="8">动画时间</el-col>
            <el-col :span="16">
                <el-input-number @change="redraw" :min="1000"  v-model="duration" :step="1000"></el-input-number>
            </el-col>
        </el-row>
        <el-row>
            <el-col :span="8">重复数量</el-col>
            <el-col :span="16">
                <el-input-number @change="redraw" :min="1"  v-model="repeat" :step="1"></el-input-number>
            </el-col>
        </el-row>
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
    <Map mapType="grid" @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { Location } from "@element-plus/icons-vue";
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue'
import PolylineTrailLinkMaterialProperty from '@/modules/cesium/PolylineTrailLinkMaterialProperty.ts'
const defaultProps = {
    children: "children",
    label: "name",
};

const mapLoaded = ref(false)
const  duration = ref(3000)
const  repeat = ref(6)
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
        name: "arrow-dovetail",
        arcType: Cesium.ArcType.NONE,
        width: 15,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-arrow-dovetail.png', Cesium.Color.WHITE, duration.value, repeat.value), // 基础颜色材质
        shadows: Cesium.ShadowMode.CAST_ONLY,
        positions: [116.388, 39.92, 116.388, 39.895]
    },
    {
        id: 'polyline002',
        name: "arrow-right",
        arcType: Cesium.ArcType.GEODESIC,
        width: 10,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-arrow-right.png', Cesium.Color.DARKBLUE, duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.392, 39.92, 116.392, 39.895]
    },
    {
        id: 'polyline003',
        name: "arrow-trans",
        arcType: Cesium.ArcType.GEODESIC,
        width: 10,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-arrow-trans.png', Cesium.Color.WHITE, duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.396, 39.92, 116.396, 39.895]
    },
    {
        id: 'polyline004',
        name: "蓝色箭头线",
        arcType: Cesium.ArcType.GEODESIC,
        width: 10,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-arrow-blue.png', Cesium.Color.BLUE, duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.4, 39.92, 116.4, 39.895]
    },
    {
        id: 'polyline005',
        name: "aqua",
        arcType: Cesium.ArcType.RHUMB,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-color-aqua.png', Cesium.Color.AQUA, duration.value, repeat.value),
        shadows: Cesium.ShadowMode.ENABLED,
        positions: [116.41, 39.92, 116.41, 39.895]
    },
    {
        id: 'polyline006',
        name: "red",
        arcType: Cesium.ArcType.NONE,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-color-red.png', Cesium.Color.RED, duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.412, 39.92, 116.412, 39.895]
    },
    {
        id: 'polyline007',
        name: "yellow",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-color-yellow.png', Cesium.Color.YELLOW, duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.414, 39.92, 116.414, 39.895]
    },
    {
        id: 'polyline008',
        name: "colour",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-colour.png', Cesium.Color.fromCssColorString('#1ff'), duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.416, 39.92, 116.416, 39.895]
    },
    {
        id: 'polyline009',
        name: "gradual",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-gradual.png', Cesium.Color.fromCssColorString('#fff'), duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.418, 39.92, 116.418, 39.895]
    },
    {
        id: 'polyline010',
        name: "interval",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-interval.png', Cesium.Color.WHITE.withAlpha(0.9), duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.42, 39.92, 116.42, 39.895]
    },
    {
        id: 'polyline011',
        name: "pulse",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-pulse.png', Cesium.Color.WHITE.withAlpha(0.99), duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.422, 39.92, 116.422, 39.895]
    },
    {
        id: 'polyline012',
        name: "sprite",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-sprite.png', Cesium.Color.WHITE.withAlpha(0.98), duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.424, 39.92, 116.424, 39.895]
    },
    {
        id: 'polyline013',
        name: "sprite2",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-sprite2.png', Cesium.Color.WHITE.withAlpha(0.97), duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.426, 39.92, 116.426, 39.895]
    },
    {
        id: 'polyline014',
        name: "tarans",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-tarans.png', Cesium.Color.WHITE.withAlpha(0.96), duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.428, 39.92, 116.428, 39.895]
    },
    {
        id: 'polyline015',
        name: "vertebral-blue",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-vertebral-blue.png', Cesium.Color.WHITE.withAlpha(0.95), duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.43, 39.92, 116.43, 39.895]
    },
    {
        id: 'polyline016',
        name: "vertebral",
        arcType: Cesium.ArcType.GEODESIC,
        width: 6,
        material: new PolylineTrailLinkMaterialProperty('./textures/line-vertebral.png', Cesium.Color.WHITE.withAlpha(0.94), duration.value, repeat.value),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.432, 39.92, 116.432, 39.895]
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

const redraw = ()=>{ 
    viewer.entities.removeAll()
    setTimeout(() => {
        addLine()
    }, 100);
}
const addLine = () => {
    dataList.forEach(item => {
        viewer.entities.add({
            id: item.id,
            polyline: {
                arcType: item.arcType ?? Cesium.ArcType.GEODESIC,
                shadows: item.shadows ?? Cesium.ShadowMode.ENABLED,
                positions: Cesium.Cartesian3.fromDegreesArray(item.positions),
                width: item.width ?? 5,
                material: item.material ?? Cesium.Color.RED,
            },
        })
    })
}
const location = (data: any) => {
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
    background-color: rgb(255, 255, 255);
    color: #777;
    z-index: 999;
}

.custom-tree-node {
    width: 100%;
    display: flex;
    justify-content: space-between;
}

.node-name {
    width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: start;
}
</style>