<template>
  <div :class="['menubox box1', showPanel ? '' : 'hide']">
    <div class="menuclose" @click="handleShowPanel">
      <el-icon size="20">
        <Close />
      </el-icon>
    </div>
    <div class="menucell">
      <div>
        <span>键盘控制模型移动：</span>
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
            @mousedown.prevent="handleDirection('up')"
            @touchstart.prevent="handleDirection('up')"
          >
            <el-icon size="28" :color="currentDirection === 'up' ? '#40feff' : ''"><Arrow-Up /></el-icon>
          </el-button>
        </div>
        <div class="direction-row">
          <el-button
            size="large"
            :class="{ active: activeDirection === 'left' }"
            @mousedown.prevent="handleDirection('left')"
            @touchstart.prevent="handleDirection('left')"
          >
            <el-icon size="28" :color="currentDirection === 'left' ? '#40feff' : ''"><Arrow-Left /></el-icon>
          </el-button>
          <el-button
            size="large"
            :class="{ active: activeDirection === 'down' }"
            @mousedown.prevent="handleDirection('down')"
            @touchstart.prevent="handleDirection('down')"
          >
            <el-icon size="28" :color="currentDirection === 'down' ? '#40feff' : ''"><Arrow-Down /></el-icon>
          </el-button>
          <el-button
            size="large"
            :class="{ active: activeDirection === 'right' }"
            @mousedown.prevent="handleDirection('right')"
            @touchstart.prevent="handleDirection('right')"
          >
            <el-icon size="28" :color="currentDirection === 'right' ? '#40feff' : ''"><Arrow-Right /></el-icon>
          </el-button>
        </div>
      </div>
      <div>操作说明：开启移动后模型自动前进，按 W A S D 或 ↑ ↓ ← → 键、或点击方向按钮，模型立即转向该方向持续移动</div>
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

let viewer: Cesium.Viewer;
const showPanel = ref(true);
const isAnimation = ref(false);
const multer = ref(1);
// 当前移动方向，模型持续朝该方向移动
const currentDirection = ref("up");
// 按钮按下的高亮方向
const activeDirection = ref("");

let modelEntity: Cesium.Entity | null = null;
let positionProperty: Cesium.ConstantPositionProperty | null = null;
let orientationProperty: Cesium.ConstantProperty | null = null;
let removeTickListener: (() => void) | null = null;
let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

// 模型当前位置（ECEF 笛卡尔坐标）
let currentPosition = Cesium.Cartesian3.fromDegrees(117.210698, 38.617627, 0);
// 上一帧时间，用于计算帧间隔 dt
let lastTickTime: Cesium.JulianDate | null = null;

// 移动速度：度/秒
const SPEED = 0.0001;

// 各方向对应的经纬度单位增量
const DIRECTION_VECTORS: Record<string, { dLon: number; dLat: number }> = {
  up: { dLon: 0, dLat: 1 },
  down: { dLon: 0, dLat: -1 },
  left: { dLon: -1, dLat: 0 },
  right: { dLon: 1, dLat: 0 },
};

// 根据移动方向计算模型朝向。
// Cesium 模型前方向为 +X，而 headingPitchRollQuaternion 中 heading 为 0 时
// 模型面朝正东，因此需在移动方向方位角的基础上减 π/2，
// 使模型面朝移动方向（与原 VelocityOrientationProperty 效果一致）。
const getHeading = (dLon: number, dLat: number, latitude: number) =>
  Math.atan2(dLon * Math.cos(latitude), dLat) - Cesium.Math.PI_OVER_TWO;

