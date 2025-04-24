class DynamicWallMaterialProperty {
  constructor(options) {
    this._definitionChanged = new Cesium.Event();
    this._color = undefined;
    this._colorSubscription = undefined;
    this.color = options.color || Color.BLUE;
    this.duration = options.duration || 1000;
    this.trailImage = options.trailImage;
    this._time = (new Date()).getTime();
  };

  get isConstant() {
    return false;
  }

  get definitionChanged() {
    return this._definitionChanged;
  }

  getType(time) {
    var MaterialType = 'wallType'
    return MaterialType;
  }

  getValue(time, result) {
    if (!Cesium.defined(result)) {
      result = {};
    }
    result.color = Cesium.Property.getValueOrClonedDefault(this._color, time, Cesium.Color.WHITE, result.color);
    result.image = this.trailImage;
    if (this.duration) {
      result.time = (((new Date()).getTime() - this._time) % this.duration) / this.duration;
    }
    viewer.scene.requestRender();
    return result;
  }

  equals(other) {
    return this === other ||
      (other instanceof DynamicWallMaterialProperty
        && Cesium.Property.equals(this._color, other._color))
  }
}

Object.defineProperties(DynamicWallMaterialProperty.prototype, {
  isConstant: {
    get: function () {
      return false;
    }
  },
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    }
  },
  color: Cesium.createPropertyDescriptor('color')
});
/**
 * 带方向的墙体
 * @param {*} options.get:true/false
 * @param {*} options.count:数量
 * @param {*} options.freely:vertical/standard
 * @param {*} options.direction:+/-
 */
function _getDirectionWallShader(options) {
  if (options && options.get) {
    var materail = "czm_material czm_getMaterial(czm_materialInput materialInput)\n\
      {\n\
          czm_material material = czm_getDefaultMaterial(materialInput);\n\
          vec2 st = materialInput.st;";
    if (options.freely == "vertical") { //（由下到上）
      materail += "vec4 colorImage = texture2D(image, vec2(fract(st.s), fract(float(" + options.count + ")*st.t" + options.direction + " time)));\n\ ";
    } else { //（逆时针）
      materail += "vec4 colorImage = texture2D(image, vec2(fract(float(" + options.count + ")*st.s " + options.direction + " time), fract(st.t)));\n\ ";
    }
    //泛光
    materail += "vec4 fragColor;\n\
          fragColor.rgb = (colorImage.rgb+color.rgb) / 1.0;\n\
          fragColor = czm_gammaCorrect(fragColor);\n\
          material.diffuse = colorImage.rgb;\n\
          material.alpha = colorImage.a;\n\
          material.emission = fragColor.rgb;\n\
          return material;\n\
      }";
    return materail
  }
}

Cesium.DynamicWallMaterialProperty = DynamicWallMaterialProperty;
var MaterialType = 'wallType';

Cesium.Material._materialCache.addMaterial(MaterialType, {
  fabric: {
    type: MaterialType,
    uniforms: {
      color: new Cesium.Color(1.0, 0.0, 0.0, 0.5),
      image: Cesium.Material.DefaultImageId,
      time: -20
    },
    source: _getDirectionWallShader({
      get: true,
      count: 20.0,
      freely: 'vertical',//'standard' vertical
      direction: '-'
    })
  },
  translucent: function (material) {
    return true;
  }
});
