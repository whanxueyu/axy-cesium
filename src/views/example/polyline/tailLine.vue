<template>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue';
import migrationLineMaterial from '@/modules/cesium/migrationLineMaterial';

const mapLoaded = ref(false)
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    drawTailLine()
    mapLoaded.value = true;
    reset()
}
const drawTailLine = () => {
  let geometryInstances = []
  let startPoint = points.start.北京
  for (let key in points.end) {
    let endPoint = points.end[key]
    let polylineGeometry = new Cesium.PolylineGeometry({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(ceratBezierLine(startPoint, endPoint)),
      width: 2,
    })
    let geometryInstance = new Cesium.GeometryInstance({ geometry: polylineGeometry })
    geometryInstances.push(geometryInstance)
  }
  var line = viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: geometryInstances,
      appearance: new Cesium.PolylineMaterialAppearance({
        material: migrationLineMaterial(Cesium.Color.fromCssColorString('#02ffff')),
      }),
    })
  )
  // viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(startPoint[0], startPoint[1], 10000000) })
  viewer.scene.preUpdate.addEventListener(function () {
    var offset = line.appearance.material.uniforms.offset
    offset += 0.005
    if (offset > 1.0) {
      offset = 0.0
    }
    line.appearance.material.uniforms.offset = offset
  })
}
/**
 * @desc 贝塞尔曲线
 * @param {Array} p1 起点坐标
 * @param {Array} p2 终点坐标
 */
const ceratBezierLine = (p1: number[], p2: number[]) => {
    const maxHeight = 300000
    const [x1, y1] = p1
    const [x2, y2] = p2
    const cp = [(x1 + x2) / 2, (y1 + y2) / 2, maxHeight]
    const positions = []
    for (let i = 0; i <= 1; i = i + 0.01) {
        let point = twoBezier(i, [p1, 0].flat(), cp, [p2, 0].flat())
        positions.push(point)
    }
    return positions.flat()
}
const twoBezier = (t: number, p1: number[], cp: number[], p2: number[]) => {
    const [x1, y1, z1] = p1
    const [cx, cy, cz] = cp
    const [x2, y2, z2] = p2
    let x = (1 - t) * (1 - t) * x1 + 2 * t * (1 - t) * cx + t * t * x2
    let y = (1 - t) * (1 - t) * y1 + 2 * t * (1 - t) * cy + t * t * y2
    let z = (1 - t) * (1 - t) * z1 + 2 * t * (1 - t) * cz + t * t * z2
    return [x, y, z]
}

const points = {
    start: { 北京: [116.391231, 39.857787] },
    end: {
        甘肃: [103.73, 36.03],
        青海: [101.74, 36.56],
        河北: [114.48, 38.03],
        云南: [102.73, 25.04],
        贵州: [106.71, 26.57],
        湖北: [114.31, 30.52],
        河南: [113.65, 34.76],
        山东: [117, 36.65],
        江苏: [118.78, 32.04],
        安徽: [117.27, 31.86],
        浙江: [120.19, 30.26],
        江西: [115.89, 28.68],
        福建: [119.3, 26.08],
        广东: [113.23, 23.16],
        湖南: [113, 28.21],
        海南: [110.35, 20.02],
        辽宁: [123.38, 41.8],
        吉林: [125.35, 43.88],
        黑龙江: [126.63, 45.75],
        山西: [112.53, 37.87],
        陕西: [108.95, 34.27],
        台湾: [121.3, 25.03],
        四川: [104.06, 30.67],
        上海: [121.48, 31.22],
        重庆: [106.54, 29.59],
        天津: [117.2, 39.13],
        内蒙古: [111.65, 40.82],
        广西: [108.33, 22.84],
        西藏: [91.11, 29.97],
        宁夏: [106.27, 38.47],
        新疆: [87.68, 43.77],
        香港: [114.17, 22.28],
        澳门: [113.54, 22.19],
    },
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(114.405, 26, 2000000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-60),
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