const keyToDirection = (key: string): string | null => {
  switch (key.toLowerCase()) {
    case "w":
    case "arrowup":
      return "up";
    case "s":
    case "arrowdown":
      return "down";
    case "a":
    case "arrowleft":
      return "left";
    case "d":
    case "arrowright":
      return "right";
    default:
      return null;
  }
};

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;

  const startTime = new Date().getTime();
  viewer.clock.startTime = Cesium.JulianDate.fromDate(new Date(startTime));
  viewer.clock.currentTime = viewer.clock.startTime.clone();
  viewer.clock.shouldAnimate = false;
  viewer.clock.multiplier = 1;

  reset();
  addModel();
  setupKeyboardListener();

  // 每帧根据当前方向直接更新模型位置：
  // 不再预生成未来路径点，按下方向键下一帧即转向，无延迟
  removeTickListener = viewer.clock.onTick.addEventListener(() => {
    const time = viewer.clock.currentTime;
    const dt = lastTickTime
      ? Cesium.JulianDate.secondsDifference(time, lastTickTime)
      : 0;
    lastTickTime = time.clone();

    // 时钟恢复后的第一帧 dt 异常大，跳过该帧
    if (
      !isAnimation.value ||
      !modelEntity ||
      !positionProperty ||
      !orientationProperty ||
      dt <= 0
    )
      return;

    // 页面卡顿/节流时 dt 可能很大，限制单帧步长防止瞬移
    const stepDt = Math.min(dt, 0.5);

    // 持续朝当前方向移动
    const dir = DIRECTION_VECTORS[currentDirection.value];
    const step = SPEED * multer.value * stepDt;
    const carto = Cesium.Cartographic.fromCartesian(currentPosition);
    currentPosition = Cesium.Cartesian3.fromRadians(
      carto.longitude + Cesium.Math.toRadians(dir.dLon * step),
      carto.latitude + Cesium.Math.toRadians(dir.dLat * step),
      0
    );
    positionProperty.setValue(currentPosition);

    // 朝向与移动方向一致
    orientationProperty.setValue(
      Cesium.Transforms.headingPitchRollQuaternion(
        currentPosition,
        new Cesium.HeadingPitchRoll(
          getHeading(dir.dLon, dir.dLat, carto.latitude),
          0,
          0
        )
      )
    );
  });
};

const addModel = () => {
  if (modelEntity) {
    viewer.entities.remove(modelEntity);
  }

  // 重置模型位置与状态，初始朝北（up）移动
  currentPosition = Cesium.Cartesian3.fromDegrees(117.210698, 38.617627, 0);
  lastTickTime = null;
  currentDirection.value = "up";
  activeDirection.value = "";

  positionProperty = new Cesium.ConstantPositionProperty(currentPosition);
  orientationProperty = new Cesium.ConstantProperty(
    Cesium.Transforms.headingPitchRollQuaternion(
      currentPosition,
      // heading -π/2 对应面朝正北
      new Cesium.HeadingPitchRoll(-Cesium.Math.PI_OVER_TWO, 0, 0)
    )
  );

  const model = viewer.entities.add({
    position: positionProperty,
    orientation: orientationProperty,
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
  modelEntity = model;
};

// 切换移动方向：下一帧立即生效
const handleDirection = (direction: string) => {
  if (!isAnimation.value) return;
  currentDirection.value = direction;
  activeDirection.value = direction;
  // 0.5 秒后恢复按钮状态
  setTimeout(() => {
    if (activeDirection.value === direction) {
      activeDirection.value = "";
    }
  }, 500);
};

const setupKeyboardListener = () => {
  keydownHandler = (event: KeyboardEvent) => {
    const direction = keyToDirection(event.key);
    if (!direction) return;
    event.preventDefault(); // 阻止方向键滚动页面
    if (event.repeat) return;
    handleDirection(direction);
  };
  document.addEventListener("keydown", keydownHandler);
};

const handleAnimationChange = (val: boolean) => {
  isAnimation.value = val;
  viewer.clock.shouldAnimate = val;
  if (!val) {
    activeDirection.value = "";
  } else if (!modelEntity) {
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
  if (removeTickListener) removeTickListener();
  if (keydownHandler) document.removeEventListener("keydown", keydownHandler);
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
