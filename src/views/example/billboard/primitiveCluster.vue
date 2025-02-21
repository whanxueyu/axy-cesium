<template>
  <div id="cesiumContainer" class="fullSize"></div>
  <div class="operation">
    <span>随机生成点位</span>
    <el-input-number :min="1" v-model="pointNum" :step="100"></el-input-number>
    <el-button type="primary" @click="generatePoints">生成</el-button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import * as Cesium from "cesium";
import markList from '@/assets/images/marker/index'
import 'cesium/Source/Widgets/widgets.css';
import PrimitiveCluster from "@/modules/cesium/PrimitiveCluster.js"

var viewer: Cesium.Viewer;
var billboards: Cesium.BillboardCollection;
const pointNum = ref(10000);
const pixelRange = 40; // 聚合范围（像素）

Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

const createBillboards = () => {
  let data = [];
  for (let i = 0; i < pointNum.value; i++) {
    const longitude = Math.random() * (110 - 90) + 90;
    const latitude = Math.random() * (40 - 30) + 30;
    data.push({
      longitude,
      latitude,
      id: i + '-pb',
      name: 'poi' + i
    });
  }
  addCluster(data);
};
let primitivesCluster: any;
const addCluster = (data: {
  longitude: number;
  latitude: number;
  id: string,
  name?: string
}[]) => {
  // 使用primitives 添加点
  var labels = new Cesium.LabelCollection()
  var billboards = new Cesium.BillboardCollection()
  var collection = new Cesium.PrimitiveCollection()

  data.forEach(ele => {
    let center = {
      lng: ele.longitude,
      lat: ele.latitude,
    }
    let title = {
      id: ele.id,
      position: Cesium.Cartesian3.fromDegrees(Number(center.lng), Number(center.lat), 0),
      text: ele.name ?? ele.id,
      font: "30px Source Han Sans CN", //字体样式
      fillColor: Cesium.Color.fromCssColorString("#ffffff"), //字体颜色
      showBackground: true, //是否显示背景颜色
      backgroundColor: Cesium.Color.fromCssColorString("#000000"), //背景颜色
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM, //垂直位置
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER, //水平位置
    }
    let img = {
      id: ele.id,
      position: Cesium.Cartesian3.fromDegrees(Number(center.lng), Number(center.lat), 80),
      image: markList.LaceRed,
      scale: 1,
      verticalOrigin: Cesium.VerticalOrigin.TOP, //垂直位置
    }
    labels.add(title)
    billboards.add(img)
  })
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

const generatePoints = () => {
  viewer.scene.primitives.removeAll();
  createBillboards();
};

onMounted(() => {
  viewer = new Cesium.Viewer("cesiumContainer", {
    // terrain: Cesium.Terrain.fromWorldTerrain(),
  });
  alert("当前cesium版本 1.124 版本过高，该聚合方法不可用，经测试可在 1.105 版本可用");
});

watch(pointNum, () => {
  generatePoints();
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

.operation {
  position: fixed;
  top: 20px;
  left: 20px;
  background-color: #fff;
  width: 200px;
}
</style>
