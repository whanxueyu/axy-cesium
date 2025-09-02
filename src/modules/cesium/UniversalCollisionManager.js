import * as Cesium from 'cesium'

/**
 * 通用实体碰撞检测管理器
 * 支持标签、点、广告牌等各种Cesium实体的碰撞检测
 * 
 * 使用方法：
 * // 创建管理器
 * const collisionManager = new UniversalCollisionManager(viewer);
 * 
 * // 添加实体到碰撞检测
 * collisionManager.addEntity(entity.id, entity, 'point', 1); // 点实体，优先级1
 * collisionManager.addEntity(labelEntity.id, labelEntity, 'label', 2); // 标签实体，优先级2
 * 
 * // 移除实体
 * collisionManager.removeEntity(entity.id);
 * 
 * // 销毁管理器
 * collisionManager.destroy();
 */
class UniversalCollisionManager {
  /**
   * 创建通用碰撞检测管理器
   * @param {Object} viewer - Cesium viewer实例
   * @param {Object} options - 配置选项
   */
  constructor(viewer, options = {}) {
    this.viewer = viewer
    this.entities = new Map() // 存储所有实体信息
    this.boundingBoxes = new Map() // 缓存屏幕包围盒
    this.visibilityStatus = new Map() // 存储可见状态
    
    // 配置选项
    this.options = {
      debounceDelay: 200, // 防抖延迟时间
      padding: 5, // 包围盒扩展像素
      enableDebug: false, // 是否启用调试模式
      ...options
    }
    
    // 初始化版本兼容性
    this._initVersionCompatibility()
    
    // 设置相机变化监听
    this._setupCameraChangeHandler()
    
    // 防抖处理
    this.debounceTimer = null
    
    // 调试模式下的可视化实体
    this.debugEntities = []
  }
  
  /**
   * 初始化版本兼容性
   * @private
   */
  _initVersionCompatibility() {
    // 检测 Cesium 版本
    this.cesiumVersion = this._detectCesiumVersion()
    
    // 设置兼容性标志
    this.compatibility = {
      // Cesium 1.120+ 的新特性支持
      hasNewSceneTransforms: this._checkAPI('Cesium.SceneTransforms.wgs84ToWindowCoordinates'),
      hasOldSceneTransforms: this._checkAPI('Cesium.SceneTransforms.wgs84ToCanvasCoordinates'),
      
      // 属性访问方式兼容性
      supportsGetValue: this._checkMethodExists('getValue'),
      
      // 相机事件兼容性  
      hasCameraChanged: this._checkAPI('this.viewer.camera.changed'),
      hasCameraMoveEnd: this._checkAPI('this.viewer.camera.moveEnd'),
      
      // Primitive 类型检测兼容性
      hasPrimitiveCollection: this._checkAPI('Cesium.PrimitiveCollection'),
      hasPointPrimitiveCollection: this._checkAPI('Cesium.PointPrimitiveCollection'),
      hasBillboardCollection: this._checkAPI('Cesium.BillboardCollection'),
      hasPolylineCollection: this._checkAPI('Cesium.PolylineCollection'),
      
      // 时间处理兼容性
      hasClockCurrentTime: this._checkAPI('this.viewer.clock.currentTime'),
      hasJulianDate: this._checkAPI('Cesium.JulianDate.now')
    }
    
    console.log(`UniversalCollisionManager: 检测到 Cesium 版本 ${this.cesiumVersion}`)
  }
  
  /**
   * 检测 Cesium 版本
   * @private
   * @returns {string} 版本号
   */
  _detectCesiumVersion() {
    try {
      // 尝试获取版本信息
      if (typeof Cesium !== 'undefined') {
        // Cesium 1.95+ 有 VERSION 属性
        if (Cesium.VERSION) {
          return Cesium.VERSION
        }
        
        // 通过特性检测推断版本范围
        if (Cesium.Viewer && Cesium.SceneTransforms) {
          if (Cesium.SceneTransforms.wgs84ToWindowCoordinates) {
            return '1.120+' // 支持较新的 API
          } else if (Cesium.SceneTransforms.wgs84ToCanvasCoordinates) {
            return '1.80-1.119' // 中等版本
          } else {
            return '1.60-1.79' // 较老版本
          }
        }
      }
      return 'unknown'
    } catch (error) {
      console.warn('检测 Cesium 版本失败:', error)
      return 'unknown'
    }
  }
  
  /**
   * 检查 API 是否存在
   * @private
   * @param {string} apiPath - API 路径
   * @returns {boolean} 是否存在
   */
  _checkAPI(apiPath) {
    try {
      const parts = apiPath.split('.')
      let current = window
      
      for (const part of parts) {
        if (part === 'this') {
          current = this
        } else if (current && typeof current === 'object' && part in current) {
          current = current[part]
        } else {
          return false
        }
      }
      
      return current !== undefined && current !== null
    } catch (error) {
      return false
    }
  }
  
