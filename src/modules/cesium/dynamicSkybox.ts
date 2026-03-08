import * as Cesium from "cesium";

const SkyBoxFS = `
precision highp float;
uniform samplerCube u_cubeMap;
in vec3 v_texCoord;
out vec4 fragColor;

void main() {
    vec4 color = texture(u_cubeMap, normalize(v_texCoord));
    fragColor = vec4(czm_gammaCorrect(color).rgb, czm_morphTime);
}`;

// 顶点着色器有修改，主要是乘了一个旋转矩阵
const SkyBoxVS = `
#version 300 es
precision highp float;

in vec3 position;
out vec3 v_texCoord;
uniform mat3 u_rotateMatrix;

void main() {
    vec3 p = czm_viewRotation * u_rotateMatrix * (czm_temeToPseudoFixed * (czm_entireFrustum.y * position));
    gl_Position = czm_projection * vec4(p, 1.0);
    v_texCoord = position;
}
`;

import rightav9 from '@/assets/images/skybox/qingtian/rightav9.jpg';
import leftav9 from '@/assets/images/skybox/qingtian/leftav9.jpg';
import frontav9 from '@/assets/images/skybox/qingtian/frontav9.jpg';
import backav9 from '@/assets/images/skybox/qingtian/backav9.jpg';
import topav9 from '@/assets/images/skybox/qingtian/topav9.jpg';
import bottomav9 from '@/assets/images/skybox/qingtian/bottomav9.jpg';

import SunSetRight from '@/assets/images/skybox/wanxia/SunSetRight.png';
import SunSetLeft from '@/assets/images/skybox/wanxia/SunSetLeft.png';
import SunSetFront from '@/assets/images/skybox/wanxia/SunSetFront.png';
import SunSetBack from '@/assets/images/skybox/wanxia/SunSetBack.png';
import SunSetUp from '@/assets/images/skybox/wanxia/SunSetUp.png';
import SunSetDown from '@/assets/images/skybox/wanxia/SunSetDown.png';

type skyboxSource = {
    negativeX: string;
    negativeY: string;
    negativeZ: string;
    positiveX: string;
    positiveY: string;
    positiveZ: string;
};

const daySkyboxSources: skyboxSource = {
    positiveX: rightav9,
    negativeX: leftav9,
    positiveY: frontav9,
    negativeY: backav9,
    positiveZ: topav9,
    negativeZ: bottomav9
};

const nightSkyboxSources: skyboxSource = {
    positiveX: SunSetRight,
    negativeX: SunSetLeft,
    positiveY: SunSetFront,
    negativeY: SunSetBack,
    positiveZ: SunSetUp,
    negativeZ: SunSetDown
};

export default class DynamicSkybox {
    public sources: skyboxSource;
    private _sources: skyboxSource | undefined;
    public show: boolean;
    private _command: Cesium.DrawCommand;
    private _cubeMap: Cesium.CubeMap | undefined;
    private _attributeLocations: { [key: string]: number } | undefined;
    private _useHdr: boolean | undefined;
    private _context: Cesium.Context | undefined;
    private _geometry: Cesium.Geometry | undefined;
    private _dayCubeMap: Cesium.CubeMap | undefined;
    private _nightCubeMap: Cesium.CubeMap | undefined;
    private _transition: Cesium.Transition;

    constructor(options: { sources: skyboxSource; show?: boolean }) {
        this.sources = options.sources;
        this._sources = undefined;
        this.show = options.show ?? true;

        this._command = new Cesium.DrawCommand({
            modelMatrix: Cesium.Matrix4.clone(Cesium.Matrix4.IDENTITY),
            owner: this
        });
        this._cubeMap = undefined;
        this._attributeLocations = undefined;
        this._useHdr = undefined;
        this._context = undefined;
        this._geometry = undefined;
        this._dayCubeMap = undefined;
        this._nightCubeMap = undefined;
        this._transition = new Cesium.Transition();
    }

