<template>
  <div class="side-panel">
    <el-tree
      node-key="id"
      ref="treeRef"
      :data="dataList"
      :props="defaultProps"
      show-checkbox
      :default-checked-keys="checkList"
      @check-change="checkListChange"
      default-expand-all
    >
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
  </div>
  <Map @loaded="handleMapLoaded" :loadTerrain="false"></Map>
</template>

<script setup lang="ts">
import { Location } from "@element-plus/icons-vue";
import { ref } from "vue";
import * as Cesium from "cesium";
import "cesium/Source/Widgets/widgets.css";
import iconList from "@/assets/images/icon";
import Map from "@/components/cesium/map.vue";
const defaultProps = {
  children: "children",
  label: "name",
};
const mapLoaded = ref(false);
var viewer: Cesium.Viewer;
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const dataList = [
  {
    id: "10",
    name: "高度跳动",
    image: iconList.MapTitleB,
  },
  {
    id: "11",
    name: "偏移跳动",
    image: iconList.MapTitleB,
  },
  {
    id: "111",
    name: "html",
  },
];
let htmlobj = {
  id: "111",
  name: "html",
  position: [116.405, 39.9, 0],
  innerHTML: `
        <div class="bounce-html">
        <div class="bounce-html-title">一个div</div>
        </div>
        `,
  top: -80,
  left: -80,
};
const checkListChange = (value: { [key: string]: any }, check: boolean) => {
  const entity = viewer?.entities?.getById(value.id);
  if (entity) {
    entity.show = check;
  }
};
const location = (item: { [key: string]: any }) => {
  const entity = viewer?.entities?.getById(item.id);
  if (entity) {
    viewer.zoomTo(entity);
  }
};
const checkList = ref<string[]>();
checkList.value = dataList.map((item) => item.id);

const defaultStyle = {
  baseHeight: 5,
  bounceHeight: 10,
  increment: 0.05,
};
var tempHeight = defaultStyle.baseHeight;
var flag = true;
const addBounceBillboard = () => {
  let positionCallbackProperty = new Cesium.CallbackPositionProperty(() => {
    if (flag) {
      tempHeight += defaultStyle.increment;
      if (tempHeight > defaultStyle.baseHeight + defaultStyle.bounceHeight) {
        flag = false;
      }
    } else {
      tempHeight -= defaultStyle.increment;
      if (tempHeight < defaultStyle.baseHeight - defaultStyle.bounceHeight) {
        flag = true;
      }
    }
    return Cesium.Cartesian3.fromDegrees(116.4, 39.9, tempHeight);
  }, false);
  viewer.entities.add({
    id: "10",
    position: positionCallbackProperty,
    billboard: {
      image: iconList.MapTitleB,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(0, 0),
    },
    label: {
      text: "高度跳动",
      font: "20px sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(0, -30),
    },
  });
};
const addBounceBillboard1 = () => {
  viewer.entities.add({
    id: "11",
    position: Cesium.Cartesian3.fromDegrees(116.41, 39.9, 5),
    billboard: {
      image: iconList.MapTitleB,
      pixelOffset: new Cesium.CallbackProperty(() => {
        if (flag) {
          tempHeight += defaultStyle.increment;
          if (
            tempHeight >
            defaultStyle.baseHeight + defaultStyle.bounceHeight
          ) {
            flag = false;
          }
        } else {
          tempHeight -= defaultStyle.increment;
          if (
            tempHeight <
            defaultStyle.baseHeight - defaultStyle.bounceHeight
          ) {
            flag = true;
          }
        }
        return new Cesium.Cartesian2(0, tempHeight);
      }, false),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
    },
    label: {
      text: "偏移跳动",
      font: "20px sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.CallbackProperty(() => {
        if (flag) {
          tempHeight += defaultStyle.increment;
          if (
            tempHeight >
            defaultStyle.baseHeight + defaultStyle.bounceHeight
          ) {
            flag = false;
          }
        } else {
          tempHeight -= defaultStyle.increment;
          if (
            tempHeight <
            defaultStyle.baseHeight - defaultStyle.bounceHeight
          ) {
            flag = true;
          }
        }
        return new Cesium.Cartesian2(0, tempHeight - 30);
      }, false),
    },
  });
};
const updateHtmlPosition = (
  htmlOverlay: HTMLElement,
  position: Cesium.Cartesian3
) => {
  if (!viewer || !htmlOverlay) return;
  const windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
    viewer.scene,
    position
  );
  if (windowPosition) {
    htmlOverlay.style.left = `${windowPosition.x}px`;
    htmlOverlay.style.top = `${windowPosition.y}px`;
  }
  const camerPosition = viewer.camera.position;
  let height =
    viewer.scene.globe.ellipsoid.cartesianToCartographic(camerPosition).height;
  height += viewer.scene.globe.ellipsoid.maximumRadius;
  if (!(Cesium.Cartesian3.distance(camerPosition, position) > height)) {
    htmlOverlay.style.display = "block";
  } else {
    htmlOverlay.style.display = "none";
  }
};
const addBounceBillboard2 = () => {
  const position = Cesium.Cartesian3.fromDegrees(
    htmlobj.position[0],
    htmlobj.position[1],
    htmlobj.position[2]
  );
  const htmlOverlay = document.createElement("div");
  htmlOverlay.innerHTML = htmlobj.innerHTML;
  htmlOverlay.setAttribute("id", htmlobj.id);
  htmlOverlay.style.position = "absolute";
  htmlOverlay.style.marginTop = `${htmlobj.top}px`;
  htmlOverlay.style.marginLeft = `${htmlobj.left}px`;
  htmlOverlay.style.pointerEvents = "none";
  viewer.cesiumWidget.container.appendChild(htmlOverlay);
  // 监听 postRender 事件
  viewer.scene.postRender.addEventListener(() => {
    updateHtmlPosition(htmlOverlay, position);
  });
};
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  addBounceBillboard();
  addBounceBillboard1();
  addBounceBillboard2();
  mapLoaded.value = true;
  reset();
};
const reset = () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.405, 39.875, 2500),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-40),
      roll: 0.0,
    },
    duration: 1,
  });
};
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
