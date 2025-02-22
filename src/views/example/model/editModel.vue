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
        </div>
        <div v-if="!showPanel" class="hideicon" @click="handleShowPanel">
            <el-icon size="30">
                <Grid />
            </el-icon>
        </div>
    </div>
    <div class="menubox box2">
        <el-button type="primary" @click="load3DTileset">加载倾斜摄影模型</el-button>
    </div>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import Map from '@/components/cesium/map.vue'
import { Grid, Close } from '@element-plus/icons-vue'
import { ControlEntity, callbackParams } from '@/modules/control/controlEntity'
import { ElMessage } from 'element-plus';
var viewer: Cesium.Viewer;
const mapLoaded = ref(false)
const showPanel = ref(true)
const drawModel = ref(false)
const currentUrl = ref('')
const control = ref<ControlEntity>()
const selectId = ref<string>()
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
const handleShowPanel = () => {
    showPanel.value = !showPanel.value;
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    let handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) {
        let ray = viewer.camera.getPickRay(event.position);
        if (!ray) return
        var pick = viewer.scene.pick(event.position);//拾取鼠标所在的entity
        if (Cesium.defined(pick)) {
            if (pick.id.id === selectId.value && selectId.value) {
                let entity = viewer.entities.getById(selectId.value)
                if (entity) {
                    entity!.model!.color = new Cesium.ConstantProperty(Cesium.Color.WHITE);
                    // entity.model.colorBlendMode = Cesium.ColorBlendMode.HIGHLIGHT;
                }

                selectId.value = '';
                if (control.value) {
                    control.value.destroy()
                }
                return
            }
            if (pick.id.name === '模型') {
                let entity: Cesium.Entity = pick.id
                let sid = pick.id.id
                selectId.value = sid
                let position = entity?.position?.getValue(viewer.clock.currentTime)
                let orientation = entity?.orientation?.getValue(viewer.clock.currentTime);
                // 四元数计算三维旋转矩阵
                let mtx3 = Cesium.Matrix3.fromQuaternion(orientation, new Cesium.Matrix3());

                // 四维转换矩阵
                let mtx4 = Cesium.Matrix4.fromRotationTranslation(mtx3, position, new Cesium.Matrix4());

                // 计算HeadingPitchRoll，结果为弧度
                let hpr = Cesium.Transforms.fixedFrameToHeadingPitchRoll(
                    mtx4,
                    Cesium.Ellipsoid.WGS84,
                    Cesium.Transforms.eastNorthUpToFixedFrame,
                    new Cesium.HeadingPitchRoll(),
                );

                console.log("orientation", orientation)
                let positionsCallback = (callbackParams: callbackParams) => {
                    if (entity) {
                        entity!.position = new Cesium.ConstantPositionProperty(
                            callbackParams.newPosition
                        )
                        if (callbackParams.newQuaternion)
                            entity!.orientation = new Cesium.ConstantProperty(callbackParams.newQuaternion)
                        if (callbackParams.newScale) {
                            entity!.model!.scale = new Cesium.ConstantProperty(callbackParams.newScale*10)
                        }
                    }
                };
                if (position)
                    control.value = new ControlEntity(viewer, { id: sid, type: 'translate,roate,scale', position, orientation: hpr, scale: 1 }, positionsCallback)
                pick!.id!.model.color = Cesium.Color.fromCssColorString('#00ff55')
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
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
    let model = viewer.entities.add({
        position: new Cesium.ConstantPositionProperty(cartesian),
        orientation: Cesium.Transforms.headingPitchRollQuaternion(
            cartesian,
            Cesium.HeadingPitchRoll.fromDegrees(0, 0, 0)
        ),
        name: '模型',
        model: {
            scale: 10,
            // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            uri: currentUrl.value,
        },
    })
    viewer.zoomTo(model).then((res) => {
        console.log('zoomto', res)
        ElMessage.success('双击模型进入编辑状态')
    })
}
// 加载3DTileset
const load3DTileset = async () => {
    try {
        const tileset = await Cesium.Cesium3DTileset.fromUrl(
            "https://zouyaoji.top/vue-cesium/SampleData/Cesium3DTiles/Tilesets/dayanta/tileset.json",
        );
        viewer.scene.primitives.add(tileset);
        // var height = 738.0
        tileset.initialTilesLoaded.addEventListener(function () {
            console.log('Initial tiles are loaded');
            var cartographic = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center)
            var lng = Cesium.Math.toDegrees(cartographic.longitude) //使用经纬度和弧度的转换，将WGS84弧度坐标系转换到目标值，弧度转度
            var lat = Cesium.Math.toDegrees(cartographic.latitude)
            // var lat = 34.219588
            // var lng = 108.959397
            //计算中心点位置的地表坐标
            var surface = Cesium.Cartesian3.fromRadians(lng, lat, 0.0)
            //偏移后的坐标
            var offset = Cesium.Cartesian3.fromRadians(lng, lat, 0)
            var translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3())
            tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation)
        });
        viewer.zoomTo(tileset);
    } catch (error) {
        console.error(`Error creating tileset: ${error}`);
    }
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

    &.box1 {
        left: 5px;
        top: 65px;
    }

    &.box2 {
        left: 5px;
        bottom: 65px;
    }
}
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
}
</style>