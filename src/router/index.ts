// src/router/index.ts
import { createRouter, RouteRecordRaw,createWebHashHistory } from 'vue-router';
import Layout from '../views/Layout.vue';
import Home from '../views/Home.vue';
import basicCase from '../views/basicCase.vue';
import ComprehensiveCase from '../views/ComprehensiveCase.vue';
import Projects from '../views/projects.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/case',
    component: Layout,
    children: [
      {
        path: '/basicCase',
        name: 'basicCase',
        props: true,
        component: basicCase
      },
      {
        path: 'ComprehensiveCase',
        name: 'ComprehensiveCase',
        component: ComprehensiveCase
      }
    ]
  },
  {
    path: '/example',
    name: 'example',
    component: () => import('@/views/example.vue'),
    children: [
      {
        path: '/example/initCesium',
        name: 'initCesium',
        component: () => import('@/views/example/imageLayer/initCesium.vue')
      },
      {
        path: '/example/tdt_img',
        name: 'tdt_img',
        component: () => import('@/views/example/imageLayer/tdtImg.vue')
      },
      {
        path: '/example/tdt_vector',
        name: 'tdt_vector',
        component: () => import('@/views/example/imageLayer/tdtVector.vue')
      },
      {
        path: '/example/gaode_img',
        name: 'gaode_img',
        component: () => import('@/views/example/imageLayer/gaodeImg.vue')
      },
      {
        path: '/example/gaode_vector',
        name: 'gaode_vector',
        component: () => import('@/views/example/imageLayer/gaodeVector.vue')
      },
      {
        path: '/example/bing_img',
        name: 'bing_img',
        component: () => import('@/views/example/imageLayer/bingImg.vue')
      },
      {
        path: '/example/bing_vector',
        name: 'bing_vector',
        component: () => import('@/views/example/imageLayer/bingVector.vue')
      },
      {
        path: '/example/tileGrid',
        name: 'tileGrid',
        component: () => import('@/views/example/imageLayer/tileGrid.vue')
      },
      {
        path: '/example/grid',
        name: 'grid',
        component: () => import('@/views/example/imageLayer/grid.vue')
      },
      {
        path: '/example/darkmap',
        name: 'darkmap',
        component: () => import('@/views/example/imageLayer/darkMap.vue')
      },
      {
        path: '/example/changeMap',
        name: 'changeMap',
        component: () => import('@/views/example/imageLayer/changeMap.vue')
      },
      {
        path: '/example/editMapColor',
        name: 'editMapColor',
        component: () => import('@/views/example/imageLayer/editMapColor.vue')
      },
      {
        path: '/example/areaMap',
        name: 'areaMap',
        component: () => import('@/views/example/imageLayer/areaMap.vue')
      },
      {
        path: '/example/night',
        name: 'night',
        component: () => import('@/views/example/imageLayer/night.vue')
      },
      {
        path: '/example/singleImg',
        name: 'singleImg',
        component: () => import('@/views/example/imageLayer/singleImg.vue')
      },
      // skybox
      {
        path: '/example/skybox',
        name: 'skybox',
        component: () => import('@/views/example/skybox/skybox.vue')
      },
      {
        path: '/example/groundSkybox',
        name: 'groundSkybox',
        component: () => import('@/views/example/skybox/groundSkybox.vue')
      },
      {
        path: '/example/background',
        name: 'background',
        component: () => import('@/views/example/skybox/background.vue')
      },
      {
        path: '/example/dynamicSkybox',
        name: 'dynamicSkybox',
        component: () => import('@/views/example/skybox/dynamicSkybox.vue')
      },
      // billboard
      {
        path: '/example/basicBillboard',
        name: 'basicBillboard',
        component: () => import('@/views/example/billboard/basicBillboard.vue')
      },
      {
        path: '/example/bounceBillboard',
        name: 'bounceBillboard',
        component: () => import('@/views/example/billboard/bounceBillboard.vue')
      },
      {
        path: '/example/animationBillboard',
        name: 'animationBillboard',
        component: () => import('@/views/example/billboard/animationBillboard.vue')
      },
      {
        path: '/example/billboardCluster',
        name: 'billboardCluster',
        component: () => import('@/views/example/billboard/billboardCluster.vue')
      },
      {
        path: '/example/billboardCluster2',
        name: 'billboardCluster2',
        component: () => import('@/views/example/billboard/billboardCluster2.vue')
      },
      {
        path: '/example/primitiveCluster',
        name: 'primitiveCluster',
        component: () => import('@/views/example/billboard/primitiveCluster.vue')
      },
      {
        path: '/example/primitiveBillboard',
        name: 'primitiveBillboard',
        component: () => import('@/views/example/billboard/primitiveBillboard.vue')
      },
      {
        path: '/example/gifBillboard',
        name: 'gifBillboard',
        component: () => import('@/views/example/billboard/gifBillboard.vue')
      },
      {
        path: '/example/htmlBillboard',
        name: 'htmlBillboard',
        component: () => import('@/views/example/billboard/htmlBillboard.vue')
      },
      {
        path: '/example/divBillboard',
        name: 'divBillboard',
        component: () => import('@/views/example/billboard/divBillboard.vue')
      },
      {
        path: '/example/dragableBillboard',
        name: 'dragableBillboard',
        component: () => import('@/views/example/billboard/dragableBillboard.vue')
      },
      {
        path: '/example/css3DdivBillboard',
        name: 'css3DdivBillboard',
        component: () => import('@/views/example/billboard/css3DdivBillboard.vue')
      },
      // polyline
      {
        path: '/example/basicPolyline',
        name: 'basicPolyline',
        component: () => import('@/views/example/polyline/basicPolyline.vue')
      },
      {
        path: '/example/imagePolyline',
        name: 'imagePolyline',
        component: () => import('@/views/example/polyline/imagePolyline.vue')
      },
      {
        path: '/example/dynamicPolyline',
        name: 'dynamicPolyline',
        component: () => import('@/views/example/polyline/dynamicPolyline.vue')
      }, 
      {
        path: '/example/polylineVolume',
        name: 'polylineVolume',
        component: () => import('@/views/example/polyline/polylineVolume.vue')
      },
      {
        path: '/example/verticaltail',
        name: 'verticaltail',
        component: () => import('@/views/example/polyline/verticaltail.vue')
      },
      {
        path: '/example/tailLine',
        name: 'tailLine',
        component: () => import('@/views/example/polyline/tailLine.vue')
      },
      {
        path: '/example/glowLine',
        name: 'glowLine',
        component: () => import('@/views/example/polyline/glowLine.vue')
      },
      // polygon
      {
        path: '/example/polygon',
        name: 'polygon',
        component: () => import('@/views/example/polygon/polygon.vue')
      },
      {
        path: '/example/areaMask',
        name: 'areaMask',
        component: () => import('@/views/example/polygon/areaMask.vue')
      },
      {
        path: '/example/gradientRegion',
        name: 'gradientRegion',
        component: () => import('@/views/example/polygon/gradientRegion.vue')
      },
      // model
      {
        path: '/example/model',
        name: 'model',
        component: () => import('@/views/example/model/model.vue')
      },
      {
        path: '/example/tileset',
        name: 'tileset',
        component: () => import('@/views/example/model/tileset.vue')
      },
      {
        path: '/example/editModel',
        name: 'editModel',
        component: () => import('@/views/example/model/editModel.vue')
      },
      {
        path: '/example/cityTileset',
        name: 'cityTileset',
        component: () => import('@/views/example/model/cityTileset.vue')
      },
      {
        path: '/example/pathTracking',
        name: 'pathTracking',
        component: () => import('@/views/example/model/pathTracking.vue')
      },
      {
        path: '/example/moveControl',
        name: 'moveControl',
        component: () => import('@/views/example/model/moveControl.vue')
      },
      // 雷达
      {
        path: '/example/jamRadar',
        name: 'jamRadar',
        component: () => import('@/views/example/radar/jamRadar.vue')
      },
      {
        path: '/example/scanRadar',
        name: 'scanRadar',
        component: () => import('@/views/example/radar/scanRadar.vue')
      },
      {
        path: '/example/waveRadar',
        name: 'waveRadar',
        component: () => import('@/views/example/radar/waveRadar.vue')
      },
      {
        path: '/example/volumeRadar',
        name: 'volumeRadar',
        component: () => import('@/views/example/radar/volumeRadar.vue')
      },
      {
        path: '/example/electricRadar',
        name: 'electricRadar',
        component: () => import('@/views/example/radar/electricRadar.vue')
      },
      {
        path: '/example/ellipsoidRadar',
        name: 'ellipsoidRadar',
        component: () => import('@/views/example/radar/ellipsoidRadar.vue')
      },
      // camera
      {
        path: '/example/smoothFly',
        name: 'smoothFly',
        component: () => import('@/views/example/camera/smoothFly.vue')
      },
      {
        path: '/example/pointAround',
        name: 'pointAround',
        component: () => import('@/views/example/camera/pointAround.vue')
      },
      {
        path: '/example/pointRotation',
        name: 'pointRotation',
        component: () => import('@/views/example/camera/pointRotation.vue')
      },
      {
        path: '/example/developing',
        name: 'developing',
        component: () => import('@/views/developing.vue')
      },
      // analys
      {
        path: '/example/position',
        name: 'position',
        component: () => import('@/views/example/analysis/position.vue')
      },
    ]
  },
  {
    path: '/projects',
    name: 'projects',
    component: Projects
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// Global before each guard for route navigation
router.beforeEach((to, from, next) => {
  // Check if the route exists or has a valid name
  if (to.name === null || to.matched.length === 0) {
    // Redirect to developing page but preserve the attempted path as a query parameter
    next({ 
      name: 'developing',
      query: { 
        attemptedPath: to.fullPath 
      }
    });
    console.log('Route not found, redirecting to developing page',to, from);
  } else {
    next();
  }
});

export default router;