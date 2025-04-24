class CircleSpiralMaterialProperty {
    constructor(options) {
        this._definitionChanged = new Cesium.Event();
        this._color = undefined;
        this._speed = undefined;
        this.color = options.color;
        this.speed = options.speed;
    };


    get isConstant() {
        return false;
    }


    get definitionChanged() {
        return this._definitionChanged;
    }


    getType(time) {
        return Cesium.Material.CircleSpiralMaterialType;
    }


    getValue(time, result) {
        if (!Cesium.defined(result)) {
            result = {};
        }

        result.color = Cesium.Property.getValueOrDefault(this._color, time, Cesium.Color.RED, result.color);
        result.speed = Cesium.Property.getValueOrDefault(this._speed, time, 10, result.speed);
        return result
    }


    equals(other) {
        return (this === other ||
            (other instanceof CircleSpiralMaterialProperty &&
                Cesium.Property.equals(this._color, other._color) &&
                Cesium.Property.equals(this._speed, other._speed))
        )
    }
}

Object.defineProperties(CircleSpiralMaterialProperty.prototype, {
    color: Cesium.createPropertyDescriptor('color'),
    speed: Cesium.createPropertyDescriptor('speed')
})

Cesium.CircleSpiralMaterialProperty = CircleSpiralMaterialProperty;
Cesium.Material.CircleSpiralMaterialProperty = 'CircleSpiralMaterialProperty';
Cesium.Material.CircleSpiralMaterialType = 'CircleSpiralMaterialType';
Cesium.Material.CircleSpiralMaterialSource = `
                                            uniform vec4 color;
                                            uniform float speed;
                                            #define PI 3.14159265359

                                            vec2 rotate2D (vec2 _st, float _angle) {
                                            _st =  mat2(cos(_angle),-sin(_angle),  sin(_angle),cos(_angle)) * _st;
                                            return _st;
                                            }
                                            czm_material czm_getMaterial(czm_materialInput materialInput){
                                            czm_material material = czm_getDefaultMaterial(materialInput);
                                            vec2 st = materialInput.st * 2.0 - 1.0;
                                            st *= 1.6;
                                            float time = czm_frameNumber * speed / 1000.0;
                                            float r = length(st);
                                            float w = .3;
                                            st = rotate2D(st,(r*PI*6.-time*2.));
                                            float a = smoothstep(-w,.2,st.x) * smoothstep(w,.2,st.x);
                                            float b = abs(1./(sin(pow(r,2.)*2.-time*1.3)*6.))*.4;
                                            material.alpha = a * b ;
                                            material.diffuse = color.rgb * a * b  * 3.0;
                                            return material;
                                            }
                                            `

Cesium.Material._materialCache.addMaterial(Cesium.Material.CircleSpiralMaterialType, {
    fabric: {
        type: Cesium.Material.CircleSpiralMaterialType,
        uniforms: {
            color: new Cesium.Color(1.0, 0.0, 0.0, 1.0),
            speed: 10.0
        },
        source: Cesium.Material.CircleSpiralMaterialSource
    },
    translucent: function (material) {
        return true;
    }
})