    update(frameState: Cesium.FrameState, useHdr: boolean): Cesium.DrawCommand | undefined {
        if (!this.show) {
            return undefined;
        }

        if ((frameState.mode !== Cesium.SceneMode.SCENE3D) && (frameState.mode !== Cesium.SceneMode.MORPHING)) {
            return undefined;
        }

        if (!frameState.passes.render) {
            return undefined;
        }

        const context = frameState.context;

        // 根据 Cesium 的时间动态更新天空盒
        const cesiumTime = frameState.time;
        const currentTime = Cesium.JulianDate.toDate(cesiumTime).getHours();
        const isDay = currentTime >= 6 && currentTime < 18;

        if (!Cesium.defined(this._dayCubeMap)) {
            this.loadCubeMap(context, daySkyboxSources).then((cubeMap) => {
                this._dayCubeMap = cubeMap;
            }).catch((error) => {
                console.error('Failed to load day cube map:', error);
            });
        }

        if (!Cesium.defined(this._nightCubeMap)) {
            this.loadCubeMap(context, nightSkyboxSources).then((cubeMap) => {
                this._nightCubeMap = cubeMap;
            }).catch((error) => {
                console.error('Failed to load night cube map:', error);
            });
        }

        const command = this._command;

        command.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(frameState.camera._positionWC);

        if (!Cesium.defined(command.vertexArray)) {
            this.createVertexArray(context);
        }

        if (!Cesium.defined(command.shaderProgram) || this._useHdr !== useHdr) {
            this.createShaderProgram(context, useHdr);
        }

        if (!Cesium.defined(this._dayCubeMap) || !Cesium.defined(this._nightCubeMap)) {
            return undefined;
        }

        // 计算过渡因子
        const transitionFactor = this._transition.compute(
            frameState.time,
            Cesium.JulianDate.fromIso8601('2023-01-01T06:00:00Z'),
            Cesium.JulianDate.fromIso8601('2023-01-01T18:00:00Z')
        );

        // 更新 u_cubeMap
        if (Cesium.defined(command.uniformMap) && Cesium.defined(command.uniformMap.u_cubeMap)) {
            command.uniformMap.u_cubeMap = () => {
                return Cesium.sampleCubicSpline(
                    [0, 1],
                    [this._dayCubeMap, this._nightCubeMap],
                    transitionFactor
                );
            };
        }

        // 更新 u_rotateMatrix
        if (Cesium.defined(command.uniformMap) && Cesium.defined(command.uniformMap.u_rotateMatrix)) {
            const rotationMatrix = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(currentTime * 15)); // 示例旋转矩阵
            command.uniformMap.u_rotateMatrix = () => {
                return rotationMatrix;
            };
        }

        return command;
    }

    private loadCubeMap(context: Cesium.Context, sources: skyboxSource): Promise<Cesium.CubeMap> {
        return new Promise((resolve, reject) => {
            if (typeof sources.positiveX === 'string') {
                Cesium.loadCubeMap(context, sources).then((cubeMap: any) => {
                    resolve(cubeMap);
                }).catch((error: any) => {
                    reject(error);
                });
            } else {
                const cubeMap = new Cesium.CubeMap({
                    context: context,
                    source: sources
                });
                resolve(cubeMap);
            }
        });
    }

    private createVertexArray(context: Cesium.Context): void {
        const geometry = Cesium.BoxGeometry.createGeometry(Cesium.BoxGeometry.fromDimensions({
            dimensions: new Cesium.Cartesian3(2.0, 2.0, 2.0),
            vertexFormat: Cesium.VertexFormat.POSITION_ONLY
        }));
        if (!Cesium.defined(geometry)) {
            return;
        }
        const attributeLocations = Cesium.GeometryPipeline.createAttributeLocations(geometry);

        this._command.vertexArray = Cesium.VertexArray.fromGeometry({
            context: context,
            geometry: geometry,
            attributeLocations: attributeLocations,
            bufferUsage: Cesium.BufferUsage._DRAW
        });

        this._geometry = geometry;
        this._attributeLocations = attributeLocations;
    }

    private createShaderProgram(context: Cesium.Context, useHdr: boolean): void {
        const fs = new Cesium.ShaderSource({
            defines: [useHdr ? 'HDR' : ''],
            sources: [SkyBoxFS]
        });

        this._command.shaderProgram = Cesium.ShaderProgram.fromCache({
            context: context,
            vertexShaderSource: SkyBoxVS,
            fragmentShaderSource: fs,
            attributeLocations: this._attributeLocations
        });

        // 初始化 uniformMap
        if (!Cesium.defined(this._command.uniformMap)) {
            this._command.uniformMap = {};
        }

        // 设置 u_rotateMatrix 为一个函数
        this._command.uniformMap.u_rotateMatrix = () => {
            return new Cesium.Matrix3(); // 默认值
        };

        // 设置 u_cubeMap 为一个函数
        this._command.uniformMap.u_cubeMap = () => {
            return this._cubeMap;
        };

        this._useHdr = useHdr;
    }

    setSkyBox(viewer: Cesium.Viewer): void {
        const defaultSkybox = viewer.scene.skyBox;

        viewer.scene.preUpdate.addEventListener(() => {
            const position = viewer.scene.camera.position;
            const cameraHeight = Cesium.Cartographic.fromCartesian(position).height;
            if (cameraHeight < 240000) {
                viewer.scene.skyBox = this;
                viewer.scene.skyAtmosphere.show = false;
            } else {
                viewer.scene.skyBox = defaultSkybox;
                viewer.scene.skyAtmosphere.show = true;
            }
        });
    }

    isDestroyed(): boolean {
        return false;
    }

    destroy(): Cesium.DynamicSkybox {
        const command = this._command;
        command.vertexArray = command.vertexArray && command.vertexArray.destroy();
        command.shaderProgram = command.shaderProgram && command.shaderProgram.destroy();
        this._cubeMap = this._cubeMap && this._cubeMap.destroy();
        this._dayCubeMap = this._dayCubeMap && this._dayCubeMap.destroy();
        this._nightCubeMap = this._nightCubeMap && this._nightCubeMap.destroy();
        this._geometry = this._geometry && this._geometry.destroy();
        return Cesium.destroyObject(this) as Cesium.DynamicSkybox;
    }
}