  /**
   * 检查方法是否存在
   * @private
   * @param {string} methodName - 方法名
   * @returns {boolean} 是否存在
   */
  _checkMethodExists(methodName) {
    try {
      // 创建一个测试实体来检查方法
      if (this.viewer && this.viewer.entities && this.viewer.entities.values.length > 0) {
        const testEntity = this.viewer.entities.values[0]
        if (testEntity && testEntity.position && testEntity.position[methodName]) {
          return typeof testEntity.position[methodName] === 'function'
        }
      }
      return false
    } catch (error) {
      return false
    }
  }
  
  /**
   * 兼容性屏幕坐标转换
   * @private
   * @param {Cartesian3} worldPosition - 世界坐标
   * @returns {Cartesian2|null} 屏幕坐标
   */
  _worldToScreenCoordinates(worldPosition) {
    try {
      // 优先使用新版本 API
      if (this.compatibility.hasNewSceneTransforms && Cesium.SceneTransforms.wgs84ToWindowCoordinates) {
        return Cesium.SceneTransforms.wgs84ToWindowCoordinates(this.viewer.scene, worldPosition)
      }
      
      // 兼容旧版本 API
      if (this.compatibility.hasOldSceneTransforms && Cesium.SceneTransforms.wgs84ToCanvasCoordinates) {
        return Cesium.SceneTransforms.wgs84ToCanvasCoordinates(this.viewer.scene, worldPosition)
      }
      
      // 更老版本的兼容处理
      if (Cesium.SceneTransforms && Cesium.SceneTransforms.wgs84ToDrawingBufferCoordinates) {
        return Cesium.SceneTransforms.wgs84ToDrawingBufferCoordinates(this.viewer.scene, worldPosition)
      }
      
      console.warn('无法找到合适的屏幕坐标转换方法')
      return null
    } catch (error) {
      console.warn('屏幕坐标转换失败:', error)
      return null
    }
  }
  
  /**
   * 兼容性属性值获取
   * @private
   * @param {Object} property - 属性对象
   * @param {JulianDate} time - 时间（可选）
   * @returns {*} 属性值
   */
  _getPropertyValue(property, time = null) {
    try {
      if (!property) return undefined
      
      // 获取当前时间
      const currentTime = time || this._getCurrentTime()
      
      // 如果支持 getValue 方法
      if (this.compatibility.supportsGetValue && typeof property.getValue === 'function') {
        return property.getValue(currentTime)
      }
      
      // 如果是常量值或直接属性
      if (typeof property.valueOf === 'function') {
        return property.valueOf()
      }
      
      // 直接返回值
      return property
    } catch (error) {
      console.warn('获取属性值失败:', error)
      return undefined
    }
  }
  
  /**
   * 兼容性获取当前时间
   * @private
   * @returns {JulianDate} 当前时间
   */
  _getCurrentTime() {
    try {
      // 优先使用 viewer 的时钟
      if (this.compatibility.hasClockCurrentTime && this.viewer.clock && this.viewer.clock.currentTime) {
        return this.viewer.clock.currentTime
      }
      
      // 使用 JulianDate.now()
      if (this.compatibility.hasJulianDate && Cesium.JulianDate && Cesium.JulianDate.now) {
        return Cesium.JulianDate.now()
      }
      
      // 兜底方案
      return new Cesium.JulianDate()
    } catch (error) {
      console.warn('获取当前时间失败:', error)
      return new Cesium.JulianDate()
    }
  }
  
  /**
   * 兼容性 Primitive 类型检测
   * @private
   * @param {Object} entity - 实体对象
   * @param {string} type - 类型字符串
   * @returns {boolean} 是否为 Primitive 类型
   */
  _isPrimitiveType(entity, type) {
    try {
      // 通过类型字符串判断
      if (type && type.startsWith('primitive-')) {
        return true
      }
      
      // 通过构造函数名判断
      if (entity && entity.constructor) {
        const constructorName = entity.constructor.name
        const primitiveNames = [
          'Primitive', 'PrimitiveCollection',
          'PointPrimitiveCollection', 'BillboardCollection', 
          'PolylineCollection', 'LabelCollection'
        ]
        
        return primitiveNames.some(name => constructorName.includes(name))
      }
      
      // 通过属性检测判断
      if (entity) {
        // 检查是否有 Primitive 特有的属性
        const primitiveProps = ['geometryInstances', 'appearance', 'show', 'allowPicking']
        const hasPrimitiveProps = primitiveProps.some(prop => prop in entity)
        
        // 检查是否有 Collection 特有的方法
        const collectionMethods = ['add', 'remove', 'removeAll', 'length']
        const hasCollectionMethods = collectionMethods.some(method => 
          entity[method] && typeof entity[method] === 'function'
        )
        
        return hasPrimitiveProps || hasCollectionMethods
      }
      
      return false
    } catch (error) {
      console.warn('Primitive 类型检测失败:', error)
      return false
    }
  }
  
