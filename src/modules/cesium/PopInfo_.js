// 实现信息弹窗：传入经纬度，弹窗的dom的element，经纬度的位置与弹窗的连接线长度和方位角，其它信息
import * as Cesium from 'cesium'

/**
 * Cesium版本兼容性辅助函数
 * @tips 处理不同版本Cesium API的兼容性问题
 */
class CesiumCompatHelper {
    /**
     * 兼容的射线与椭球面求交
     * @param {Cesium.Ray} ray - 射线
     * @param {Cesium.Ellipsoid} ellipsoid - 椭球面
     * @returns {Cesium.Cartesian3|null} 交点坐标
     */
    static rayEllipsoidIntersection(ray, ellipsoid) {
        try {
            // 尝试新版本API
            const intersection = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid)
            if (intersection) {
                return Cesium.Ray.getPoint(ray, intersection.start)
            }
        } catch (e) {
            // 回退到旧版本API（如果存在）
            try {
                if (ellipsoid.intersectRay) {
                    return ellipsoid.intersectRay(ray)
                }
            } catch (e2) {
                console.warn('Cesium射线椭球面求交API调用失败:', e2)
            }
        }
        return null
    }
}

/**
 * 信息弹窗类
 * @tips 用于在Cesium地图上显示信息弹窗，支持连接线、位置跟随等功能
 * 
 * 支持三种定位模式：
 * 1. 地理坐标模式 (geographicMode: 1, 默认)：
 *    - 弹窗DOM会记住其中心点的地理坐标位置
 *    - 地图缩放时，弹窗始终保持在该地理位置上
 *    - 连接线会随地图缩放发生变化（长度和角度都可能改变）
 *    - 适用于需要标注地理位置的场景
 * 
 * 2. 屏幕坐标模式 (geographicMode: 2)：
 *    - 弹窗保持在固定的屏幕位置
 *    - 地图缩放时，连接线的长度和方位角保持不变
 *    - DOM在屏幕空间的位置也保持不变
 *    - 适用于HUD、工具提示等界面元素
 * 
 * 3. 混合模式 (geographicMode: 3)：
 *    - 地图缩放时，连接线的长度和方位角保持不变
 *    - 但弹窗位置会根据锚点位置实时更新
 *    - 结合了屏幕坐标的固定连接线和地理坐标的位置跟随
 * 
 * 拖拽功能：
 * - 支持鼠标和触摸拖拽，实时更新连接线
 * - 地理坐标模式：拖拽后更新弹窗的地理位置
 * - 屏幕坐标模式：拖拽后更新弹窗的屏幕位置
 * - 可动态开启/关闭拖拽功能
 * 
 * @author LantuPlot
 */
