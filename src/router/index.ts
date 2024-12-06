// src/router/index.ts
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Layout from '../views/Layout.vue';
import Home from '../views/Home.vue';
import basicCase from '../views/basicCase.vue';
import ComprehensiveCase from '../views/ComprehensiveCase.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: '',
        name: 'Home',
        component: Home
      },
      {
        path: 'basicCase',
        name: 'basicCase',
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
    ]
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

export default router;