  /**
   * 添加实体到碰撞检测管理器
   * @param {string} id - 实体ID
   * @param {Object} entity - Cesium实体或Primitive
   * @param {string} type - 实体类型 ('point', 'label', 'billboard', 'model', 'primitive-point', 'primitive-billboard', 'primitive-polyline', 'primitive-polygon')
   * @param {number} priority - 优先级（数值越大优先级越高）
   * @param {Object} customBounds - 自定义边界框（可选）
   * @param {Object} primitiveInfo - Primitive额外信息（如位置数组等）
   */
  addEntity(id, entity, type, priority = 1, customBounds = null, primitiveInfo = null) {
    // 使用兼容性方法判断是否为Primitive类型
    const isPrimitive = this._isPrimitiveType(entity, type)
    
    // 存储实体信息
    this.entities.set(id, {
      entity: entity,
      type: type,
      priority: priority,
      customBounds: customBounds,
      primitiveInfo: primitiveInfo, // 存储Primitive的额外信息
      isPrimitive: isPrimitive,
      originalShow: this._getShowProperty(entity, type) // 保存原始显示状态
    })
    
    // 初始计算包围盒
    this._updateBoundingBox(id)
    
    // 立即执行一次碰撞检测
    this._checkCollisions()
  }
  
  /**
   * 移除实体并重新执行碰撞检测
   * @param {string} id - 实体ID
   */
  removeEntity(id) {
    // 恢复原始显示状态
    const entityInfo = this.entities.get(id)
    if (entityInfo) {
      this._setShowProperty(entityInfo.entity, entityInfo.type, entityInfo.originalShow)
    }
    
    // 移除相关数据
    this.entities.delete(id)
    this.boundingBoxes.delete(id)
    this.visibilityStatus.delete(id)
    
    // 重新执行碰撞检测
    this._checkCollisions()
  }
  
  /**
   * 更新指定实体的位置并重新计算碰撞
   * @param {string} id - 实体ID
   */
  updateEntity(id) {
    const entityInfo = this.entities.get(id)
    if (!entityInfo) return
    
    // 更新包围盒
    this._updateBoundingBox(id)
    
    // 重新计算碰撞
    this._checkCollisions()
  }
  
  /**
   * 批量更新多个实体
   * @param {Array<string>} ids - 实体ID数组
   */
  updateEntities(ids) {
    // 批量更新包围盒
    ids.forEach(id => {
      if (this.entities.has(id)) {
        this._updateBoundingBox(id)
      }
    })
    
    // 执行一次碰撞检测
    this._checkCollisions()
  }
  
  /**
   * 更新实体的屏幕包围盒
   * @private
   * @param {string} id - 实体ID
   */
  _updateBoundingBox(id) {
    const entityInfo = this.entities.get(id)
    if (!entityInfo || !entityInfo.entity) return
    
    let bbox = null
    
    // 使用自定义边界框
    if (entityInfo.customBounds) {
      if (entityInfo.isPrimitive) {
        bbox = this._calculatePrimitiveCustomBoundingBox(entityInfo.entity, entityInfo.customBounds, entityInfo.primitiveInfo)
      } else {
        bbox = this._calculateCustomBoundingBox(entityInfo.entity, entityInfo.customBounds)
      }
    } else {
      // 根据实体类型计算包围盒
      if (entityInfo.isPrimitive) {
        // Primitive类型的包围盒计算
        switch (entityInfo.type) {
          case 'primitive-point':
            bbox = this._calculatePrimitivePointBoundingBox(entityInfo.entity, entityInfo.primitiveInfo)
            break
          case 'primitive-billboard':
            bbox = this._calculatePrimitiveBillboardBoundingBox(entityInfo.entity, entityInfo.primitiveInfo)
            break
          case 'primitive-polyline':
            bbox = this._calculatePrimitivePolylineBoundingBox(entityInfo.entity, entityInfo.primitiveInfo)
            break
          case 'primitive-polygon':
            bbox = this._calculatePrimitivePolygonBoundingBox(entityInfo.entity, entityInfo.primitiveInfo)
            break
          default:
            bbox = this._calculateGenericPrimitiveBoundingBox(entityInfo.entity, entityInfo.primitiveInfo)
        }
      } else {
        // Entity类型的包围盒计算
        switch (entityInfo.type) {
          case 'point':
            bbox = this._calculatePointBoundingBox(entityInfo.entity)
            break
          case 'label':
            bbox = this._calculateLabelBoundingBox(entityInfo.entity)
            break
          case 'billboard':
            bbox = this._calculateBillboardBoundingBox(entityInfo.entity)
            break
          case 'model':
            bbox = this._calculateModelBoundingBox(entityInfo.entity)
            break
          default:
            bbox = this._calculateGenericBoundingBox(entityInfo.entity)
        }
      }
    }
    
    if (bbox) {
      // 应用填充
      bbox.left -= this.options.padding
      bbox.top -= this.options.padding
      bbox.right += this.options.padding
      bbox.bottom += this.options.padding
      
      this.boundingBoxes.set(id, bbox)
    }
  }
  