class PopInfo {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Cesium.Viewer} options.viewer - Cesium地图实例
     * @param {Array} options.position - 经纬度位置 [longitude, latitude, height]
     * @param {HTMLElement} options.element - 弹窗DOM元素
     * @param {Object} options.lineConfig - 连接线配置
     * @param {Number} options.lineConfig.length - 连接线长度（像素）
     * @param {Number} options.lineConfig.angle - 连接线方位角（角度，0度为正北方向）
     * @param {String} options.lineConfig.anchorPoint - 连接点位置：'center'(中心) | 'nearest'(最近角，默认)
     * @param {Object} options.style - 弹窗样式配置
     * @param {String} options.id - 弹窗唯一标识
     * @param {Number} options.geographicMode - 定位模式：1=地理坐标模式，2=屏幕坐标模式，3=混合模式
     * @param {Boolean} options.draggable - 是否允许拖拽移动弹窗，默认为true
     */
    constructor(options = {}) {
        // 基础配置
        this.viewer = options.viewer
        this.id = options.id || this._generateId()

        // 位置信息
        this.position = options.position || [0, 0, 0]
        this.cartesianPosition = null

        // 定位模式：1=地理坐标模式，2=屏幕坐标模式，3=混合模式
        this.geographicMode = options.geographicMode !== undefined ? options.geographicMode : 1

        // 地理坐标模式下的弹窗中心点经纬度
        this.popupCenterPosition = null
        this.popupCenterCartesian = null

        // 屏幕坐标模式下的固定屏幕位置
        this.fixedScreenPosition = null

        // 混合模式下的固定连接线长度和角度
        this.fixedLineLength = null
        this.fixedLineAngle = null

        // DOM元素
        this.element = options.element
        this.container = null

        // 连接线配置
        this.lineConfig = Object.assign({
            length: 100,        // 连接线长度（像素）
            angle: 0,          // 方位角（度）
            color: '#ffffff',   // 连接线颜色
            width: 2,          // 连接线宽度
            opacity: 0.8,      // 连接线透明度
            anchorPoint: 'nearest'  // 连接点位置：'center' | 'nearest'
        }, options.lineConfig || {})

        // 样式配置
        this.style = Object.assign({
            zIndex: 1000,      // 层级
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '4px',
            padding: '8px',
            color: '#666666',
            fontSize: '14px',
            maxWidth: '300px',
            pointerEvents: 'auto'
        }, options.style || {})

        // 状态管理
        this.isVisible = false
        this.isDestroyed = false

        // 拖拽功能配置
        this.draggable = options.draggable !== undefined ? options.draggable : true
        this.isDragging = false
        this.dragStartPosition = null
        this.dragOffset = { x: 0, y: 0 }

        // 调试模式
        this._debugMode = options.debug || false

        // Cesium实体
        this.pointEntity = null
        this.lineEntity = null

        // 事件监听器
        this._frameUpdateListener = null
        this._dragMouseMoveListener = null
        this._dragMouseUpListener = null

        // 初始化
        this._init()
    }

    /**
     * 初始化弹窗
     * @private
     */
    _init() {
        if (!this.viewer || !this.element) {
            console.error('PopInfo: viewer和element是必需的参数')
            return
        }

        // 创建弹窗容器
        this._createContainer()

        // 转换坐标
        this._updateCartesianPosition()

        // 创建连接点和连接线
        this._createEntities()

        // 设置DOM样式
        this._applyStyles()

        // 启动位置更新
        this._startPositionTracking()

        // 设置拖拽功能
        this._setupDragHandlers()

        this.show()
    }

    /**
     * 创建弹窗容器
     * @private
     */
    _createContainer() {
        // 创建容器div
        this.container = document.createElement('div')
        this.container.className = 'cesium-popup-container'
        this.container.style.position = 'absolute'
        this.container.style.display = 'none'
        this.container.style.pointerEvents = 'none'

        // 创建连接线canvas
        this.lineCanvas = document.createElement('canvas')
        this.lineCanvas.className = 'cesium-popup-line-canvas'
        this.lineCanvas.style.position = 'absolute'
        this.lineCanvas.style.left = '0px'
        this.lineCanvas.style.top = '0px'
        this.lineCanvas.style.pointerEvents = 'none'
        this.lineCanvas.style.zIndex = (this.style.zIndex || 1000) - 1
        this.lineCanvas.style.display = 'none' // 初始隐藏

        // 添加用户元素到容器
        this.container.appendChild(this.element)

        // 添加到地图容器
        this.viewer.container.appendChild(this.container)
        this.viewer.container.appendChild(this.lineCanvas)
    }

    /**
     * 更新笛卡尔坐标
     * @private
     */
    _updateCartesianPosition() {
        const longitude = Cesium.Math.toRadians(this.position[0])
        const latitude = Cesium.Math.toRadians(this.position[1])
        const height = this.position[2] || 0

        this.cartesianPosition = Cesium.Cartesian3.fromRadians(longitude, latitude, height)
    }

    /**
     * 创建Cesium实体
     * @private
     */
    _createEntities() {
        // 创建连接点（可选，用于调试）
        this.pointEntity = this.viewer.entities.add({
            id: `popup-point-${this.id}`,
            position: this.cartesianPosition,
            show: false, // 默认隐藏连接点
            point: {
                pixelSize: 5,
                color: Cesium.Color.fromCssColorString(this.lineConfig.color),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 1
            }
        })
    }

    /**
     * 应用样式
     * @private
     */
    _applyStyles() {
        Object.assign(this.element.style, this.style)
        this.element.style.position = 'relative'

        // 设置拖拽相关样式
        if (this.draggable) {
            this.container.style.cursor = 'move'
            this.container.style.pointerEvents = 'auto'
            this.element.style.userSelect = 'none' // 防止拖拽时选中文本
        }
    }

    /**
     * 开始位置跟踪
     * @private
     */
    _startPositionTracking() {
        this._frameUpdateListener = this.viewer.scene.postRender.addEventListener(() => {
            if (this.isVisible && !this.isDestroyed && !this.isDragging) {
                this._updatePosition()
            }
        })
    }

    /**
     * 设置拖拽事件处理器
     * @private
     */
    _setupDragHandlers() {
        if (!this.draggable) return

        // 鼠标按下事件
        this.container.addEventListener('mousedown', (event) => {
            this._onDragStart(event)
        })

        // 触摸事件支持（移动端）
        this.container.addEventListener('touchstart', (event) => {
            this._onDragStart(event.touches[0])
        })
    }

    /**
     * 开始拖拽
     * @param {MouseEvent|Touch} event - 鼠标或触摸事件
     * @private
     */
    _onDragStart(event) {
        if (this.isDestroyed) return

        this.isDragging = true
        this.dragStartPosition = {
            x: event.clientX,
            y: event.clientY
        }

        // 记录容器当前位置
        const containerRect = this.container.getBoundingClientRect()
        this.dragOffset = {
            x: containerRect.left,
            y: containerRect.top
        }

        // 改变鼠标样式
        this.container.style.cursor = 'grabbing'
        document.body.style.cursor = 'grabbing'

        // 添加全局事件监听器
        this._dragMouseMoveListener = (e) => this._onDragMove(e)
        this._dragMouseUpListener = (e) => this._onDragEnd(e)

        document.addEventListener('mousemove', this._dragMouseMoveListener)
        document.addEventListener('mouseup', this._dragMouseUpListener)
        document.addEventListener('touchmove', this._dragMouseMoveListener)
        document.addEventListener('touchend', this._dragMouseUpListener)

        // 阻止默认行为
        event.preventDefault()
    }

    /**
     * 拖拽移动过程
     * @param {MouseEvent|TouchEvent} event - 鼠标或触摸事件
     * @private
     */
    _onDragMove(event) {
        if (!this.isDragging || this.isDestroyed) return

        // 处理触摸事件
        const clientX = event.clientX || (event.touches && event.touches[0].clientX)
        const clientY = event.clientY || (event.touches && event.touches[0].clientY)

        if (!clientX || !clientY) return

        // 计算移动距离
        const deltaX = clientX - this.dragStartPosition.x
        const deltaY = clientY - this.dragStartPosition.y

        // 获取viewer容器的偏移
        const viewerRect = this.viewer.container.getBoundingClientRect()

        // 更新弹窗位置（考虑viewer偏移）
        const newX = this.dragOffset.x + deltaX
        const newY = this.dragOffset.y + deltaY

        // 确保位置是相对于页面的绝对位置
        this.container.style.left = `${newX}px`
        this.container.style.top = `${newY}px`

        // 实时更新连接线（传递页面绝对坐标）
        this._updateConnectionLineDuringDrag(newX, newY)

        // 阻止默认行为
        event.preventDefault()
    }

    /**
     * 拖拽结束
     * @param {MouseEvent|TouchEvent} event - 鼠标或触摸事件
     * @private
     */
    _onDragEnd(event) {
        if (!this.isDragging) return

        this.isDragging = false

        // 恢复鼠标样式
        this.container.style.cursor = 'move'
        document.body.style.cursor = ''

        // 移除全局事件监听器
        if (this._dragMouseMoveListener) {
            document.removeEventListener('mousemove', this._dragMouseMoveListener)
            document.removeEventListener('touchmove', this._dragMouseMoveListener)
            this._dragMouseMoveListener = null
        }

        if (this._dragMouseUpListener) {
            document.removeEventListener('mouseup', this._dragMouseUpListener)
            document.removeEventListener('touchend', this._dragMouseUpListener)
            this._dragMouseUpListener = null
        }

        // 根据定位模式处理拖拽结果
        this._handleDragResult()

        // 确保弹窗在视口内
        this._keepInViewport()
    }

    /**
     * 拖拽过程中更新连接线
     * @param {Number} popupX - 弹窗X坐标（页面绝对坐标）
     * @param {Number} popupY - 弹窗Y坐标（页面绝对坐标）
     * @private
     */
    _updateConnectionLineDuringDrag(popupX, popupY) {
        if (!this.cartesianPosition) return

        // 获取锚点的屏幕坐标
        const anchorScreenPos = Cesium.SceneTransforms.worldToWindowCoordinates(
            this.viewer.scene,
            this.cartesianPosition
        )

        if (!anchorScreenPos) return

        // 获取viewer容器的位置偏移
        const viewerRect = this.viewer.container.getBoundingClientRect()
        const containerRect = this.container.getBoundingClientRect()

        // 构建弹窗矩形信息（相对于viewer的坐标）
        const popupRect = {
            left: popupX - viewerRect.left,
            top: popupY - viewerRect.top,
            width: containerRect.width,
            height: containerRect.height
        }

        // 计算连接点
        const connectionPoint = this._calculateConnectionPoint(anchorScreenPos, popupRect)

        // 绘制连接线
        this._drawConnectionLine(anchorScreenPos, connectionPoint)
    }

    /**
     * 处理拖拽结果
     * @private
     */
    _handleDragResult() {
        const containerRect = this.container.getBoundingClientRect()
        const viewerRect = this.viewer.container.getBoundingClientRect()

        // 计算相对于viewer容器的位置
        const relativeLeft = containerRect.left - viewerRect.left
        const relativeTop = containerRect.top - viewerRect.top

        const popupCenterScreenPos = {
            x: relativeLeft + containerRect.width / 2,
            y: relativeTop + containerRect.height / 2
        }

        if (this.geographicMode === 1) { // 地理坐标模式
            // 地理坐标模式：将新的屏幕位置转换为地理坐标并保存
            this._updatePopupCenterGeographicPosition(popupCenterScreenPos)
        } else if (this.geographicMode === 2) { // 屏幕坐标模式
            // 屏幕坐标模式：直接更新固定屏幕位置
            this.fixedScreenPosition = {
                x: relativeLeft,
                y: relativeTop
            }
        } else if (this.geographicMode === 3) { // 混合模式
            // 混合模式：更新固定连接线长度和角度
            // 获取锚点的屏幕坐标
            const anchorScreenPos = Cesium.SceneTransforms.worldToWindowCoordinates(
                this.viewer.scene,
                this.cartesianPosition
            )

            if (anchorScreenPos) {
                // 计算新的连接线长度和角度
                // 使用弹窗中心点而不是左上角，以获得更准确的角度和长度
                const popupCenterX = relativeLeft + containerRect.width / 2
                const popupCenterY = relativeTop + containerRect.height / 2

                // 计算连接线向量
                const dx = popupCenterX - anchorScreenPos.x
                const dy = popupCenterY - anchorScreenPos.y

                // 计算长度（欧几里得距离）
                this.fixedLineLength = Math.sqrt(dx * dx + dy * dy)

                // 计算角度（弧度转度）
                this.fixedLineAngle = Cesium.Math.toDegrees(Math.atan2(dx, -dy)) // 负dy因为屏幕Y轴向下

                // 确保角度在0-360度范围内
                if (this.fixedLineAngle < 0) {
                    this.fixedLineAngle += 360
                }

                // 直接设置弹窗位置，避免在下一帧重新计算时位置偏移
                this.container.style.left = `${relativeLeft}px`
                this.container.style.top = `${relativeTop}px`
            }
        }
    }

    /**
     * 更新弹窗中心点的地理坐标位置
     * @param {Object} screenPos - 屏幕坐标
     * @private
     */
    _updatePopupCenterGeographicPosition(screenPos) {
        // 将屏幕坐标转换为地理坐标
        const ray = this.viewer.camera.getPickRay(new Cesium.Cartesian2(screenPos.x, screenPos.y))

        // 尝试与地形求交
        let popupCartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene)

        // 如果没有与地形求交，则使用椭球面求交（兼容不同Cesium版本）
        if (!popupCartesian) {
            popupCartesian = CesiumCompatHelper.rayEllipsoidIntersection(ray, this.viewer.scene.globe.ellipsoid)
        }

        // 如果求交成功，更新弹窗中心位置
        if (popupCartesian) {
            this.popupCenterCartesian = popupCartesian

            // 转换为经纬度保存
            const cartographic = Cesium.Cartographic.fromCartesian(popupCartesian)
            this.popupCenterPosition = [
                Cesium.Math.toDegrees(cartographic.longitude),
                Cesium.Math.toDegrees(cartographic.latitude),
                cartographic.height
            ]
        }
    }

    /**
     * 更新弹窗位置
     * @private
     */
    _updatePosition() {
        if (!this.cartesianPosition) return

        // 将世界坐标转换为屏幕坐标
        // const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
        const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
            this.viewer.scene,
            this.cartesianPosition
        )

        if (!screenPosition) {
            this.hide()
            return
        }

        if (this.geographicMode === 1) { // 地理坐标模式
            // 地理坐标模式：弹窗跟随地理位置
            this._updateGeographicMode(screenPosition)
        } else if (this.geographicMode === 2) { // 屏幕坐标模式
            // 屏幕坐标模式：保持屏幕位置和连接线不变
            this._updateScreenMode(screenPosition)
        } else if (this.geographicMode === 3) { // 混合模式
            // 混合模式：连接线的长度和角度保持不变，但弹窗位置会实时更新
            this._updateMixedMode(screenPosition)
        }
    }

    /**
     * 地理坐标模式更新
     * @param {Object} anchorScreenPos - 锚点屏幕坐标
     * @private
     */
    _updateGeographicMode(anchorScreenPos) {
        // 如果还没有记住弹窗中心点的地理位置，则计算并记住
        if (!this.popupCenterPosition) {
            this._calculateAndRememberPopupCenter(anchorScreenPos)
        }

        // 将弹窗中心点的地理坐标转换为屏幕坐标
        const popupCenterScreenPos = Cesium.SceneTransforms.worldToWindowCoordinates(
            this.viewer.scene,
            this.popupCenterCartesian
        )

        if (!popupCenterScreenPos) {
            this.hide()
            return
        }

        // 更新容器位置到弹窗中心点
        this.container.style.left = `${popupCenterScreenPos.x}px`
        this.container.style.top = `${popupCenterScreenPos.y}px`

        // 获取弹窗矩形信息并计算连接点
        const containerRect = this.container.getBoundingClientRect()
        const viewerRect = this.viewer.container.getBoundingClientRect()
        const popupRect = {
            left: containerRect.left - viewerRect.left,
            top: containerRect.top - viewerRect.top,
            width: containerRect.width,
            height: containerRect.height
        }

        const connectionPoint = this._calculateConnectionPoint(anchorScreenPos, popupRect)

        // 绘制连接线
        this._drawConnectionLine(anchorScreenPos, connectionPoint)

        // 确保弹窗在屏幕范围内
        this._keepInViewport()
    }

    /**
     * 屏幕坐标模式更新
     * @param {Object} anchorScreenPos - 锚点屏幕坐标
     * @private
     */
    _updateScreenMode(anchorScreenPos) {
        // 如果还没有记住固定的屏幕位置，则计算并记住
        if (!this.fixedScreenPosition) {
            this.fixedScreenPosition = this._calculatePopupPosition(anchorScreenPos)
        }

        // 保持弹窗在固定的屏幕位置
        this.container.style.left = `${this.fixedScreenPosition.x}px`
        this.container.style.top = `${this.fixedScreenPosition.y}px`

        // 获取弹窗矩形信息并计算连接点
        const containerRect = this.container.getBoundingClientRect()
        const viewerRect = this.viewer.container.getBoundingClientRect()
        const popupRect = {
            left: containerRect.left - viewerRect.left,
            top: containerRect.top - viewerRect.top,
            width: containerRect.width,
            height: containerRect.height
        }

        const connectionPoint = this._calculateConnectionPoint(anchorScreenPos, popupRect)

        // 绘制连接线
        this._drawConnectionLine(anchorScreenPos, connectionPoint)

        // 在屏幕模式下，不需要做视口检查，因为位置是固定的
    }

    /**
     * 混合模式更新
     * @param {Object} anchorScreenPos - 锚点屏幕坐标
     * @private
     */
    _updateMixedMode(anchorScreenPos) {
        // 如果还没有记住固定的连接线长度和角度，则使用配置中的值
        if (this.fixedLineLength === null) {
            this.fixedLineLength = this.lineConfig.length
        }
        if (this.fixedLineAngle === null) {
            this.fixedLineAngle = this.lineConfig.angle
        }

        // 使用固定的连接线长度和角度计算弹窗位置
        const angleRad = Cesium.Math.toRadians(this.fixedLineAngle)
        const offsetX = Math.sin(angleRad) * this.fixedLineLength
        const offsetY = -Math.cos(angleRad) * this.fixedLineLength // 负号因为屏幕Y轴向下

        // 获取容器的尺寸
        const containerRect = this.container.getBoundingClientRect()

        // 计算新的弹窗位置（基于锚点位置）
        // 这里需要考虑弹窗中心点与左上角的偏移
        const popupX = anchorScreenPos.x + offsetX - containerRect.width / 2
        const popupY = anchorScreenPos.y + offsetY - containerRect.height / 2

        // 更新容器位置
        this.container.style.left = `${popupX}px`
        this.container.style.top = `${popupY}px`

        // 获取弹窗矩形信息并计算连接点
        const viewerRect = this.viewer.container.getBoundingClientRect()
        const popupRect = {
            left: containerRect.left - viewerRect.left,
            top: containerRect.top - viewerRect.top,
            width: containerRect.width,
            height: containerRect.height
        }

        const connectionPoint = this._calculateConnectionPoint(anchorScreenPos, popupRect)

        // 绘制连接线
        this._drawConnectionLine(anchorScreenPos, connectionPoint)

        // 确保弹窗在屏幕范围内
        this._keepInViewport()
    }

    /**
     * 计算并记住弹窗中心点的地理位置
     * @param {Object} anchorScreenPos - 锚点屏幕坐标
     * @private
     */
    _calculateAndRememberPopupCenter(anchorScreenPos) {
        // 先计算初始的弹窗屏幕位置
        const initialPopupScreenPos = this._calculatePopupPosition(anchorScreenPos)

        // 将弹窗屏幕位置转换为地理坐标
        const ray = this.viewer.camera.getPickRay(new Cesium.Cartesian2(
            initialPopupScreenPos.x,
            initialPopupScreenPos.y
        ))

        // 尝试与地形求交
        let popupCartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene)

        // 如果没有与地形求交，则使用椭球面求交（兼容不同Cesium版本）
        if (!popupCartesian) {
            popupCartesian = CesiumCompatHelper.rayEllipsoidIntersection(ray, this.viewer.scene.globe.ellipsoid)
        }

        // 如果还是没有求交成功，则使用锚点相同的高度
        if (!popupCartesian) {
            const anchorCartographic = Cesium.Cartographic.fromCartesian(this.cartesianPosition)
            // 计算弹窗位置在地面的投影
            const offsetDistance = this.lineConfig.length * this.viewer.camera.positionCartographic.height / 1000000 // 简化的距离计算
            const angleRad = Cesium.Math.toRadians(this.lineConfig.angle)

            const popupCartographic = new Cesium.Cartographic(
                anchorCartographic.longitude + offsetDistance * Math.sin(angleRad) / 111320, // 简化的经度计算
                anchorCartographic.latitude + offsetDistance * Math.cos(angleRad) / 110540,  // 简化的纬度计算
                anchorCartographic.height
            )

            popupCartesian = Cesium.Cartographic.toCartesian(popupCartographic)
        }

        this.popupCenterCartesian = popupCartesian

        // 转换为经纬度保存
        const cartographic = Cesium.Cartographic.fromCartesian(popupCartesian)
        this.popupCenterPosition = [
            Cesium.Math.toDegrees(cartographic.longitude),
            Cesium.Math.toDegrees(cartographic.latitude),
            cartographic.height
        ]
    }

    /**
     * 计算弹窗位置
     * @param {Object} basePosition - 基础位置
     * @returns {Object} 弹窗位置
     * @private
     */
    _calculatePopupPosition(basePosition) {
        // 将角度转换为弧度
        const angleRad = Cesium.Math.toRadians(this.lineConfig.angle)

        // 计算偏移量（考虑Cesium的坐标系统）
        const offsetX = Math.sin(angleRad) * this.lineConfig.length
        const offsetY = -Math.cos(angleRad) * this.lineConfig.length // 负号因为屏幕Y轴向下

        return {
            x: basePosition.x + offsetX,
            y: basePosition.y + offsetY
        }
    }

    /**
     * 计算弹窗的连接点位置
     * @param {Object} anchorPos - 锚点位置
     * @param {Object} popupRect - 弹窗矩形信息 {left, top, width, height}
     * @returns {Object} 连接点位置 {x, y}
     * @private
     */
    _calculateConnectionPoint(anchorPos, popupRect) {
        const anchorPoint = this.lineConfig.anchorPoint || 'nearest'

        if (anchorPoint === 'center') {
            // 连接到弹窗中心
            return {
                x: popupRect.left + popupRect.width / 2,
                y: popupRect.top + popupRect.height / 2
            }
        } else {
            // 连接到最近的角
            return this._findNearestCorner(anchorPos, popupRect)
        }
    }

    /**
     * 找到距离锚点最近的弹窗角
     * @param {Object} anchorPos - 锚点位置
     * @param {Object} popupRect - 弹窗矩形信息
     * @returns {Object} 最近角的位置
     * @private
     */
    _findNearestCorner(anchorPos, popupRect) {
        // 四个角的坐标
        const corners = [
            { x: popupRect.left, y: popupRect.top }, // 左上
            { x: popupRect.left + popupRect.width, y: popupRect.top }, // 右上
            { x: popupRect.left, y: popupRect.top + popupRect.height }, // 左下
            { x: popupRect.left + popupRect.width, y: popupRect.top + popupRect.height } // 右下
        ]

        // 计算每个角到锚点的距离
        let nearestCorner = corners[0]
        let minDistance = this._calculateDistance(anchorPos, corners[0])

        for (let i = 1; i < corners.length; i++) {
            const distance = this._calculateDistance(anchorPos, corners[i])
            if (distance < minDistance) {
                minDistance = distance
                nearestCorner = corners[i]
            }
        }

        return nearestCorner
    }

    /**
     * 计算两点之间的距离
     * @param {Object} point1 - 点1
     * @param {Object} point2 - 点2
     * @returns {Number} 距离
     * @private
     */
    _calculateDistance(point1, point2) {
        const dx = point1.x - point2.x
        const dy = point1.y - point2.y
        return Math.sqrt(dx * dx + dy * dy)
    }

    /**
     * 绘制连接线
     * @param {Object} startPos - 起始位置
     * @param {Object} endPos - 结束位置
     * @private
     */
    _drawConnectionLine(startPos, endPos) {
        if (!startPos || !endPos || !this.lineCanvas) return

        const canvas = this.lineCanvas
        const ctx = canvas.getContext('2d')

        // 设置画布大小为视口大小
        const rect = this.viewer.container.getBoundingClientRect()

        // 设置canvas的实际尺寸和样式尺寸
        const dpr = window.devicePixelRatio || 1
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`

        // 缩放上下文以适应设备像素比
        ctx.scale(dpr, dpr)

        // 清空画布
        ctx.clearRect(0, 0, rect.width, rect.height)

        // 验证坐标有效性
        if (isNaN(startPos.x) || isNaN(startPos.y) || isNaN(endPos.x) || isNaN(endPos.y)) {
            console.warn('PopInfo: 连接线坐标无效', { startPos, endPos })
            return
        }

        // 设置线条样式
        ctx.strokeStyle = this.lineConfig.color || '#ffffff'
        ctx.lineWidth = this.lineConfig.width || 2
        ctx.globalAlpha = this.lineConfig.opacity || 0.8
        ctx.lineCap = 'round'

        // 绘制连接线
        ctx.beginPath()
        ctx.moveTo(startPos.x, startPos.y)
        ctx.lineTo(endPos.x, endPos.y)
        ctx.stroke()

        // 调试信息（可选）
        if (this._debugMode) {
            console.log('PopInfo: 绘制连接线', {
                start: startPos,
                end: endPos,
                canvasSize: { width: rect.width, height: rect.height },
                lineConfig: this.lineConfig
            })
        }
    }

    /**
     * 保持弹窗在视口内
     * @private
     */
    _keepInViewport() {
        const containerRect = this.container.getBoundingClientRect()
        const viewerRect = this.viewer.container.getBoundingClientRect()

        let left = parseInt(this.container.style.left)
        let top = parseInt(this.container.style.top)

        // 边界检查和调整
        if (left < 0) left = 10
        if (top < 0) top = 10
        if (left + containerRect.width > viewerRect.width) {
            left = viewerRect.width - containerRect.width - 10
        }
        if (top + containerRect.height > viewerRect.height) {
            top = viewerRect.height - containerRect.height - 10
        }

        this.container.style.left = `${left}px`
        this.container.style.top = `${top}px`
    }

    /**
     * 显示弹窗
     */
    show() {
        if (this.isDestroyed) return

        this.isVisible = true
        this.container.style.display = 'block'
        this.lineCanvas.style.display = 'block'

        // 确保canvas层级正确
        this.lineCanvas.style.zIndex = (this.style.zIndex || 1000) - 1

        // 立即更新一次位置
        this._updatePosition()
    }

    /**
     * 隐藏弹窗
     */
    hide() {
        this.isVisible = false
        this.container.style.display = 'none'
        this.lineCanvas.style.display = 'none'

        // 清空连接线
        if (this.lineCanvas) {
            const ctx = this.lineCanvas.getContext('2d')
            ctx.clearRect(0, 0, this.lineCanvas.width, this.lineCanvas.height)
        }
    }

    /**
     * 更新锚点位置
     * @param {Array} newPosition - 新的经纬度位置 [longitude, latitude, height]
     */
    updatePosition(newPosition) {
        this.position = newPosition
        this._updateCartesianPosition()

        // 更新点实体位置
        if (this.pointEntity) {
            this.pointEntity.position = this.cartesianPosition
        }

        // 如果是屏幕坐标模式，需要重新计算固定位置
        if (this.geographicMode !== 1) { // 非地理坐标模式
            this.fixedScreenPosition = null
        }
    }

    /**
     * 切换定位模式
     * @param {Number} geographicMode - 定位模式：1=地理坐标模式，2=屏幕坐标模式，3=混合模式
     */
    setGeographicMode(geographicMode) {
        if (this.geographicMode === geographicMode) return

        // 验证模式值
        if (![1, 2, 3].includes(geographicMode)) {
            console.warn('PopInfo: geographicMode 只支持 1(地理坐标)、2(屏幕坐标)或3(混合模式)')
            return
        }

        this.geographicMode = geographicMode

        // 清除之前模式的缓存数据
        this.popupCenterPosition = null
        this.popupCenterCartesian = null
        this.fixedScreenPosition = null

        // 混合模式下保留当前的连接线长度和角度
        if (geographicMode === 3) {
            this.fixedLineLength = this.lineConfig.length
            this.fixedLineAngle = this.lineConfig.angle
        } else {
            this.fixedLineLength = null
            this.fixedLineAngle = null
        }

        // 立即更新位置
        if (this.isVisible) {
            this._updatePosition()
        }
    }

    /**
     * 获取当前定位模式
     * @returns {Number} 定位模式
     */
    getGeographicMode() {
        return this.geographicMode
    }

    /**
     * 重置弹窗位置（清除缓存的位置信息）
     */
    resetPosition() {
        this.popupCenterPosition = null
        this.popupCenterCartesian = null
        this.fixedScreenPosition = null

        // 混合模式下重置固定连接线长度和角度
        if (this.geographicMode === 3) {
            this.fixedLineLength = this.lineConfig.length
            this.fixedLineAngle = this.lineConfig.angle
        }

        // 立即更新位置
        if (this.isVisible) {
            this._updatePosition()
        }
    }

    /**
     * 设置拖拽功能开关
     * @param {Boolean} draggable - 是否允许拖拽
     */
    setDraggable(draggable) {
        this.draggable = draggable

        if (this.container) {
            if (draggable) {
                this.container.style.cursor = 'move'
                this.container.style.pointerEvents = 'auto'
                this.element.style.userSelect = 'none'
            } else {
                this.container.style.cursor = 'default'
                this.element.style.userSelect = 'auto'

                // 如果正在拖拽，则停止拖拽
                if (this.isDragging) {
                    this._onDragEnd({})
                }
            }
        }
    }

    /**
     * 获取拖拽功能状态
     * @returns {Boolean} 是否允许拖拽
     */
    getDraggable() {
        return this.draggable
    }

    /**
     * 获取当前是否正在拖拽
     * @returns {Boolean} 是否正在拖拽
     */
    isDraggingState() {
        return this.isDragging
    }

    /**
     * 设置调试模式
     * @param {Boolean} debug - 是否开启调试模式
     */
    setDebugMode(debug) {
        this._debugMode = debug
        if (debug) {
            console.log('PopInfo: 调试模式已开启')
            // 添加调试样式
            if (this.lineCanvas) {
                this.lineCanvas.style.border = '1px solid red'
            }
            if (this.container) {
                this.container.style.border = '1px solid blue'
            }
        } else {
            // 移除调试样式
            if (this.lineCanvas) {
                this.lineCanvas.style.border = 'none'
            }
            if (this.container) {
                this.container.style.border = 'none'
            }
        }
    }

    /**
     * 强制重绘连接线
     */
    forceRedrawLine() {
        if (this.isVisible && this.cartesianPosition) {
            this._updatePosition()
        }
    }

    /**
     * 获取调试信息
     * @returns {Object} 调试信息
     */
    getDebugInfo() {
        const containerRect = this.container ? this.container.getBoundingClientRect() : null
        const viewerRect = this.viewer.container.getBoundingClientRect()

        return {
            // 基本状态
            id: this.id,
            isVisible: this.isVisible,
            isDragging: this.isDragging,
            geographicMode: this.geographicMode,
            draggable: this.draggable,

            // 位置信息
            position: this.position,
            popupCenterPosition: this.popupCenterPosition,
            fixedScreenPosition: this.fixedScreenPosition,

            // DOM信息
            containerRect: containerRect ? {
                left: containerRect.left,
                top: containerRect.top,
                width: containerRect.width,
                height: containerRect.height
            } : null,
            viewerRect: {
                left: viewerRect.left,
                top: viewerRect.top,
                width: viewerRect.width,
                height: viewerRect.height
            },

            // 连接线信息
            lineConfig: this.lineConfig,
            lineCanvasSize: this.lineCanvas ? {
                width: this.lineCanvas.width,
                height: this.lineCanvas.height,
                styleWidth: this.lineCanvas.style.width,
                styleHeight: this.lineCanvas.style.height
            } : null
        }
    }

    /**
     * 更新连接线配置
     * @param {Object} newConfig - 新的连接线配置
     */
    updateLineConfig(newConfig) {
        Object.assign(this.lineConfig, newConfig)

        // 如果更新了连接点类型，立即重绘
        if (newConfig.anchorPoint && this.isVisible) {
            this.forceRedrawLine()
        }
    }

    /**
     * 设置连接点类型
     * @param {String} anchorPoint - 连接点类型：'center' | 'nearest'
     */
    setAnchorPoint(anchorPoint) {
        if (anchorPoint !== 'center' && anchorPoint !== 'nearest') {
            console.warn('PopInfo: anchorPoint 只支持 "center" 或 "nearest"')
            return
        }

        this.lineConfig.anchorPoint = anchorPoint

        // 立即重绘连接线
        if (this.isVisible) {
            this.forceRedrawLine()
        }
    }

    /**
     * 获取当前连接点类型
     * @returns {String} 连接点类型
     */
    getAnchorPoint() {
        return this.lineConfig.anchorPoint || 'nearest'
    }

    /**
     * 更新弹窗内容
     * @param {HTMLElement} newElement - 新的DOM元素
     */
    updateContent(newElement) {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element)
        }

        this.element = newElement
        this._applyStyles()
        this.container.appendChild(this.element)
    }

    /**
     * 销毁弹窗
     */
    destroy() {
        this.isDestroyed = true
        this.hide()

        // 停止正在进行的拖拽操作
        if (this.isDragging) {
            this._onDragEnd({})
        }

        // 移除拖拽事件监听器
        if (this._dragMouseMoveListener) {
            document.removeEventListener('mousemove', this._dragMouseMoveListener)
            document.removeEventListener('touchmove', this._dragMouseMoveListener)
            this._dragMouseMoveListener = null
        }

        if (this._dragMouseUpListener) {
            document.removeEventListener('mouseup', this._dragMouseUpListener)
            document.removeEventListener('touchend', this._dragMouseUpListener)
            this._dragMouseUpListener = null
        }

        // 恢复全局样式
        document.body.style.cursor = ''

        // 移除事件监听器
        if (this._frameUpdateListener) {
            this._frameUpdateListener()
            this._frameUpdateListener = null
        }

        // 移除实体
        if (this.pointEntity) {
            this.viewer.entities.remove(this.pointEntity)
        }

        // 移除DOM元素
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container)
        }
        if (this.lineCanvas && this.lineCanvas.parentNode) {
            this.lineCanvas.parentNode.removeChild(this.lineCanvas)
        }

        // 清空引用
        this.viewer = null
        this.element = null
        this.container = null
        this.lineCanvas = null
        this.pointEntity = null
        this.cartesianPosition = null
        this.popupCenterCartesian = null
    }

    /**
     * 生成唯一ID
     * @returns {String} 唯一标识符
     * @private
     */
    _generateId() {
        return 'popup-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now()
    }

    /**
     * 获取弹窗是否可见
     * @returns {Boolean} 是否可见
     */
    getVisible() {
        return this.isVisible
    }

    /**
     * 获取弹窗位置
     * @returns {Array} 经纬度位置
     */
    getPosition() {
        return this.position.slice()
    }

    /**
     * 获取弹窗配置
     * @returns {Object} 配置对象
     */
    getConfig() {
        return {
            id: this.id,
            position: this.position.slice(),
            lineConfig: Object.assign({}, this.lineConfig),
            style: Object.assign({}, this.style),
            geographicMode: this.geographicMode,
            draggable: this.draggable,
            isVisible: this.isVisible,
            isDragging: this.isDragging,
            // 地理坐标模式下的弹窗中心位置
            popupCenterPosition: this.popupCenterPosition ? this.popupCenterPosition.slice() : null,
            // 屏幕坐标模式下的固定屏幕位置
            fixedScreenPosition: this.fixedScreenPosition ? Object.assign({}, this.fixedScreenPosition) : null,
            // 混合模式下的固定连接线长度和角度
            fixedLineLength: this.fixedLineLength,
            fixedLineAngle: this.fixedLineAngle
        }
    }
}

export default PopInfo
// import PopInfo from './src/Utils/PopInfo.js'

// // 创建弹窗内容
// const popupElement = document.createElement('div')
// popupElement.innerHTML = `
//     <h3>设备信息</h3>
//     <p>位置：北京市朝阳区</p>
//     <p>状态：正常运行</p>
// `

// // 创建弹窗实例 - 地理坐标模式（默认，支持拖拽）
// const popup = new PopInfo({
//     viewer: cesiumViewer,
//     position: [116.39, 39.91, 0],  // 锚点经纬度
//     element: popupElement,
//     geographicMode: 1,  // 地理坐标模式：弹窗跟随地理位置
//     draggable: true,       // 允许拖拽（默认为true）
//     lineConfig: {
//         length: 120,       // 连接线长度
//         angle: 45,         // 方位角
//         color: '#00ff00',  // 连接线颜色
//         width: 2,          // 连接线宽度
//         anchorPoint: 'nearest'  // 连接到最近角（默认）
//     },
//     style: {
//         backgroundColor: 'rgba(0, 0, 0, 0.8)',
//         color: '#ffffff',
//         borderRadius: '6px',
//         padding: '10px'
//     }
// })

// // 创建弹窗实例 - 中心连接模式
// const centerPopup = new PopInfo({
//     viewer: cesiumViewer,
//     position: [116.40, 39.92, 0],  // 锚点经纬度
//     element: popupElement2,
//     lineConfig: {
//         length: 100,
//         angle: 0,
//         color: '#0088ff',
//         anchorPoint: 'center'  // 连接到弹窗中心
//     }
// })

// // 创建弹窗实例 - 屏幕坐标模式
// const screenPopup = new PopInfo({
//     viewer: cesiumViewer,
//     position: [116.39, 39.91, 0],  // 锚点经纬度
//     element: popupElement,
//     geographicMode: 2,  // 屏幕坐标模式：保持屏幕位置和连接线不变
//     draggable: true,        // 允许拖拽
//     lineConfig: {
//         length: 120,     // 连接线长度（固定）
//         angle: 45,       // 方位角（固定）
//         color: '#ff0000', // 连接线颜色
//         width: 2         // 连接线宽度
//     }
// })

// // 创建弹窗实例 - 混合模式
// const mixedPopup = new PopInfo({
//     viewer: cesiumViewer,
//     position: [116.38, 39.90, 0],  // 锚点经纬度
//     element: popupElement3,
//     geographicMode: 3,  // 混合模式：缩放时连接线长度和角度保持不变，但弹窗位置会更新
//     draggable: true,    // 允许拖拽
//     lineConfig: {
//         length: 150,     // 初始连接线长度
//         angle: 90,       // 初始方位角（正东方向）
//         color: '#ffaa00', // 连接线颜色
//         width: 2         // 连接线宽度
//     },
//     style: {
//         backgroundColor: 'rgba(50, 50, 50, 0.9)',
//         color: '#ffffff',
//         borderRadius: '8px',
//         padding: '12px'
//     }
// })

// // 显示弹窗
// popup.show()

// // 拖拽功能控制
// popup.setDraggable(false)       // 禁用拖拽
// popup.getDraggable()            // 获取拖拽状态
// popup.isDraggingState()         // 获取当前是否正在拖拽

// // 切换模式示例
// popup.setGeographicMode(2)  // 切换到屏幕坐标模式
// popup.setGeographicMode(3)  // 切换到混合模式
// popup.resetPosition()       // 重置位置缓存

// // 连接点控制示例
// popup.setAnchorPoint('center')  // 切换到中心连接
// popup.setAnchorPoint('nearest') // 切换到最近角连接（默认）

// // 模式说明：
// // 地理坐标模式(1)：弹窗跟随地理位置，地图缩放时弹窗保持在该地理位置，连接线长度和角度会变化
// // 屏幕坐标模式(2)：弹窗保持在固定屏幕位置，地图缩放时连接线长度和方位角保持不变
// // 混合模式(3)：地图缩放时连接线长度和方位角保持不变，但弹窗位置会根据锚点位置实时更新

// // 连接点模式说明：
// // 'nearest' 模式：连接线会动态连接到距离锚点最近的弹窗角，拖拽时实时计算
// // 'center' 模式：连接线始终连接到弹窗的几何中心，位置固定