<template>
    <div class="side-panel">
        <el-tree node-key="id" ref="treeRef" :data="polygonList" :props="defaultProps" show-checkbox
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
        <video id="trailer" style="width:0px;height: 0;" controls autoplay muted loop>
            <source src="@/assets/oceans.mp4" type="video/mp4">
            Your browser does not support the <code>video</code> element.
        </video>
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

const polygonList = [
    {
        id: 'polygon001',
        name: "蓝色多边形",
        positions: [116.400327, 39.914952,
            116.404667, 39.914992,
            116.405091, 39.907520,
            116.400276, 39.907725,
            116.400691, 39.911293,
            116.400327, 39.914952,],
        material: new Cesium.ColorMaterialProperty(Cesium.Color.CYAN.withAlpha(0.5)),
        extrudedHeight: 0
    },
    {
        id: 'polygon002',
        name: "红色带高度",
        positions: [116.381472, 39.906648,
            116.381179, 39.901755,
            116.385007, 39.901839,
            116.385042, 39.899653,
            116.389326, 39.899327,
            116.389480, 39.902064,
            116.392945, 39.902143,
            116.393025, 39.904181,
            116.389035, 39.904418,
            116.389133, 39.906274,
            116.385165, 39.906578,
            116.381472, 39.906648],
        material: new Cesium.ColorMaterialProperty(Cesium.Color.RED.withAlpha(0.7)),
        extrudedHeight: 200
    },
    {
        id: 'polygon003',
        name: "图片材质",
        positions: [116.384877, 39.922420, 116.385409, 39.912552, 116.396083, 39.912551, 116.395624, 39.922487, 116.384877, 39.922420],
        material: new Cesium.ImageMaterialProperty({
            image: 'public/textures/gugong.jpg',
            repeat: new Cesium.Cartesian2(1, 1)
        })
    },
    {
        id: 'polygon004',
        name: "模拟白膜",
        positions: [116.411472, 39.906648,
            116.411179, 39.901755,
            116.415007, 39.901839,
            116.415042, 39.899653,
            116.419326, 39.899327,
            116.419480, 39.902064,
            116.422945, 39.902143,
            116.423025, 39.904181,
            116.419035, 39.904418,
            116.419133, 39.906274,
            116.415165, 39.906578,
            116.411472, 39.906648],
        material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE),
        extrudedHeight: 200,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.5)
    },
]


const checkListChange = (value: { [key: string]: any; }, check: boolean) => {
    const entity = viewer?.entities?.getById(value.id);
    if (entity) {
        entity.show = check
    }
}

const checkList = ref<string[]>()
checkList.value = polygonList.map(item => item.id)


const addPolygon = (data: any) => {
    const entity = viewer?.entities?.getById(data.id);
    if (entity) {
        entity.show = !entity.show;
    } else {
        viewer.entities.add({
            id: data.id,
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(data.positions),
                material: data.material ?? Cesium.Color.RED.withAlpha(0.5),
                // height: 0,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                outline: true,
                outlineColor: data.outlineColor ?? Cesium.Color.BLACK,
                extrudedHeight: data.extrudedHeight ?? 0,
            }
        });
    }
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
    handler.setInputAction(function (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) {
        var cartesian = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid);
        if (!cartesian) return;
        // drawPlane(cartesian)
        var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        var longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
        var latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
        console.log(longitudeString, latitudeString);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    polygonList.forEach(item => {
        addPolygon(item)
    })
    mapLoaded.value = true;
    reset()
}
const drawPlane = (center: Cesium.Cartesian3) => {
    let cartographic = Cesium.Cartographic.fromCartesian(center);
    let lng = Cesium.Math.toDegrees(cartographic.longitude); // 经度
    let lat = Cesium.Math.toDegrees(cartographic.latitude); // 纬度
    let alt = cartographic.height
    const videoElement = document.getElementById("trailer");
    viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, 540 + alt),
        plane: {
            plane: new Cesium.Plane(Cesium.Cartesian3.UNIT_Y, 0.0),
            dimensions: new Cesium.Cartesian2(1920.0, 1080.0),
            material: videoElement as any,
            outline: true,
            outlineColor: Cesium.Color.BLACK,
        },
    });
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