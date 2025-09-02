// DivPlane.ts
import * as Cesium from 'cesium';

interface DivPlaneOptions {
  position?: Cesium.Cartesian3;
  positions?: Cesium.Cartesian3[]; // 支持4个点的多边形
  style?: {
    width?: number;
    height?: number;
    color?: string;
    backgroundColor?: string;
    opacity?: number;
    border?: string;
    pointerEvents?: boolean;
    [key: string]: any; // 其他CSS样式
  };
  attr?: any;
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
  hasEdit?: boolean;
  editable?: boolean;
  onBeforeAdd?: (entity: Cesium.Entity) => void;
  onAdd?: (entity: Cesium.Entity) => void;
  onRemove?: (entity: Cesium.Entity) => void;
  onClick?: (evt: any) => void;
  onRightClick?: (evt: any) => void;
  onMouseOver?: (evt: any) => void;
  onMouseOut?: (evt: any) => void;
}

export class DivPlane {
  private viewer: Cesium.Viewer;
  private entity: Cesium.Entity;
  private htmlElement: HTMLElement;
  private options: DivPlaneOptions;
  private position: Cesium.Cartesian3;
  private positions: Cesium.Cartesian3[] = [];
  private style: any;
  private attr: any;
  private container: HTMLElement;
  
  constructor(viewer: Cesium.Viewer, options: DivPlaneOptions) {
    this.viewer = viewer;
    this.options = options;
    this.position = options.position || new Cesium.Cartesian3(0, 0, 0);
    this.positions = options.positions || [];
    this.style = {
      width: '100px',
      height: '100px',
      backgroundColor: 'rgba(255,255,255,0.8)',
      opacity: 1,
      border: '1px solid #000',
      pointerEvents: true,
      ...options.style
    };
    this.attr = options.attr || {};
    
    this.createHtmlElement();
    this.createEntity();
    this.setupEventListeners();
    this.setupSync();
  }
  
  private createHtmlElement(): void {
    this.htmlElement = document.createElement('div');
    this.htmlElement.className = 'cesium-divplane';
    this.htmlElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: center center;
      pointer-events: ${this.style.pointerEvents ? 'auto' : 'none'};
    `;
    
    // 应用样式
    Object.keys(this.style).forEach(key => {
      if (key !== 'pointerEvents') {
        this.htmlElement.style[key] = this.style[key];
      }
    });
    
    // 添加到viewer容器
    this.container = document.createElement('div');
    this.container.className = 'cesium-divplane-container';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      transform-style: preserve-3d;
    `;
    
    this.container.appendChild(this.htmlElement);
    this.viewer.container.appendChild(this.container);
  }
  
  private createEntity(): void {
    const entityOptions: any = {
      position: this.position,
      properties: {
        divPlane: this
      }
    };
    
    if (this.positions.length > 0) {
      entityOptions.polygon = {
        hierarchy: this.positions,
        material: Cesium.Color.TRANSPARENT
      };
    } else {
      entityOptions.point = {
        pixelSize: 1,
        color: Cesium.Color.TRANSPARENT
      };
    }
    
    if (this.options.distanceDisplayCondition) {
      entityOptions.distanceDisplayCondition = this.options.distanceDisplayCondition;
    }
    
    this.entity = this.viewer.entities.add(entityOptions);
    
    if (this.options.onAdd) {
      this.options.onAdd(this.entity);
    }
  }
  
  private setupEventListeners(): void {
    if (this.options.onClick) {
      this.htmlElement.addEventListener('click', (evt) => {
        this.options.onClick!({
          ...evt,
          target: this,
          entity: this.entity
        });
      });
    }
    
    if (this.options.onRightClick) {
      this.htmlElement.addEventListener('contextmenu', (evt) => {
        this.options.onRightClick!({
          ...evt,
          target: this,
          entity: this.entity
        });
      });
    }
    
    if (this.options.onMouseOver) {
      this.htmlElement.addEventListener('mouseover', (evt) => {
        this.options.onMouseOver!({
          ...evt,
          target: this,
          entity: this.entity
        });
      });
    }
    
    if (this.options.onMouseOut) {
      this.htmlElement.addEventListener('mouseout', (evt) => {
        this.options.onMouseOut!({
          ...evt,
          target: this,
          entity: this.entity
        });
      });
    }
  }
  
  private setupSync(): void {
    this.viewer.scene.postRender.addEventListener(() => {
      this.syncPosition();
    });
  }
  
  private syncPosition(): void {
    let windowPosition;
    
    if (this.positions.length > 0) {
      // 多点模式，使用多边形中心点
      const center = this.getPolygonCenter(this.positions);
      windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
        this.viewer.scene,
        center
      );
    } else {
      // 单点模式
      windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
        this.viewer.scene,
        this.position
      );
    }
    
    if (windowPosition) {
      const width = parseFloat(this.style.width) || 100;
      const height = parseFloat(this.style.height) || 100;
      
      this.htmlElement.style.left = `${windowPosition.x - width/2}px`;
      this.htmlElement.style.top = `${windowPosition.y - height/2}px`;
    }
  }
  
  private getPolygonCenter(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 {
    if (positions.length === 0) {
      return new Cesium.Cartesian3(0, 0, 0);
    }
    
    const center = new Cesium.Cartesian3();
    positions.forEach(pos => {
      Cesium.Cartesian3.add(center, pos, center);
    });
    
    return Cesium.Cartesian3.multiplyByScalar(center, 1/positions.length, center);
  }
  
  // 公共方法
  public setPosition(position: Cesium.Cartesian3): void {
    this.position = position;
    if (this.entity.position) {
      this.entity.position.setValue(position);
    }
  }
  
  public setPositions(positions: Cesium.Cartesian3[]): void {
    this.positions = positions;
    // 更新实体
    if (this.entity.polygon) {
      this.entity.polygon.hierarchy = new Cesium.PolygonHierarchy(positions);
    }
  }
  
  public setStyle(style: any): void {
    this.style = { ...this.style, ...style };
    Object.keys(style).forEach(key => {
      this.htmlElement.style[key] = style[key];
    });
  }
  
  public setAttr(attr: any): void {
    this.attr = { ...this.attr, ...attr };
  }
  
  public getAttr(): any {
    return this.attr;
  }
  
  public show(): void {
    this.htmlElement.style.display = 'block';
    this.entity.show = true;
  }
  
  public hide(): void {
    this.htmlElement.style.display = 'none';
    this.entity.show = false;
  }
  
  public isVisible(): boolean {
    return this.entity.show ?? true;
  }
  
  public remove(): void {
    if (this.options.onRemove) {
      this.options.onRemove(this.entity);
    }
    
    this.viewer.entities.remove(this.entity);
    
    if (this.htmlElement && this.htmlElement.parentNode) {
      this.htmlElement.parentNode.removeChild(this.htmlElement);
    }
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
  
  public getElement(): HTMLElement {
    return this.htmlElement;
  }
  
  public getEntity(): Cesium.Entity {
    return this.entity;
  }
  
  public addClass(className: string): void {
    this.htmlElement.classList.add(className);
  }
  
  public removeClass(className: string): void {
    this.htmlElement.classList.remove(className);
  }
  
  public hasClass(className: string): boolean {
    return this.htmlElement.classList.contains(className);
  }
}