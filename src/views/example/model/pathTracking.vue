<template>
    <div :class="['menubox box1', showPanel ? '' : 'hide']">
        <div class="menuclose" @click="handleShowPanel">
            <el-icon size="20">
                <Close />
            </el-icon>
        </div>
        <div class="el-tabs">
            <div class="modelList" dropzone="copy">
                <div class="model" draggable="true" v-for="model in modelList" @mousedown="selectModel(model)"
                    @dragend="dragEnd" @dragstart="dragstart" @dragover="dragover">
                    <img class="icon" width="120px" height="80px" :src="model.icon" alt="">
                    <div class="name">{{ model.name }}</div>
                </div>
            </div>
        </div>
        <div class="menucell">
            <div class="control-panel" v-if="selectedModel">
                <h3>路径跟踪控制</h3>
                <el-button type="primary" @click="startPathTracking" :disabled="!selectedModel || isMoving">
                    {{ isMoving ? '移动中...' : '开始路径跟踪' }}
                </el-button>
                <el-button @click="stopPathTracking" :disabled="!isMoving">
                    停止
                </el-button>
                <el-button @click="resetPath" :disabled="!modelEntity">
                    重置
                </el-button>
                <div class="speed-control">
                    <label>速度 (m/s): {{ speed }}</label>
                    <el-slider v-model="speed" :min="1" :max="100" :step="1"></el-slider>
                </div>
            </div>
        </div>
        <div v-if="!showPanel" class="hideicon" @click="handleShowPanel">
            <el-icon size="30">
                <Grid />
            </el-icon>
        </div>
    </div>
    <Map :animation="true" :timeline="true":showStatusBar="false" @loaded="handleMapLoaded"></Map>
    <div class="path-visualization" v-if="showPath">
        <div class="path-info">当前路径点数：{{ pathPositions.length }}</div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import { Grid, Close } from '@element-plus/icons-vue'
import Map from '@/components/cesium/map.vue'
var viewer: Cesium.Viewer;
const mapLoaded = ref(false)
const showPanel = ref(true)
const drawModel = ref(false)
const currentUrl = ref('')
const selectedModel = ref<any>(null)
const modelEntity = ref<Cesium.Entity | null>(null)
const isMoving = ref(false)
const speed = ref(50)
const pathPositions = ref<Cesium.Cartesian3[]>([])
const showPath = ref(false)
let movingEntity: Cesium.Entity | null = null
let pathProperty: Cesium.SampledPositionProperty | null = null
const modelList = [

    {
        name: '士兵',
        url: './models/士兵.glb',
        icon: '/models/士兵.png'
    },
    {
        name: 'Cesium_Man',
        url: './models/Cesium_Man.glb',
        icon: '/models/Cesium_Man.png'
    },
    {
        name: '警车',
        url: './models/警车.glb',
        icon: './models/警车.png'
    },
    {
        name: '救护车',
        url: './models/救护车.glb',
        icon: './models/救护车.png'
    },
    {
        name: '猛士车',
        url: './models/猛士车.glb',
        icon: '/models/猛士车.png'
    },
    {
        name: '水炮车',
        url: './models/水炮车.glb',
        icon: './models/水炮车.png'
    },
    {
        name: '武警巡逻车',
        url: './models/武警巡逻车.glb',
        icon: './models/武警巡逻车.png'
    }, {
        name: 'SK_BIAOZHI_508_black',
        url: './models/SK_BIAOZHI_508_black.glb',
        icon: './models/武警巡逻车.png'
    },
    {
        name: '火警车',
        url: './models/Fire_Truck.glb',
        icon: './models/Fire_Truck.png'
    },
    {
        name: '无人机-3轴',
        url: './models/hovering_drone.glb',
        icon: './models/hovering_drone.png'
    },
    {
        name: '无人机-4轴',
        url: './models/flying_drone.glb',
        icon: './models/flying_drone.png'
    },
]
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    let handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // Left click - log coordinates
    handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        var cartesian = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid);
        if (!cartesian) return;
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        let lng = Cesium.Math.toDegrees(cartographic.longitude); // 经度
        let lat = Cesium.Math.toDegrees(cartographic.latitude); // 纬度
        let coordinate = {
            longitude: Number(lng.toFixed(6)),
            latitude: Number(lat.toFixed(6)),
            height: Number(cartographic.height.toFixed(6)),
        };
        console.log('Coordinate:', coordinate);

    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    // Right click - add path point
    handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        var cartesian = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid);
        if (!cartesian || !modelEntity.value) return;
        addPathPoint(cartesian);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    
    mapLoaded.value = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.391257, 39.907204, 300),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0,
        },
        duration: 1
    });
}
const selectModel = (model: any) => {
    currentUrl.value = model.url;
    selectedModel.value = model;
}
const dragstart = (event: DragEvent) => {
    drawModel.value = true
    if (event.dataTransfer && event.target instanceof HTMLElement) {
        event.dataTransfer.setData('drag_text', event.target?.innerHTML || '');
    }
}
const dragover = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
    }
}
const dragEnd = (event: MouseEvent) => {
    console.log(event.x, event.y, "X")
    console.log(event.clientX, event.clientY, "client")
    console.log(event.pageX, event.pageY, "page")
    console.log(event.screenX, event.screenY, "screen")
    console.log(event.offsetX, event.offsetY, "offset")
    console.log(event.layerX, event.layerY, "layer")
    if (drawModel.value) {
        let ray = viewer.camera.getPickRay(new Cesium.Cartesian2(event.x, event.y));
        if (ray) {
            let cartesian = viewer.scene.globe.pick(ray, viewer.scene);
            // 如果你想要的是Cesium的长度坐标（Cartesian3），可以直接使用转换后的世界坐标
            if (cartesian) {
                dragAddModel(cartesian)
            }
        }
    }
    drawModel.value = false
}
const dragAddModel = (cartesian: Cesium.Cartesian3) => {
    // Remove previous model entity if exists
    if (modelEntity.value) {
        viewer.entities.remove(modelEntity.value);
    }
    
    let model = viewer.entities.add({
        position: new Cesium.ConstantPositionProperty(cartesian),
        orientation: Cesium.Transforms.headingPitchRollQuaternion(
            cartesian,
            Cesium.HeadingPitchRoll.fromDegrees(0, 0, 0)
        ),
        name: '模型',
        model: {
            scale: 10,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            uri: currentUrl.value,
        },
    })
    modelEntity.value = model;
    
    // Store the initial position as the first path point
    pathPositions.value = [cartesian];
    showPath.value = true;
    
    viewer.zoomTo(model).then((res) => {
        console.log('zoomto', res)
    })
}

