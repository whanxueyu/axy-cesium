// src/router/index.ts
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Layout from '../views/Layout.vue';
import Home from '../views/Home.vue';
import basicCase from '../views/basicCase.vue';
import ComprehensiveCase from '../views/ComprehensiveCase.vue';

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
        path: '/basicCase/:type',
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
        path: '/example/basicBillboard',
        name: 'basicBillboard',
        component: () => import('@/views/example/billboard/basicBillboard.vue')
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
        component: () => import('@/views/example/billboard/primitiveCluster2.vue')
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
    ]
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

export default router;