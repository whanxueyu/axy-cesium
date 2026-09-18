import defaultImg from '@/assets/images/home/todo.png';

type ImageImport = Record<string, { default: string }>;
const exampleImages = {
  ...import.meta.glob('@/assets/images/example/*.png', { eager: true }),
  ...import.meta.glob('@/assets/images/example/*.jpg', { eager: true })
} as ImageImport;

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
    moveControl: 'moveControl.png',
    mouseMoveControl: 'mouseMoveControl.png',
    animation: 'animation.png',
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
    weather: 'weather.png',
    rain: 'rain.png',
    snow: 'snow.png',
    fog: 'fog.png',
    cloud: 'cloud.png',
    lightning: 'lightning.png'
  },
  analysis: {
    measure: 'measure.png',
    volume: 'volume.png',
    cutfill: 'cutfill.png',
    profile: 'profile.png',
    viewshed: 'viewshed.png',
    lineOfSight: 'lineOfSight.png',
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
    const imageKey = `/src/assets/images/example/${fileName}`;
    let filePath = exampleImages[imageKey];
    if (!filePath && fileName.endsWith('.png')) {
      filePath = exampleImages[imageKey.replace(/\.png$/, '.jpg')];
    }
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
    title: '综合案例',
    type: 'comprehensive',
    list: [
      {
        imgurl: getImagePath('comprehensive', 'measurement'),
        title: '三维应急推演与通信保障',
        description: '规划融合3D Tiles、车辆轨迹、动态天气、淹没、通视、通信链路和CSS3D信息面板',
        path: '/example/emergencyScenario',
        status: 'planned'
      },
      {
        imgurl: getImagePath('comprehensive', 'cameraFlight'),
        title: '轨迹巡检与相机编排',
        description: '规划以时间轴组织模型轨迹、相机关键帧、跟随视角和巡检事件，形成可回放巡航流程',
        path: '/example/cameraTimeline',
        status: 'planned'
      },
      {
        imgurl: getImagePath('comprehensive', 'dynamicData'),
        title: '场景日夜交替',
        description: '根据时间变化模拟日夜交替效果，光照天空变换',
        path: '/example/dynamicData',
        status: 'planned'
      }
    ]
  },
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
      }
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
        path: '/example/css3DdivBillboard'
      },
      {
        imgurl: getImagePath('billboard', 'primitiveCluster'),
        title: '标牌性能实验室',
        description: '规划对比 Entity、Primitive、HTML、CSS3D 标牌在大数据量下的FPS、聚合、遮挡、避让和LOD',
        path: '/example/billboardBenchmark',
        status: 'planned'
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
        title: '3D Tiles城市构件检查',
        description: '城市白膜加载、构件拾取、轮廓高亮与自定义着色，后续拓展属性面板和专题渲染',
        path: '/example/cityTileset'
      },
      {
        imgurl: getImagePath('model', 'cityModel'),
        title: '3D Tiles剖切与裁剪',
        description: '规划基于裁剪面实现平面剖切、盒裁剪和高度裁剪，用于查看建筑内部与模型断面',
        path: '/example/tilesetClipping',
        status: 'planned'
      },
      {
        imgurl: getImagePath('model', 'cityModel'),
        title: '3D Tiles楼层爆炸',
        description: '规划按楼层或构件分组展开，支持单体隐藏、透明化、属性查看、复位和相机定位',
        path: '/example/tilesetExplosion',
        status: 'planned'
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
        imgurl: getImagePath('model', 'pathTracking'),
        title: '轨迹编辑与相机跟随',
        description: '规划路径点编辑、时间轴播放、倍速暂停、第一/第三人称跟随、相机关键帧和巡检回放',
        path: '/example/trackPlayback',
        status: 'planned'
      },
      {
        imgurl: getImagePath('model', 'moveControl'),
        title: '键盘控制模型移动',
        description: '键盘控制模型移动方向，支持 WASD 键和方向键，按一次方向模型持续朝该方向移动',
        path: '/example/moveControl'
      },
      {
        imgurl: getImagePath('model', 'mouseMoveControl'),
        title: '鼠标控制模型移动',
        description: '点击地图任意位置，模型自动走向点击处，移动中可随时点击改道',
        path: '/example/mouseMoveControl'
      },
      {
        imgurl: '/models/animation/Rampaging%20T-Rex.png',
        title: 'GLB内置动画播放',
        description: '读取 Rampaging T-Rex GLB 内置五段动画，支持动画切换、播放暂停、进度控制、倍速和循环播放',
        path: '/example/animation'
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
      {
        imgurl: getImagePath('radar', 'jam'),
        title: '多节点通信覆盖分析',
        description: '规划多雷达/多终端链路连通图，叠加地形遮挡、通信半径、链路余量和移动目标变化',
        path: '/example/radioCoverage',
        status: 'planned'
      },
    ]
  },
  {
    title: '效果',
    type: 'material',
    list: [
      {
        imgurl: getImagePath('material', 'rain'),
        title: '雨效果',
        description: '基于后处理与风场扰动的雨幕效果，支持雨量、雨速、风向和远近层次调节',
        path: '/example/weatherRain'
      },
      {
        imgurl: getImagePath('material', 'snow'),
        title: '雪效果',
        description: '局部深度感知降雪与地形积雪效果，支持风向、速度、覆盖范围和积雪增长调节',
        path: '/example/weatherSnow'
      },
      {
        imgurl: getImagePath('material', 'fog'),
        title: '雾效果',
        description: '基于场景深度的近地雾和远景雾化效果，支持浓度、能见度和高度衰减控制',
        path: '/example/weatherFog'
      },
      {
        imgurl: getImagePath('material', 'lightning'),
        title: '闪电效果',
        description: '闪电照明与雷暴天空模拟',
        path: '/example/weatherLightning'
      },
      {
        imgurl: getImagePath('material', 'cloud'),
        title: '体积云效果',
        description: '基于体积渲染的云层效果，支持云量、云速、云高度和云厚度调节',
        path: '/example/weatherCloud'
      },
      {
        imgurl: getImagePath('material', 'heatmap'),
        title: '热力图效果',
        description: '3D热力图效果，支持二三维切换、自定义颜色、半径大小、热力点和高度',
        path: '/example/heatmap'
      },
      {
        imgurl: getImagePath('material', 'weather'),
        title: '天气与能见度联动',
        description: '规划雨、雪、雾、体积云、闪电组合预设，并联动可视距离、光照和场景氛围',
        path: '/example/weatherScenario',
        status: 'planned'
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
        description: '规划沿预设轨道浏览，支持轨道编辑、速度控制、循环播放和视角插值',
        path: '/example/orbit',
        status: 'planned'
      },
      {
        imgurl: getImagePath('camera', 'follow'),
        title: '跟随飞行',
        description: '规划绑定移动目标，支持第一人称、第三人称、侧后方跟随和跟随距离调节',
        path: '/example/follow',
        status: 'planned'
      },
      {
        imgurl: getImagePath('camera', 'limitView'),
        title: '限制相机范围',
        description: '规划限制相机经纬度、高度、俯仰角和目标区域，适合园区/城市资产巡检场景',
        path: '/example/limitView',
        status: 'planned'
      },
    ]
  },
  {
    title: '测量分析',
    type: 'analysis',
    list: [
      {
        imgurl: getImagePath('analysis', 'measure'),
        title: '综合测量',
        description: '综合坐标、距离、面积和高度差测量，支持结果留存、右键结束和一键清空',
        path: '/example/measure'
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
        title: '可视域分析',
        description: '带视椎体和视线效果的可视域分析',
        path: '/example/viewshed'
      },
      {
        imgurl: getImagePath('analysis', 'lineOfSight'),
        title: '通视分析',
        description: '两点通视与 360° 通视分析',
        path: '/example/lineOfSight'
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
      },
    ]
  },
]
