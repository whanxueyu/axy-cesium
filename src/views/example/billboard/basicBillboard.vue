<template>
    <div id="cesiumContainer" class="fullSize"></div>
    <div class="side-panel">
        <el-tree node-key="id" ref="treeRef" :data="dataList" :props="defaultProps" show-checkbox
            :default-checked-keys="checkList" @check-change="checkListChange" default-expand-all>
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
</template>

<script setup lang="ts">
import { Delete, Location, Edit, Plus } from "@element-plus/icons-vue";
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import iconList from "@/assets/images/icon";
const defaultProps = {
    children: "children",
    label: "name",
};
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const dataList = [
    {
        id: '10',
        name: "原点在对象的顶部",
        position: [116.4, 39.9],
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        scale: 0.5,
        image: iconList.LblExtent
    },
    {
        id: '11',
        name: "原点位于 BASELINE 和 TOP 之间的垂直中心",
        position: [116.41, 39.9],
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        scale: 0.5,
        image: iconList.LblExtent
    },
    {
        id: '12',
        name: "原点位于对象的底部",
        position: [116.42, 39.9],
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.5,
        image: iconList.LblExtent
    },
    {
        id: '13',
        name: "如果有文本，则位于文本\n基线，否则位于底部",
        position: [116.43, 39.9],
        verticalOrigin: Cesium.VerticalOrigin.BASELINE,
        scale: 0.5,
        image: iconList.LblExtent
    },
    {
        id: '20',
        name: "原点位于对象的右侧",
        position: [116.41, 39.91],
        horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
        scale: 0.5,
        image: iconList.LblExtent2
    },
    {
        id: '21',
        name: "原点位于对象的水平中心",
        position: [116.42, 39.91],
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        scale: 0.5,
        image: iconList.LblExtent2
    },
    {
        id: '22',
        name: "原点在对象的左侧",
        position: [116.43, 39.91],
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        scale: 0.5,
        image: iconList.LblExtent2
    },
    {
        id: '30',
        name: "像素pixel偏移量(20,40)",
        position: [116.40, 39.92],
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        scale: 0.5,
        pixelOffset: new Cesium.Cartesian2(20, 40),
        image: iconList.TextPnl
    },
    {
        id: '31',
        name: "像素pixel偏移量(20,-40)",
        position: [116.41, 39.92],
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        scale: 0.5,
        pixelOffset: new Cesium.Cartesian2(20, -40),
        image: iconList.TextPnl
    },
    {
        id: '32',
        name: "像素pixel偏移量(20,0)",
        position: [116.42, 39.92],
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        scale: 0.5,
        pixelOffset: new Cesium.Cartesian2(20, 0),
        image: iconList.TextPnl
    },
    {
        id: '33',
        name: "像素pixel偏移量(0,0)",
        position: [116.43, 39.92],
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        scale: 0.5,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        image: iconList.TextPnl
    },
    {
        id: '40',
        name: "缩放0.8倍",
        position: [116.40, 39.89],
        scale: 0.8,
        image: iconList.LblCircle
    },
    {
        id: '41',
        name: "缩放2倍",
        position: [116.41, 39.89],
        scale: 2,
        image: iconList.LblCircle2
    },
    {
        id: '50',
        name: "alignedAxis UNIT_X",
        position: [116.40, 39.84],
        scale: 1,
        image: iconList.Plane_Blue,
        alignedAxis: Cesium.Cartesian3.UNIT_X
    },
    {
        id: '51',
        name: "alignedAxis UNIT_Y",
        position: [116.41, 39.84],
        scale: 1,
        image: iconList.Plane_Blue,
        alignedAxis: Cesium.Cartesian3.UNIT_Y
    },
    {
        id: '52',
        name: "alignedAxis UNIT_Z",
        position: [116.42, 39.84],
        scale: 1,
        image: iconList.Plane_Blue,
        alignedAxis: Cesium.Cartesian3.UNIT_Z
    },
    {
        id: '53',
        name: "rotation旋转45度",
        position: [116.43, 39.84],
        scale: 1,
        image: iconList.Plane_Blue,
        rotation: Cesium.Math.toRadians(45)
    },
    {
        id: '54',
        name: "rotation旋转90度",
        position: [116.44, 39.84],
        scale: 1,
        image: iconList.Plane_Blue,
        rotation: Cesium.Math.toRadians(90)
    },
    {
        id: '60',
        name: "在高度1000米到5000米范围才显示",
        position: [116.40, 39.88],
        scale: 1,
        image: iconList.MapTitleR,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(1000, 5000)
    },
    {
        id: '61',
        name: "eyeOffset 示例",
        position: [116.41, 39.88],
        scale: 1,
        image: iconList.LblCircle,
        eyeOffset: new Cesium.Cartesian3(0, 0, 100)
    },
    {
        id: '70',
        name: "标牌贴地",
        position: [116.40, 39.87],
        scale: 1,
        image: iconList.LblCircle,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    },
    {
        id: '71',
        name: "标牌贴地形",
        position: [116.41, 39.87],
        scale: 1,
        image: iconList.LblCircle,
        heightReference: Cesium.HeightReference.CLAMP_TO_TERRAIN
    },
    {
        id: '80',
        name: "pixelOffsetScaleByDistance 示例",
        position: [116.40, 39.86],
        scale: 1,
        image: iconList.TextPnl,
        pixelOffsetScaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 5000, 0.5)
    },
    {
        id: '81',
        name: "根据视距缩放，5000米以上0.5倍，1000米以下5倍",
        position: [116.41, 39.86],
        scale: 1,
        image: iconList.TextPnl,
        scaleByDistance: new Cesium.NearFarScalar(1000, 5.0, 5000, 0.5)
    },
    {
        id: '90',
        name: "根据视距透明度，5000米以上0.2，1000米以下1",
        position: [116.40, 39.85],
        scale: 1,
        image: iconList.TextPnl,
        translucencyByDistance: new Cesium.NearFarScalar(1000, 1.0, 5000, 0.2)
    },
    {
        id: '91',
        name: "sizeInMeters 示例",
        position: [116.41, 39.85],
        // scale: 1,
        width: 300,
        height: 200,
        image: iconList.MapTitleB,
        sizeInMeters: true
    }
]
const checkListChange = (value: { [key: string]: any; }, check: boolean) => {
    const entity = viewer?.entities?.getById(value.id);
    if (entity) {
        entity.show = check
    }
}
const location = (item: {
    [key: string]: any;
}) => {
    const entity = viewer?.entities?.getById(item.id);
    if (entity) {
        viewer.zoomTo(entity)
    }
}
const checkList = ref<string[]>()
checkList.value = dataList.map(item => item.id)
// 原点在对象的顶部。
const addBillboard = () => {
    dataList.forEach(item => {
        const billboard = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(item.position[0], item.position[1], 50),
            id: item.id,
            billboard: {
                image: item.image,
                scale: item.scale,
                width: item.width ?? undefined,
                height: item.height ?? undefined,
                verticalOrigin: item.verticalOrigin ?? undefined,
                horizontalOrigin: item.horizontalOrigin ?? undefined,
                pixelOffset: item.pixelOffset ?? undefined,
                alignedAxis: item.alignedAxis ?? undefined,
                rotation: item.rotation ?? undefined,
                distanceDisplayCondition: item.distanceDisplayCondition ?? undefined,
                eyeOffset: item.eyeOffset ?? undefined,
                heightReference: item.heightReference ?? undefined,
                pixelOffsetScaleByDistance: item.pixelOffsetScaleByDistance ?? undefined,
                scaleByDistance: item.scaleByDistance ?? undefined,
                translucencyByDistance: item.translucencyByDistance ?? undefined,
                sizeInMeters: item.sizeInMeters ?? false
            },
            label: {
                text: item.name,
                font: "20px sans-serif",
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: item.verticalOrigin,
                pixelOffset: new Cesium.Cartesian2(0, -30)
            },
            point: {
                pixelSize: 10,
                color: Cesium.Color.RED,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2
            }
        })
        viewer.zoomTo(billboard)
    })
}
onMounted(() => {
    viewer = new Cesium.Viewer("cesiumContainer", {
        // terrain: Cesium.Terrain.fromWorldTerrain(),
    });
    console.log(iconList)
    addBillboard()
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

.side-panel {
    position: absolute;
    padding: 10px;
    top: 10px;
    left: 10px;
    background-color: rgba(255, 255, 255, 0.8);
}
.custom-tree-node{
    width: 100%;
    display: flex;
    justify-content: space-between;
}
.node-name{
    width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: start;
}
</style>