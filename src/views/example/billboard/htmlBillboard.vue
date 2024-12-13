<template>
    <div id="cesiumContainer" class="fullSize"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

const htmlOverList = [
    {
        id: '001',
        position: [116.39, 39.91, 0],
        innerHTML: `
            <div class="div-billboard1">
            <div class="div-billboard-title">我是一个div</div>
            </div>
            `,
        top: -94,
        left: -74
    },
    {
        id: '002',
        position: [116.39, 39.89, 10],
        innerHTML: `
            <div class="div-billboard2">
            <div class="div-billboard2-boder">
              <span class="div-billboard2-text">这是一个炫酷的效果</span>
            </div>
          </div>`,
        top: 0,
        left: -80
    },
    {
        id: '003',
        position: [116.40, 39.91, 0],
        innerHTML: `
            <div class="div-billboard3">
            <div class="div-billboard3-title">鼠标可穿透操作地图</div>
            </div>
            `,
        top: -134,
        left: 0,
        pointEvents: 'none'
    },
    {
        id: '004',
        position: [116.40, 39.89, 0],
        innerHTML: `
            <div class="div-billboard4">
            <div class="div-billboard4-title">鼠标可穿透</div>
            <div class="div-billboard4-body">在这里鼠标无法穿透</div>
            </div>
            `,
        top: -157,
        left: 0,
        pointEvents: 'none'
    },
    {
        id: '005',
        position: [116.42, 39.91, 0],
        innerHTML: `
            <div class="div-billboard5">
                <div class="div-billboard5-board">
                <h5>鼠标移动到这里会变色</h5>
                </div>
                <div class="div-billboard5-line"></div>
            </div>
            `,
        top: -20,
        left: 0,
        // pointEvents: 'none'
    },
    {
        id: '006',
        position: [116.42, 39.89, 0],
        innerHTML: `
            <div class="div-billboard6">
                <div class="div-billboard6-board">
                <h5>我是中国人</h5>
                </div>
                <div class="div-billboard6-line"></div>
            </div>
            `,
        top: -20,
        left: 0,
        pointEvents: 'none'
    }

];
// 更新 HTML 内容位置
const updateHtmlPosition = (htmlOverlay: HTMLElement, position: Cesium.Cartesian3) => {
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
const addBillboard = () => {
    htmlOverList.forEach(item => {
        const position = Cesium.Cartesian3.fromDegrees(item.position[0], item.position[1], item.position[2]);
        const htmlOverlay = document.createElement('div')
        htmlOverlay.innerHTML = item.innerHTML
        htmlOverlay.setAttribute('id', item.id)
        htmlOverlay.style.position = "absolute";
        htmlOverlay.style.marginTop = `${item.top}px`;
        htmlOverlay.style.marginLeft = `${item.left}px`;
        htmlOverlay.style.pointerEvents = item.pointEvents ?? 'aoto';
        viewer.cesiumWidget.container.appendChild(htmlOverlay)
        // 监听 postRender 事件
        viewer.scene.postRender.addEventListener(() => {
            updateHtmlPosition(htmlOverlay, position)
        });
    })
}
onMounted(() => {
    viewer = new Cesium.Viewer("cesiumContainer", {
    });
    addBillboard()
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