# PopInfo 信息弹窗类使用说明

## 📋 概述

PopInfo 是一个专为 Cesium 地图设计的信息弹窗类，支持在地图上显示带连接线的信息弹窗。该类提供了两种定位模式和完整的拖拽功能，适用于各种地图标注和信息展示场景。

## ✨ 核心特性

### 🌍 双模式定位系统

- **地理坐标模式** (`geographicMode: true`)：弹窗跟随地理位置，地图缩放时保持地理定位
- **屏幕坐标模式** (`geographicMode: false`)：弹窗保持屏幕位置，连接线长度和角度固定

### 🖱️ 完整拖拽支持

- 支持鼠标和触摸拖拽
- 实时连接线更新
- 智能模式处理
- 可动态开启/关闭

### 🎯 智能连接点系统

- **中心连接**：连接线始终连接到弹窗中心点
- **最近角连接**：动态计算并连接到距离锚点最近的弹窗角
- 拖拽过程中连接点保持一致，无跳跃
- 可实时切换连接点类型

### 🎨 高度自定义

- 自定义 DOM 内容
- 灵活的样式配置
- 可配置连接线样式
- 支持动态更新

## 🚀 快速开始

### 基础使用

```javascript
import PopInfo from './src/Utils/PopInfo.js';

// 创建弹窗内容
const popupElement = document.createElement('div');
popupElement.innerHTML = `
    <h3>设备信息</h3>
    <p>位置：北京市朝阳区</p>
    <p>状态：正常运行</p>
`;

// 创建弹窗实例
const popup = new PopInfo({
  viewer: cesiumViewer, // Cesium地图实例
  position: [116.39, 39.91, 0], // 锚点经纬度 [经度, 纬度, 高度]
  element: popupElement, // 弹窗DOM元素
  lineConfig: {
    length: 120, // 连接线长度（像素）
    angle: 45, // 方位角（度，0为正北）
    color: '#ffffff', // 连接线颜色
    width: 2, // 连接线宽度
    anchorPoint: 'nearest', // 连接点：'nearest'(最近角) | 'center'(中心)
  },
});

// 显示弹窗
popup.show();
```

## 📖 详细配置

### 构造函数参数

```javascript
const popup = new PopInfo({
  // 必需参数
  viewer: cesiumViewer, // Cesium.Viewer 实例
  position: [116.39, 39.91, 0], // 锚点位置 [经度, 纬度, 高度]
  element: domElement, // 弹窗内容DOM元素

  // 可选参数
  id: 'my-popup', // 弹窗唯一标识
  geographicMode: true, // 定位模式，默认true
  draggable: true, // 是否允许拖拽，默认true

  // 连接线配置
  lineConfig: {
    length: 100, // 连接线长度（像素）
    angle: 0, // 方位角（度）
    color: '#ffffff', // 颜色
    width: 2, // 宽度
    opacity: 0.8, // 透明度
    anchorPoint: 'nearest', // 连接点：'center'(中心) | 'nearest'(最近角)
  },

  // 样式配置
  style: {
    zIndex: 1000, // 层级
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: '4px',
    padding: '8px',
    color: '#ffffff',
    fontSize: '14px',
    maxWidth: '300px',
    pointerEvents: 'auto',
  },
});
```

## 🎯 使用模式详解

### 1. 地理坐标模式

适用于需要标注地理位置的场景，如 POI 信息、设备位置等。

```javascript
const geoPopup = new PopInfo({
  viewer: cesiumViewer,
  position: [116.39, 39.91, 0],
  element: popupElement,
  geographicMode: true, // 地理坐标模式
  lineConfig: {
    length: 150,
    angle: 45,
    color: '#00ff00',
  },
});

geoPopup.show();

// 特点：
// - 弹窗会记住地理位置
// - 地图缩放时弹窗保持在地理位置上
// - 连接线会随地图视角变化
```

### 2. 屏幕坐标模式

适用于 HUD 界面、工具提示等不需要跟随地理位置的场景。

```javascript
const screenPopup = new PopInfo({
  viewer: cesiumViewer,
  position: [116.39, 39.91, 0],
  element: popupElement,
  geographicMode: false, // 屏幕坐标模式
  lineConfig: {
    length: 100, // 固定长度
    angle: 30, // 固定角度
    color: '#ff0000',
  },
});

screenPopup.show();

// 特点：
// - 弹窗保持在屏幕位置
// - 地图缩放时位置和连接线不变
// - 适合界面元素
```

