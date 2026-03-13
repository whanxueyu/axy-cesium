<template>
  <div :class="['menubox box1', showPanel ? '' : 'hide']">
    <div class="menuclose" @click="handleShowPanel">
      <el-icon size="20">
        <Close />
      </el-icon>
    </div>
    <div class="menucell">
      <div>
        <span>模型移动控制：</span>
        <el-switch
          v-model="isAnimation"
          width="80"
          size="large"
          inline-prompt
          style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
          active-text="开启移动"
          inactive-text="停止移动"
          @change="handleAnimationChange"
        />
      </div>
      <div>
        <div class="flex row">
          <span style="width: 66px;">倍速：</span>
          <el-select
            v-model="multer"
            placeholder="请选择"
            @change="handleMulterChange"
          >
            <el-option label="暂停" :value="0"></el-option>
            <el-option label="1倍速" :value="1"></el-option>
            <el-option label="2倍速" :value="2"></el-option>
            <el-option label="4倍速" :value="4"></el-option>
          </el-select>
        </div>
        <div class="flex row">
        <el-button
          :type="isAdd ? 'info' : 'primary'"
          :disabled="isAnimation"
          @click="handleAddPoint"
          >添加路径点</el-button
        >
        <el-button type="danger" @click="clearPathPoint">清空路径点</el-button>
        </div>
        <div>路径点（{{ pathPositions.length }}）</div>
        <div>
          <el-table :data="pathPositions" style="width: 220px" height="300">
            <el-table-column prop="longitude" label="经度" />
            <el-table-column prop="latitude" label="纬度" />
          </el-table>
        </div>
      </div>
    </div>
    <div v-if="!showPanel" class="hideicon" @click="handleShowPanel">
      <el-icon size="30">
        <Grid />
      </el-icon>
    </div>
  </div>
  <Map :showStatusBar="true" @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as Cesium from "cesium";
import { Grid, Close } from "@element-plus/icons-vue";
import Map from "@/components/cesium/map.vue";
import PolylineTrailLinkMaterialProperty from "@/modules/cesium/PolylineTrailLinkMaterialProperty.ts";

var viewer: Cesium.Viewer;
const isAdd = ref<boolean>(false);
const mapLoaded = ref(false);
const showPanel = ref(true);
const modelEntity = ref<Cesium.Entity | null>(null);
const lineEntity = ref<Cesium.Entity | null>(null);
const isAnimation = ref(false);
const pathPositions = ref([
  { longitude: 117.21067, latitude: 38.619915, height: 0 },
  { longitude: 117.210677, latitude: 38.618953, height: 0 },
  { longitude: 117.209499, latitude: 38.618965, height: 0 },
  { longitude: 117.208264, latitude: 38.618938, height: 0 },
  { longitude: 117.2083, latitude: 38.618266, height: 0 },
  { longitude: 117.209325, latitude: 38.618252, height: 0 },
  { longitude: 117.210683, latitude: 38.618237, height: 0 },
  { longitude: 117.210688, latitude: 38.617351, height: 0 },
  { longitude: 117.212041, latitude: 38.617346, height: 0 },
  { longitude: 117.212037, latitude: 38.618272, height: 0 },
  { longitude: 117.213038, latitude: 38.618267, height: 0 },
  { longitude: 117.213043, latitude: 38.61897, height: 0 },
  { longitude: 117.211725, latitude: 38.618963, height: 0 },
  { longitude: 117.211706, latitude: 38.61994, height: 0 },
  { longitude: 117.21067, latitude: 38.619915, height: 0 },
]);

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  let handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  // Left click - log coordinates
  handler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      var cartesian = viewer.camera.pickEllipsoid(
        event.position,
        viewer.scene.globe.ellipsoid
      );
      if (!cartesian) return;
      let cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      let lng = Cesium.Math.toDegrees(cartographic.longitude); // 经度
      let lat = Cesium.Math.toDegrees(cartographic.latitude); // 纬度
      let coordinate = {
        longitude: Number(lng.toFixed(6)),
        latitude: Number(lat.toFixed(6)),
        height: Number(cartographic.height.toFixed(6)),
      };
      console.log("Coordinate:", coordinate);
      if (isAdd.value) {
        addPathPoint(coordinate);
        isAdd.value = false;
      }
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );
  mapLoaded.value = true;
  reset();
};

