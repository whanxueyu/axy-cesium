import * as Cesium from "cesium";

export interface ArticleSensorFrame {
  direction: Cesium.Cartesian3;
  right: Cesium.Cartesian3;
  up: Cesium.Cartesian3;
}

export interface ArticlePerspectiveFrustum {
  fov: number;
  aspectRatio: number;
}

const FRAME_EPSILON = 1e-12;

/**
 * Builds the orthonormal local frame used by the rectangular sensor.
 * The sensor uses +Z as its view direction, +X as its lateral axis, and +Y
 * as its vertical axis.
 */
export function createArticleSensorFrame(
  observer: Cesium.Cartesian3,
  viewPosition: Cesium.Cartesian3,
  referenceUp: Cesium.Cartesian3,
): ArticleSensorFrame {
  const direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(viewPosition, observer, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );

  let right = Cesium.Cartesian3.cross(
    referenceUp,
    direction,
    new Cesium.Cartesian3(),
  );

  if (Cesium.Cartesian3.magnitudeSquared(right) < FRAME_EPSILON) {
    const fallbackUp =
      Math.abs(direction.z) < 0.9
        ? Cesium.Cartesian3.UNIT_Z
        : Cesium.Cartesian3.UNIT_X;
    right = Cesium.Cartesian3.cross(
      fallbackUp,
      direction,
      right,
    );
  }

  Cesium.Cartesian3.normalize(right, right);
  const up = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.cross(direction, right, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );

  return { direction, right, up };
}

export function createArticleSensorModelMatrix(
  observer: Cesium.Cartesian3,
  frame: ArticleSensorFrame,
): Cesium.Matrix4 {
  const rotation = new Cesium.Matrix3();
  Cesium.Matrix3.setColumn(rotation, 0, frame.right, rotation);
  Cesium.Matrix3.setColumn(rotation, 1, frame.up, rotation);
  Cesium.Matrix3.setColumn(rotation, 2, frame.direction, rotation);

  const orientation = Cesium.Quaternion.fromRotationMatrix(
    rotation,
    new Cesium.Quaternion(),
  );

  return Cesium.Matrix4.fromTranslationQuaternionRotationScale(
    observer,
    orientation,
    new Cesium.Cartesian3(1, 1, 1),
    new Cesium.Matrix4(),
  );
}

/**
 * Returns the effective edge angles used by the article's rectangular sensor.
 * The edge angles differ from the input half angles at the corners because
 * each side is clipped by the other axis.
 */
export function getArticleSensorEdgeHalfAngles(
  xHalfAngle: number,
  yHalfAngle: number,
): { maxX: number; maxY: number } {
  return {
    maxY: Math.atan(Math.cos(xHalfAngle) * Math.tan(yHalfAngle)),
    maxX: Math.atan(Math.cos(yHalfAngle) * Math.tan(xHalfAngle)),
  };
}

/**
 * Returns the four far-plane corner directions in the order:
 * bottom-left, bottom-right, top-right, top-left.
 *
 * The local vectors are (±tan(x), ±tan(y), 1), which is exactly the
 * rectangular clipping rule used by the article shader and edge construction.
 */
export function getArticleSensorBoundaryDirections(
  frame: ArticleSensorFrame,
  horizontalFov: number,
  verticalFov: number,
): Cesium.Cartesian3[] {
  const xHalfAngle = Cesium.Math.toRadians(horizontalFov / 2);
  const yHalfAngle = Cesium.Math.toRadians(verticalFov / 2);
  const tanX = Math.tan(xHalfAngle);
  const tanY = Math.tan(yHalfAngle);

  const localDirections = [
    new Cesium.Cartesian3(-tanX, -tanY, 1),
    new Cesium.Cartesian3(tanX, -tanY, 1),
    new Cesium.Cartesian3(tanX, tanY, 1),
    new Cesium.Cartesian3(-tanX, tanY, 1),
  ];

  return localDirections.map((local) => {
    const world = Cesium.Cartesian3.add(
      Cesium.Cartesian3.add(
        Cesium.Cartesian3.multiplyByScalar(
          frame.right,
          local.x,
          new Cesium.Cartesian3(),
        ),
        Cesium.Cartesian3.multiplyByScalar(
          frame.up,
          local.y,
          new Cesium.Cartesian3(),
        ),
        new Cesium.Cartesian3(),
      ),
      Cesium.Cartesian3.multiplyByScalar(
        frame.direction,
        local.z,
        new Cesium.Cartesian3(),
      ),
      new Cesium.Cartesian3(),
    );
    return Cesium.Cartesian3.normalize(world, world);
  });
}

export function getArticleSensorBoundaryPositions(
  observer: Cesium.Cartesian3,
  frame: ArticleSensorFrame,
  horizontalFov: number,
  verticalFov: number,
  radius: number,
): Cesium.Cartesian3[] {
  return getArticleSensorBoundaryDirections(frame, horizontalFov, verticalFov).map(
    (direction) =>
      Cesium.Cartesian3.add(
        observer,
        Cesium.Cartesian3.multiplyByScalar(
          direction,
          radius,
          new Cesium.Cartesian3(),
        ),
        new Cesium.Cartesian3(),
      ),
  );
}

/**
 * Tests the same rectangular cone inequality used in sensorFS:
 * abs(x) <= z * tan(xHalfAngle), abs(y) <= z * tan(yHalfAngle).
 */
export function isDirectionInArticleSensor(
  direction: Cesium.Cartesian3,
  frame: ArticleSensorFrame,
  horizontalFov: number,
  verticalFov: number,
  epsilon = 1e-8,
): boolean {
  const localX = Cesium.Cartesian3.dot(direction, frame.right);
  const localY = Cesium.Cartesian3.dot(direction, frame.up);
  const localZ = Cesium.Cartesian3.dot(direction, frame.direction);

  if (localZ <= epsilon) return false;

  const tanX = Math.tan(Cesium.Math.toRadians(horizontalFov / 2));
  const tanY = Math.tan(Cesium.Math.toRadians(verticalFov / 2));
  return (
    Math.abs(localX) <= localZ * tanX + epsilon &&
    Math.abs(localY) <= localZ * tanY + epsilon
  );
}

export function getArticlePerspectiveFrustum(
  horizontalFov: number,
  verticalFov: number,
): ArticlePerspectiveFrustum {
  const horizontal = Cesium.Math.toRadians(horizontalFov);
  const vertical = Cesium.Math.toRadians(verticalFov);
  const aspectRatio =
    Math.tan(horizontal / 2) / Math.tan(vertical / 2);

  return {
    fov: Math.max(horizontal, vertical),
    aspectRatio,
  };
}
