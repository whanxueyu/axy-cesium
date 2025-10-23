import * as Cesium from 'cesium';
export default class EllipsoidElectricMaterialProperty {
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
      
      // 设置默认值
      this.color1 = options.color1 || new Cesium.Color(0.0, 0.0, 1.0, 1.0);    // 蓝色
      this.color2 = options.color2 || new Cesium.Color(0.0, 1.0, 0.0, 1.0);    // 绿色
      this.color3 = options.color3 || new Cesium.Color(1.0, 1.0, 0.0, 1.0);    // 黄色
      this.color4 = options.color4 || new Cesium.Color(1.0, 0.0, 0.0, 1.0);    // 红色
      this.direction = options.direction || 0.0;                                // 垂直渐变
      this.transition1 = options.transition1 || 0.33;                           // 第一过渡点
      this.transition2 = options.transition2 || 0.66;                           // 第二过渡点
      this.transition3 = options.transition3 || 1.0;                            // 第三过渡点
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
      
      return result;
    }
  
    equals(other) {
      return (this === other ||
        (other instanceof EllipsoidElectricMaterialProperty &&
          Cesium.Property.equals(this._color1, other._color1) &&
          Cesium.Property.equals(this._color2, other._color2) &&
          Cesium.Property.equals(this._color3, other._color3) &&
          Cesium.Property.equals(this._color4, other._color4) &&
          Cesium.Property.equals(this._direction, other._direction) &&
          Cesium.Property.equals(this._transition1, other._transition1) &&
          Cesium.Property.equals(this._transition2, other._transition2) &&
          Cesium.Property.equals(this._transition3, other._transition3)))
    }
  }
  
  // 定义属性描述符
  Object.defineProperties(EllipsoidElectricMaterialProperty.prototype, {
    color1: Cesium.createPropertyDescriptor('color1'),
    color2: Cesium.createPropertyDescriptor('color2'),
    color3: Cesium.createPropertyDescriptor('color3'),
    color4: Cesium.createPropertyDescriptor('color4'),
    direction: Cesium.createPropertyDescriptor('direction'),
    transition1: Cesium.createPropertyDescriptor('transition1'),
    transition2: Cesium.createPropertyDescriptor('transition2'),
    transition3: Cesium.createPropertyDescriptor('transition3')
  });
  
  // 注册到Cesium
//   Cesium.EllipsoidElectricMaterialProperty = EllipsoidElectricMaterialProperty;
  Cesium.Material.EllipsoidElectricMaterialType = 'EllipsoidElectricMaterialType';
  
  // 四色渐变着色器
  Cesium.Material.EllipsoidElectricMaterialSource = `
    uniform vec4 color1;
    uniform vec4 color2;
    uniform vec4 color3;
    uniform vec4 color4;
    uniform float direction;
    uniform float transition1;
    uniform float transition2;
    uniform float transition3;
    
    czm_material czm_getMaterial(czm_materialInput materialInput) {
      czm_material material = czm_getDefaultMaterial(materialInput);
      vec2 st = materialInput.st;
      
      // 确保过渡点有序
      float t1 = min(transition1, min(transition2, transition3));
      float t2 = min(max(transition1, transition2), max(transition2, transition3));
      float t3 = max(transition1, max(transition2, transition3));
      
      // 根据方向选择渐变轴 (0=垂直, 1=水平)
      float gradient = direction < 0.5 ? st.t : st.s;
      
      // 四色渐变计算
      vec4 finalColor;
      if (gradient <= t1) {
        // 第一段: color1 -> color2
        finalColor = mix(color1, color2, gradient / t1);
      } else if (gradient <= t2) {
        // 第二段: color2 -> color3
        finalColor = mix(color2, color3, (gradient - t1) / (t2 - t1));
      } else if (gradient <= t3) {
        // 第三段: color3 -> color4
        finalColor = mix(color3, color4, (gradient - t2) / (t3 - t2));
      } else {
        // 超出范围使用color4
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
        transition3: 1.0                                 // 第三过渡点
      },
      source: Cesium.Material.EllipsoidElectricMaterialSource
    },
    translucent: function(material) {
      return true;
    }
  });