// Path tracking functions
const startPathTracking = () => {
    if (!modelEntity.value || pathPositions.value.length < 2) return;
    
    isMoving.value = true;
    
    // Create a sample path with time
    pathProperty = new Cesium.SampledPositionProperty();
    const startTime = viewer.clock.currentTime.clone();
    
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < pathPositions.value.length - 1; i++) {
        totalDistance += Cesium.Cartesian3.distance(pathPositions.value[i], pathPositions.value[i + 1]);
    }
    
    // Calculate time for each point based on speed
    let currentTime = startTime.clone();
    pathPositions.value.forEach((position, index) => {
        if (index > 0) {
            const distance = Cesium.Cartesian3.distance(pathPositions.value[index - 1], position);
            const timeInterval = distance / speed.value; // time in seconds
            currentTime = Cesium.JulianDate.addSeconds(currentTime, timeInterval, new Cesium.JulianDate());
        }
        pathProperty?.addSample(currentTime, position);
    });
    
    // Update entity position to use the path property
    modelEntity.value.position = pathProperty;
    
    // Set clock to follow the path
    viewer.clock.startTime = startTime.clone();
    viewer.clock.stopTime = currentTime.clone();
    viewer.clock.currentTime = startTime.clone();
    viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
    viewer.clock.multiplier = 1.0;
    
    // Auto zoom to follow the model
    const followCamera = () => {
        if (!isMoving.value || !modelEntity.value) return;
        
        const position = modelEntity.value.position?.getValue(viewer.clock.currentTime);
        if (position) {
            viewer.camera.lookAt(position, new Cesium.Cartesian3(0, -100, 100));
        }
        
        if (Cesium.JulianDate.lessThan(viewer.clock.currentTime, viewer.clock.stopTime)) {
            requestAnimationFrame(followCamera);
        }
    };
    
    followCamera();
}

const stopPathTracking = () => {
    isMoving.value = false;
    if (movingEntity && movingEntity !== modelEntity.value) {
        viewer.entities.remove(movingEntity);
        movingEntity = null;
    }
}

const resetPath = () => {
    stopPathTracking();
    if (modelEntity.value && pathPositions.value.length > 0) {
        // Reset to first position
        modelEntity.value.position = new Cesium.ConstantPositionProperty(pathPositions.value[0]);
        viewer.clock.currentTime = viewer.clock.startTime.clone();
    }
}

// Add path point on right click
const addPathPoint = (cartesian: Cesium.Cartesian3) => {
    pathPositions.value.push(cartesian);
    
    // Visualize the path
    viewer.entities.add({
        polyline: {
            positions: pathPositions.value,
            width: 3,
            material: new Cesium.Color(1.0, 0.0, 0.0, 0.8),
        }
    });
}
const handleShowPanel = () => {
    showPanel.value = !showPanel.value;
}
onMounted(() => {

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
    transition: all .3s;

    .menuclose {
        position: absolute;
        right: 4px;
        top: 4px;
        cursor: pointer;
        color: #00eeff;

        &:hover {
            color: #ffffff
        }
    }

    &.hide {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        padding: 0;
        background-color: #01a1fd;
        // border: 1px solid #00eeff;
        transition: all .3s;

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
        transition: all .3s;
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
                transition: all .3s;
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
                    transition: all .3s;
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
    
    .menucell {
        padding: 10px;
        
        .control-panel {
            h3 {
                margin: 0 0 15px 0;
                font-size: 16px;
                color: #00eeff;
            }
            
            .el-button {
                margin: 5px;
                width: calc(100% - 10px);
            }
            
            .speed-control {
                margin-top: 15px;
                
                label {
                    display: block;
                    margin-bottom: 8px;
                    color: #fff;
                    font-size: 14px;
                }
            }
        }
    }
}

.path-visualization {
    position: absolute;
    bottom: 120px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    padding: 10px 20px;
    border-radius: 5px;
    color: #fff;
    z-index: 998;
    
    .path-info {
        font-size: 14px;
    }
}
</style>