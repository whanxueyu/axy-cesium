<template>
  <div class="operation">
    <span>随机生成点位</span>
    <el-input-number :min="1" v-model="pointNum" :step="100"></el-input-number>
    <el-button type="primary" @click="generatePoints">生成</el-button>
  </div>
  <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import * as Cesium from "cesium";
import markList from '@/assets/images/marker/index'
import 'cesium/Source/Widgets/widgets.css';
import PrimitiveCluster from "@/modules/cesium/PrimitiveCluster.js"
import Map from '@/components/cesium/map.vue'
const mapLoaded = ref(false)
var viewer;
const pointNum = ref(10000);

Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
// ***************************************************************************

let billboardsCollection;
let billboardsCollectionCombine = new Cesium.BillboardCollection();

let primitivesCollection = null;
let primitives = null;

const formatClusterPoint = (features) => {
  primitivesCollection = new Cesium.PrimitiveCollection();
  billboardsCollectionCombine = new Cesium.BillboardCollection();
  var scene = viewer.scene;
  let primitivecluster = null;
  primitivecluster = new PrimitiveCluster();

  //与entitycluster相同设置其是否聚合 以及最大最小值
  primitivecluster.enabled = true;
  primitivecluster.pixelRange = 60;
  primitivecluster.minimumClusterSize = 2;

  //后面设置聚合的距离及聚合后的图标颜色显示与官方案例一样
  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const coordinates = feature.geometry.coordinates;
    const position = Cesium.Cartesian3.fromDegrees(
      coordinates[0],
      coordinates[1],
      2000
    );

    // 带图片的点
    billboardsCollectionCombine.add({
      image: "/images/mark-icon.png",
      width: 32,
      height: 32,
      position,
    });
  }
  primitivecluster._billboardCollection = billboardsCollectionCombine;
  // 同时在赋值时调用_initialize方法
  primitivecluster._initialize(scene);

  primitivesCollection.add(primitivecluster);
  primitives = viewer.scene.primitives.add(primitivesCollection);

  primitivecluster.clusterEvent.addEventListener(
    (clusteredEntities, cluster) => {
      // 关闭自带的显示聚合数量的标签
      cluster.label.show = false;
      cluster.billboard.show = true;
      cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;

      // 根据聚合数量的多少设置不同层级的图片以及大小
      cluster.billboard.image = combineIconAndLabel(
        "/images/school-icon.png",
        clusteredEntities.length,
        64
      );
      // cluster.billboard.image = "/images/school-icon.png";
      cluster.billboard._imageHeight = 60;
      cluster.billboard._imageWidth = 60;
      cluster.billboard._dirty = false;
      cluster.billboard.width = 40;
      cluster.billboard.height = 40;
    }
  );
  return primitivecluster;
};
// ***************************************************************************
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
let primitivesCluster;
const addCluster = (data) => {
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
  primitivecluster = new PrimitiveCluster({
    enabled: true,
    pixelRange: 60,
    minimumClusterSize: 2,
    clusterBillboards: true,
    clusterPoints: true,
    clusterLabels: true,
  })
  // primitivecluster.enabled = true
  // primitivecluster.pixelRange = 1
  // primitivecluster.minimumClusterSize = 10
  primitivecluster._billboardCollection = billboards
  // 同时在赋值时调用_initialize方法
  primitivecluster._initialize(viewer.scene)
  collection.add(primitivecluster)
  primitivesCluster = viewer.scene.primitives.add(collection)
  const pinBuilder = new Cesium.PinBuilder()
  primitivecluster.clusterEvent.addEventListener((clusteredEntities, cluster) => {
    // 关闭自带的显示聚合数量的标签
    console.log(clusteredEntities, cluster)
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

const handleMapLoaded = (MapViewer) => {
    viewer = MapViewer;
    billboardsCollection = viewer.scene.primitives.add(
  new Cesium.BillboardCollection()
);
    // alert("当前cesium版本 1.124 版本过高，该聚合方法不可用，经测试可在 1.105 版本可用");
    mapLoaded.value = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(101.405, 36.5, 2500000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0,
        },
        duration: 1
    });
}

watch(pointNum, () => {
  generatePoints();
});
</script>
<style scoped>
.operation {
  position: fixed;
  top: 20px;
  left: 20px;
  background-color: #fff;
  width: 200px;
  z-index: 9999;
}
</style>