## 🔧 API 参考

### 调试和故障排除

```javascript
// 开启调试模式（会在弹窗和连接线canvas上显示边框）
popup.setDebugMode(true);

// 获取完整的调试信息
const debugInfo = popup.getDebugInfo();
console.log('PopInfo调试信息:', debugInfo);

// 强制重绘连接线
popup.forceRedrawLine();

// 重置位置缓存
popup.resetPosition();
```

### 显示控制

```javascript
// 显示弹窗
popup.show();

// 隐藏弹窗
popup.hide();

// 获取显示状态
const isVisible = popup.getVisible();
```

### 位置管理

```javascript
// 更新锚点位置
popup.updatePosition([116.4, 39.92, 0]);

// 获取当前位置
const position = popup.getPosition();

// 重置位置缓存
popup.resetPosition();
```

### 模式切换

```javascript
// 切换到地理坐标模式
popup.setGeographicMode(true);

// 切换到屏幕坐标模式
popup.setGeographicMode(false);

// 获取当前模式
const isGeoMode = popup.getGeographicMode();
```

### 拖拽控制

```javascript
// 启用拖拽
popup.setDraggable(true);

// 禁用拖拽
popup.setDraggable(false);

// 获取拖拽状态
const isDraggable = popup.getDraggable();

// 获取当前是否正在拖拽
const isDragging = popup.isDraggingState();
```

### 内容更新

```javascript
// 更新弹窗内容
const newElement = document.createElement('div');
newElement.innerHTML = '<p>新的内容</p>';
popup.updateContent(newElement);

// 更新连接线配置
popup.updateLineConfig({
  length: 200,
  angle: 90,
  color: '#blue',
  anchorPoint: 'center', // 改为连接到弹窗中心
});

// 设置连接点类型
popup.setAnchorPoint('nearest'); // 连接到最近的角
popup.setAnchorPoint('center'); // 连接到弹窗中心

// 获取当前连接点类型
const anchorPoint = popup.getAnchorPoint();
```

### 配置获取

```javascript
// 获取完整配置
const config = popup.getConfig();
console.log(config);
/*
返回格式：
{
    id: "popup-abc123",
    position: [116.39, 39.91, 0],
    lineConfig: { length: 120, angle: 45, ... },
    style: { backgroundColor: "...", ... },
    geographicMode: true,
    draggable: true,
    isVisible: true,
    isDragging: false,
    popupCenterPosition: [116.391, 39.911, 0],
    fixedScreenPosition: null
}
*/
```

### 销毁

```javascript
// 销毁弹窗，释放所有资源
popup.destroy();
```

## 💡 实用示例

### 示例 1：设备状态监控

```javascript
class DevicePopup {
  constructor(viewer, deviceData) {
    this.device = deviceData;
    this.popup = this.createPopup(viewer);
  }

  createPopup(viewer) {
    // 创建设备信息DOM
    const element = document.createElement('div');
    element.className = 'device-popup';
    element.innerHTML = `
            <div class="device-header">
                <h4>${this.device.name}</h4>
                <span class="status ${this.device.status}">${this.device.status}</span>
            </div>
            <div class="device-info">
                <p>类型：${this.device.type}</p>
                <p>位置：${this.device.location}</p>
                <p>最后更新：${this.device.lastUpdate}</p>
            </div>
        `;

    return new PopInfo({
      viewer,
      position: this.device.coordinates,
      element,
      geographicMode: true,
      lineConfig: {
        length: 100,
        angle: 45,
        color: this.getStatusColor(),
        width: 3,
      },
      style: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '200px',
      },
    });
  }

  getStatusColor() {
    const colors = {
      online: '#00ff00',
      offline: '#ff0000',
      warning: '#ffaa00',
    };
    return colors[this.device.status] || '#cccccc';
  }

  updateDevice(newData) {
    this.device = { ...this.device, ...newData };
    this.popup.updateLineConfig({
      color: this.getStatusColor(),
    });
    // 更新DOM内容...
  }

  show() {
    this.popup.show();
  }

  hide() {
    this.popup.hide();
  }

  destroy() {
    this.popup.destroy();
  }
}

// 使用
const device = {
  name: '传感器01',
  type: '温度传感器',
  status: 'online',
  location: '北京市朝阳区',
  coordinates: [116.39, 39.91, 0],
  lastUpdate: '2024-01-01 10:30:00',
};

const devicePopup = new DevicePopup(cesiumViewer, device);
devicePopup.show();
```

