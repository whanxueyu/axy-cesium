<template>
    <div :class="['menubox box1', showPanel ? '' : 'hide']">
        <div class="menuclose" @click="handleShowPanel">
            <el-icon size="20">
                <Close />
            </el-icon>
        </div>
        <div class="el-tabs">
            <div class="itemList">
                <div :class="['name', currentSkyBox?.id === skybox.id ? 'active' : '']" v-for="skybox in skyboxList"
                    :key="skybox.id" @click="selectSkybox(skybox)">{{ skybox.name }}</div>
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
    <Map @loaded="handleMapLoaded" :destination="destination" :orientation="orientation"></Map>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import { Grid, Close } from '@element-plus/icons-vue'
import Map from '@/components/cesium/map.vue'
import { skyboxList } from '@/assets/images/skybox';
import SkyBoxOnGround from "@/modules/cesium/groundSkybox.js"
var viewer: Cesium.Viewer;
type skyboxListType = {
    name: string;
    id: string;
    source: {
        negativeX: string;
        negativeY: string;
        negativeZ: string;
        positiveX: string;
        positiveY: string;
        positiveZ: string;
    };
}
const destination = ref({
    longitude: 116,
    latitude: 40,
    height: 2000

});
const orientation = ref({
    heading: 0,
    pitch: 0,
    roll: 0.0,
})
const showPanel = ref(true)
const currentSkyBox = ref<skyboxListType>()
var groundSkybox
const handleMapLoaded = (Viewer: Cesium.Viewer) => {
    viewer = Viewer;
}
const selectSkybox = (skybox: skyboxListType) => {
    currentSkyBox.value = skybox;
    // 切换天空盒
    if (viewer && skybox.source) {
        groundSkybox = new SkyBoxOnGround({
            sources: skybox.source
        });
        groundSkybox.setSkyBox(viewer);
    }
}
const handleShowPanel = () => {
    showPanel.value = !showPanel.value;
}
onMounted(() => {
    // 默认加载天空盒1
    currentSkyBox.value = skyboxList[0];
    selectSkybox(skyboxList[0])
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

    .itemList {
        width: 130px;
        display: flex;
        flex-wrap: nowrap;
        overflow-y: auto;
        // height: 600px;
        margin-top: 30px;
        flex-direction: column;
        overflow-x: hidden;

        .name {
            width: 100px;
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

            &:hover,
            &.active {
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