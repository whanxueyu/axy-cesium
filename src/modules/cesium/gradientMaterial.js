import * as Cesium from 'cesium';
export default class EllipsoidGradientMaterialProperty {
    constructor(options) {
      this._definitionChanged = new Cesium.Event();
      this._color1 = undefined;
      this._color2 = undefined;
      this._color3 = undefined;
      this._color4 = undefined;
      this._direction = undefined;
      this._transition1 = undefined;
      this._transition2 = undefined;
      this._transition3 = undefined;
      // 新增阈值参数
      this._threshold1 = undefined;
      this._threshold2 = undefined;
      this._threshold3 = undefined;
      // 新增过渡宽度
      this._transitionWidth = undefined;
      
      // 设置默认值
      this.color1 = options.color1 || new Cesium.Color(0.0, 0.0, 1.0, 1.0);    // 蓝色
      this.color2 = options.color2 || new Cesium.Color(0.0, 1.0, 0.0, 1.0);    // 绿色
      this.color3 = options.color3 || new Cesium.Color(1.0, 1.0, 0.0, 1.0);    // 黄色
      this.color4 = options.color4 || new Cesium.Color(1.0, 0.0, 0.0, 1.0);    // 红色
      this.direction = options.direction || 0.0;                                // 垂直渐变
      this.transition1 = options.transition1 || 0.33;                           // 第一过渡点
      this.transition2 = options.transition2 || 0.66;                           // 第二过渡点
      this.transition3 = options.transition3 || 1.0;                            // 第三过渡点
      // 设置默认阈值（新增）
      this.threshold1 = options.threshold1 !== undefined ? options.threshold1 : 0.2;
      this.threshold2 = options.threshold2 !== undefined ? options.threshold2 : 0.5;
      this.threshold3 = options.threshold3 !== undefined ? options.threshold3 : 0.8;
      // 设置默认过渡宽度（新增）
      this.transitionWidth = options.transitionWidth !== undefined ? options.transitionWidth : 0.05;
    }
    
    get isConstant() {
      return false;
    }

    get definitionChanged() {
      return this._definitionChanged;
    }
    
    // eslint-disable-next-line
    getType(time) {
      return Cesium.Material.EllipsoidElectricMaterialType;
    }

    getValue(time, result) {
      if (!Cesium.defined(result)) {
        result = {};
      }
      
      // 获取各颜色属性值
      result.color1 = Cesium.Property.getValueOrDefault(this._color1, time, new Cesium.Color(0.0, 0.0, 1.0, 1.0), result.color1);
      result.color2 = Cesium.Property.getValueOrDefault(this._color2, time, new Cesium.Color(0.0, 1.0, 0.0, 1.0), result.color2);
      result.color3 = Cesium.Property.getValueOrDefault(this._color3, time, new Cesium.Color(1.0, 1.0, 0.0, 1.0), result.color3);
      result.color4 = Cesium.Property.getValueOrDefault(this._color4, time, new Cesium.Color(1.0, 0.0, 0.0, 1.0), result.color4);
      
      // 获取方向和过渡点
      result.direction = Cesium.Property.getValueOrDefault(this._direction, time, 0.0, result.direction);
      result.transition1 = Cesium.Property.getValueOrDefault(this._transition1, time, 0.33, result.transition1);
      result.transition2 = Cesium.Property.getValueOrDefault(this._transition2, time, 0.66, result.transition2);
      result.transition3 = Cesium.Property.getValueOrDefault(this._transition3, time, 1.0, result.transition3);
      // 获取阈值（新增）
      result.threshold1 = Cesium.Property.getValueOrDefault(this._threshold1, time, 0.2, result.threshold1);
      result.threshold2 = Cesium.Property.getValueOrDefault(this._threshold2, time, 0.5, result.threshold2);
      result.threshold3 = Cesium.Property.getValueOrDefault(this._threshold3, time, 0.8, result.threshold3);
      // 获取过渡宽度（新增）
      result.transitionWidth = Cesium.Property.getValueOrDefault(this._transitionWidth, time, 0.05, result.transitionWidth);
      
      return result;
    }

