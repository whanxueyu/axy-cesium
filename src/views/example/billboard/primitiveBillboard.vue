<script setup>
import { onUnmounted, onMounted } from "vue";
import 'cesium/Source/Widgets/widgets.css';
import markList from '@/assets/images/marker/index'
import * as Cesium from "cesium";
import PrimitiveCluster from "@/modules/cesium/PrimitiveCluster.js";

let viewer;
let billboardsCollectionCombine = new Cesium.BillboardCollection();

let primitivesCollection;
let primitives = null;

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
    (clusteredEntities, cluster) => {
      console.log(clusteredEntities.length, cluster);
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

async function combineIconAndLabel(url, label, size) {
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
let primitivesCluster;
const addCluster = () => {
  // 使用primitives 添加点
  var labels = new Cesium.LabelCollection()
  var billboards = new Cesium.BillboardCollection()
  var collection = new Cesium.PrimitiveCollection()
  for (let i = 0; i < 10000; i++) {
    const longitude = Math.random() * (110 - 90) + 90;
    const latitude = Math.random() * (40 - 30) + 30;
    let title = {
      id: longitude,
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 10),
      text: i,
      font: "30px Source Han Sans CN", //字体样式
      fillColor: new Cesium.Color.fromCssColorString("#ffffff"), //字体颜色
      showBackground: true, //是否显示背景颜色
      backgroundColor: new Cesium.Color.fromCssColorString("#000000"), //背景颜色
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM, //垂直位置
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER, //水平位置
    }
    let img = {
      id: longitude,
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 10),
      image: markList.LaceRed,
      scale: 1,
      verticalOrigin: Cesium.VerticalOrigin.TOP, //垂直位置
    }
    // labels.add(title)
    billboards.add(img)
  }
  let primitivecluster = null
  primitivecluster = new PrimitiveCluster()
  primitivecluster.enabled = true
  primitivecluster.pixelRange = 1
  primitivecluster.minimumClusterSize = 10
  primitivecluster._billboardCollection = billboards
  // 同时在赋值时调用_initialize方法
  primitivecluster._initialize(viewer.scene)
  collection.add(primitivecluster)
  primitivesCluster = viewer.scene.primitives.add(collection)
  const pinBuilder = new Cesium.PinBuilder()
  primitivecluster.clusterEvent.addEventListener((clusteredEntities, cluster) => {
    // 关闭自带的显示聚合数量的标签
    cluster.label.show = false
    cluster.billboard.show = true
    cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM
    let pinImg = pinBuilder.fromText(cluster.label.text, Cesium.Color.RED, 60).toDataURL()
    // 根据聚合数量的多少设置不同层级的图片以及大小
    cluster.billboard.image = pinImg
  })
  return primitivecluster
}
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
    <el-button type="primary" @click="addCluster">primitive打点聚合</el-button>
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