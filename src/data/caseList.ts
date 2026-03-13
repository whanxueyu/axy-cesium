import defaultImg from '@/assets/images/home/todo.png';

type ImageImport = Record<string, { default: string }>;
const exampleImages = import.meta.glob('@/assets/images/example/*.png', { eager: true }) as ImageImport;

const imageResources = {
  layers: {
    init: 'init.png',
    tdtimg: 'tdtimg.png',
    tdtvector: 'tdtvector.png',
    gaodeimg: 'gaodeimg.png',
    gaodevector: 'gaodevector.png',
    bingimg: 'bingimg.png',
    bingvector: 'bingvector.png',
    grid: 'gird.png',
    tilegrid: 'tilegrid.png',
    darkmap: 'darkmap.png',
    baselayer: 'baselayer.png',
    editlayer: 'editlayer.png',
    areaMap: 'areaMap.png',
    night: 'night.png',
    singleImg: 'singleImg.png'
  },
  skybox: {
    skybox: 'skybox.png',
    groundSkybox: 'groundSkybox.png',
    background: 'background.png',
    dynamicSkybox: 'dynamicSkybox.png',
    shaderSkybox: 'shaderSkybox.png',
    weatherSkybox: 'weatherSkybox.png',
  },
  billboard: {
    animationBillboard: 'animationBillboard.png',
    basicBillboard: 'basicBillboard.png',
    bounceBillboard: 'bounceBillboard.png',
    cluster: 'billboardCluster.png',
    cluster2: 'billboardCluster2.png',
    primitiveBillboard: 'primitiveBillboard.png',
    primitiveCluster: 'primitiveCluster.png',
    gifBillboard: 'gifbillboard.png',
    htmlBillboard: 'htmlBillboard.png',
    divBillboard: 'divBillboard.png',
    dragableBillboard: 'dragableBillboard.png',
    css3DdivBillboard: 'css3DdivBillboard.png',
    divCluster: 'divCluster.png'
  },
  polyline: {
    basicPolyline: 'basicPolyline.png',
    dynamicPolyline: 'dynamicPolyline.png',
    imagePolyline: 'imagePolyline.png',
    polylineVolume: 'polylineVolume.png',
    verticaltail: 'verticaltail.png',
    tailLine: 'tailLine.png',
    glowLine: 'glowLine.png',
  },
  polygon: {
    polygon: 'polygon.png',
    areaMask: 'areaMask.png',
    gradientRegion: 'gradientRegion.png'
  },
  model: {
    model: 'model.png',
    tileset: 'tileset.png',
    editModel: 'editModel.png',
    cityModel: 'cityModel.png',
    pathTracking: 'pathTracking.png',
    moveControl:'moveControl.png',
  },
  radar: {
    scan: 'scanRadar.png',
    wave: 'waveRadar.png',
    jam: 'jamRadar.png',
    volume: 'volumeRadar.png',
    ellipsoid: 'ellipsoidRadar.png',
    electric: 'electricRadar.png',
  },
  material: {
    postProcess: 'postProcess.png',
    heatmap: 'heatmap.png',
    terrain: 'terrain.png',
    weather: 'weather.png'
  },
  analysis: {
    position: 'position.png',
    distance: 'distance.png',
    height: 'height.png',
    area: 'area.png',
    volume: 'volume.png',
    cutfill: 'cutfill.png',
    profile: 'profile.png',
    viewshed: 'viewshed.png',
    slope: 'slope.png',
    flood: 'flood.png'
  },
  camera: {
    smoothFly: 'smoothFly.png',
    around: 'around.png',
    rotation: 'rotation.png',
    orbit: 'orbit.png',
    follow: 'follow.png',
    limitView: 'limitView.png'
  },
  comprehensive: {
    measurement: 'measurement.png',
    dynamicData: 'dynamicData.png',
    cameraFlight: 'cameraFlight.png',
    undergroundMode: 'undergroundMode.png',
  }
};

// 定义 imageResources 的类型
type ImageCategory = keyof typeof imageResources;
type ImageName<T extends ImageCategory> = keyof typeof imageResources[T];

