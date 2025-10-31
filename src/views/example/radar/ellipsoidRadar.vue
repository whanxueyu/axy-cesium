<template>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue';

const mapLoaded = ref(false)
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const radarList = ref<{
    id: number;
    name: string;
    position: number[];
    radius: number;
    color: string;
    length: number;
    count: number;
    thickness: number;
    wallPositions: number[];
}[]>([
    {
        id: 1,
        name: "雷达1",
        position: [116.388, 39.91],
        radius: 100,
        color: "#ffff0f",
        length: 250,
        count: 15,
        thickness: 0.5,
        wallPositions: [],
    },
    {
        id: 2,
        name: "雷达2",
        position: [116.405, 39.91],
        radius: 500,
        color: "#ff3666",
        length: 1000,
        count: 30,
        thickness: 0.3,
        wallPositions: [],
    },
    {
        id: 3,
        name: "雷达3",
        position: [116.39, 39.897],
        radius: 300,
        color: "#00cfff",
        length: 800,
        count: 20,
        thickness: 0.2,
        wallPositions: [],
    },
    {
        id: 4,
        name: "雷达4",
        position: [116.415, 39.896],
        radius: 250,
        color: "#0fff0f",
        length: 500,
        count: 10,
        thickness: 0.1,
        wallPositions: [],
    },
])
const handleDrawRadar = () => {
    radarList.value.forEach((item) => {
        addEntities(item)
    })
}
const addEntities = (item: {
    id: number;
    name: string;
    position: number[];
    radius: number;
    color: string;
    length: number;
    count: number;
    thickness: number;
    wallPositions: number[];
}) => {
    viewer.entities.add({
        id: item.id + '',
        position: Cesium.Cartesian3.fromDegrees(item.position[0], item.position[1]),
        // 立体墙
        wall: {
            positions: new Cesium.CallbackProperty(() => {
                return Cesium.Cartesian3.fromDegreesArrayHeights(item.wallPositions);
            }, false),
            material: Cesium.Color.fromCssColorString(item.color),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
                0.0,
                10.5e6
            ),
        },
        // 球体
        ellipsoid: {
            radii: new Cesium.Cartesian3(
                item.radius * 2,
                item.radius * 2,
                item.radius * 2
            ),
            maximumCone: Cesium.Math.toRadians(90),
            material: Cesium.Color.fromCssColorString(item.color).withAlpha(0.5),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(item.color),
            outlineWidth: 1,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
                0.0,
                10.5e6
            ),
        },
    });
}
const calcPoints = (x1: number, y1: number, radius: number, heading: number) => {
    var m = Cesium.Transforms.eastNorthUpToFixedFrame(
        Cesium.Cartesian3.fromDegrees(x1, y1)
    );
    var rx = radius * Math.cos((heading * Math.PI) / 180.0);
    var ry = radius * Math.sin((heading * Math.PI) / 180.0);
    var translation = Cesium.Cartesian3.fromElements(rx, ry, 0);
    var d = Cesium.Matrix4.multiplyByPoint(
        m,
        translation,
        new Cesium.Cartesian3()
    );
    var c = Cesium.Cartographic.fromCartesian(d);
    var x2 = Cesium.Math.toDegrees(c.longitude);
    var y2 = Cesium.Math.toDegrees(c.latitude);
    return computeCirclularFlight(x1, y1, x2, y2, 0, 90);
}
const computeCirclularFlight = (x1: number, y1: number, x2: number, y2: number, fx: number, angle: number) => {
    let positionArr = [];
    positionArr.push(x1);
    positionArr.push(y1);
    positionArr.push(0);
    var radius = Cesium.Cartesian3.distance(
        Cesium.Cartesian3.fromDegrees(x1, y1),
        Cesium.Cartesian3.fromDegrees(x2, y2)
    );
    for (let i = fx; i <= fx + angle; i++) {
        let h = radius * Math.sin((i * Math.PI) / 180.0);
        let r = Math.cos((i * Math.PI) / 180.0);
        let x = (x2 - x1) * r + x1;
        let y = (y2 - y1) * r + y1;
        positionArr.push(x);
        positionArr.push(y);
        positionArr.push(h);
    }
    return positionArr;
}
let tickListener;
const addPostRender = () => {
    tickListener = viewer.clock.onTick.addEventListener(() => {
         //可调节转动速度
        radarList.value.forEach((item) => {
            item.count += item.thickness;
            item.wallPositions = calcPoints(
                item.position[0],
                item.position[1],
                item.radius*2,
                item.count
            );
        });

    });
}


const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    handleDrawRadar();
    mapLoaded.value = true;
    reset()
    viewer.clock.shouldAnimate = true; // 开启时间动画
    addPostRender()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.405, 39.875, 3000),
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