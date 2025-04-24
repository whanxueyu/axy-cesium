import * as Cesium from 'cesium';

export function useSampledPositionProperty(
    viewer: Cesium.Viewer,
    lines: {
        longitude: number;
        latitude: number;
        height: number;
        time: number;
    }[],
    duration: number,
    startTime?: Cesium.JulianDate,
) {
    let startJulianDate = startTime ?? Cesium.JulianDate.fromDate(new Date());
    startJulianDate = Cesium.JulianDate.addHours(startJulianDate, 8, new Cesium.JulianDate());
    const stop = Cesium.JulianDate.addSeconds(startJulianDate, duration, new Cesium.JulianDate());
    viewer.clock.startTime = startJulianDate.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = startJulianDate.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 1;
    viewer.timeline?.zoomTo(startJulianDate, stop);
    viewer.clock.shouldAnimate = true;

    const property = new Cesium.SampledPositionProperty();
    lines.forEach(line => {
        const moveTime = Cesium.JulianDate.addSeconds(startJulianDate, line.time, new Cesium.JulianDate());
        const pos = Cesium.Cartesian3.fromDegrees(line.longitude, line.latitude, line.height);
        property.addSample(moveTime, pos);
    });
    return {
        start: startJulianDate,
        stop,
        property,
    };
}


export function cartesian2ToWGS84(viewer: Cesium.Viewer, position: Cesium.Cartesian2) {
    const worldPosition = viewer!.camera.pickEllipsoid(position);
    // 如果点不在地球表面，worldPosition将是undefined
    if (Cesium.defined(worldPosition)) {
        // 转换为经纬度
        const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(worldPosition);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;
        return {
            longitude,
            latitude,
            height,
        }
    }
    return {}
}

function rotatingByMatrix4(mat, options) {

    let _rotateX = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(options.x));
    let _rotateY = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(options.y));
    let _rotateZ = Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(options.z));

    mat = Cesium.Matrix4.multiplyByMatrix3(mat, _rotateX, mat);
    mat = Cesium.Matrix4.multiplyByMatrix3(mat, _rotateY, mat);
    mat = Cesium.Matrix4.multiplyByMatrix3(mat, _rotateZ, mat);
    return mat;

}

/**
 * 旋转entity模型
 * @param object 
 * @param options 
 */
export function rotateEntity(object: Cesium.Entity, options: { x: number, y: number, z: number }) {
    let position = object!.position!.getValue(Cesium.JulianDate.now());//先得到entity的位置
    let oldOrientation = object!.orientation!.getValue(Cesium.JulianDate.now());//entity的朝向
    let transform = Cesium.Matrix4.fromTranslationQuaternionRotationScale(position!, oldOrientation, new Cesium.Cartesian3(1, 1, 1), new Cesium.Matrix4());//得到entity的位置朝向矩阵
    transform = rotatingByMatrix4(transform, options);//根据沿着x,y,z轴旋转之后，得到旋转矩阵
    let orientation = new Cesium.Quaternion();
    let m3 = Cesium.Matrix4.getRotation(transform, new Cesium.Matrix3());//得到3*3的旋转矩阵
    Cesium.Quaternion.fromRotationMatrix(m3, orientation);//将旋转矩阵转换成齐次坐标
    // @ts-ignore
    object!.orientation!.setValue(orientation);//更新entity的朝向

}

/**
 * 旋转3dtiles 模型
 * @param object 
 * @param options 
 */
export function rotateTiles(object: Cesium.Cesium3DTileset, options: { x: number, y: number, z: number }) {
    // @ts-ignore
    let transform = object!._root!.transform;//从3dtile对象得到位置矩阵
    transform = rotatingByMatrix4(transform, options);//根据沿着x,y,z轴旋转之后，得到旋转矩阵
    // @ts-ignore
    object!._root.transform = transform;//更新3dtiles的位置矩阵

}

/**
 * 平移3dTiles 模型
 * @param object 
 * @param options 
 */
export function translateTiles(object: Cesium.Cesium3DTileset, options: { x: number, y: number, z: number }) {
    // @ts-ignore
    let transform = object._root.transform;//从3dtile得到位置矩阵
    let m = new Cesium.Matrix4();
    Cesium.Matrix4.setTranslation(Cesium.Matrix4.IDENTITY, new Cesium.Cartesian3(options.x, options.y, options.z), m)//构造平移矩阵
    // @ts-ignore
    object.root.transform = Cesium.Matrix4.multiply(transform, m, transform);//计算平移之后的位置矩阵，然后更新3dtiles的位置

}

/**
 * 平移entity 模型
 * @param object 
 */
export function translateEntity(object: Cesium.Entity, options: { x: number, y: number, z: number }) {
    let position = object!.position!.getValue(Cesium.JulianDate.now());//求出当前事件entity的位置
    let transform = Cesium.Transforms.eastNorthUpToFixedFrame(position!);//东-北-上参考系构造出4*4的矩阵
    let m = new Cesium.Matrix4();
    Cesium.Matrix4.setTranslation(Cesium.Matrix4.IDENTITY, new Cesium.Cartesian3(options.x, options.y, options.z), m)//构造平移矩阵
    let modelMatrix = Cesium.Matrix4.multiply(transform, m, transform);//将当前位置矩阵乘以平移矩阵得到平移之后的位置矩阵
    Cesium.Matrix4.getTranslation(modelMatrix, position!);//从位置矩阵中取出坐标信息
    // @ts-ignore
    object!.position!.setValue(position);//更新enity的位置

}

export default function modifyMap(viewer) {
    // 获取地图影像图层
    let baseLayer = viewer.imageryLayers.get(0);
    //设置2个变量，用来判断是否进行颜色的翻转和过滤
    baseLayer.invertColor = true;

    baseLayer.filterRGB = [0, 50, 100]; //[255,255,255] = > [0,50,100]
    //   更改底图着色器的代码
    const baseFragmentShader =
        viewer.scene.globe._surfaceShaderSet.baseFragmentShaderSource.sources;
    // console.log(baseFragmentShader);

    // 循环修改着色器
    for (let i = 0; i < baseFragmentShader.length; i++) {
        // console.log(baseFragmentShader[i]);
        const strS = "color = czm_saturation(color, textureSaturation);\n#endif\n";
        let strT = "color = czm_saturation(color, textureSaturation);\n#endif\n";
        if (baseLayer.invertColor) {
            strT += `
          color.r = 1.0 - color.r;
          color.g = 1.0 - color.g;
          color.b = 1.0 - color.b;
        `;
        }
        if (baseLayer.filterRGB) {
            strT += `
          color.r = color.r*${baseLayer.filterRGB[0]}.0/255.0;
          color.g = color.g*${baseLayer.filterRGB[1]}.0/255.0;
          color.b = color.b*${baseLayer.filterRGB[2]}.0/255.0;
        `;
        }

        baseFragmentShader[i] = baseFragmentShader[i].replace(strS, strT);
    }
}