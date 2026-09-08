/**
 * 动态立体墙材质（淹没分析用）
 * 移植自 dynamicWallMaterialProperty.js，改为显式 import Cesium：
 * 原 js 依赖全局可写 Cesium，ESM 模块命名空间只读会导致赋值报错
 */
import * as Cesium from "cesium";

interface DynamicWallOptions {
  color?: Cesium.Color;
  duration?: number; // 动画周期（毫秒）
  trailImage?: string | false; // 墙身纹理
  viewer?: Cesium.Viewer;
  count?: number;
}

export class DynamicWallMaterialProperty {
  private _definitionChanged: Cesium.Event;
  private _color: Cesium.Color | undefined;
  private _colorSubscription: Cesium.Event.RemoveCallback | undefined;
  private _time: number;

  public color?: Cesium.Color;
  public duration?: number;
  public trailImage?: string | false;
  public viewer?: Cesium.Viewer;
  public count?: number;

  constructor(options: DynamicWallOptions = {}) {
    this._definitionChanged = new Cesium.Event();
    this._color = undefined;
    this._colorSubscription = undefined;
    this.color = options.color;
    this.duration = options.duration;
    this.trailImage = options.trailImage;
    this._time = new Date().getTime();
    this.viewer = options.viewer;
    this.count = options.count;
  }

  get isConstant() {
    return false;
  }

  get definitionChanged() {
    return this._definitionChanged;
  }

  getType() {
    return "AnalysisDynamicWall";
  }

  getValue(time: Cesium.JulianDate, result?: any) {
    if (!Cesium.defined(result)) {
      result = {};
    }
    result.color = Cesium.Property.getValueOrClonedDefault(
      this._color,
      time,
      Cesium.Color.WHITE,
      result.color,
    );
    if (this.trailImage) {
      result.image = this.trailImage;
    } else {
      result.image = (Cesium.Material as any).AnalysisDynamicWallImage;
    }

    if (this.count) {
      result.count = this.count;
    }

    if (this.duration) {
      result.time = ((new Date().getTime() - this._time) % this.duration) / this.duration;
    }
    this.viewer?.scene.requestRender();
    return result;
  }

  equals(other: any) {
    return (
      this === other ||
      (other instanceof DynamicWallMaterialProperty &&
        Cesium.Property.equals(this._color, other._color))
    );
  }
}

Object.defineProperties(DynamicWallMaterialProperty.prototype, {
  color: Cesium.createPropertyDescriptor("color"),
});

const Material = Cesium.Material as any;

Material.AnalysisDynamicWallType = "AnalysisDynamicWall";
Material.AnalysisDynamicWallImage = "/textures/flow-wall-1.png";

Material.AnalysisDynamicWallSource =
  "czm_material czm_getMaterial(czm_materialInput materialInput)\n\
                                            {\n\
                                            czm_material material = czm_getDefaultMaterial(materialInput);\n\
                                            vec2 st = materialInput.st;\n\
                                            vec4 colorImage = texture(image, vec2(fract(float(count * st.t - 2000. - time)), fract(st.s)));\n\
                                            float streak = colorImage.a;\n\
                                            // 透明纹理区域用实心色墙面，条纹处叠加亮色流动\n\
                                            material.diffuse = mix(color.rgb, colorImage.rgb, streak);\n\
                                            material.alpha = max(color.a, streak);\n\
                                            material.emission = mix(color.rgb * 0.35, colorImage.rgb * 0.85, streak);\n\
                                            return material;\n\
                                            }";

Material._materialCache.addMaterial(Material.AnalysisDynamicWallType, {
  fabric: {
    type: Material.AnalysisDynamicWallType,
    uniforms: {
      color: new Cesium.Color(1.0, 1.0, 1.0, 1),
      image: Material.AnalysisDynamicWallImage,
      time: 0,
      count: 1,
    },
    source: Material.AnalysisDynamicWallSource,
  },
  translucent: function (material: any) {
    return true;
  },
});
