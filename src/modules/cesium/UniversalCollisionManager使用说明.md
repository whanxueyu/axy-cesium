# 通用实体碰撞检测管理器使用说明

## 概述

`UniversalCollisionManager` 是一个通用的 Cesium 实体碰撞检测管理器，支持点、标签、广告牌、模型等各种实体类型的碰撞检测。通过计算实体在屏幕上的包围盒来检测碰撞，并根据优先级隐藏低优先级的实体。

### 🎯 版本兼容性

**新特性**：现已支持 **Cesium 1.60 到最新版本** 的兼容性！管理器会自动检测您的 Cesium 版本并选择最合适的 API 调用方式。详见 [版本兼容性说明](./UniversalCollisionManager_版本兼容性说明.md)。

## 功能特性

- ✅ 支持多种实体类型：点(point)、标签(label)、广告牌(billboard)、模型(model)
- ✅ 支持 Primitive 类型：点集合、广告牌集合、线集合、多边形等
- ✅ **多版本兼容**：支持 Cesium 1.60+ 到最新版本
- ✅ 基于屏幕坐标的包围盒碰撞检测
- ✅ 优先级管理，高优先级实体优先显示
- ✅ 自定义边界框支持
- ✅ 相机变化时的自动更新（带防抖优化）
- ✅ 调试模式，可视化包围盒
- ✅ 碰撞统计信息
- ✅ 性能优化和内存管理

## 使用方法

### 1. 基本用法

```javascript
import UniversalCollisionManager from './UniversalCollisionManager.js';

// 创建管理器
const collisionManager = new UniversalCollisionManager(viewer, {
  debounceDelay: 200, // 防抖延迟
  padding: 5, // 包围盒扩展像素
  enableDebug: false, // 调试模式
});

// 添加点实体
const pointEntity = viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 100),
  point: {
    pixelSize: 10,
    color: Cesium.Color.YELLOW,
  },
});
collisionManager.addEntity(pointEntity.id, pointEntity, 'point', 1);

// 添加标签实体
const labelEntity = viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(116.41, 39.91, 100),
  label: {
    text: '北京',
    font: '16pt monospace',
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    pixelOffset: new Cesium.Cartesian2(0, -20),
  },
});
collisionManager.addEntity(labelEntity.id, labelEntity, 'label', 2);

// 添加广告牌实体
const billboardEntity = viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(116.42, 39.92, 100),
  billboard: {
    image: 'path/to/icon.png',
    width: 32,
    height: 32,
  },
});
collisionManager.addEntity(billboardEntity.id, billboardEntity, 'billboard', 3);

// 添加Primitive点集合
const pointPrimitive = new Cesium.PointPrimitiveCollection();
const positions = [
  Cesium.Cartesian3.fromDegrees(116.43, 39.93, 100),
  Cesium.Cartesian3.fromDegrees(116.44, 39.94, 100),
];
positions.forEach((pos) => {
  pointPrimitive.add({
    position: pos,
    pixelSize: 8,
    color: Cesium.Color.RED,
  });
});
viewer.scene.primitives.add(pointPrimitive);
collisionManager.addEntity(
  pointPrimitive.id,
  pointPrimitive,
  'primitive-point',
  2,
  null, // 无自定义边界
  { positions: positions, pointSize: 8 }, // primitiveInfo
);
```

### 2. 自定义边界框

```javascript
// 使用自定义边界框
collisionManager.addEntity(entity.id, entity, 'custom', 1, {
  width: 64, // 自定义宽度
  height: 48, // 自定义高度
  offsetX: 10, // X轴偏移
  offsetY: -5, // Y轴偏移
});
```

### 3. 动态更新

```javascript
// 更新单个实体
collisionManager.updateEntity(entityId);

// 批量更新多个实体
collisionManager.updateEntities([entityId1, entityId2, entityId3]);

// 移除实体
collisionManager.removeEntity(entityId);
```

### 4. 调试模式

```javascript
// 启用调试模式，可视化包围盒
collisionManager.setDebugMode(true);

// 获取碰撞统计信息
const stats = collisionManager.getCollisionStats();
console.log(`总实体: ${stats.total}, 可见: ${stats.visible}, 隐藏: ${stats.hidden}`);
```

### 5. 销毁管理器

```javascript
// 应用程序结束时销毁管理器
collisionManager.destroy();
```

## 实体类型支持

### 点实体 (point)

