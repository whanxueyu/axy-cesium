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
    night: 'night.png'
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
    css3DdivBillboard: 'css3DdivBillboard.png'
  },
  polyline: {
    basicPolyline: 'basicPolyline.png',
    dynamicPolyline: 'dynamicPolyline.png',
    imagePolyline: 'imagePolyline.png',
    polygon: 'polygon.png',
  },
  model: {
    model: 'model.png',
    tileset: 'tileset.png',
    editModel: 'editModel.png'
  },
  radar: {
    scan: 'scanRadar.png',
    wave: 'wave.png',
    jam: 'jamRadar.png',
  },
  material: {
    postProcess: 'postProcess.png',
    heatmap: 'heatmap.png',
    terrain: 'terrain.png',
    animation: 'animation.png'
  },
  analysis: {
    basic: 'basic.png'
  },
  camera: {
    around: 'around.png',
    rotation: 'rotation.png'
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
        imgurl: getImagePath('billboard', 'gifBillboard'),
        title: '动态标牌',
        description: '使用gif动图实现动态标牌效果。（目前使用gifler库解析gif，但是效果不理想，无法加载超过1.6M的动图，且加载动图数量稍多就会卡顿，后续寻找更优解）',
        path: '/example/gifBillboard'
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
        // path: '/example/developing'
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
    title: '基础图形',
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
        imgurl: getImagePath('polyline', 'polygon'),
        title: '面状',
        description: '面状效果',
        path: '/example/polygon'
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
        title: '3D Tiles模型加载',
        description: '加载大雁塔倾斜摄影模型',
        path: '/example/tileset'
      },
      {
        imgurl: getImagePath('model', 'editModel'),
        title: '模型编辑',
        description: '模型编辑工具，可沿着XYZ轴平移，旋转，缩放',
        path: '/example/editModel'
      },
    ]
  },
  {
    title: '雷达',
    type: 'radar',
    list: [
      {
        imgurl: getImagePath('radar', 'jam'),
        title: '干扰雷达',
        description: '干扰雷达效果,根据地形及雷达参数计算通讯链路连通性',
        path: '/example/jamRadar'
      },
      {
        imgurl: getImagePath('radar', 'scan'),
        title: '扫描雷达',
        description: '多种方法实现雷达扫描效果',
        path: '/example/scanRadar'
      },
      {
        imgurl: getImagePath('radar', 'wave'),
        title: '扩散雷达',
        description: '多种方法实现雷达扫描效果',
        path: '/example/waveRadar'
      },
    ]
  },
  {
    title: '效果',
    type: 'material',
    list: [
      {
        imgurl: getImagePath('material', 'animation'),
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
      }
    ]
  },
  {
    title: '测量分析',
    type: 'analysis',
    list: [
      {
        imgurl: getImagePath('analysis', 'basic'),
        title: '基础测量',
        description: '点位测量、高度测量、距离测量、面积测量',
        path: '/example/postProcessing'
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
        path: '/example/developing'
      }
    ]
  },
]