    equals(other) {
      return (this === other ||
        (other instanceof EllipsoidGradientMaterialProperty &&
          Cesium.Property.equals(this._color1, other._color1) &&
          Cesium.Property.equals(this._color2, other._color2) &&
          Cesium.Property.equals(this._color3, other._color3) &&
          Cesium.Property.equals(this._color4, other._color4) &&
          Cesium.Property.equals(this._direction, other._direction) &&
          Cesium.Property.equals(this._transition1, other._transition1) &&
          Cesium.Property.equals(this._transition2, other._transition2) &&
          Cesium.Property.equals(this._transition3, other._transition3) &&
          // 比较新增属性
          Cesium.Property.equals(this._threshold1, other._threshold1) &&
          Cesium.Property.equals(this._threshold2, other._threshold2) &&
          Cesium.Property.equals(this._threshold3, other._threshold3) &&
          Cesium.Property.equals(this._transitionWidth, other._transitionWidth)))
    }
  }
  
  // 定义属性描述符
  Object.defineProperties(EllipsoidGradientMaterialProperty.prototype, {
    color1: Cesium.createPropertyDescriptor('color1'),
    color2: Cesium.createPropertyDescriptor('color2'),
    color3: Cesium.createPropertyDescriptor('color3'),
    color4: Cesium.createPropertyDescriptor('color4'),
    direction: Cesium.createPropertyDescriptor('direction'),
    transition1: Cesium.createPropertyDescriptor('transition1'),
    transition2: Cesium.createPropertyDescriptor('transition2'),
    transition3: Cesium.createPropertyDescriptor('transition3'),
    // 新增阈值属性
    threshold1: Cesium.createPropertyDescriptor('threshold1'),
    threshold2: Cesium.createPropertyDescriptor('threshold2'),
    threshold3: Cesium.createPropertyDescriptor('threshold3'),
    // 新增过渡宽度属性
    transitionWidth: Cesium.createPropertyDescriptor('transitionWidth')
  });
  
  // 注册到Cesium
  Cesium.Material.EllipsoidElectricMaterialType = 'EllipsoidElectricMaterialType';
  
  // 四色渐变着色器（修改为硬边过渡）
  Cesium.Material.EllipsoidElectricMaterialSource = `
    uniform vec4 color1;
    uniform vec4 color2;
    uniform vec4 color3;
    uniform vec4 color4;
    uniform float direction;
    uniform float transition1;
    uniform float transition2;
    uniform float transition3;
    // 新增阈值参数
    uniform float threshold1;
    uniform float threshold2;
    uniform float threshold3;
    // 新增过渡宽度
    uniform float transitionWidth;
    
    czm_material czm_getMaterial(czm_materialInput materialInput) {
      czm_material material = czm_getDefaultMaterial(materialInput);
      vec2 st = materialInput.st;
      
      // 根据方向选择渐变轴 (0=垂直, 1=水平)
      float gradient = direction < 0.5 ? st.t : st.s;
      
      // 硬边过渡计算（仅在阈值附近小范围渐变）
      vec4 finalColor;
      
      // 1. 蓝色区域：gradient <= threshold1
      if (gradient <= threshold1) {
        finalColor = color1;
      } 
      // 2. 蓝绿过渡：threshold1 < gradient <= threshold1 + transitionWidth
      else if (gradient <= threshold1 + transitionWidth) {
        float t = (gradient - threshold1) / transitionWidth;
        finalColor = mix(color1, color2, t);
      }
      // 3. 绿色区域：threshold1 + transitionWidth < gradient <= threshold2
      else if (gradient <= threshold2) {
        finalColor = color2;
      }
      // 4. 绿黄过渡：threshold2 < gradient <= threshold2 + transitionWidth
      else if (gradient <= threshold2 + transitionWidth) {
        float t = (gradient - threshold2) / transitionWidth;
        finalColor = mix(color2, color3, t);
      }
      // 5. 黄色区域：threshold2 + transitionWidth < gradient <= threshold3
      else if (gradient <= threshold3) {
        finalColor = color3;
      }
      // 6. 黄红过渡：threshold3 < gradient <= threshold3 + transitionWidth
      else if (gradient <= threshold3 + transitionWidth) {
        float t = (gradient - threshold3) / transitionWidth;
        finalColor = mix(color3, color4, t);
      }
      // 7. 红色区域：gradient > threshold3 + transitionWidth
      else {
        finalColor = color4;
      }
      
      // 设置材质属性
      material.diffuse = finalColor.rgb;
      material.alpha = 1.0;
      return material;
    }
  `;
  
  // 注册材质到Cesium材质缓存
  Cesium.Material._materialCache.addMaterial(Cesium.Material.EllipsoidElectricMaterialType, {
    fabric: {
      type: Cesium.Material.EllipsoidElectricMaterialType,
      uniforms: {
        color1: new Cesium.Color(0.0, 0.0, 1.0, 1.0),    // 蓝色
        color2: new Cesium.Color(0.0, 1.0, 0.0, 1.0),    // 绿色
        color3: new Cesium.Color(1.0, 1.0, 0.0, 1.0),    // 黄色
        color4: new Cesium.Color(1.0, 0.0, 0.0, 1.0),    // 红色
        direction: 0.0,                                  // 0=垂直渐变, 1=水平渐变
        transition1: 0.33,                               // 第一过渡点
        transition2: 0.66,                               // 第二过渡点
        transition3: 1.0,                                // 第三过渡点
        // 新增阈值参数
        threshold1: 0.2,
        threshold2: 0.5,
        threshold3: 0.8,
        // 新增过渡宽度
        transitionWidth: 0.05
      },
      source: Cesium.Material.EllipsoidElectricMaterialSource
    },
    translucent: function(material) {
      return true;
    }
  });