- 根据 `pixelSize` 属性计算包围盒
- 自动处理点的屏幕坐标转换

### 标签实体 (label)

- 根据文本内容、字体大小、缩放比例计算包围盒
- 支持 `pixelOffset` 偏移量
- 自动测量文本尺寸

### 广告牌实体 (billboard)

- 根据图片尺寸和缩放比例计算包围盒
- 支持 `pixelOffset` 偏移量
- 处理动态尺寸变化

### 模型实体 (model)

- 使用简化的包围盒计算方案
- 支持模型缩放
- 可通过自定义边界框精确控制

### Primitive 点集合 (primitive-point)

- 支持 `PointPrimitiveCollection` 类型
- 根据 `primitiveInfo.pointSize` 计算包围盒
- 自动处理多个点的合并包围盒

### Primitive 广告牌集合 (primitive-billboard)

- 支持 `BillboardCollection` 类型
- 根据广告牌尺寸和缩放计算包围盒
- 支持动态尺寸和位置

### Primitive 线集合 (primitive-polyline)

- 支持 `PolylineCollection` 类型
- 根据线宽和所有顶点计算包围盒
- 适用于复杂路径和轨迹

### Primitive 多边形 (primitive-polygon)

- 支持各种 `Primitive` 几何体
- 根据顶点位置计算包围盒
- 支持复杂几何形状

## 配置选项

```javascript
const options = {
  debounceDelay: 200, // 相机变化防抖延迟（毫秒）
  padding: 5, // 包围盒扩展像素数
  enableDebug: false, // 是否启用调试模式
};
```

## 性能优化建议

1. **合理设置防抖延迟**：相机快速移动时避免频繁计算
2. **按需更新**：只在实体位置确实改变时调用 `updateEntity`
3. **批量操作**：使用 `updateEntities` 一次性更新多个实体
4. **及时清理**：不需要的实体及时从管理器中移除
5. **调试模式**：生产环境中关闭调试模式

## 与原有 LabelCollisionManager 的区别

| 特性           | LabelCollisionManager | UniversalCollisionManager           |
| -------------- | --------------------- | ----------------------------------- |
| 支持实体类型   | 仅标签                | Entity + Primitive 全类型           |
| Entity 支持    | 仅 Label              | Point、Label、Billboard、Model      |
| Primitive 支持 | 不支持                | Point、Billboard、Polyline、Polygon |
| 包围盒计算     | 标签专用算法          | 针对不同类型的优化算法              |
| 自定义边界     | 不支持                | 支持自定义边界框                    |
| 调试功能       | 无                    | 可视化包围盒                        |
| 统计信息       | 无                    | 提供详细统计                        |
| 扩展性         | 有限                  | 高度可扩展                          |

## Primitive 使用示例

### 点集合 Primitive

```javascript
// 创建点集合
const pointPrimitive = new Cesium.PointPrimitiveCollection();
const positions = [Cesium.Cartesian3.fromDegrees(116.4, 39.9, 100), Cesium.Cartesian3.fromDegrees(116.41, 39.91, 100)];

positions.forEach((pos) => {
  pointPrimitive.add({
    position: pos,
    pixelSize: 10,
    color: Cesium.Color.YELLOW,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
  });
});

viewer.scene.primitives.add(pointPrimitive);

// 注册到碰撞管理器
collisionManager.addEntity('points-1', pointPrimitive, 'primitive-point', 1, null, {
  positions: positions,
  pointSize: 10,
});
```

### 广告牌集合 Primitive

````javascript
// 创建广告牌集合
const billboardPrimitive = new Cesium.BillboardCollection()
const canvas = createIconCanvas() // 自定义图标

positions.forEach(pos => {
  billboardPrimitive.add({
    position: pos,
    image: canvas,
    width: 32,
    height: 32
  })
})

viewer.scene.primitives.add(billboardPrimitive)

// 注册到碰撞管理器
collisionManager.addEntity(
  'billboards-1',
  billboardPrimitive,
  'primitive-billboard',
  3,
  null,
  { positions: positions, width: 32, height: 32, scale: 1.0 }
)

## 扩展开发

如需支持新的实体类型，只需在 `_updateBoundingBox` 方法中添加相应的计算逻辑：

```javascript
case 'custom-type':
  bbox = this._calculateCustomTypeBoundingBox(entityInfo.entity)
  break
````

然后实现对应的包围盒计算方法即可。