### 示例 2：动态弹窗管理器

```javascript
class PopupManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.popups = new Map();
  }

  // 创建弹窗
  createPopup(id, options) {
    if (this.popups.has(id)) {
      this.removePopup(id);
    }

    const popup = new PopInfo({
      viewer: this.viewer,
      id,
      ...options,
    });

    this.popups.set(id, popup);
    return popup;
  }

  // 显示弹窗
  showPopup(id) {
    const popup = this.popups.get(id);
    if (popup) {
      popup.show();
    }
  }

  // 隐藏弹窗
  hidePopup(id) {
    const popup = this.popups.get(id);
    if (popup) {
      popup.hide();
    }
  }

  // 移除弹窗
  removePopup(id) {
    const popup = this.popups.get(id);
    if (popup) {
      popup.destroy();
      this.popups.delete(id);
    }
  }

  // 切换所有弹窗模式
  switchAllMode(geographicMode) {
    this.popups.forEach((popup) => {
      popup.setGeographicMode(geographicMode);
    });
  }

  // 清除所有弹窗
  clearAll() {
    this.popups.forEach((popup) => popup.destroy());
    this.popups.clear();
  }
}

// 使用
const popupManager = new PopupManager(cesiumViewer);

// 创建多个弹窗
popupManager.createPopup('popup1', {
  position: [116.39, 39.91, 0],
  element: element1,
  geographicMode: true,
});

popupManager.createPopup('popup2', {
  position: [116.4, 39.92, 0],
  element: element2,
  geographicMode: false,
});

// 显示弹窗
popupManager.showPopup('popup1');
popupManager.showPopup('popup2');

// 统一切换模式
popupManager.switchAllMode(false);
```

## ⚠️ 注意事项

### 性能考虑

1. **大量弹窗**：当需要显示大量弹窗时，建议实现弹窗池或按需显示机制
2. **频繁更新**：避免过于频繁地更新弹窗位置或内容
3. **内存管理**：使用完毕后及时调用 `destroy()` 方法释放资源

### 兼容性

1. **Cesium 版本**：兼容 Cesium 1.90+ 版本（已处理 API 变更兼容性问题）
2. **API 变更说明**：针对不同版本的 `intersectRay` 方法使用了兼容性处理
3. **浏览器支持**：支持现代浏览器，包括移动端
4. **触摸设备**：完整支持触摸拖拽功能

### 最佳实践

1. **合理选择模式**：根据使用场景选择合适的定位模式
2. **样式统一**：建议为同类弹窗使用统一的样式配置
3. **事件处理**：可以通过 DOM 事件监听弹窗内的交互
4. **错误处理**：在生产环境中添加适当的错误处理逻辑

## 🐛 常见问题

### Q: 弹窗不显示或位置错误？

A: 检查 `viewer` 是否正确传入，`position` 坐标是否有效

### Q: 拖拽后位置不正确？

A: 确认当前的 `geographicMode` 设置是否符合预期

### Q: 连接线不显示？

A: 检查 `lineConfig` 配置，确保颜色和宽度设置正确

### Q: 内存泄漏？

A: 确保在不需要时调用 `destroy()` 方法清理资源

### Q: 移动端拖拽不生效？

A: 检查容器的 `touch-action` CSS 属性，确保没有被禁用

### Q: 连接线不显示？

A: 可能原因及解决方案：

1. 检查 `lineConfig.color` 是否设置正确
2. 开启调试模式：`popup.setDebugMode(true)` 查看 canvas 边框
3. 检查 canvas 的 zIndex 设置是否被其他元素遮挡
4. 调用 `popup.forceRedrawLine()` 强制重绘
5. 通过 `popup.getDebugInfo()` 获取详细信息

### Q: 拖拽后位置偏移？

A: 已修复相对位置计算问题，如果仍有偏移：

1. 检查 Cesium 容器是否有特殊的定位样式
2. 开启调试模式查看容器边框是否正确
3. 尝试调用 `popup.resetPosition()` 重置位置

### Q: 报错 "intersectRay is not a function"？

A: 这是 Cesium 版本兼容性问题。代码已内置 `CesiumCompatHelper` 兼容性辅助类，自动处理不同版本的 API 差异。如果仍有问题，请检查 Cesium 版本是否为 1.90+

---

_最后更新：2025 年 7 月_ | _版本：1.0.0_