const getImagePath = <T extends ImageCategory>(category: T, name: ImageName<T>): string => {
  const fileName = imageResources[category][name];
  if (fileName) {
    let filePath = exampleImages[`/src/assets/images/example/${fileName}`];
    if (filePath) {
      return filePath.default;
    } else {
      return defaultImg;
    }
  } else {
    return defaultImg;
  }
};


export var caseList = [
  {
    title: '图层',
    type: 'layers',
    list: [
      {
        imgurl: getImagePath('layers', 'init'),
        title: '初始化',
        description: '最基础的初始化 Cesium 案例。',
        path: '/example/initCesium'
      },
      {
        imgurl: getImagePath('layers', 'tdtimg'),
        title: '天地图影像',
        description: '添加天地图影像，并取消无关图标和widgets。',
        path: '/example/tdt_img'
      },
      {
        imgurl: getImagePath('layers', 'tdtvector'),
        title: '天地图矢量',
        description: '添加天地图矢量，并取消无关图标和widgets。',
        path: '/example/tdt_vector'
      },
      {
        imgurl: getImagePath('layers', 'gaodeimg'),
        title: '高德地图影像',
        description: '添加高德地图影像，并取消无关图标和widgets。',
        path: '/example/gaode_img'
      },
      {
        imgurl: getImagePath('layers', 'gaodevector'),
        title: '高德地图矢量',
        description: '添加高德地图矢量，并取消无关图标和widgets。',
        path: '/example/gaode_vector'
      },
      {
        imgurl: getImagePath('layers', 'bingimg'),
        title: '必应地图影像',
        description: '添加必应地图影像，并取消无关图标和widgets。',
        path: '/example/bing_img'
      },
      {
        imgurl: getImagePath('layers', 'bingvector'),
        title: '必应地图矢量',
        description: '添加必应地图矢量，并取消无关图标和widgets。',
        path: '/example/bing_vector'
      },
      {
        imgurl: getImagePath('layers', 'grid'),
        title: '网格地图',
        description: '生成网格地图，并取消无关图标和widgets。',
        path: '/example/grid'
      },
      {
        imgurl: getImagePath('layers', 'tilegrid'),
        title: '瓦片网格地图',
        description: '生成瓦片网格地图，并取消无关图标和widgets。',
        path: '/example/tileGrid'
      },
      {
        imgurl: getImagePath('layers', 'singleImg'),
        title: '单张图片作底图',
        description: '加载单张图片作为地图底图',
        path: '/example/singleImg'
      },
      {
        imgurl: getImagePath('layers', 'areaMap'),
        title: '区域地图加载',
        description: '在指定区域单独加载图层',
        path: '/example/areaMap'
      },
      {
        imgurl: getImagePath('layers', 'night'),
        title: '夜晚地图',
        description: '夜晚地图效果，白天黑夜图层切换模拟地球自传动态效果',
        path: '/example/night'
      },
      {
        imgurl: getImagePath('layers', 'darkmap'),
        title: '暗色（反色）地图',
        description: '通过修改涂层颜色通道生成暗色底图',
        path: '/example/darkmap'
      },
      {
        imgurl: getImagePath('layers', 'baselayer'),
        title: '切换底图',
        description: '自定义基础图层选择组件，点击随意切换各种底图',
        path: '/example/changeMap'
      },
      {
        imgurl: getImagePath('layers', 'editlayer'),
        title: '编辑地图颜色',
        description: '可根据调整参数，随意生成自己喜欢的底图颜色',
        path: '/example/editMapColor'
      },

    ]
  },
  {
    title: '天空盒',
    type: 'skybox',
    list: [
      {
        imgurl: getImagePath('skybox', 'skybox'),
        title: '天空盒',
        description: '自定义不同类型的天空盒效果',
        path: '/example/skybox'
      },
      {
        imgurl: getImagePath('skybox', 'groundSkybox'),
        title: '近地天空盒',
        description: '自定义不同类型的近地天空盒效果',
        path: '/example/groundSkybox'
      },
      {
        imgurl: getImagePath('skybox', 'background'),
        title: '设置背景图',
        description: '设置背景图',
        path: '/example/background'
      },
      // {
      //   imgurl: getImagePath('skybox', 'dynamicSkybox'),
      //   title: '动态天空盒',
      //   description: '随时间变化的动态天空盒效果，模拟日夜转换',
      //   path: '/example/dynamicSkybox'
      // },
      // {
      //   imgurl: getImagePath('skybox', 'shaderSkybox'),
      //   title: '着色器天空盒',
      //   description: '使用自定义着色器实现的特殊天空效果',
      //   path: '/example/shaderSkybox'
      // },
      // {
      //   imgurl: getImagePath('skybox', 'weatherSkybox'),  // 复用现有图片或新建weatherSkybox.png
      //   title: '天气天空盒',
      //   description: '结合雨雪雾天气效果的复合天空盒',
      //   path: '/example/weatherSkybox'
      // }
    ]
  },
  {
    title: '标牌',
    type: 'billboard',
    list: [
      {
        imgurl: getImagePath('billboard', 'basicBillboard'),
        title: '基础标牌',
        description: '基础标牌的各个参数效果对比展示',
        path: '/example/basicBillboard'
      },
      {
        imgurl: getImagePath('billboard', 'bounceBillboard'),
        title: '跳动标牌',
        description: '用三种方式实现标牌跳动效果，三种方式对比',
        path: '/example/bounceBillboard'
      },
      {
        imgurl: getImagePath('billboard', 'animationBillboard'),
        title: '动画标牌',
        description: '标牌坠落、变大、透明等动画效果',
        path: '/example/animationBillboard'
      },
       {
        imgurl: getImagePath('billboard', 'gifBillboard'),
        title: '动态标牌',
        description: '使用gif动图实现动态标牌效果。（目前使用gifler库解析gif，但是效果不理想，无法加载超过1.6M的动图，且加载动图数量稍多就会卡顿，后续寻找更优解）',
        path: '/example/gifBillboard'
      },
      {
        imgurl: getImagePath('billboard', 'cluster'),
        title: 'entity标牌聚合效果',
        description: '随机生成500个点位，并实现不同层级的聚合效果',
        path: '/example/billboardCluster'
      },
      {
        imgurl: getImagePath('billboard', 'cluster2'),
        title: 'entity标牌自定义聚合效果',
        description: '随机生成500个点位，并实现不同层级的自定义聚合效果',
        path: '/example/billboardCluster2'
      },
      {
        imgurl: getImagePath('billboard', 'primitiveBillboard'),
        title: 'primitive标牌(高性能)',
        description: '随机生成10000个点位，可支持更多点位渲染',
        path: '/example/primitiveBillboard'
      },
      {
        imgurl: getImagePath('billboard', 'primitiveCluster'),
        title: 'primitive标牌聚合(高性能)',
        description: '随机生成10000个点位，可支持更多点位渲染',
        path: '/example/primitiveCluster'
      },
      {
        imgurl: getImagePath('billboard', 'htmlBillboard'),
        title: 'html自定义标牌',
        description: '使用html作为标牌，有更高的自由度，可以实现自己的交互逻辑',
        path: '/example/htmlBillboard'
      },
      {
        imgurl: getImagePath('billboard', 'divBillboard'),
        title: 'div标牌终极方案',
        description: '封装了divBillboard类，可以加载任意的vue组件',
        path: '/example/divBillboard'
      },
      {
        imgurl: getImagePath('billboard', 'dragableBillboard'),
        title: '可拖动的标牌，结合div',
        description: '支持拖拽，可在地图上显示带连接线的信息弹窗',
        path: '/example/dragableBillboard'
      },
      {
        imgurl: getImagePath('billboard', 'divCluster'),
        title: 'div聚合标牌',
        description: '如果想要将div标牌也进行聚合的话可以参考这个实现',
        path: '/example/divCluster'
      },
      {
        imgurl: getImagePath('billboard', 'css3DdivBillboard'),
        title: 'css3Ddiv标牌',
        description: '使用css3D技术在cesium中加载有三维效果的div标牌',
        // path: '/example/css3DdivBillboard'
        path: '/example/developing'
      },
    ]
  },
  {
    title: '线状实体',
    type: 'polyline',
    list: [
      {
        imgurl: getImagePath('polyline', 'basicPolyline'),
        title: '基础线',
        description: '基础polyline效果,',
        path: '/example/basicPolyline'
      },
      {
        imgurl: getImagePath('polyline', 'imagePolyline'),
        title: '图片材质线',
        description: '为Polyline设置图片作为材质',
        path: '/example/imagePolyline'
      },
      {
        imgurl: getImagePath('polyline', 'dynamicPolyline'),
        title: '动态线',
        description: '动态效果的Polyline',
        path: '/example/dynamicPolyline'
      },
      {
        imgurl: getImagePath('polyline', 'polylineVolume'),
        title: '动态管道',
        description: '绘制动态管道方法',
        path: '/example/polylineVolume'
      },
      {
        imgurl: getImagePath('polyline', 'verticaltail'),
        title: '竖直尾迹',
        description: '竖直向上的尾迹线',
        path: '/example/verticaltail'
      },
      {
        imgurl: getImagePath('polyline', 'tailLine'),
        title: '迁徙线',
        description: '发光迁徙线，带尾迹的效果',
        path: '/example/tailLine'
      },
      {
        imgurl: getImagePath('polyline', 'glowLine'),
        title: '边界发光线',
        description: '使用primitive实现边界发光线效果',
        path: '/example/glowLine'
      },
    ]
  },
  {
    title: '面状实体',
    type: 'polygon',
    list: [
      {
        imgurl: getImagePath('polygon', 'polygon'),
        title: '多边形面',
        description: '多边形面面状实体各类材质',
        path: '/example/polygon'
      },
      {
        imgurl: getImagePath('polygon', 'areaMask'),
        title: '反选遮罩',
        description: '多边形面反选遮罩效果',
        path: '/example/areaMask'
      },
      {
        imgurl: getImagePath('polygon', 'gradientRegion'),
        title: '渐变色区域',
        description: '多边形面渐变色区域效果',
        path: '/example/gradientRegion'
      },
    ]
  },
  {
    title: '模型',
    type: 'model',
    list: [
      {
        imgurl: getImagePath('model', 'model'),
        title: 'gltf模型加载',
        description: '加载基础的各类glb单体模型',
        path: '/example/model'
      },
      {
        imgurl: getImagePath('model', 'tileset'),
        title: '倾斜摄影模型加载',
        description: '加载大雁塔倾斜摄影模型',
        path: '/example/tileset'
      },
      {
        imgurl: getImagePath('model', 'cityModel'),
        title: '城市白膜',
        description: '城市白膜加载，picker功能，自定义材质',
        path: '/example/cityTileset'
      },
      {
        imgurl: getImagePath('model', 'editModel'),
        title: '模型编辑',
        description: '模型编辑工具，可沿着XYZ轴平移，旋转，缩放',
        path: '/example/editModel'
      },
      {
        imgurl: getImagePath('model', 'pathTracking'),
        title: '模型沿线移动',
        description: '模型根据设置的路径进行移动，支持循环播放，可设置路径点和路径参数',
        path: '/example/pathTracking'
      },
      {
        imgurl: getImagePath('model', 'moveControl'),
        title: '模型移动控制',
        description: '键盘控制模型移动方向，支持 WASD 键和方向键',
        path: '/example/moveControl'
      },
    ]
  },
  {
    title: '雷达',
    type: 'radar',
    list: [
      {
        imgurl: getImagePath('radar', 'scan'),
        title: '扫描雷达',
        description: '多种方法实现雷达扫描效果',
        path: '/example/scanRadar'
      },
      {
        imgurl: getImagePath('radar', 'wave'),
        title: '扩散雷达',
        description: '不同大小、颜色、波纹数量和速度的波纹雷达效果',
        path: '/example/waveRadar'
      },
      {
        imgurl: getImagePath('radar', 'volume'),
        title: '圆锥体雷达',
        description: '不同大小、颜色、波纹数量和波纹宽度的雷达效果',
        path: '/example/volumeRadar'
      },
      {
        imgurl: getImagePath('radar', 'electric'),
        title: '电光球体雷达',
        description: '有点光特效的球体雷达效果',
        path: '/example/electricRadar'
      },
      {
        imgurl: getImagePath('radar', 'ellipsoid'),
        title: '球体扫描雷达',
        description: '不同大小、颜色和速度的球体扫描雷达效果',
        path: '/example/ellipsoidRadar'
      },
            {
        imgurl: getImagePath('radar', 'jam'),
        title: '干扰雷达',
        description: '干扰雷达效果,根据地形及雷达参数计算通讯链路连通性',
        path: '/example/jamRadar'
      },
    ]
  },
  {
    title: '效果',
    type: 'material',
    list: [
      {
        imgurl: getImagePath('material', 'weather'),
        title: '天气效果',
        description: '雨雪雾动态天气模拟与切换',
        path: '/example/weatherEffects'
      },
      {
        imgurl: getImagePath('material', 'heatmap'),
        title: '热力图效果',
        description: '基于地理坐标的热力数据可视化',
        path: '/example/heatmap'
      },
    ]
  },
  {
    title: '相机控制',
    type: 'camera',
    list: [
      {
        imgurl: getImagePath('camera', 'smoothFly'),
        title: '相机平滑飞入',
        description: '监听瓦片加载事件，所有瓦片加载完成后再进行相机移动，实现相机丝滑飞入效果',
        path: '/example/smoothFly'
      },
      {
        imgurl: getImagePath('camera', 'around'),
        title: '绕点飞行',
        description: '绕点飞行是三维场景中一种非常常见的的动画效果，需要围绕其中心点进行旋转浏览',
        path: '/example/pointAround'
      },
      {
        imgurl: getImagePath('camera', 'rotation'),
        title: '定点旋转',
        description: '定点旋转是指在目标点旋转看向四周进行浏览',
        path: '/example/pointRotation'
      },
      {
        imgurl: getImagePath('camera', 'orbit'),
        title: '轨道飞行',
        description: '轨道飞行是指沿着预设的轨道进行飞行浏览',
        path: '/example/orbit'
      },
      {
        imgurl: getImagePath('camera', 'follow'),
        title: '跟随飞行',
        description: '跟随飞行是指沿着目标对象进行飞行浏览',
        path: '/example/follow'
      },
      {
        imgurl: getImagePath('camera', 'limitView'),
        title: '限制相机范围',
        description: '限制相机查看范围和角度，相机始终在目标点附近',
        path: '/example/limitView'
      },
    ]
  },
  {
    title: '测量分析',
    type: 'analysis',
    list: [
      {
        imgurl: getImagePath('analysis', 'position'),
        title: '坐标测量',
        description: '多种模式坐标测量，拾取坐标',
        path: '/example/position'
      },
      {
        imgurl: getImagePath('analysis', 'distance'),
        title: '距离测量',
        description: '直线距离测量，贴地距离测量',
        path: '/example/measurement'
      },
      {
        imgurl: getImagePath('analysis', 'height'),
        title: '高度差测量',
        description: '测量两点之间高度差',
        path: '/example/height'
      },
      {
        imgurl: getImagePath('analysis', 'area'),
        title: '面积测量',
        description: '多边形面积测量，贴地面积测量',
        path: '/example/area'
      },
      {
        imgurl: getImagePath('analysis', 'cutfill'),
        title: '填挖方分析',
        description: '场地平整填挖方计算，土方量估算',
        path: '/example/cutfill'
      },
      {
        imgurl: getImagePath('analysis', 'profile'),
        title: '剖面分析',
        description: '地形剖面线分析，高程剖面',
        path: '/example/profile'
      },
      {
        imgurl: getImagePath('analysis', 'viewshed'),
        title: '通视分析',
        description: '两点之间通视性分析，可视域分析',
        path: '/example/viewshed'
      },
      {
        imgurl: getImagePath('analysis', 'slope'),
        title: '坡度坡向分析',
        description: '地形坡度坡向分析，坡度分级',
        path: '/example/slope'
      },
      {
        imgurl: getImagePath('analysis', 'flood'),
        title: '淹没分析',
        description: '洪水淹没模拟，水位上升下降',
        path: '/example/flood'
      }
    ]
  },
  {
    title: '综合案例',
    type: 'comprehensive',
    list: [
      {
        imgurl: getImagePath('comprehensive', 'dynamicData'),
        title: '场景日夜交替',
        description: '根据时间变化模拟日夜交替效果，光照天空变换',
        path: '/example/dynamicData'
      }
    ]
  },
]