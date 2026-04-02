<template>
  <div :class="['menubox box1', showPanel ? '' : 'hide']">
    <div class="menuclose" @click="handleShowPanel">
      <el-icon size="20">
        <Close />
      </el-icon>
    </div>
    <div class="el-tabs">
      <div class="modelList" dropzone="copy">
        <div
          class="model"
          draggable="true"
          v-for="model in modelList"
          @mousedown="selectModel(model)"
          @dragend="dragEnd"
          @dragstart="dragstart"
          @dragover="dragover"
        >
          <img
            class="icon"
            width="120px"
            height="80px"
            :src="model.icon"
            alt=""
          />
          <div class="name">{{ model.name }}</div>
        </div>
      </div>
    </div>
    <div class="menucell"></div>
    <div v-if="!showPanel" class="hideicon" @click="handleShowPanel">
      <el-icon size="30">
        <Grid />
      </el-icon>
    </div>
  </div>
  <Map @loaded="handleMapLoaded" :loadTerrain="false"></Map>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as Cesium from "cesium";
import { Grid, Close } from "@element-plus/icons-vue";
import Map from "@/components/cesium/map.vue";
var viewer: Cesium.Viewer;
const mapLoaded = ref(false);
const showPanel = ref(true);
const drawModel = ref(false);
const currentUrl = ref("");
const modelList = [
  {
    name: "Cesium_Man",
    url: "./models/Cesium_Man.glb",
    icon: "/models/Cesium_Man.png",
  },
  {
    name: "Breakdancer",
    url: "./models/animation/Breakdancer.glb",
    icon: "./models/animation/Breakdancer.png",
  },
  {
    name: "Curious skeleton",
    url: "./models/animation/Curious skeleton.glb",
    icon: "./models/animation/Curious skeleton.png",
  },
  {
    name: "Dancing troll",
    url: "./models/animation/Dancing troll.glb",
    icon: "./models/animation/Dancing troll.png",
  },
  {
    name: "Playful dog",
    url: "./models/animation/Playful dog.glb",
    icon: "./models/animation/Playful dog.png",
  },
  {
    name: "Rampaging T-Rex",
    url: "./models/animation/Rampaging T-Rex.glb",
    icon: "./models/animation/Rampaging T-Rex.png",
  },
];
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  let handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  viewer.clock.shouldAnimate = true;
  viewer.clock.multiplier = 1;
  // 右
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
      console.log(coordinate);
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );
  mapLoaded.value = true;

  reset();
};
const reset = () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.391257, 39.907204, 30),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
    duration: 1,
  });
};
const selectModel = (model: any) => {
  currentUrl.value = model.url;
};
const dragstart = (event: DragEvent) => {
  drawModel.value = true;
  if (event.dataTransfer && event.target instanceof HTMLElement) {
    event.dataTransfer.setData("drag_text", event.target?.innerHTML || "");
  }
};
const dragover = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
};
const dragEnd = (event: MouseEvent) => {
  //   console.log(event.x, event.y, "X");
  //   console.log(event.clientX, event.clientY, "client");
  //   console.log(event.pageX, event.pageY, "page");
  //   console.log(event.screenX, event.screenY, "screen");
  //   console.log(event.offsetX, event.offsetY, "offset");
  //   console.log(event.layerX, event.layerY, "layer");
  if (drawModel.value) {
    let ray = viewer.camera.getPickRay(new Cesium.Cartesian2(event.x, event.y));
    if (ray) {
      let cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      // 如果你想要的是Cesium的长度坐标（Cartesian3），可以直接使用转换后的世界坐标
      if (cartesian) {
        dragAddModel(cartesian);
      }
    }
  }
  drawModel.value = false;
};
const dragAddModel = async (cartesian: Cesium.Cartesian3) => {
  // 用于存储动画信息的变量
  let animations: any[] = [];

  // 创建模型矩阵
  const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    cartesian,
    viewer.scene.globe.ellipsoid
  );

  try {
    // 使用 Model.fromGltfAsync 加载模型，并通过 gltfCallback 获取动画数据
    const model = await Cesium.Model.fromGltfAsync({
      url: currentUrl.value,
      modelMatrix: modelMatrix,
      scale: 10.0,
      minimumPixelSize: 128, // 这个需要在添加到场景后设置
      gltfCallback: (gltf: any) => {
        animations = gltf.animations || [];
      },
      silhouetteColor: new Cesium.Color(0, 1, 0, 1.0),
      silhouetteSize: 2.0,
    });

    // 将模型添加到场景中
    viewer.scene.primitives.add(model);

    // 设置 minimumPixelSize（必须在添加到场景后）

    // 设置高度参考（必须在添加到场景后）
    // model.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;

    // 等待模型完全准备好（循环检查 model.ready）
    const maxWaitTime = 5000; // 最多等待 5 秒
    const interval = 100; // 每 100ms 检查一次
    let waitedTime = 0;

    while (!model.ready && waitedTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      waitedTime += interval;
    }

    if (!model.ready) {
      console.warn("模型加载超时，但继续执行");
    }
    console.log("模型已准备好:", model);
    console.log("模型属性:", {
      minimumPixelSize: model.minimumPixelSize,
      heightReference: model.heightReference,
      scale: model.scale,
    });

    // 打印模型动画信息
    console.log("===== 模型动画信息 =====");
    console.log("动画:", animations);

    if (animations && animations.length > 0) {
      console.log("\n--- 动画列表 ---");
      animations.forEach((animation: any, index: number) => {
        console.log(`\n动画 : ${animation}`);
        console.log(`\n动画 ${index + 1}:`);
        console.log("  - 名称:", animation.name || "未命名");
        console.log("  - 通道数量:", animation.channels?.length || 0);
        console.log("  - 采样器数量:", animation.samplers?.length || 0);
      });

      console.log("\n========================\n");
    } else {
      console.log("⚠️ 该模型没有包含任何动画");
      console.log("========================\n");
    }

    // 缩放到模型位置
    viewer.camera.flyTo({
      destination: model.boundingSphere.center,
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0,
      },
      duration: 1,
    });
  } catch (error: any) {
    console.error("加载模型失败:", error);
  }
};
const handleShowPanel = () => {
  showPanel.value = !showPanel.value;
};
onMounted(() => {});
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

    .demo-tabs {
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

  .demo-tabs {
    margin: 10px auto;
  }

  .modelList {
    width: 130px;
    display: flex;
    flex-wrap: nowrap;
    overflow-y: auto;
    height: 600px;
    margin-top: 30px;
    flex-direction: column;
    overflow-x: hidden;

    .model {
      width: 100px;
      height: 100px;
      border: 1px solid #00eeff33;
      margin: 10px;

      &:active {
        cursor: grab;
      }

      .icon {
        width: 80px;
        height: 60px;
        padding: 5px;
        transition: all 0.3s;
      }

      .name {
        // height: 40px;
        // line-height: 32px;
        text-align: center;
      }

      &:hover {
        background-color: #00eeff33;
        border: 1px solid #00eeff;

        .icon {
          width: 100px;
          height: 80px;
          padding: 0px;
          transition: all 0.3s;
        }
      }
    }
  }

  .tab-body {
    width: 250px;

    .text {
      line-height: 24px;
      text-indent: 24px;
      text-align: start;
    }
  }
}
</style>
