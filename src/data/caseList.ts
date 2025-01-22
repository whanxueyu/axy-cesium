import img1 from '@/assets/images/example/init.png';
import tdtimg from '@/assets/images/example/tdtimg.png';
import tdtvector from '@/assets/images/example/tdtvector.png';
import gaodeimg from '@/assets/images/example/gaodeimg.png';
import gaodevector from '@/assets/images/example/gaodevector.png';
import bingimg from '@/assets/images/example/bingimg.png';
import bingvector from '@/assets/images/example/bingvector.png';
import grid from '@/assets/images/example/gird.png';
import tilegrid from '@/assets/images/example/tilegrid.png';
import darkmap from '@/assets/images/example/darkmap.png';
import baselayer from '@/assets/images/example/baselayer.png';
import editlayer from '@/assets/images/example/editlayer.png';
import areaMap from '@/assets/images/example/areaMap.png';
import basicBillboard from '@/assets/images/example/basicBillboard.png';
import cluster from '@/assets/images/example/cluster.png';
import cluster2 from '@/assets/images/example/cluster2.png';
import primitiveBillboard from '@/assets/images/example/primitiveBillboard.png';
import gifBillboard from '@/assets/images/example/gifbillboard.png';
import htmlBillboard from '@/assets/images/example/htmlBillboard.png';
import night from '@/assets/images/example/night.png';
import divBillboard from '@/assets/images/example/divBillboard.png';
import model from '@/assets/images/example/model.png';
import tileset from '@/assets/images/example/tileset.png';
import editModel from '@/assets/images/example/editModel.png';

export const caseList = {
  layers: [
    {
      imgurl: img1,
      title: '初始化',
      description: '最基础的初始化 Cesium 案例。',
      path: '/example/initCesium'
    },
    {
      imgurl: tdtimg,
      title: '天地图影像',
      description: '添加天地图影像，并取消无关图标和widgets。',
      path: '/example/tdt_img'
    },
    {
      imgurl: tdtvector,
      title: '天地图矢量',
      description: '添加天地图矢量，并取消无关图标和widgets。',
      path: '/example/tdt_vector'
    },
    {
      imgurl: gaodeimg,
      title: '高德地图影像',
      description: '添加高德地图影像，并取消无关图标和widgets。',
      path: '/example/gaode_img'
    },
    {
      imgurl: gaodevector,
      title: '高德地图矢量',
      description: '添加高德地图矢量，并取消无关图标和widgets。',
      path: '/example/gaode_vector'
    },
    {
      imgurl: bingimg,
      title: '必应地图影像',
      description: '添加必应地图影像，并取消无关图标和widgets。',
      path: '/example/bing_img'
    },
    {
      imgurl: bingvector,
      title: '必应地图矢量',
      description: '添加必应地图矢量，并取消无关图标和widgets。',
      path: '/example/bing_vector'
    },
    {
      imgurl: grid,
      title: '网格地图',
      description: '生成网格地图，并取消无关图标和widgets。',
      path: '/example/grid'
    },
    {
      imgurl: tilegrid,
      title: '瓦片网格地图',
      description: '生成瓦片网格地图，并取消无关图标和widgets。',
      path: '/example/tileGrid'
    },
    {
      imgurl: areaMap,
      title: '区域地图加载',
      description: '在指定区域单独加载图层',
      path: '/example/areaMap'
    },
    {
      imgurl: night,
      title: '夜晚地图',
      description: '夜晚地图效果，白天黑夜图层切换模拟地球自传动态效果',
      path: '/example/night'
    },
    {
      imgurl: darkmap,
      title: '暗色（反色）地图',
      description: '通过修改涂层颜色通道生成暗色底图',
      path: '/example/darkmap'
    },
    {
      imgurl: baselayer,
      title: '切换底图',
      description: '自定义基础图层选择组件，点击随意切换各种底图',
      path: '/example/changeMap'
    },
    {
      imgurl: editlayer,
      title: '编辑地图颜色',
      description: '可根据调整参数，随意生成自己喜欢的底图颜色',
      path: '/example/editMapColor'
    },
    
  ],
  billboard:[
    {
      imgurl: basicBillboard,
      title: '基础标牌',
      description: '基础标牌的各个参数效果对比展示',
      path: '/example/basicBillboard'
    },
    {
      imgurl: cluster,
      title: 'entity标牌聚合效果',
      description: '随机生成500个点位，并实现不同层级的聚合效果',
      path: '/example/billboardCluster'
    },
    {
      imgurl: cluster2,
      title: 'entity标牌自定义聚合效果',
      description: '随机生成500个点位，并实现不同层级的自定义聚合效果',
      path: '/example/billboardCluster2'
    },
    {
      imgurl: primitiveBillboard,
      title: 'primitive标牌(高性能)',
      description: '随机生成10000个点位，可支持更多点位渲染',
      path: '/example/primitiveBillboard'
    },
    {
      imgurl: primitiveBillboard,
      title: 'primitive标牌聚合(高性能)',
      description: '随机生成10000个点位，可支持更多点位渲染',
      path: '/example/primitiveCluster'
    },
    {
      imgurl: gifBillboard,
      title: '动态标牌',
      description: '使用gif动图实现动态标牌效果。（目前使用gifler库解析gif，但是效果不理想，无法加载超过1.6M的动图，且加载动图数量稍多就会卡顿，后续寻找更优解）',
      path: '/example/gifBillboard'
    },
    {
      imgurl: htmlBillboard,
      title: 'html自定义标牌',
      description: '使用html作为标牌，有更高的自由度，可以实现自己的交互逻辑',
      path: '/example/htmlBillboard'
    },
    {
      imgurl: divBillboard,
      title: 'div标牌终极方案',
      description: '封装了divBillboard类，可以加载任意的vue组件',
      path: '/example/divBillboard'
    },

  ],
  model:[
    {
      imgurl: model,
      title: 'gltf模型加载',
      description: '加载基础的各类glb单体模型',
      path: '/example/model'
    },
    {
      imgurl: tileset,
      title: '3D Tiles模型加载',
      description: '加载大雁塔倾斜摄影模型',
      path: '/example/tileset'
    },
    {
      imgurl: editModel,
      title: '模型编辑',
      description: '模型编辑工具，可沿着XYZ轴平移，旋转，缩放',
      path: '/example/editModel'
    },

  ]
}