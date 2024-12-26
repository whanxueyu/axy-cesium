<script setup lang="ts">
import { onUnmounted, onMounted } from "vue";
import 'cesium/Source/Widgets/widgets.css';
import markList from '@/assets/images/marker/index'
import * as Cesium from "cesium";
import PrimitiveCluster from "@/modules/cesium/PrimitiveCluster.js";

let viewer: Cesium.Viewer;
let billboardsCollectionCombine: Cesium.BillboardCollection = new Cesium.BillboardCollection();

let primitivesCollection: Cesium.PrimitiveCollection;
let primitives: Cesium.Primitive | null = null;

const onCluster = () => {
  primitivesCollection = new Cesium.PrimitiveCollection();
  billboardsCollectionCombine = new Cesium.BillboardCollection();
  const primitivecluster = new PrimitiveCluster();
  primitivecluster.enabled = true;
  primitivecluster.pixelRange = 60;
  primitivecluster.minimumClusterSize = 2;

  for (let i = 0; i < 10000; i++) {
    const longitude = Math.random() * (110 - 90) + 90;
    const latitude = Math.random() * (40 - 30) + 30;
    billboardsCollectionCombine.add({
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 100),
      image: markList.LaceRed,
      width: 32,
      height: 32,
    });
  }
  viewer.scene.primitives.add(billboardsCollectionCombine)
  primitivecluster._billboardCollection = billboardsCollectionCombine;
  primitivecluster._initialize(viewer.scene);

  primitivesCollection.add(primitivecluster);
  primitives = viewer.scene.primitives.add(primitivesCollection);

  primitivecluster.clusterEvent.addEventListener(
    (clusteredEntities: Cesium.Entity[], cluster: any) => {
      // cluster.label.show = false;
      // cluster.billboard.show = true;
      // cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;

      // // 根据聚合数量的多少设置不同层级的图片以及大小
      // combineIconAndLabel(markList.M1, clusteredEntities.length, 64)
      //   .then(dataUrl => {
      //     cluster.billboard.image = dataUrl;
      //     cluster.billboard.width = 40;
      //     cluster.billboard.height = 40;
      //   })
      //   .catch(error => {
      //     console.error('Error combining icon and label:', error);
      //   });
    }
  );
};

async function combineIconAndLabel(url: string, label: number, size: number): Promise<string> {
  // 创建画布对象
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error('Could not get 2D context');
  }

  try {
    const resource = new Cesium.Resource({ url });
    const image = await resource.fetchImage();
    if (image)
      ctx.drawImage(image, 0, 0);
  } catch (e) {
    console.error('Failed to fetch or draw image:', e);
    throw e;
  }

  // 渲染字体
  ctx.fillStyle = Cesium.Color.BLACK.toCssColorString();
  ctx.font = "bold 20px Microsoft YaHei";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(label), size / 2, size / 2);

  return canvas.toDataURL(); // 将画布转换为 Data URL
}

const onClear = () => {
  primitives?.destroy();
  primitivesCollection.destroy();
  billboardsCollectionCombine.destroy();
  primitives = null;
  primitivesCollection = new Cesium.PrimitiveCollection();
  billboardsCollectionCombine = new Cesium.BillboardCollection();
};

onMounted(() => {
  viewer = new Cesium.Viewer("cesiumContainer", {
    // terrain: Cesium.Terrain.fromWorldTerrain(),
  });
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(120.36, 36.09, 40000),
  });
});

onUnmounted(() => {
  onClear();
});
</script>

<template>
  <div id="cesiumContainer" class="fullSize"></div>

  <div class="operation">
    <el-button type="primary" @click="onCluster">primitive打点聚合</el-button>
    <el-button type="primary" @click="onClear">清除打点</el-button>
  </div>
</template>

<style scoped>
.fullSize {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.operation {
  position: fixed;
  top: 20px;
  left: 20px;
  background-color: #fff;
  width: 200px;
}
</style>