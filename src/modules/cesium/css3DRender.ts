// CSS3DEarthSync.ts
import * as Cesium from 'cesium';

interface CSS3DEarthSyncOptions {
  radius?: number;
  enableDebug?: boolean;
}

export class CSS3DEarthSync {
  private viewer: Cesium.Viewer;
  private sphere: HTMLElement;
  private radius: number;
  private enableDebug: boolean;
  private container: HTMLElement;
  private sphereContainer: HTMLElement;
  
  constructor(viewer: Cesium.Viewer, container: HTMLElement, options?: CSS3DEarthSyncOptions) {
    this.viewer = viewer;
    this.container = container;
    this.radius = options?.radius || 6378137; // 地球半径(米)
    this.enableDebug = options?.enableDebug || false;
    
    // 设置容器的透视属性
    this.container.style.perspective = '1000px';
    
    this.sphere = this.createCSS3DSphere();
    this.setupSync();
  }
  
  private createCSS3DSphere(): HTMLElement {
    // 创建容器
    this.sphereContainer = document.createElement('div');
    this.sphereContainer.className = 'cesium-css3d-sphere-container';
    this.sphereContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      transform-style: preserve-3d;
    `;
    
    // 创建球体
    const sphere = document.createElement('div');
    sphere.className = 'cesium-css3d-sphere';
    sphere.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 200px;
      height: 200px;
      transform-style: preserve-3d;
      backface-visibility: visible;
      -webkit-backface-visibility: visible;
      -webkit-transform-style: preserve-3d;
      transform-origin: center center;
    `;
    
    // 创建球体表面（使用多个div模拟球体）
    const segments = 20;
    for (let i = 0; i < segments; i++) {
      const face = document.createElement('div');
      face.className = 'css3d-sphere-face';
      
      // 计算每个面的位置
      const phi = Math.acos(-1 + (2 * i) / segments);
      const theta = Math.sqrt(segments * Math.PI) * phi;
      
      const faceSize = 80;
      face.style.cssText = `
        position: absolute;
        width: ${faceSize}px;
        height: ${faceSize}px;
        margin-left: ${-faceSize/2}px;
        margin-top: ${-faceSize/2}px;
        background: ${this.enableDebug ? 'rgba(0, 100, 255, 0.3)' : 'transparent'};
        border: ${this.enableDebug ? '1px solid rgba(0, 150, 255, 0.5)' : 'none'};
        transform-style: preserve-3d;
        backface-visibility: visible;
        -webkit-backface-visibility: visible;
        transform: rotateY(${theta * 180 / Math.PI}deg) 
                  rotateZ(${phi * 180 / Math.PI}deg) 
                  translateZ(100px);
      `;
      
      sphere.appendChild(face);
    }
    
    this.sphereContainer.appendChild(sphere);
    this.container.appendChild(this.sphereContainer);
    
    return sphere;
  }
  
  private setupSync(): void {
    // 监听场景渲染事件，确保每帧都同步
    this.viewer.scene.postRender.addEventListener(() => {
      this.syncTransform();
    });
  }
  
  private syncTransform(): void {
    const camera = this.viewer.camera;
    const scene = this.viewer.scene;
    
    // 获取地球中心在世界坐标系中的位置
    const earthCenter = new Cesium.Cartesian3(0, 0, 0);
    
    // 将地球中心转换为屏幕坐标
    const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
      scene,
      earthCenter
    );
    
    if (!screenPosition) {
      return;
    }
    
    // 计算相机到地球中心的距离
    const cameraPosition = camera.positionWC;
    const distanceToCenter = Cesium.Cartesian3.distance(cameraPosition, earthCenter);
    
    // 计算适当的缩放因子
    const scale = this.calculateScale(distanceToCenter);
    
    // 计算旋转
    const rotation = this.calculateRotation(camera);
    
    // 应用变换到容器而不是球体本身
    this.sphereContainer.style.transform = `
      translate3d(${screenPosition.x - 100}px, ${screenPosition.y - 100}px, 0px)
    `;
    
    // 球体本身的变换只包含缩放和旋转
    this.sphere.style.transform = `
      scale3d(${scale}, ${scale}, ${scale})
      ${rotation}
    `;
    
    // 添加硬件加速
    this.sphere.style.webkitTransform = this.sphere.style.transform;
    this.sphereContainer.style.webkitTransform = this.sphereContainer.style.transform;
  }
  
  private calculateScale(distance: number): number {
    // 基于相机距离计算缩放因子
    const frustum = this.viewer.camera.frustum as Cesium.PerspectiveFrustum;
    const viewportHeight = this.viewer.container.clientHeight;
    
    // 使用更精确的计算方法
    const verticalFov = frustum.fovy;
    const earthAngularSize = 2 * Math.atan(this.radius / distance);
    const screenSize = (earthAngularSize / verticalFov) * viewportHeight;
    const sphereBaseSize = 200; // 球体基础大小
    
    return screenSize / sphereBaseSize;
  }
  
  private calculateRotation(camera: Cesium.Camera): string {
    // 创建一个从east-north-up到view的变换矩阵
    const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
      new Cesium.Cartesian3(0, 0, 0)
    );
    
    // 获取view到east-north-up的变换矩阵
    const viewMatrix = Cesium.Matrix4.inverseTransformation(
      camera.viewMatrix,
      new Cesium.Matrix4()
    );
    
    // 计算最终的变换矩阵
    const finalMatrix = new Cesium.Matrix4();
    Cesium.Matrix4.multiply(viewMatrix, modelMatrix, finalMatrix);
    
    // 提取旋转矩阵
    const rotationMatrix = Cesium.Matrix4.getMatrix3(finalMatrix, new Cesium.Matrix3());
    
    // 将旋转矩阵转换为CSS3D变换
    const cssMatrix = this.matrix3ToCSSMatrix(rotationMatrix);
    
    return cssMatrix;
  }
  
  private matrix3ToCSSMatrix(matrix: Cesium.Matrix3): string {
    // 获取矩阵元素
    const m = matrix;
    
    // 构造CSS3D变换矩阵字符串
    // 注意CSS矩阵是列优先，而Cesium是行优先
    return `matrix3d(
      ${m[0]}, ${m[3]}, ${m[6]}, 0,
      ${m[1]}, ${m[4]}, ${m[7]}, 0,
      ${m[2]}, ${m[5]}, ${m[8]}, 0,
      0, 0, 0, 1
    )`;
  }
  
  public destroy(): void {
    if (this.sphere && this.sphere.parentNode) {
      this.sphere.parentNode.removeChild(this.sphere);
    }
    if (this.sphereContainer && this.sphereContainer.parentNode) {
      this.sphereContainer.parentNode.removeChild(this.sphereContainer);
    }
  }
  
  public setVisibility(visible: boolean): void {
    this.sphere.style.display = visible ? 'block' : 'none';
  }
}