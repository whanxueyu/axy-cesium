import type { UserConfig, ConfigEnv } from "vite";
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium'
import path from 'path';
const ENV_DIR = path.join(__dirname, "envs");

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const env = loadEnv(mode, process.cwd(), "VITE")
  return {
    plugins: [vue(),cesium()],
    base: './',
    define: {
      "process.env": JSON.stringify(env),
      __APP_ENV__: JSON.stringify(env.APP_ENV),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@stores": path.resolve(__dirname, "./src/stores"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@utils": path.resolve(__dirname, "src/utils"),
        "@views": path.resolve(__dirname, "src/views"),
      },
    },
    server: {
      host: '0.0.0.0',
    },
    envDir: ENV_DIR
  };
});