
var start = null;
var stop = null;
var CimMap = null;
var Viewer = null;
var camera = null;

var longitude =113.9758022295;
var latitude = 22.5944962474;
var radius = 0.03;

function initAutoRotateParameters(cimMap, viewer){
    CimMap = cimMap;
    Viewer = viewer;

    camera = viewer.camera;
    camera.position = new CimMap.Cartesian3(0.25, 0.0, 0.0);
    camera.direction = new CimMap.Cartesian3(1.0, 0.0, 0.0);
    camera.up = new CimMap.Cartesian3(0.0, 0.0, 1.0);
    camera.right = new CimMap.Cartesian3(0.0, -1.0, 0.0);

    Viewer.scene.globe.enableLighting = true;
    Viewer.scene.globe.depthTestAgainstTerrain = true;

// Follow the path of a plane. See the interpolation Sandcastle example.
    CimMap.Math.setRandomNumberSeed(3);

    start = CimMap.JulianDate.fromDate(new Date(2015, 2, 25, 8));
    stop = CimMap.JulianDate.addSeconds(start, 360, new CimMap.JulianDate());

    Viewer.clock.startTime = start.clone();
    Viewer.clock.stopTime = stop.clone();
    Viewer.clock.currentTime = start.clone();
    Viewer.clock.clockRange = CimMap.ClockRange.LOOP_STOP;
    Viewer.clock.multiplier = 10.0;
    Viewer.clock.shouldAnimate = true;

    var entity = Viewer.entities.add({
        availability : new CimMap.TimeIntervalCollection([new CimMap.TimeInterval({
            start : start,
            stop : stop
        })]),
        position : computeCirclularFlight(longitude, latitude, radius)
    });

    entity.position.setInterpolationOptions({
        interpolationDegree : 2,
        interpolationAlgorithm : CimMap.HermitePolynomialApproximation
    });

// Set initial camera position and orientation to be when in the model's reference frame.

    Viewer.scene.postUpdate.addEventListener(function(scene, time) {
        var position = entity.position.getValue(time);
        if (!CimMap.defined(position)) {
            return;
        }

        var transform;
        if (!CimMap.defined(entity.orientation)) {
            transform = CimMap.Transforms.eastNorthUpToFixedFrame(position);
        } else {
            var orientation = entity.orientation.getValue(time);
            if (!CimMap.defined(orientation)) {
                return;
            }

            transform = CimMap.Matrix4.fromRotationTranslation(CimMap.Matrix3.fromQuaternion(orientation), position);
        }

        // Save camera state
        var offset = CimMap.Cartesian3.clone(camera.position);
        var direction = CimMap.Cartesian3.clone(camera.direction);
        var up = CimMap.Cartesian3.clone(camera.up);

        // Set camera to be in model's reference frame.
        camera.lookAtTransform(transform);

        // Reset the camera state to the saved state so it appears fixed in the model's frame.
        CimMap.Cartesian3.clone(offset, camera.position);
        CimMap.Cartesian3.clone(direction, camera.direction);
        CimMap.Cartesian3.clone(up, camera.up);
        CimMap.Cartesian3.cross(direction, up, camera.right);
    });
}

function computeCirclularFlight(lon, lat, radius) {
    var property = new CimMap.SampledPositionProperty();
    var startAngle = CimMap.Math.nextRandomNumber() * 360.0;
    var endAngle = startAngle + 360.0;

    var increment = (CimMap.Math.nextRandomNumber() * 2.0 - 1.0) * 10.0 + 45.0;
    for (var i = startAngle; i < endAngle; i += increment) {
        var radians = CimMap.Math.toRadians(i);
        var timeIncrement = i - startAngle;
        var time = CimMap.JulianDate.addSeconds(start, timeIncrement, new CimMap.JulianDate());
        var position = CimMap.Cartesian3.fromDegrees(lon + (radius * 1.5 * Math.cos(radians)), lat + (radius * Math.sin(radians)), CimMap.Math.nextRandomNumber() * 500 + 1800);
        property.addSample(time, position);
    }
    return property;
}


