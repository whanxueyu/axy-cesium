kuang() {
      //cesium默认右键为放大缩小，此处给zoomEventTypes设置新值
      gViewer.scene.screenSpaceCameraController.zoomEventTypes = [
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
      ];
      //earthsdk默认右键为改变视角，此处禁止。
      gViewer.scene.screenSpaceCameraController.lookEventTypes = [];
      gViewer.camera.setView({
        orientation: {
          heading: Cesium.Math.toRadians(0), // east, default value is 0.0 (north)
          pitch: Cesium.Math.toRadians(-60), // default value (looking down)
          roll: 0.0, // default value
        },
      });
      //禁用相机偏转
      gViewer.scene.screenSpaceCameraController.enableTilt = false;
      // gViewer.scene.screenSpaceCameraController.enableRotate = false;

      //右键按下标识
      var flag = false;
      //起点终点x,y
      var startX = null;
      var startY = null;
      var endX = null;
      var endY = null;
      //创建框选元素
      var selDiv = document.createElement("div");
      var handler = new Cesium.ScreenSpaceEventHandler(gViewer.canvas);
      //右键按下事件，设置起点，div设置样式和位置，添加到页面
      handler.setInputAction(function (event) {
        flag = true;
        startX = event.position.x;
        startY = event.position.y;

        selDiv.style.cssText =
          "position:absolute;width:0px;height:0px;font-size:0px;margin:0px;padding:0px;border:1px dashed #0099FF;background-color:#C3D5ED;z-index:1000;filter:alpha(opacity:60);opacity:0.6;";
        selDiv.id = "selectDiv";
        selDiv.style.left = startX + "px";
        selDiv.style.top = startY + "px";
        document.body.appendChild(selDiv);
      }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);

      //鼠标抬起事件，获取div坐上和右下的x,y 转为经纬度坐标
      handler.setInputAction(function (event) {
        debugger;
        flag = false;
        var l = parseInt(selDiv.style.left);
        var t = parseInt(selDiv.style.top);
        var w = parseInt(selDiv.style.width);
        var h = parseInt(selDiv.style.height);
        var earthPosition = gViewer.camera.pickEllipsoid(
          { x: l, y: t },
          gViewer.scene.globe.ellipsoid
        );
        var cartographic = Cesium.Cartographic.fromCartesian(
          earthPosition,
          gViewer.scene.globe.ellipsoid,
          new Cesium.Cartographic()
        );
        let p1 = [
          Cesium.Math.toDegrees(cartographic.longitude),
          Cesium.Math.toDegrees(cartographic.latitude),
        ];
        earthPosition = gViewer.camera.pickEllipsoid(
          { x: l + w, y: t + h },
          gViewer.scene.globe.ellipsoid
        );
        cartographic = Cesium.Cartographic.fromCartesian(
          earthPosition,
          gViewer.scene.globe.ellipsoid,
          new Cesium.Cartographic()
        );
        // alert(
        //   "右下坐标为：" +
        //     [
        //       Cesium.Math.toDegrees(cartographic.longitude),
        //       Cesium.Math.toDegrees(cartographic.latitude),
        //     ]
        // );
        let p2 = [
          Cesium.Math.toDegrees(cartographic.longitude),
          Cesium.Math.toDegrees(cartographic.latitude),
        ];

        gViewer.entities.add({
          name: "Gree",
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(
              p1[0],
              p2[1],
              p2[0],
              p1[1]
            ),
            material: Cesium.Color.AQUA.withAlpha(0.3),
          },
        });
        gViewer.scene.screenSpaceCameraController.enableTilt = true;
        //根据业务确定是否删除框选div
        document
          .getElementById("selectDiv")
          .parentNode.removeChild(document.getElementById("selectDiv"));
      }, Cesium.ScreenSpaceEventType.RIGHT_UP);

      //鼠标移动事件，处理位置css
      handler.setInputAction(function (event) {
        if (flag) {
          endX = event.endPosition.x;
          endY = event.endPosition.y;

          selDiv.style.left = Math.min(endX, startX) + "px";
          selDiv.style.top = Math.min(endY, startY) + "px";
          selDiv.style.width = Math.abs(endX - startX) + "px";
          selDiv.style.height = Math.abs(endY - startY) + "px";
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    },