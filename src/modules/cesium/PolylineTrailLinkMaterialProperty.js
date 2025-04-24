function PolylineTrailLinkMaterialProperty(color, duration, d, imgurl) {
  this._definitionChanged = new Cesium.Event();
  this._color = undefined;
  this._image = undefined;
  this._colorSubscription = undefined;
  this.color = color;
  this.image = imgurl;
  this.duration = duration || 3000;
  this._time = new Date().getTime();
  this.repeat = { x: 20, y: 1 };
  this._d = d;
}

Object.defineProperties(PolylineTrailLinkMaterialProperty.prototype, {
  isConstant: {
    get: function () {
      return false;
    },
  },
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },
  color: Cesium.createPropertyDescriptor('color'),
  image: Cesium.createPropertyDescriptor('image')
});

PolylineTrailLinkMaterialProperty.prototype.getType = function (time) {
  return 'PolylineTrailLink';
};

PolylineTrailLinkMaterialProperty.prototype.getValue = function (time, result) {
  if (!Cesium.defined(result)) {
    result = {};
  }
  result.color = Cesium.Property.getValueOrClonedDefault(
    this._color,
    time,
    Cesium.Color.WHITE,
    result.color
  );
  // result.image = Cesium.Material.PolylineTrailLinkImage;
  result.image = Cesium.Property.getValueOrUndefined(this._image, time);
  result.time = (((new Date().getTime() - this._time) % this.duration) / this.duration) * this._d;
  result.repeat = this.repeat;
  return result;
};

PolylineTrailLinkMaterialProperty.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof PolylineTrailLinkMaterialProperty &&
      Cesium.Property.equals(this._color, other._color) &&
      Cesium.Property.equals(this._image, other._image))
  );
};

Cesium.PolylineTrailLinkMaterialProperty = PolylineTrailLinkMaterialProperty;
Cesium.Material.PolylineTrailLinkType = 'PolylineTrailLink';
Cesium.Material.PolylineTrailLinkImage = './line.png';

Cesium.Material.PolylineTrailLinkSource = `
    czm_material czm_getMaterial(czm_materialInput materialInput)
    {
        czm_material material = czm_getDefaultMaterial(materialInput);
        vec2 st = materialInput.st * repeat;
        vec4 colorImage = texture(image, vec2(fract(st.s - time), st.t));
        material.alpha = colorImage.a * color.a;
        material.diffuse = (colorImage.rgb+color.rgb)/2.0;
        material.emission = colorImage.rgb * color.rgb;
        return material;
    }
`;

Cesium.Material._materialCache.addMaterial(Cesium.Material.PolylineTrailLinkType, {
  fabric: {
    type: Cesium.Material.PolylineTrailLinkType,
    uniforms: {
      color: new Cesium.Color(0.0, 0.0, 1.0, 0.5),
      image: Cesium.Material.PolylineTrailLinkImage,
      time: -20,
      repeat: {
        x: 1,
        y: 1
      }
    },
    source: Cesium.Material.PolylineTrailLinkSource,
  },
  translucent: function (material) {
    return true;
  },
});
