# axy-cesium

## 项目简介

`axy-cesium` 是一个基于 Vue 3 和 Cesium 的 3D 可视化案例展示平台。该项目旨在提供一系列 Cesium 示例，帮助开发者学习和掌握 Cesium 的使用方法，并展示其在 GIS 开发中的强大功能。

## 功能特点

- **丰富的示例**：涵盖了从基础的地图图层到复杂的 3D 模型加载，适合不同层次的开发者学习。
- **响应式设计**：使用 Element Plus 组件库，确保界面美观且适应多种设备。
- **性能优化**：通过 Vite 的快速热更新和按需加载机制，提升开发效率和用户体验。
- **模块化设计**：代码结构清晰，便于维护和扩展。

## 目录结构

```plaintext
axy-cesium/
├── public/                   # 静态资源文件
├── src/
│   ├── assets/               # 静态资源（图片、样式等）
│   ├── components/           # 公共组件
│   ├── data/                 # 数据文件（如案例列表）
│   ├── router/               # 路由配置
│   ├── stores/               # 状态管理
│   ├── views/                # 页面组件
│   └── App.vue               # 根组件
├── vite.config.ts            # Vite 构建配置
├── package.json              # 项目依赖和脚本
└── README.md                 # 项目说明文档
```

## 安装与运行
### 前提条件
确保你已经安装了 Node.js 和 npm 或 Yarn。

### 安装依赖
```bash
# 使用 npm
npm install
# 或者使用 Yarn
yarn install
```
### 启动开发服务器
```bash
# 使用 npm
npm run dev

# 或者使用 Yarn
yarn dev
```
启动后，浏览器会自动打开 http://localhost:3000。

### 构建生产版本
```bash
# 使用 npm
npm run build

# 或者使用 Yarn
yarn build
```
构建完成后，生成的静态文件将位于 dist 目录中。

### 预览生产版本
```bash
# 使用 npm
npm run preview

# 或者使用 Yarn
yarn preview
```
## 使用说明
首页 (Home.vue)：包含导航栏、英雄部分、特性卡片、创新部分以及浮动按钮等元素。
案例列表 (caseList.ts)：组织了多个 Cesium 示例，涵盖了从基础的地图图层到复杂的 3D 模型加载。
路由配置 (router/index.ts)：定义了详细的路由规则，支持动态加载不同的示例页面。

## 贡献指南
欢迎任何人对 axy-cesium 进行贡献！你可以通过以下方式参与：

提交问题：如果你发现了任何问题或有改进建议，请在 GitHub Issues 中提交。
提交 Pull Request：如果你修复了某个问题或添加了新功能，请提交 Pull Request。
提交 Pull Request 的步骤


如果你有任何问题或需要进一步的帮助，请随时联系我！

稀土掘金: [安大桃子](https://juejin.cn/user/4169764191092407)

邮箱: 1358042645@qq.com

GitHub: [[axy-cesium](https://github.com/whanxueyu/axy-cesium)]

