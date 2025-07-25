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
  
  constructor(viewer: Cesium.Viewer, container: HTMLElement, options?: CSS3DEarthSyncOptions) {
    this.viewer = viewer;
    this.container = container;
    this.radius = options?.radius || 6378137; // 地球半径(米)
    this.enableDebug = options?.enableDebug || false;
    
    this.sphere = this.createCSS3DSphere();
    this.setupSync();
  }
  
  private createCSS3DSphere(): HTMLElement {
    // 创建容器
    const sphereContainer = document.createElement('div');
    sphereContainer.className = 'cesium-css3d-sphere-container';
    sphereContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      transform-style: preserve-3d;
      perspective: 1000px;
    `;
    
    // 创建球体
    const sphere = document.createElement('div');
    sphere.className = 'cesium-css3d-sphere';
    sphere.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 200px;
      height: 200px;
      margin-left: -100px;
      margin-top: -100px;
      transform-style: preserve-3d;
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
        transform: rotateY(${theta * 180 / Math.PI}deg) 
                  rotateZ(${phi * 180 / Math.PI}deg) 
                  translateZ(100px);
      `;
      
      sphere.appendChild(face);
    }
    
    sphereContainer.appendChild(sphere);
    this.container.appendChild(sphereContainer);
    
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
    // const scene = this.viewer.scene;
    
    // 计算相机到地球中心的距离
    const cameraPosition = camera.position;
    const distanceToCenter = Cesium.Cartesian3.magnitude(cameraPosition);
    
    // 计算适当的缩放因子
    const scale = this.calculateScale(distanceToCenter);
    
    // 计算旋转
    const rotation = this.calculateRotation(camera);
    
    // 获取屏幕中心点
    const centerScreenPos = this.getScreenCenter();
    
    // 应用变换
    this.sphere.style.transform = `
      translate3d(${centerScreenPos.x}px, ${centerScreenPos.y}px, 0)
      ${rotation}
      scale3d(${scale}, ${scale}, ${scale})
    `;
  }
  
  private calculateScale(distance: number): number {
    // 基于相机距离计算缩放因子
    const fov = (this.viewer.camera.frustum as Cesium.PerspectiveFrustum).fov;
    const viewportHeight = this.viewer.container.clientHeight;
    
    // 计算地球在屏幕上的投影大小
    const angularSize = 2 * Math.atan(this.radius / distance);
    const screenSize = (angularSize / fov) * viewportHeight;
    const sphereBaseSize = 200; // 球体基础大小
    
    return screenSize / sphereBaseSize;
  }
  
  private calculateRotation(camera: Cesium.Camera): string {
    // 获取相机方向并转换为CSS旋转
    const heading = Cesium.Math.toDegrees(camera.heading);
    const pitch = Cesium.Math.toDegrees(camera.pitch);
    const roll = Cesium.Math.toDegrees(camera.roll);
    
    // 注意坐标系转换
    return `rotateZ(${-roll}deg) rotateX(${-pitch}deg) rotateY(${heading}deg)`;
  }
  
  private getScreenCenter(): { x: number; y: number } {
    const containerRect = this.viewer.container.getBoundingClientRect();
    return {
      x: containerRect.width / 2,
      y: containerRect.height / 2
    };
  }
  
  public destroy(): void {
    if (this.sphere && this.sphere.parentNode) {
      this.sphere.parentNode.removeChild(this.sphere);
    }
  }
  
  public setVisibility(visible: boolean): void {
    this.sphere.style.display = visible ? 'block' : 'none';
  }
}