  /**
   * 计算点实体的屏幕包围盒
   * @private
   * @param {Object} entity - 点实体
   * @returns {Object|null} 包围盒对象
   */
  _calculatePointBoundingBox(entity) {
    if (!entity.position || !entity.point) return null
    
    try {
      // 使用兼容性方法获取世界坐标
      const position = this._getPropertyValue(entity.position)
      if (!position) return null
      
      // 使用兼容性方法转换为屏幕坐标
      const screenPos = this._worldToScreenCoordinates(position)
      if (!screenPos) return null
      
      // 使用兼容性方法获取点的像素大小
      const pixelSize = this._getPropertyValue(entity.point.pixelSize) || 8
      const halfSize = pixelSize / 2
      
      return {
        left: screenPos.x - halfSize,
        top: screenPos.y - halfSize,
        right: screenPos.x + halfSize,
        bottom: screenPos.y + halfSize
      }
    } catch (error) {
      console.warn('计算点实体包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算标签实体的屏幕包围盒
   * @private
   * @param {Object} entity - 标签实体
   * @returns {Object|null} 包围盒对象
   */
  _calculateLabelBoundingBox(entity) {
    if (!entity.position || !entity.label) return null
    
    try {
      // 使用兼容性方法获取世界坐标
      const position = this._getPropertyValue(entity.position)
      if (!position) return null
      
      // 使用兼容性方法转换为屏幕坐标
      const screenPos = this._worldToScreenCoordinates(position)
      if (!screenPos) return null
      
      // 使用兼容性方法获取标签文本和字体信息
      const text = this._getPropertyValue(entity.label.text) || ''
      const fontSize = this._getPropertyValue(entity.label.font) || '12pt monospace'
      const scale = this._getPropertyValue(entity.label.scale) || 1.0
      
      // 估算文本尺寸
      const textDimensions = this._measureText(text, fontSize, scale)
      
      // 使用兼容性方法计算偏移量
      const pixelOffset = this._getPropertyValue(entity.label.pixelOffset) || new Cesium.Cartesian2(0, 0)
      
      const centerX = screenPos.x + pixelOffset.x
      const centerY = screenPos.y + pixelOffset.y
      
      return {
        left: centerX - textDimensions.width / 2,
        top: centerY - textDimensions.height / 2,
        right: centerX + textDimensions.width / 2,
        bottom: centerY + textDimensions.height / 2
      }
    } catch (error) {
      console.warn('计算标签包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算广告牌实体的屏幕包围盒
   * @private
   * @param {Object} entity - 广告牌实体
   * @returns {Object|null} 包围盒对象
   */
  _calculateBillboardBoundingBox(entity) {
    if (!entity.position || !entity.billboard) return null
    
    try {
      // 使用兼容性方法获取世界坐标
      const position = this._getPropertyValue(entity.position)
      if (!position) return null
      
      // 使用兼容性方法转换为屏幕坐标
      const screenPos = this._worldToScreenCoordinates(position)
      if (!screenPos) return null
      
      // 使用兼容性方法获取广告牌尺寸
      const scale = this._getPropertyValue(entity.billboard.scale) || 1.0
      const width = this._getPropertyValue(entity.billboard.width) || 32
      const height = this._getPropertyValue(entity.billboard.height) || 32
      
      const scaledWidth = width * scale
      const scaledHeight = height * scale
      
      // 使用兼容性方法计算偏移量
      const pixelOffset = this._getPropertyValue(entity.billboard.pixelOffset) || new Cesium.Cartesian2(0, 0)
      
      const centerX = screenPos.x + pixelOffset.x
      const centerY = screenPos.y + pixelOffset.y
      
      return {
        left: centerX - scaledWidth / 2,
        top: centerY - scaledHeight / 2,
        right: centerX + scaledWidth / 2,
        bottom: centerY + scaledHeight / 2
      }
    } catch (error) {
      console.warn('计算广告牌包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算模型实体的屏幕包围盒
   * @private
   * @param {Object} entity - 模型实体
   * @returns {Object|null} 包围盒对象
   */
  _calculateModelBoundingBox(entity) {
    if (!entity.position || !entity.model) return null
    
    try {
      // 使用兼容性方法获取世界坐标
      const position = this._getPropertyValue(entity.position)
      if (!position) return null
      
      // 使用兼容性方法转换为屏幕坐标
      const screenPos = this._worldToScreenCoordinates(position)
      if (!screenPos) return null
      
      // 模型包围盒计算较复杂，这里使用简化方案
      // 实际应用中可以根据模型的边界球或边界盒计算
      const scale = this._getPropertyValue(entity.model.scale) || 1.0
      const defaultSize = 50 * scale // 默认估算尺寸
      
      return {
        left: screenPos.x - defaultSize / 2,
        top: screenPos.y - defaultSize / 2,
        right: screenPos.x + defaultSize / 2,
        bottom: screenPos.y + defaultSize / 2
      }
    } catch (error) {
      console.warn('计算模型包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算自定义边界框
   * @private
   * @param {Object} entity - 实体
   * @param {Object} customBounds - 自定义边界信息
   * @returns {Object|null} 包围盒对象
   */
  _calculateCustomBoundingBox(entity, customBounds) {
    try {
      // 使用兼容性方法获取世界坐标
      const position = this._getPropertyValue(entity.position)
      if (!position) return null
      
      // 使用兼容性方法转换为屏幕坐标
      const screenPos = this._worldToScreenCoordinates(position)
      if (!screenPos) return null
      
      // 应用自定义边界
      const width = customBounds.width || 32
      const height = customBounds.height || 32
      const offsetX = customBounds.offsetX || 0
      const offsetY = customBounds.offsetY || 0
      
      const centerX = screenPos.x + offsetX
      const centerY = screenPos.y + offsetY
      
      return {
        left: centerX - width / 2,
        top: centerY - height / 2,
        right: centerX + width / 2,
        bottom: centerY + height / 2
      }
    } catch (error) {
      console.warn('计算自定义包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算通用实体包围盒（兜底方案）
   * @private
   * @param {Object} entity - 实体
   * @returns {Object|null} 包围盒对象
   */
  _calculateGenericBoundingBox(entity) {
    try {
      // 使用兼容性方法获取世界坐标
      const position = this._getPropertyValue(entity.position)
      if (!position) return null
      
      // 使用兼容性方法转换为屏幕坐标
      const screenPos = this._worldToScreenCoordinates(position)
      if (!screenPos) return null
      
      // 使用默认尺寸
      const defaultSize = 24
      
      return {
        left: screenPos.x - defaultSize / 2,
        top: screenPos.y - defaultSize / 2,
        right: screenPos.x + defaultSize / 2,
        bottom: screenPos.y + defaultSize / 2
      }
    } catch (error) {
      console.warn('计算通用包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算Primitive点的屏幕包围盒
   * @private
   * @param {Object} primitive - Primitive对象
   * @param {Object} primitiveInfo - Primitive信息
   * @returns {Object|null} 包围盒对象
   */
  _calculatePrimitivePointBoundingBox(primitive, primitiveInfo) {
    try {
      // 从primitiveInfo中获取位置信息
      const positions = primitiveInfo?.positions || []
      if (positions.length === 0) return null
      
      // 计算所有点的屏幕包围盒
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      
      for (const position of positions) {
        const screenPos = this._worldToScreenCoordinates(position)
        if (!screenPos) continue
        
        // 获取点大小（从primitiveInfo或使用默认值）
        const pointSize = primitiveInfo?.pointSize || 8
        const halfSize = pointSize / 2
        
        minX = Math.min(minX, screenPos.x - halfSize)
        minY = Math.min(minY, screenPos.y - halfSize)
        maxX = Math.max(maxX, screenPos.x + halfSize)
        maxY = Math.max(maxY, screenPos.y + halfSize)
      }
      
      if (minX === Infinity) return null
      
      return { left: minX, top: minY, right: maxX, bottom: maxY }
    } catch (error) {
      console.warn('计算Primitive点包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算Primitive广告牌的屏幕包围盒
   * @private
   * @param {Object} primitive - Primitive对象
   * @param {Object} primitiveInfo - Primitive信息
   * @returns {Object|null} 包围盒对象
   */
  _calculatePrimitiveBillboardBoundingBox(primitive, primitiveInfo) {
    try {
      // 从primitiveInfo中获取位置和尺寸信息
      const positions = primitiveInfo?.positions || []
      if (positions.length === 0) return null
      
      const width = primitiveInfo?.width || 32
      const height = primitiveInfo?.height || 32
      const scale = primitiveInfo?.scale || 1.0
      
      const scaledWidth = width * scale
      const scaledHeight = height * scale
      
      // 计算所有广告牌的屏幕包围盒
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      
      for (const position of positions) {
        const screenPos = this._worldToScreenCoordinates(position)
        if (!screenPos) continue
        
        minX = Math.min(minX, screenPos.x - scaledWidth / 2)
        minY = Math.min(minY, screenPos.y - scaledHeight / 2)
        maxX = Math.max(maxX, screenPos.x + scaledWidth / 2)
        maxY = Math.max(maxY, screenPos.y + scaledHeight / 2)
      }
      
      if (minX === Infinity) return null
      
      return { left: minX, top: minY, right: maxX, bottom: maxY }
    } catch (error) {
      console.warn('计算Primitive广告牌包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算Primitive线的屏幕包围盒
   * @private
   * @param {Object} primitive - Primitive对象
   * @param {Object} primitiveInfo - Primitive信息
   * @returns {Object|null} 包围盒对象
   */
  _calculatePrimitivePolylineBoundingBox(primitive, primitiveInfo) {
    try {
      // 从primitiveInfo中获取位置信息
      const positions = primitiveInfo?.positions || []
      if (positions.length === 0) return null
      
      // 获取线宽
      const lineWidth = primitiveInfo?.width || 2
      const halfWidth = lineWidth / 2
      
      // 计算所有点的屏幕包围盒
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      
      for (const position of positions) {
        const screenPos = this._worldToScreenCoordinates(position)
        if (!screenPos) continue
        
        minX = Math.min(minX, screenPos.x - halfWidth)
        minY = Math.min(minY, screenPos.y - halfWidth)
        maxX = Math.max(maxX, screenPos.x + halfWidth)
        maxY = Math.max(maxY, screenPos.y + halfWidth)
      }
      
      if (minX === Infinity) return null
      
      return { left: minX, top: minY, right: maxX, bottom: maxY }
    } catch (error) {
      console.warn('计算Primitive线包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算Primitive多边形的屏幕包围盒
   * @private
   * @param {Object} primitive - Primitive对象
   * @param {Object} primitiveInfo - Primitive信息
   * @returns {Object|null} 包围盒对象
   */
  _calculatePrimitivePolygonBoundingBox(primitive, primitiveInfo) {
    try {
      // 从primitiveInfo中获取位置信息
      const positions = primitiveInfo?.positions || []
      if (positions.length === 0) return null
      
      // 计算所有顶点的屏幕包围盒
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      
      for (const position of positions) {
        const screenPos = this._worldToScreenCoordinates(position)
        if (!screenPos) continue
        
        minX = Math.min(minX, screenPos.x)
        minY = Math.min(minY, screenPos.y)
        maxX = Math.max(maxX, screenPos.x)
        maxY = Math.max(maxY, screenPos.y)
      }
      
      if (minX === Infinity) return null
      
      return { left: minX, top: minY, right: maxX, bottom: maxY }
    } catch (error) {
      console.warn('计算Primitive多边形包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算通用Primitive包围盒（兜底方案）
   * @private
   * @param {Object} primitive - Primitive对象
   * @param {Object} primitiveInfo - Primitive信息
   * @returns {Object|null} 包围盒对象
   */
  _calculateGenericPrimitiveBoundingBox(primitive, primitiveInfo) {
    try {
      // 尝试从boundingSphere获取包围球信息
      const boundingSphere = primitive.boundingSphere || primitiveInfo?.boundingSphere
      if (boundingSphere) {
        const screenPos = this._worldToScreenCoordinates(boundingSphere.center)
        if (screenPos) {
          // 将3D包围球半径转换为屏幕像素（简化估算）
          const radius = Math.max(boundingSphere.radius / this.viewer.camera.getMagnitude() * 1000, 20)
          
          return {
            left: screenPos.x - radius,
            top: screenPos.y - radius,
            right: screenPos.x + radius,
            bottom: screenPos.y + radius
          }
        }
      }
      
      // 如果有位置信息，使用默认尺寸
      const positions = primitiveInfo?.positions
      if (positions && positions.length > 0) {
        const position = positions[0]
        const screenPos = this._worldToScreenCoordinates(position)
        if (screenPos) {
          const defaultSize = 32
          return {
            left: screenPos.x - defaultSize / 2,
            top: screenPos.y - defaultSize / 2,
            right: screenPos.x + defaultSize / 2,
            bottom: screenPos.y + defaultSize / 2
          }
        }
      }
      
      return null
    } catch (error) {
      console.warn('计算通用Primitive包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 计算Primitive自定义边界框
   * @private
   * @param {Object} primitive - Primitive对象
   * @param {Object} customBounds - 自定义边界信息
   * @param {Object} primitiveInfo - Primitive信息
   * @returns {Object|null} 包围盒对象
   */
  _calculatePrimitiveCustomBoundingBox(primitive, customBounds, primitiveInfo) {
    try {
      // 从primitiveInfo获取位置信息
      const positions = primitiveInfo?.positions
      if (!positions || positions.length === 0) return null
      
      // 使用第一个位置作为参考点
      const position = positions[0]
      const screenPos = this._worldToScreenCoordinates(position)
      if (!screenPos) return null
      
      // 应用自定义边界
      const width = customBounds.width || 32
      const height = customBounds.height || 32
      const offsetX = customBounds.offsetX || 0
      const offsetY = customBounds.offsetY || 0
      
      const centerX = screenPos.x + offsetX
      const centerY = screenPos.y + offsetY
      
      return {
        left: centerX - width / 2,
        top: centerY - height / 2,
        right: centerX + width / 2,
        bottom: centerY + height / 2
      }
    } catch (error) {
      console.warn('计算Primitive自定义包围盒失败:', error)
      return null
    }
  }
  
  /**
   * 测量文本尺寸
   * @private
   * @param {string} text - 文本内容
   * @param {string} font - 字体信息
   * @param {number} scale - 缩放比例
   * @returns {Object} 文本尺寸 {width, height}
   */
  _measureText(text, font, scale = 1.0) {
    // 创建临时canvas来测量文本
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    context.font = font
    
    const metrics = context.measureText(text)
    const fontSize = parseInt(font.match(/\d+/)[0]) || 12
    
    return {
      width: metrics.width * scale,
      height: fontSize * scale * 1.2 // 估算行高
    }
  }
  
  /**
   * 检测碰撞
   * @private
   */
  _checkCollisions() {
    // 清除防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    
    // 清理调试可视化
    if (this.options.enableDebug) {
      this._clearDebugVisualization()
    }
    
    // 更新所有包围盒并重置可见状态
    for (const [id, entityInfo] of this.entities) {
      this._updateBoundingBox(id)
      
      // 重置为可见状态
      this._setShowProperty(entityInfo.entity, entityInfo.type, entityInfo.originalShow)
      this.visibilityStatus.set(id, true)
    }
    
    // 按优先级排序实体
    const entityEntries = Array.from(this.entities.entries())
    entityEntries.sort((a, b) => b[1].priority - a[1].priority)
    
    // 处理实体间碰撞
    for (let i = 0; i < entityEntries.length; i++) {
      const [id1, entityInfo1] = entityEntries[i]
      
      // 如果已经被隐藏，跳过
      if (!this.visibilityStatus.get(id1)) continue
      
      const bbox1 = this.boundingBoxes.get(id1)
      if (!bbox1) continue
      
      for (let j = i + 1; j < entityEntries.length; j++) {
        const [id2, entityInfo2] = entityEntries[j]
        
        // 如果已经被隐藏，跳过
        if (!this.visibilityStatus.get(id2)) continue
        
        const bbox2 = this.boundingBoxes.get(id2)
        if (!bbox2) continue
        
        // 检测碰撞
        if (this._isColliding(bbox1, bbox2)) {
          // 优先级低的隐藏
          if (entityInfo1.priority >= entityInfo2.priority) {
            this._setShowProperty(entityInfo2.entity, entityInfo2.type, false)
            this.visibilityStatus.set(id2, false)
          } else {
            this._setShowProperty(entityInfo1.entity, entityInfo1.type, false)
            this.visibilityStatus.set(id1, false)
            break // 跳出内层循环
          }
        }
      }
    }
    
    // 调试模式下可视化包围盒
    if (this.options.enableDebug) {
      this._visualizeBoundingBoxes()
    }
  }
  
  /**
   * 判断两个边界框是否碰撞
   * @private
   * @param {Object} bbox1 - 第一个边界框
   * @param {Object} bbox2 - 第二个边界框
   * @returns {boolean} 是否发生碰撞
   */
  _isColliding(bbox1, bbox2) {
    return !(
      bbox1.right < bbox2.left ||
      bbox1.left > bbox2.right ||
      bbox1.bottom < bbox2.top ||
      bbox1.top > bbox2.bottom
    )
  }
  
  /**
   * 获取实体的显示属性
   * @private
   * @param {Object} entity - 实体或Primitive
   * @param {string} type - 实体类型
   * @returns {boolean} 显示状态
   */
  _getShowProperty(entity, type) {
    try {
      // 使用兼容性方法处理Primitive类型
      if (this._isPrimitiveType(entity, type)) {
        return entity.show !== undefined ? entity.show : true
      }
      
      // 处理Entity类型，使用兼容性方法获取属性值
      switch (type) {
        case 'point':
          return this._getPropertyValue(entity.point?.show) ?? true
        case 'label':
          return this._getPropertyValue(entity.label?.show) ?? true
        case 'billboard':
          return this._getPropertyValue(entity.billboard?.show) ?? true
        case 'model':
          return this._getPropertyValue(entity.model?.show) ?? true
        default:
          return this._getPropertyValue(entity.show) ?? true
      }
    } catch (error) {
      console.warn(`获取显示属性失败 (${type}):`, error)
      return true
    }
  }
  
  /**
   * 设置实体的显示属性
   * @private
   * @param {Object} entity - 实体或Primitive
   * @param {string} type - 实体类型
   * @param {boolean} show - 显示状态
   */
  _setShowProperty(entity, type, show) {
    try {
      // 使用兼容性方法处理Primitive类型
      if (this._isPrimitiveType(entity, type)) {
        entity.show = show
        return
      }
      
      // 处理Entity类型
      switch (type) {
        case 'point':
          if (entity.point) entity.point.show = show
          break
        case 'label':
          if (entity.label) entity.label.show = show
          break
        case 'billboard':
          if (entity.billboard) entity.billboard.show = show
          break
        case 'model':
          if (entity.model) entity.model.show = show
          break
        default:
          entity.show = show
      }
    } catch (error) {
      console.warn(`设置实体显示属性失败 (${type}):`, error)
    }
  }
  
  /**
   * 设置相机变化监听（兼容多版本）
   * @private
   */
  _setupCameraChangeHandler() {
    try {
      // 优先使用 camera.changed 事件（Cesium 1.80+）
      if (this.compatibility.hasCameraChanged && this.viewer.camera.changed) {
        this.cameraChangeHandler = this.viewer.camera.changed.addEventListener(() => {
          this._handleCameraChange()
        })
        return
      }
      
      // 兼容旧版本：使用 camera.moveEnd 事件
      if (this.compatibility.hasCameraMoveEnd && this.viewer.camera.moveEnd) {
        this.cameraChangeHandler = this.viewer.camera.moveEnd.addEventListener(() => {
          this._handleCameraChange()
        })
        return
      }
      
      // 兜底方案：使用定时器轮询检测相机变化
      console.warn('未找到合适的相机事件，使用轮询检测')
      this._setupCameraPolling()
      
    } catch (error) {
      console.warn('设置相机监听失败，使用轮询检测:', error)
      this._setupCameraPolling()
    }
  }
  
  /**
   * 处理相机变化事件
   * @private
   */
  _handleCameraChange() {
    // 使用防抖处理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    
    this.debounceTimer = setTimeout(() => {
      this._checkCollisions()
    }, this.options.debounceDelay)
  }
  
  /**
   * 设置相机轮询检测（兜底方案）
   * @private
   */
  _setupCameraPolling() {
    let lastCameraPosition = null
    let lastCameraDirection = null
    
    this.cameraPollingInterval = setInterval(() => {
      try {
        const camera = this.viewer.camera
        const currentPosition = camera.position.clone()
        const currentDirection = camera.direction.clone()
        
        // 检测位置或方向是否发生变化
        if (!lastCameraPosition || 
            !lastCameraDirection ||
            !Cesium.Cartesian3.equals(currentPosition, lastCameraPosition) ||
            !Cesium.Cartesian3.equals(currentDirection, lastCameraDirection)) {
          
          lastCameraPosition = currentPosition
          lastCameraDirection = currentDirection
          this._handleCameraChange()
        }
      } catch (error) {
        console.warn('相机轮询检测失败:', error)
      }
    }, this.options.debounceDelay)
  }
  
  /**
   * 可视化包围盒（调试模式）
   * @private
   */
  _visualizeBoundingBoxes() {
    // 为每个包围盒创建矩形实体用于调试
    for (const [id, bbox] of this.boundingBoxes) {
      const entityInfo = this.entities.get(id)
      if (!entityInfo) continue
      
      // 确保边界值在有效范围内
      const left = Math.max(-180, Math.min(180, bbox.left))
      const right = Math.max(-180, Math.min(180, bbox.right))
      const top = Math.max(-90, Math.min(90, bbox.top))
      const bottom = Math.max(-90, Math.min(90, bbox.bottom))
      
      // 检查边界是否有效
      if (left >= right || bottom >= top) {
        console.warn(`跳过无效的包围盒边界: ${id}`, { left, right, top, bottom })
        continue
      }
      
      try {
        // 创建调试矩形
        const debugEntity = this.viewer.entities.add({
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(left, bottom, right, top),
            material: this.visibilityStatus.get(id) ? 
              Cesium.Color.GREEN.withAlpha(0.3) : 
              Cesium.Color.RED.withAlpha(0.3),
            outline: true,
            outlineColor: this.visibilityStatus.get(id) ? 
              Cesium.Color.GREEN : 
              Cesium.Color.RED,
            height: 0
          }
        })
        
        this.debugEntities.push(debugEntity)
      } catch (error) {
        console.warn(`创建调试矩形失败 (${id}):`, error)
      }
    }
  }
  
  /**
   * 清理调试可视化
   * @private
   */
  _clearDebugVisualization() {
    this.debugEntities.forEach(entity => {
      this.viewer.entities.remove(entity)
    })
    this.debugEntities = []
  }
  
  /**
   * 启用/禁用调试模式
   * @param {boolean} enable - 是否启用调试模式
   */
  setDebugMode(enable) {
    this.options.enableDebug = enable
    if (!enable) {
      this._clearDebugVisualization()
    } else {
      this._checkCollisions()
    }
  }
  
  /**
   * 获取碰撞统计信息
   * @returns {Object} 统计信息
   */
  getCollisionStats() {
    const totalEntities = this.entities.size
    const visibleEntities = Array.from(this.visibilityStatus.values()).filter(v => v).length
    const hiddenEntities = totalEntities - visibleEntities
    
    return {
      total: totalEntities,
      visible: visibleEntities,
      hidden: hiddenEntities,
      hiddenPercentage: totalEntities > 0 ? (hiddenEntities / totalEntities * 100).toFixed(1) : 0
    }
  }
  
  /**
   * 销毁管理器
   */
  destroy() {
    // 恢复所有实体的原始显示状态
    for (const [id, entityInfo] of this.entities) {
      this._setShowProperty(entityInfo.entity, entityInfo.type, entityInfo.originalShow)
    }
    
    // 移除事件监听
    if (this.cameraChangeHandler) {
      this.cameraChangeHandler()
    }
    
    // 清理相机轮询定时器（兼容性兜底方案）
    if (this.cameraPollingInterval) {
      clearInterval(this.cameraPollingInterval)
    }
    
    // 清理防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    
    // 清理调试可视化
    this._clearDebugVisualization()
    
    // 清理数据
    this.entities.clear()
    this.boundingBoxes.clear()
    this.visibilityStatus.clear()
  }
}

export default UniversalCollisionManager 