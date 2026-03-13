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
      <!-- <div>
        <div class="flex row">
          <span style="width: 66px">倍速：</span>
          <el-select
            v-model="multer"
            placeholder="请选择"
            @change="handleMulterChange"
          >
            <el-option label="暂停" :value="0"></el-option>
            <el-option label="1 倍速" :value="1"></el-option>
            <el-option label="2 倍速" :value="2"></el-option>
            <el-option label="4 倍速" :value="4"></el-option>
          </el-select>
        </div>
      </div> -->
      <div class="direction-control">
        <div class="direction-row">
          <el-button
            size="large"
            :class="{ active: activeDirection === 'up' }"
            @mousedown="handleDirection('up')"
            @touchstart.prevent="handleDirection('up')"
          >
            <el-icon size="28" :color="currentDirection === 'up' ? '#40feff' : ''"><Arrow-Up /></el-icon>
          </el-button>
        </div>
        <div class="direction-row">
          <el-button
            size="large"
            :class="{ active: activeDirection === 'left' }"
            @mousedown="handleDirection('left')"
            @touchstart.prevent="handleDirection('left')"
          >
            <el-icon size="28" :color="currentDirection === 'left' ? '#40feff' : ''"><Arrow-Left /></el-icon>
          </el-button>
          <el-button
            size="large"
            :class="{ active: activeDirection === 'down' }"
            @mousedown="handleDirection('down')"
            @touchstart.prevent="handleDirection('down')"
          >
            <el-icon size="28" :color="currentDirection === 'down' ? '#40feff' : ''"><Arrow-Down /></el-icon>
          </el-button>
          <el-button
            size="large"
            :class="{ active: activeDirection === 'right' }"
            @mousedown="handleDirection('right')"
            @touchstart.prevent="handleDirection('right')"
          >
            <el-icon size="28" :color="currentDirection === 'right' ? '#40feff' : ''"><Arrow-Right /></el-icon>
          </el-button>
        </div>
      </div>
      <div>操作说明：使用 W A S D 或 ↑ ↓ ← → 控制模型移动</div>
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
import { ref, onUnmounted } from "vue";
import * as Cesium from "cesium";
import {
  Grid,
  Close,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "@element-plus/icons-vue";
import Map from "@/components/cesium/map.vue";

var viewer: Cesium.Viewer;
const showPanel = ref(true);
const modelEntity = ref<Cesium.Entity | null>(null);
const isAnimation = ref(false);
const multer = ref(1);
let keyboardHandler: any = null;
let positionProperty: Cesium.SampledPositionProperty | null = null;
let currentDirection = ref("up");
const activeDirection = ref("");
let lastLongitude = 117.210698;
let lastLatitude = 38.617627;
let lastHeight = 0;
let nextTime: Cesium.JulianDate | null = null;
let hasPendingPoint = false;

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;

  const startTime = new Date().getTime();
  viewer.clock.startTime = Cesium.JulianDate.fromDate(new Date(startTime));
  viewer.clock.stopTime = Cesium.JulianDate.fromDate(
    new Date(startTime + 3600000)
  );
  viewer.clock.currentTime = viewer.clock.startTime.clone();
  viewer.clock.shouldAnimate = false;
  viewer.clock.multiplier = 1;

  reset();
  addModel();
  setupKeyboardListener();

  // 监听时钟跳动，持续添加新坐标点
  viewer.clock.onTick.addEventListener(() => {
    if (!isAnimation.value || !positionProperty || !nextTime || hasPendingPoint)
      return;

    const currentTime = viewer.clock.currentTime;
    const timeDiff = Cesium.JulianDate.secondsDifference(nextTime, currentTime);

    // 当未来的路径点只剩 1 秒时，添加下一个点
    if (timeDiff <= 1) {
      const speed = 0.0001 * (multer.value === 0 ? 1 : multer.value);
      let newLongitude = lastLongitude;
      let newLatitude = lastLatitude;

      // 根据当前方向计算新位置
      switch (currentDirection.value) {
        case "up":
          newLatitude += speed;
          break;
        case "down":
          newLatitude -= speed;
          break;
        case "left":
          newLongitude -= speed;
          break;
        case "right":
          newLongitude += speed;
          break;
      }

      // 下一秒的时间点
      const futureTime = Cesium.JulianDate.addSeconds(
        nextTime,
        1,
        new Cesium.JulianDate()
      );
      const futurePos = Cesium.Cartesian3.fromDegrees(
        newLongitude,
        newLatitude,
        lastHeight
      );
      positionProperty.addSample(futureTime, futurePos);

      lastLongitude = newLongitude;
      lastLatitude = newLatitude;
      nextTime = futureTime;
      hasPendingPoint = true;

      // 0.5 秒后允许继续添加
      setTimeout(() => {
        hasPendingPoint = false;
      }, 500);
    }
  });
};

