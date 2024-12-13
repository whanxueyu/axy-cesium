<template>
    <div id="cesiumContainer" class="fullSize"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

const addBillboard = () => {
    const position = Cesium.Cartesian3.fromDegrees(116.4, 39.9, 50);
    const htmlOverlay = document.createElement('div')
    htmlOverlay.innerHTML = `
    <div class="div-billboard1">
    <div class="div-billboard-title">我是一个div</div>
    </div>
    `
    htmlOverlay.setAttribute('id', '001')
    htmlOverlay.style.position = "absolute";
    htmlOverlay.style.marginTop = "-94px";
    htmlOverlay.style.marginLeft = "-74px";
    viewer.cesiumWidget.container.appendChild(htmlOverlay)

    // 更新 HTML 内容位置
    const updateHtmlPosition = () => {
        if (!viewer || !htmlOverlay) return;
        const windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
        if (windowPosition) {
            htmlOverlay.style.left = `${windowPosition.x}px`;
            htmlOverlay.style.top = `${windowPosition.y}px`;
        }
        const camerPosition = viewer.camera.position;
        let height =
            viewer.scene.globe.ellipsoid.cartesianToCartographic(
                camerPosition
            ).height;
        height += viewer.scene.globe.ellipsoid.maximumRadius;
        if (
            !(Cesium.Cartesian3.distance(camerPosition, position) > height)
        ) {
            htmlOverlay.style.display = "block";
        } else {
            htmlOverlay.style.display = "none";
        }
    };

    // 监听 postRender 事件
    viewer.scene.postRender.addEventListener(updateHtmlPosition);
}
const addBillboard2 = () => {
    const position = Cesium.Cartesian3.fromDegrees(116.4, 39.8, 50);
    const htmlOverlay = document.createElement('div')
    htmlOverlay.innerHTML = `
  <div class="div-billboard2">
     <div class="div-billboard2-boder">
       <span class="div-billboard2-text">这是一个炫酷的效果</span>
     </div>
  </div>`
    htmlOverlay.setAttribute('id', '002')
    htmlOverlay.style.position = "absolute";
    htmlOverlay.style.marginLeft = "-80px";
    viewer.cesiumWidget.container.appendChild(htmlOverlay)

    // 更新 HTML 内容位置
    const updateHtmlPosition = () => {
        if (!viewer || !htmlOverlay) return;
        const windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
        if (windowPosition) {
            htmlOverlay.style.left = `${windowPosition.x}px`;
            htmlOverlay.style.top = `${windowPosition.y}px`;
        }
        const camerPosition = viewer.camera.position;
        let height =
            viewer.scene.globe.ellipsoid.cartesianToCartographic(
                camerPosition
            ).height;
        height += viewer.scene.globe.ellipsoid.maximumRadius;
        if (
            !(Cesium.Cartesian3.distance(camerPosition, position) > height)
        ) {
            htmlOverlay.style.display = "block";
        } else {
            htmlOverlay.style.display = "none";
        }
    };

    // 监听 postRender 事件
    viewer.scene.postRender.addEventListener(updateHtmlPosition);
}
onMounted(() => {
    viewer = new Cesium.Viewer("cesiumContainer", {
    });
    addBillboard()
    addBillboard2()
    viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(116.41, 39.88, 2000), 2000))
});
</script>

<style scoped>
.fullSize {
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
}
</style>