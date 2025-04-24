


/*
 * @Description: 动态扩散墙的墙体效果（参考开源代码）（不同高度透明度不同）
 * @Version: 1.0
 * @Author: Julian
 * @Date: 2022-03-07 19:50:46
 * @LastEditors: Julian
 * @LastEditTime: 2022-03-07 19:56:30
 */
class RadarRadiationWaveMaterialProperty {
  constructor(options) {
    this._definitionChanged = new Cesium.Event();
    this._color = undefined;
    this.color = options.color;
    this.repeat = options.repeat;
    this.offset = options.offset;
    this.thickness = options.thickness;
    this.duration = options.duration || 1000;
    this._time = (new Date()).getTime();
  };

  get isConstant () {
    return false;
  }

  get definitionChanged () {
    return this._definitionChanged;
  }

  getType (time) {
    return Cesium.Material.RadarRadiationWaveMaterialType;
  }

  getValue (time, result) {
    if (!Cesium.defined(result)) {
      result = {};
    }

    result.color = Cesium.Property.getValueOrDefault(this._color, time, Cesium.Color.RED, result.color);
    result.repeat = Cesium.Property.getValueOrDefault(this.repeat, time, 1, result.repeat);
    result.offset = Cesium.Property.getValueOrDefault(this.offset, time, 0, result.offset);
    result.thickness = Cesium.Property.getValueOrDefault(this.thickness, time, 0.8, result.thickness);
    result.time = (((new Date()).getTime() - this._time) % this.duration) / this.duration / 10;
    return result
  }

  equals (other) {
    return (this === other ||
      (other instanceof RadarRadiationWaveMaterialProperty &&
        Cesium.Property.equals(this._color, other._color) &&
        Cesium.Property.equals(this.repeat, other.repeat) &&
        Cesium.Property.equals(this.offset, other.offset) &&
        Cesium.Property.equals(this.thickness, other.thickness))
    )
  }
}

Object.defineProperties(RadarRadiationWaveMaterialProperty.prototype, {
  color: Cesium.createPropertyDescriptor('color'),
  repeat: Cesium.createPropertyDescriptor('repeat'),
  offset: Cesium.createPropertyDescriptor('offset'),
  thickness: Cesium.createPropertyDescriptor('thickness'),
})

Cesium.RadarRadiationWaveMaterialProperty = RadarRadiationWaveMaterialProperty;
Cesium.Material.RadarRadiationWaveMaterialProperty = 'RadarRadiationWaveMaterialProperty';
Cesium.Material.RadarRadiationWaveMaterialType = 'RadarRadiationWaveMaterialType';
Cesium.Material.RadarRadiationWaveMaterialSource =
  `
   uniform vec4 color;
                  uniform float repeat;
                  uniform float offset;
                  uniform float thickness;
                  czm_material czm_getMaterial(czm_materialInput materialInput)
                  {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    float sp = 1.0/repeat;
                    vec2 st = materialInput.st;
                    float dis = distance(st, vec2(0.5));
                    float m = mod(dis + (offset)*st.t-time, sp);
                    float a = step(sp*(1.0-thickness), m);
                    material.diffuse = color.rgb;
                    material.alpha = a * color.a * dis * 1.2;
                    return material;
    }                                         
    `
Cesium.Material._materialCache.addMaterial(Cesium.Material.RadarRadiationWaveMaterialType, {
  fabric: {
    type: Cesium.Material.RadarRadiationWaveMaterialType,
    uniforms: {
      color: new Cesium.Color(0.2, 1, 0, 1),
      repeat: 1,
      offset: 0,
      thickness: 0.8,
      time: -20
    },
    source: Cesium.Material.RadarRadiationWaveMaterialSource
  },
  translucent: function (material) {
    return true;
  }
})