const addModel = () => {
  if (modelEntity.value) {
    viewer.entities.remove(modelEntity.value);
  }

  positionProperty = new Cesium.SampledPositionProperty();

  // 初始化：添加当前时刻的起始点
  const currentTime = viewer.clock.currentTime;
  const initialPos = Cesium.Cartesian3.fromDegrees(
    lastLongitude,
    lastLatitude,
    lastHeight
  );
  positionProperty.addSample(currentTime, initialPos);

  // 预先添加未来 3 秒的点，保证模型不会消失
  nextTime = currentTime.clone();
  for (let i = 1; i <= 3; i++) {
    nextTime = Cesium.JulianDate.addSeconds(
      nextTime,
      1,
      new Cesium.JulianDate()
    );
    const lat = lastLatitude + i * 0.0001;
    const pos = Cesium.Cartesian3.fromDegrees(lastLongitude, lat, lastHeight);
    positionProperty.addSample(nextTime, pos);
  }
  lastLatitude = lastLatitude + 3 * 0.0001;

  let model = viewer.entities.add({
    position: positionProperty,
    orientation: new Cesium.VelocityOrientationProperty(positionProperty),
    name: "Cesium_Man",
    model: {
      scale: 16,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      uri: "./models/Cesium_Man.glb",
      clampAnimations: true,
      color: Cesium.Color.RED,
      colorBlendMode: Cesium.ColorBlendMode.MIX,
      colorBlendAmount: 0.5,
      silhouetteColor: new Cesium.Color(0, 1, 0, 1.0),
      silhouetteSize: 2.0,
    },
  });
  modelEntity.value = model;
};
const handleDirection = (direction: string) => {
  if (
    !modelEntity.value ||
    !isAnimation.value ||
    !positionProperty ||
    !nextTime
  )
    return;

  const speed = 0.0001 * (multer.value === 0 ? 1 : multer.value);
  let newLongitude = lastLongitude;
  let newLatitude = lastLatitude;

  switch (direction) {
    case "up":
      newLatitude += speed;
      activeDirection.value = "up";
      break;
    case "down":
      newLatitude -= speed;
      activeDirection.value = "down";
      break;
    case "left":
      newLongitude -= speed;
      activeDirection.value = "left";
      break;
    case "right":
      newLongitude += speed;
      activeDirection.value = "right";
      break;
  }

  // 计算下一秒的时间点
  const futureTime = Cesium.JulianDate.addSeconds(
    nextTime,
    1,
    new Cesium.JulianDate()
  );

  // 添加下一秒的位置到路径中
  const futurePos = Cesium.Cartesian3.fromDegrees(
    newLongitude,
    newLatitude,
    lastHeight
  );
  positionProperty.addSample(futureTime, futurePos);

  // 更新状态
  lastLongitude = newLongitude;
  lastLatitude = newLatitude;
  nextTime = futureTime;
  hasPendingPoint = true;
  currentDirection.value = direction;
  // 0.5 秒后恢复按钮状态
  setTimeout(() => {
    activeDirection.value = "";
    hasPendingPoint = false;
  }, 500);
};

const setupKeyboardListener = () => {
  keyboardHandler = (event: KeyboardEvent) => {
    if (
      !modelEntity.value ||
      !isAnimation.value ||
      !positionProperty ||
      !nextTime
    )
      return;

    const speed = 0.0001 * (multer.value === 0 ? 1 : multer.value);
    let newLongitude = lastLongitude;
    let newLatitude = lastLatitude;
    let direction = "";

    switch (event.key.toLowerCase()) {
      case "w":
      case "arrowup":
        newLatitude += speed;
        direction = "up";
        break;
      case "s":
      case "arrowdown":
        newLatitude -= speed;
        direction = "down";
        break;
      case "a":
      case "arrowleft":
        newLongitude -= speed;
        direction = "left";
        break;
      case "d":
      case "arrowright":
        newLongitude += speed;
        direction = "right";
        break;
      default:
        return;
    }

    currentDirection.value = direction;
    activeDirection.value = direction;

    // 计算下一秒的时间点
    const futureTime = Cesium.JulianDate.addSeconds(
      nextTime,
      1,
      new Cesium.JulianDate()
    );

    // 添加下一秒的位置到路径中
    const futurePos = Cesium.Cartesian3.fromDegrees(
      newLongitude,
      newLatitude,
      lastHeight
    );
    positionProperty.addSample(futureTime, futurePos);

    // 更新状态
    lastLongitude = newLongitude;
    lastLatitude = newLatitude;
    nextTime = futureTime;
    hasPendingPoint = true;

    // 0.5 秒后恢复按钮状态
    setTimeout(() => {
      activeDirection.value = "";
      hasPendingPoint = false;
    }, 500);
  };

  document.addEventListener("keydown", keyboardHandler);
};

const handleAnimationChange = (val: boolean) => {
  viewer.clock.shouldAnimate = val;
  isAnimation.value = val;
  if (val && !modelEntity.value) {
    addModel();
  }
};

// const handleMulterChange = (val: string) => {
//   viewer.clock.multiplier = Number(val);
// };

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

onUnmounted(() => {
  if (keyboardHandler) {
    document.removeEventListener("keydown", keyboardHandler);
  }
});
</script>

<style scoped lang="scss">
.menubox {
  position: absolute;
  z-index: 999;
  border-bottom-right-radius: 10px;
  // padding: 0 10px 10px;
  border: 1px solid rgba(139, 139, 139, 0.2);
  background-color: #e6e6e6;
  color: #2e2e2e;
  user-select: none;
  transition: all 0.3s;

  .menuclose {
    position: absolute;
    right: 4px;
    top: 4px;
    cursor: pointer;
    color: #006269;

    &:hover {
      color: #00ccb1;
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
.row {
  margin: 5px 0;
}

.direction-control {
  margin: 15px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;

  .direction-row {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .el-button {
    width: 60px;
    height: 60px;
    transition: all 0.1s ease;
    box-shadow: 5px 2px 2px 4px #ccc;
    outline: none;
    &:focus-visible{
    outline: none;
    }


    &:hover {
      box-shadow: 5px 2px 2px 4px #0d86ff6b;
    }

    &.active {
      background-color: #dddddd;
      border-color: #d6d4d4;
      color: white;
      transform: scale(0.97);
      box-shadow: 3px 1px 2px 4px #ccc;
    }

  }
}
</style>