const addModel = () => {
  if (modelEntity.value) {
    viewer.entities.remove(modelEntity.value);
  }
  const positionProperty = new Cesium.SampledPositionProperty();
  pathPositions.value.forEach((item, index) => {
    let time = new Date().getTime() + index * 10000;
    if (index === 0) {
      viewer.clock.startTime = Cesium.JulianDate.fromDate(new Date(time));
    }
    if (index === pathPositions.value.length - 1) {
      viewer.clock.stopTime = Cesium.JulianDate.fromDate(new Date(time));
    }
    positionProperty.addSample(
      Cesium.JulianDate.fromDate(new Date(time)),
      Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude, item.height)
    );
  });

  let model = viewer.entities.add({
    position: positionProperty,
    orientation: new Cesium.VelocityOrientationProperty(positionProperty),
    name: "Cesium_Man",
    model: {
      scale: 16,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      uri: "./models/Cesium_Man.glb",
      clampAnimations: true,
    },
  });
  modelEntity.value = model;
};
const addLine = () => {
  if (lineEntity.value) {
    viewer.entities.remove(lineEntity.value);
  }
  let positions = pathPositions.value.map((item) => {
    return Cesium.Cartesian3.fromDegrees(
      item.longitude,
      item.latitude,
      item.height
    );
  });
  lineEntity.value = viewer.entities.add({
    polyline: {
      arcType: Cesium.ArcType.GEODESIC,
      positions: positions,
      clampToGround: true,
      width: 4,
      material: new PolylineTrailLinkMaterialProperty(
        "./textures/line-color-red.png",
        Cesium.Color.RED.withAlpha(0.8),
        pathPositions.value.length * 500,
        pathPositions.value.length
      ),
      shadows: Cesium.ShadowMode.DISABLED,
    },
  });
};
const pointAll = ref<Cesium.Entity[]>([]);
const addPoint = () => {
  if (pointAll.value.length > 0) {
    pointAll.value.forEach((point) => {
      viewer.entities.remove(point);
    });
    pointAll.value = [];
  }
  pathPositions.value.forEach((item, index) => {
    let point = viewer.entities.add({
      id: "point_" + index,
      position: Cesium.Cartesian3.fromDegrees(
        item.longitude,
        item.latitude,
        item.height
      ),
      point: {
        pixelSize: 10,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.RED,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
    pointAll.value.push(point);
  });
};
const handleAnimationChange = (val: boolean) => {
  viewer.clock.shouldAnimate = val;
  if (val) {
    if (!modelEntity.value) addModel();
    if (!lineEntity.value) addLine();
    if (pointAll.value.length < 1) addPoint();
  }
};
const handleMulterChange = (val: string) => {
  viewer.clock.multiplier = Number(val);
};
const multer = ref(1);

const handleAddPoint = () => {
  isAdd.value = !isAdd.value;
};
const clearPathPoint = () => {
  pathPositions.value = [];
  viewer.entities.removeAll();
  lineEntity.value = null;
  modelEntity.value = null;
  pointAll.value = [];
  //   isAdd.value = false;
};

// Add path point on right click
const addPathPoint = (coordinate: {
  longitude: number;
  latitude: number;
  height: number;
}) => {
  viewer.entities.removeAll();
  pathPositions.value.push({
    longitude: coordinate.longitude,
    latitude: coordinate.latitude,
    height: coordinate.height,
  });
};
const handleShowPanel = () => {
  showPanel.value = !showPanel.value;
};
const reset = () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(117.2105, 38.616, 320),
    orientation: {
      heading: Cesium.Math.toRadians(361),
      pitch: Cesium.Math.toRadians(-50),
      roll: 0.0,
    },
    duration: 1,
  });
};
onMounted(() => {
  addModel();
  addLine();
  addPoint();
});
</script>

<style scoped lang="scss">
.menubox {
  position: absolute;
  z-index: 999;
  border-bottom-right-radius: 10px;
  // padding: 0 10px 10px;
  border: 1px solid rgba(139, 139, 139, 0.2);
  background-color: #222222;
  color: #fff;
  user-select: none;
  transition: all 0.3s;

  .menuclose {
    position: absolute;
    right: 4px;
    top: 4px;
    cursor: pointer;
    color: #00eeff;

    &:hover {
      color: #ffffff;
    }
  }

  &.hide {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    padding: 0;
    background-color: #01a1fd;
    // border: 1px solid #00eeff;
    transition: all 0.3s;

    &:hover {
      box-shadow: 0 0 4px 1px #00eeff;
    }

    .el-tabs {
      display: none;
    }

    .menucell {
      display: none;
    }

    .menuclose {
      display: none;
    }

  }

  &.box1 {
    left: 5px;
    top: 65px;
  }

  .hideicon {
    width: 30px;
    height: 30px;
    padding: 5px;
    transition: all 0.3s;
  }

  .menucell {
    padding: 10px;
  }
}
.row{
    margin: 5px 0;
}
</style>
