import * as Cesium from 'cesium';
import { initMesh } from './mesh';

let viewer:any;

// Cesium.Viewer 的配置 ============

const terrainProvider =await Cesium.createWorldTerrainAsync({
  requestWaterMask: true,
  requestVertexNormals: true,
});


let configuration={
  infoBox:false,  // 是否显示信息窗口
  animation:false, // 是否创建动画
  baseLayerPicker:false,// 是否显示图层选择器
  fullscreenButton:false,// 是否显示全屏按钮
  geocoder:false, // 是否显示右上角的查询按钮
  homeButton:false,  // 是否显示HOME按钮
  sceneModePicker:false, // 是否显示场景控制按钮
  navigationHelpButton:false, // 是否显示帮助按钮
  timeline:false,// 是否显示时间轴
  // skyBox:new Cesium.SkyBox({   // 天空盒子
  //   sources : {
  //     positiveX : 'skybox_px.png',
  //     negativeX : 'skybox_nx.png',
  //     positiveY : 'skybox_py.png',
  //     negativeY : 'skybox_ny.png',
  //     positiveZ : 'skybox_pz.png',
  //     negativeZ : 'skybox_nz.png' 
  //   }
  // }),
  terrainProvider : terrainProvider,//设置地形
  
};




/**
 * 初始化
 * https://cesium.com/learn/cesiumjs-learn/cesiumjs-creating-entities/#shapes-and-volumes
 */
// MARK: 配置 ======


let initViewer=async  (dom:HTMLDivElement)=>{

  viewer = new Cesium.Viewer(dom,{
    ...configuration
  });

  addTMap2(viewer, 'vec',13);
};


/**
*/
let addTMap2=(viewer: Cesium.Viewer, layer: TMapType,level:number)=>{
  let imageryLayers = viewer.imageryLayers;
  
  const tMapImagery = new Cesium.UrlTemplateImageryProvider({
    url: "http://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",

    tilingScheme : new Cesium.GeographicTilingScheme(),
    maximumLevel :level
  })


  let layerCC = imageryLayers.addImageryProvider(tMapImagery);
  layerCC.alpha = 0.3;

}





export {
  Cesium,
  viewer,
  initViewer,
};


