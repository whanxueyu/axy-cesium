<template>
    <div class="side-panel">
        <el-tree node-key="id" ref="treeRef" :data="dataList" :props="defaultProps" show-checkbox
            :default-checked-keys="checkList" @check-change="checkListChange" default-expand-all>
            <template #default="{ data }">
                <div class="custom-tree-node flex-sb-center" @dblclick="location(data)">
                    <div class="node-name">{{ data.name }}</div>
                    <el-image style="width: 90px;height: 30px;" :src="data.imgUrl" lazy loading="lazy"
                        fit="contain"></el-image>
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
import { Location } from "@element-plus/icons-vue";
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
    {
        id: 'gridMaterial',
        name: "蓝色渐变",
        arcType: Cesium.ArcType.NONE,
        width: 6,
        imgUrl: './textures/line-color-aqua.png',
        material: new Cesium.ImageMaterialProperty({
            image: './textures/line-color-aqua.png',
            repeat: new Cesium.Cartesian2(10, 1),
            transparent: true,
        }),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.388, 39.92, 116.388, 39.895, 116.394, 39.905]
    },
    {
        id: 'imageMaterial',
        name: "蓝色发光箭头",
        arcType: Cesium.ArcType.GEODESIC,
        width: 40,
        imgUrl: './textures/line-arrow-dovetail.png',
        material: new Cesium.ImageMaterialProperty({
            image: './textures/line-arrow-dovetail.png',
            repeat: new Cesium.Cartesian2(10, 1),
            transparent: true,
        }),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.4, 39.92, 116.4, 39.895,116.406, 39.905]
    },
    {
        id: 'stripeMaterial',
        name: "蓝色箭头",
        arcType: Cesium.ArcType.GEODESIC,
        width: 12,
        imgUrl: './textures/line-arrow-blue.png',
        material: new Cesium.ImageMaterialProperty({
            image: './textures/line-arrow-blue.png',
            repeat: new Cesium.Cartesian2(50, 1),
            transparent: true,
        }),
        shadows: Cesium.ShadowMode.DISABLED,
        positions: [116.412, 39.92, 116.412, 39.895, 116.418, 39.905]
    },
    {
        id: 'fakeroad',
        name: "公路",
        arcType: Cesium.ArcType.GEODESIC,
        width: 62,
        sizeInMeters: true,
        imgUrl: './textures/road.jpg',
        material: new Cesium.ImageMaterialProperty({
            image: './textures/road.jpg',
            repeat: new Cesium.Cartesian2(50, 1),
            transparent: true,
        }),
        shadows: Cesium.ShadowMode.DISABLED,
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
                arcType: item.arcType ?? Cesium.ArcType.GEODESIC,
                shadows: item.shadows ?? Cesium.ShadowMode.ENABLED,
                positions: Cesium.Cartesian3.fromDegreesArray(item.positions),
                width: item.width ?? 5,
                material: item.material ?? Cesium.Color.RED
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
    let handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        var cartesian = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid);
        if (!cartesian) return;
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        let lng = Cesium.Math.toDegrees(cartographic.longitude); // 经度
        let lat = Cesium.Math.toDegrees(cartographic.latitude); // 纬度
        let coordinate = {
            longitude: Number(lng.toFixed(6)),
            latitude: Number(lat.toFixed(6)),
            height: Number(cartographic.height.toFixed(6)),
        };
        console.log(coordinate.longitude, coordinate.latitude);

    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
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