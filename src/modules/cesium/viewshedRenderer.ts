import * as Cesium from "cesium";
import {
  createArticleSensorFrame,
  createArticleSensorModelMatrix,
  getArticlePerspectiveFrustum,
  getArticleSensorEdgeHalfAngles,
  type ArticleSensorFrame,
} from "@/modules/cesium/viewshedGeometry";

type CesiumInternal = Record<string, any>;

const C = Cesium as unknown as CesiumInternal;

const attributeLocations = {
  position: 0,
  normal: 1,
};

/*
 * These are the sensor shaders used by the supplied article. The shadow
 * receiver shader is patched separately below so terrain and models are
 * colored by the viewshed result.
 */
const sensorComm = `
uniform vec4 u_intersectionColor;
uniform float u_intersectionWidth;
uniform vec4 u_lineColor;

struct czm_ellipsoid
{
  vec3 center;
  vec3 radii;
  vec3 inverseRadii;
  vec3 inverseRadiiSquared;
};

czm_ellipsoid czm_getWgs84EllipsoidEC()
{
  vec3 radii = vec3(6378137.0, 6378137.0, 6356752.314245);
  vec3 inverseRadii = vec3(
    1.0 / radii.x,
    1.0 / radii.y,
    1.0 / radii.z
  );
  vec3 inverseRadiiSquared = inverseRadii * inverseRadii;
  return czm_ellipsoid(
    czm_view[3].xyz,
    radii,
    inverseRadii,
    inverseRadiiSquared
  );
}

bool inSensorShadow(vec3 coneVertexWC, czm_ellipsoid ellipsoidEC, vec3 pointWC)
{
  vec3 D = ellipsoidEC.inverseRadii;
  vec3 q = D * coneVertexWC;
  float qMagnitudeSquared = dot(q, q);
  float test = qMagnitudeSquared - 1.0;
  vec3 temp = D * pointWC - q;
  float d = dot(temp, q);
  return (d < -test) && (d / length(temp) < -sqrt(test));
}

vec4 getLineColor()
{
  return u_lineColor;
}

vec4 getIntersectionColor()
{
  return u_intersectionColor;
}

float getIntersectionWidth()
{
  return u_intersectionWidth;
}

vec2 sensor2dTextureCoordinates(float sensorRadius, vec3 pointMC)
{
  float t = pointMC.z / sensorRadius;
  float s = 1.0 + (atan(pointMC.y, pointMC.x) / czm_twoPi);
  s = s - floor(s);
  return vec2(s, t);
}`;

const sensorFS = `
uniform bool u_showIntersection;
uniform bool u_showThroughEllipsoid;
uniform float u_radius;
uniform float u_xHalfAngle;
uniform float u_yHalfAngle;
uniform float u_normalDirection;
uniform float u_type;

in vec3 v_position;
in vec3 v_positionWC;
in vec3 v_positionEC;
in vec3 v_normalEC;

vec4 getColor(float sensorRadius, vec3 pointEC)
{
  czm_materialInput materialInput;
  vec3 pointMC = (czm_inverseModelView * vec4(pointEC, 1.0)).xyz;
  materialInput.st = sensor2dTextureCoordinates(sensorRadius, pointMC);
  materialInput.str = pointMC / sensorRadius;
  materialInput.positionToEyeEC = -v_positionEC;
  materialInput.normalEC = u_normalDirection * normalize(v_normalEC);
  czm_material material = czm_getMaterial(materialInput);
  return mix(
    czm_phong(
      normalize(materialInput.positionToEyeEC),
      material,
      czm_lightDirectionEC
    ),
    vec4(material.diffuse, material.alpha),
    0.4
  );
}

bool isOnBoundary(float value, float epsilon)
{
  float width = getIntersectionWidth();
  float tolerance = width * epsilon;
  float delta = max(abs(dFdx(value)), abs(dFdy(value)));
  float pixels = width * delta;
  float temp = abs(value);
  return temp < tolerance && temp < pixels ||
    (delta < 10.0 * tolerance && temp - delta < tolerance && temp < pixels);
}

vec4 shade(bool isOnBoundary)
{
  if (u_showIntersection && isOnBoundary)
  {
    return getIntersectionColor();
  }
  if (u_type == 1.0)
  {
    return getLineColor();
  }
  return getColor(u_radius, v_positionEC);
}

float ellipsoidSurfaceFunction(czm_ellipsoid ellipsoid, vec3 point)
{
  vec3 scaled = ellipsoid.inverseRadii * point;
  return dot(scaled, scaled) - 1.0;
}

void main()
{
  vec3 sensorVertexWC = czm_model[3].xyz;
  float positionX = v_position.x;
  float positionY = v_position.y;
  float positionZ = v_position.z;
  vec3 zDir = vec3(0.0, 0.0, 1.0);
  vec3 lineX = vec3(positionX, 0.0, positionZ);
  vec3 lineY = vec3(0.0, positionY, positionZ);
  float resX = dot(normalize(lineX), zDir);
  if (resX < cos(u_xHalfAngle) - 0.00001)
  {
    discard;
  }
  float resY = dot(normalize(lineY), zDir);
  if (resY < cos(u_yHalfAngle) - 0.00001)
  {
    discard;
  }

  czm_ellipsoid ellipsoid = czm_getWgs84EllipsoidEC();
  float ellipsoidValue = ellipsoidSurfaceFunction(ellipsoid, v_positionWC);

  if (!u_showThroughEllipsoid)
  {
    if (ellipsoidValue < 0.0)
    {
      discard;
    }
    if (inSensorShadow(sensorVertexWC, ellipsoid, v_positionWC))
    {
      discard;
    }
  }

  out_FragColor = shade(isOnBoundary(ellipsoidValue, czm_epsilon3));
}`;

const sensorVS = `
in vec4 position;
in vec3 normal;

out vec3 v_position;
out vec3 v_positionWC;
out vec3 v_positionEC;
out vec3 v_normalEC;

void main()
{
  gl_Position = czm_modelViewProjection * position;
  v_position = vec3(position);
  v_positionWC = (czm_model * position).xyz;
  v_positionEC = (czm_modelView * position).xyz;
  v_normalEC = czm_normal * normal;
}`;

interface SensorOptions {
  modelMatrix: Cesium.Matrix4;
  radius: number;
  xHalfAngle: number;
  yHalfAngle: number;
  color: Cesium.Color;
  lineColor: Cesium.Color;
  show: boolean;
  showLines: boolean;
}

class RectangularSensorPrimitive {
  public show: boolean;
  public showSectorLines: boolean;
  public showSectorSegmentLines: boolean;
  public showDomeSurfaces = false;
  public showDomeLines: boolean;
  public slice = 32;

  private _modelMatrix: Cesium.Matrix4;
  private _computedModelMatrix = new Cesium.Matrix4();
  private _radius: number;
  private _xHalfAngle: number;
  private _yHalfAngle: number;
  private _color: Cesium.Color;
  private _lineColor: Cesium.Color;
  private _material: any;
  private _translucent: boolean | undefined;
  private _showThroughEllipsoid = false;
  private _showIntersection = false;
  private _intersectionColor = Cesium.Color.WHITE;
  private _intersectionWidth = 5;

  private _domeFrontCommand: any;
  private _domeBackCommand: any;
  private _domeLineCommand: any;
  private _sectorLineCommand: any;
  private _sectorSegmentLineCommand: any;
  private _domeVA: any;
  private _domeLineVA: any;
  private _sectorLineVA: any;
  private _sectorSegmentLineVA: any;
  private _frontFaceRS: any;
  private _backFaceRS: any;
  private _shaderProgram: any;
  private _colorCommands: any[] = [];
  private _boundingSphere: Cesium.BoundingSphere;
  private _boundingSphereWC = new Cesium.BoundingSphere();
  private _createVS = true;
  private _createRS = true;
  private _createSP = true;
  private _createCommands = true;
  private _destroyed = false;

  public constructor(options: SensorOptions) {
    this.show = options.show;
    this.showSectorLines = options.showLines;
    this.showSectorSegmentLines = options.showLines;
    this.showDomeLines = options.showLines;
    this._modelMatrix = Cesium.Matrix4.clone(options.modelMatrix, new Cesium.Matrix4());
    this._radius = options.radius;
    this._xHalfAngle = Cesium.Math.toRadians(options.xHalfAngle);
    this._yHalfAngle = Cesium.Math.toRadians(options.yHalfAngle);
    this._color = Cesium.Color.clone(options.color, new Cesium.Color());
    this._lineColor = Cesium.Color.clone(options.lineColor, new Cesium.Color());
    this._material = C.Material.fromType(C.Material.ColorType);
    this._material.uniforms.color = this._color;

    this._boundingSphere = new Cesium.BoundingSphere(Cesium.Cartesian3.ZERO, this._radius);
    this.updateComputedBounds();

    this._domeFrontCommand = new C.DrawCommand({
      owner: this,
      primitiveType: C.PrimitiveType.TRIANGLES,
      boundingVolume: this._boundingSphereWC,
    });
    this._domeBackCommand = new C.DrawCommand({
      owner: this,
      primitiveType: C.PrimitiveType.TRIANGLES,
      boundingVolume: this._boundingSphereWC,
    });
    this._domeLineCommand = new C.DrawCommand({
      owner: this,
      primitiveType: C.PrimitiveType.LINES,
      boundingVolume: this._boundingSphereWC,
    });
    this._sectorLineCommand = new C.DrawCommand({
      owner: this,
      primitiveType: C.PrimitiveType.LINES,
      boundingVolume: this._boundingSphereWC,
    });
    this._sectorSegmentLineCommand = new C.DrawCommand({
      owner: this,
      primitiveType: C.PrimitiveType.LINES,
      boundingVolume: this._boundingSphereWC,
    });
  }

  public setModelMatrix(modelMatrix: Cesium.Matrix4): void {
    if (Cesium.Matrix4.equals(modelMatrix, this._modelMatrix)) return;
    Cesium.Matrix4.clone(modelMatrix, this._modelMatrix);
    this.updateComputedBounds();
  }

  public setRadius(radius: number): void {
    if (this._radius === radius) return;
    this._radius = radius;
    this._boundingSphere = new Cesium.BoundingSphere(Cesium.Cartesian3.ZERO, radius);
    this.updateComputedBounds();
  }

  public setAngles(xHalfAngle: number, yHalfAngle: number): void {
    if (this._xHalfAngle === Cesium.Math.toRadians(xHalfAngle) &&
        this._yHalfAngle === Cesium.Math.toRadians(yHalfAngle)) {
      return;
    }
    this._xHalfAngle = Cesium.Math.toRadians(xHalfAngle);
    this._yHalfAngle = Cesium.Math.toRadians(yHalfAngle);
    this._createVS = true;
    this._createCommands = true;
  }

  public setColor(color: Cesium.Color): void {
    Cesium.Color.clone(color, this._color);
    this._material.uniforms.color = this._color;
  }

  public setVisibility(show: boolean, showLines: boolean): void {
    if (this.show !== show) this.show = show;
    if (
      this.showSectorLines !== showLines ||
      this.showSectorSegmentLines !== showLines ||
      this.showDomeLines !== showLines
    ) {
      this.showSectorLines = showLines;
      this.showSectorSegmentLines = showLines;
      this.showDomeLines = showLines;
      this._createCommands = true;
    }
  }

  public update(frameState: any): void {
    if (this._destroyed || !this.show || frameState.mode !== C.SceneMode.SCENE3D) {
      return;
    }
    if (this._xHalfAngle <= 0 || this._yHalfAngle <= 0 || this._radius < 0) {
      return;
    }

    const translucent = this._material.isTranslucent();
    if (this._translucent !== translucent) {
      this._translucent = translucent;
      this._createRS = true;
      this._createCommands = true;
    }

    if (this._createVS) {
      this.destroyVertexArrays();
      this.createVertexArrays(frameState.context);
      this._createVS = false;
    }
    if (this._createRS) {
      this.createRenderState(translucent);
      this._createRS = false;
    }
    if (this._createSP) {
      this.createShaderProgram(frameState.context);
      this._createSP = false;
      this._createCommands = true;
    }
    if (this._createCommands) {
      this.createCommands(translucent);
      this._createCommands = false;
    }

    if (frameState.passes.render) {
      frameState.commandList.push(...this._colorCommands);
    }
  }

  public isDestroyed(): boolean {
    return this._destroyed;
  }

  public destroy(): void {
    if (this._destroyed) return;
    this.destroyVertexArrays();
    if (this._shaderProgram && !this._shaderProgram.isDestroyed()) {
      this._shaderProgram.destroy();
    }
    this._shaderProgram = undefined;
    this._destroyed = true;
  }

  private updateComputedBounds(): void {
    Cesium.Matrix4.multiplyByUniformScale(
      this._modelMatrix,
      this._radius,
      this._computedModelMatrix,
    );
    Cesium.BoundingSphere.transform(
      this._boundingSphere,
      this._modelMatrix,
      this._boundingSphereWC,
    );
  }

  private createVertexArrays(context: any): void {
    const unitPositions = computeUnitPosition(this._xHalfAngle, this._yHalfAngle, this.slice);
    const positions = computeSectorPositions(
      this._xHalfAngle,
      this._yHalfAngle,
      unitPositions,
    );

    if (this.showSectorLines) {
      this._sectorLineVA = createSectorLineVertexArray(
        context,
        this._xHalfAngle,
        this._yHalfAngle,
      );
    }
    if (this.showSectorSegmentLines) {
      this._sectorSegmentLineVA = createSectorSegmentLineVertexArray(context, positions);
    }
    if (this.showDomeSurfaces) {
      this._domeVA = createDomeVertexArray(context);
    }
    if (this.showDomeLines) {
      this._domeLineVA = createSensorGridLineVertexArray(
        context,
        this._xHalfAngle,
        this._yHalfAngle,
        this.slice,
      );
    }
  }

  private createRenderState(translucent: boolean): void {
    if (translucent) {
      this._frontFaceRS = C.RenderState.fromCache({
        depthTest: { enabled: !this._showThroughEllipsoid },
        depthMask: false,
        blending: C.BlendingState.ALPHA_BLEND,
        cull: { enabled: true, face: C.CullFace.BACK },
      });
      this._backFaceRS = C.RenderState.fromCache({
        depthTest: { enabled: !this._showThroughEllipsoid },
        depthMask: false,
        blending: C.BlendingState.ALPHA_BLEND,
        cull: { enabled: true, face: C.CullFace.FRONT },
      });
    } else {
      this._frontFaceRS = C.RenderState.fromCache({
        depthTest: { enabled: !this._showThroughEllipsoid },
        depthMask: true,
      });
      this._backFaceRS = this._frontFaceRS;
    }
  }

  private createShaderProgram(context: any): void {
    const fragmentShaderSource = new C.ShaderSource({
      sources: [sensorComm, this._material.shaderSource, sensorFS],
    });
    this._shaderProgram = C.ShaderProgram.replaceCache({
      context,
      shaderProgram: this._shaderProgram,
      vertexShaderSource: sensorVS,
      fragmentShaderSource,
      attributeLocations,
    });
  }

  private createCommands(translucent: boolean): void {
    this._colorCommands.length = 0;
    const pass = translucent ? C.Pass.TRANSLUCENT : C.Pass.OPAQUE;

    if (this.showSectorLines) {
      createSensorCommand(
        this,
        this._sectorLineCommand,
        this._sectorLineVA,
        this._frontFaceRS,
        this._shaderProgram,
        this._computedModelMatrix,
        this._lineColor,
        pass,
        true,
      );
    }
    if (this.showSectorSegmentLines) {
      createSensorCommand(
        this,
        this._sectorSegmentLineCommand,
        this._sectorSegmentLineVA,
        this._frontFaceRS,
        this._shaderProgram,
        this._computedModelMatrix,
        this._lineColor,
        pass,
        true,
      );
    }
    if (this.showDomeSurfaces) {
      createSensorSurfaceCommands(
        this,
        this._domeFrontCommand,
        this._domeBackCommand,
        this._domeVA,
        this._frontFaceRS,
        this._backFaceRS,
        this._shaderProgram,
        this._computedModelMatrix,
        pass,
        translucent,
      );
    }
    if (this.showDomeLines) {
      createSensorCommand(
        this,
        this._domeLineCommand,
        this._domeLineVA,
        this._frontFaceRS,
        this._shaderProgram,
        this._computedModelMatrix,
        this._lineColor,
        pass,
        true,
      );
    }
  }

  private destroyVertexArrays(): void {
    [
      this._domeVA,
      this._domeLineVA,
      this._sectorLineVA,
      this._sectorSegmentLineVA,
    ].forEach((vertexArray) => {
      if (vertexArray && !vertexArray.isDestroyed()) vertexArray.destroy();
    });
    this._domeVA = undefined;
    this._domeLineVA = undefined;
    this._sectorLineVA = undefined;
    this._sectorSegmentLineVA = undefined;
  }

  public get material(): any {
    return this._material;
  }

  public get color(): Cesium.Color {
    return this._color;
  }

  public get boundingSphere(): Cesium.BoundingSphere {
    return this._boundingSphere;
  }

  public get xHalfAngle(): number {
    return Cesium.Math.toDegrees(this._xHalfAngle);
  }

  public get yHalfAngle(): number {
    return Cesium.Math.toDegrees(this._yHalfAngle);
  }
}

function createSensorSurfaceCommands(
  primitive: RectangularSensorPrimitive,
  frontCommand: any,
  backCommand: any,
  vertexArray: any,
  frontRenderState: any,
  backRenderState: any,
  shaderProgram: any,
  modelMatrix: Cesium.Matrix4,
  pass: any,
  translucent: boolean,
): void {
  if (translucent) {
    backCommand.vertexArray = vertexArray;
    backCommand.renderState = backRenderState;
    backCommand.shaderProgram = shaderProgram;
    backCommand.uniformMap = getSensorUniformMap(primitive, true);
    backCommand.pass = pass;
    backCommand.modelMatrix = modelMatrix;
    primitive["_colorCommands"].push(backCommand);
  }

  frontCommand.vertexArray = vertexArray;
  frontCommand.renderState = frontRenderState;
  frontCommand.shaderProgram = shaderProgram;
  frontCommand.uniformMap = getSensorUniformMap(primitive, false);
  frontCommand.pass = pass;
  frontCommand.modelMatrix = modelMatrix;
  primitive["_colorCommands"].push(frontCommand);
}

function createSensorCommand(
  primitive: RectangularSensorPrimitive,
  command: any,
  vertexArray: any,
  renderState: any,
  shaderProgram: any,
  modelMatrix: Cesium.Matrix4,
  lineColor: Cesium.Color,
  pass: any,
  isLine: boolean,
): void {
  command.vertexArray = vertexArray;
  command.renderState = renderState;
  command.shaderProgram = shaderProgram;
  command.uniformMap = getSensorUniformMap(primitive, false, isLine, lineColor);
  command.pass = pass;
  command.modelMatrix = modelMatrix;
  primitive["_colorCommands"].push(command);
}

function getSensorUniformMap(
  primitive: RectangularSensorPrimitive,
  backFace: boolean,
  isLine = false,
  lineColor = Cesium.Color.WHITE,
): Record<string, () => unknown> {
  return {
    u_type: () => (isLine ? 1 : 0),
    u_xHalfAngle: () => Cesium.Math.toRadians(primitive.xHalfAngle),
    u_yHalfAngle: () => Cesium.Math.toRadians(primitive.yHalfAngle),
    u_radius: () => primitive["_radius"],
    u_showThroughEllipsoid: () => primitive["_showThroughEllipsoid"],
    u_showIntersection: () => primitive["_showIntersection"],
    u_intersectionColor: () => primitive["_intersectionColor"],
    u_intersectionWidth: () => primitive["_intersectionWidth"],
    u_normalDirection: () => (backFace ? -1 : 1),
    u_lineColor: () => lineColor,
    ...primitive.material._uniforms,
  };
}

function computeUnitPosition(
  xHalfAngle: number,
  yHalfAngle: number,
  slice: number,
): { zoy: Cesium.Cartesian3[]; zox: Cesium.Cartesian3[] } {
  const { maxX, maxY } = getArticleSensorEdgeHalfAngles(
    xHalfAngle,
    yHalfAngle,
  );
  const zoy: Cesium.Cartesian3[] = [];
  const zox: Cesium.Cartesian3[] = [];

  for (let i = 0; i < slice; i++) {
    const y = (2 * maxY * i) / (slice - 1) - maxY;
    zoy.push(new Cesium.Cartesian3(0, Math.sin(y), Math.cos(y)));
    const x = (2 * maxX * i) / (slice - 1) - maxX;
    zox.push(new Cesium.Cartesian3(Math.sin(x), 0, Math.cos(x)));
  }
  return { zoy, zox };
}

function computeSectorPositions(
  xHalfAngle: number,
  yHalfAngle: number,
  unitPosition: { zoy: Cesium.Cartesian3[]; zox: Cesium.Cartesian3[] },
): Cesium.Cartesian3[][] {
  const positions: Cesium.Cartesian3[][] = [];
  const scratch = new Cesium.Matrix3();

  let matrix = Cesium.Matrix3.fromRotationY(xHalfAngle, scratch);
  positions.push(
    unitPosition.zoy.map((point) =>
      Cesium.Matrix3.multiplyByVector(matrix, point, new Cesium.Cartesian3()),
    ),
  );

  matrix = Cesium.Matrix3.fromRotationX(-yHalfAngle, scratch);
  positions.push(
    unitPosition.zox
      .map((point) => Cesium.Matrix3.multiplyByVector(matrix, point, new Cesium.Cartesian3()))
      .reverse(),
  );

  matrix = Cesium.Matrix3.fromRotationY(-xHalfAngle, scratch);
  positions.push(
    unitPosition.zoy
      .map((point) => Cesium.Matrix3.multiplyByVector(matrix, point, new Cesium.Cartesian3()))
      .reverse(),
  );

  matrix = Cesium.Matrix3.fromRotationX(yHalfAngle, scratch);
  positions.push(
    unitPosition.zox.map((point) =>
      Cesium.Matrix3.multiplyByVector(matrix, point, new Cesium.Cartesian3()),
    ),
  );
  return positions;
}

function createVertexBuffer(context: any, vertices: Float32Array): any {
  return C.Buffer.createVertexBuffer({
    context,
    typedArray: vertices,
    usage: C.BufferUsage.STATIC_DRAW,
  });
}

function getSensorCornerDirections(
  xHalfAngle: number,
  yHalfAngle: number,
): Cesium.Cartesian3[] {
  const tanX = Math.tan(xHalfAngle);
  const tanY = Math.tan(yHalfAngle);
  return [
    normalizeSensorDirection(-tanX, -tanY),
    normalizeSensorDirection(tanX, -tanY),
    normalizeSensorDirection(tanX, tanY),
    normalizeSensorDirection(-tanX, tanY),
  ];
}

function normalizeSensorDirection(xRatio: number, yRatio: number): Cesium.Cartesian3 {
  return Cesium.Cartesian3.normalize(
    new Cesium.Cartesian3(xRatio, yRatio, 1),
    new Cesium.Cartesian3(),
  );
}

function createSectorLineVertexArray(
  context: any,
  xHalfAngle: number,
  yHalfAngle: number,
): any {
  const corners = getSensorCornerDirections(xHalfAngle, yHalfAngle);
  const vertices = new Float32Array(corners.length * 2 * 3);
  let offset = 0;
  corners.forEach((corner) => {
    vertices[offset++] = 0;
    vertices[offset++] = 0;
    vertices[offset++] = 0;
    vertices[offset++] = corner.x;
    vertices[offset++] = corner.y;
    vertices[offset++] = corner.z;
  });
  const vertexBuffer = createVertexBuffer(context, vertices);
  return new C.VertexArray({
    context,
    attributes: [{
      index: attributeLocations.position,
      vertexBuffer,
      componentsPerAttribute: 3,
      componentDatatype: C.ComponentDatatype.FLOAT,
      offsetInBytes: 0,
      strideInBytes: 3 * Float32Array.BYTES_PER_ELEMENT,
    }],
  });
}

function createSectorSegmentLineVertexArray(
  context: any,
  positions: Cesium.Cartesian3[][],
): any {
  const segmentCount = positions.reduce((count, plane) => count + plane.length - 1, 0);
  const vertices = new Float32Array(segmentCount * 2 * 3);
  let offset = 0;
  positions.forEach((plane) => {
    for (let i = 0; i < plane.length - 1; i++) {
      const start = plane[i];
      const end = plane[i + 1];
      vertices[offset++] = start.x;
      vertices[offset++] = start.y;
      vertices[offset++] = start.z;
      vertices[offset++] = end.x;
      vertices[offset++] = end.y;
      vertices[offset++] = end.z;
    }
  });
  const vertexBuffer = createVertexBuffer(context, vertices);
  return new C.VertexArray({
    context,
    attributes: [{
      index: attributeLocations.position,
      vertexBuffer,
      componentsPerAttribute: 3,
      componentDatatype: C.ComponentDatatype.FLOAT,
      offsetInBytes: 0,
      strideInBytes: 3 * Float32Array.BYTES_PER_ELEMENT,
    }],
  });
}

function pushLineVertex(
  vertices: number[],
  point: Cesium.Cartesian3,
): void {
  vertices.push(point.x, point.y, point.z);
}

function createSensorGridLineVertexArray(
  context: any,
  xHalfAngle: number,
  yHalfAngle: number,
  slice: number,
): any {
  const vertices: number[] = [];
  const tanX = Math.tan(xHalfAngle);
  const tanY = Math.tan(yHalfAngle);
  const gridCount = 5;

  for (let row = 1; row < gridCount - 1; row++) {
    const yRatio = Cesium.Math.lerp(-tanY, tanY, row / (gridCount - 1));
    let previous: Cesium.Cartesian3 | undefined;

    for (let column = 0; column < slice; column++) {
      const xRatio = Cesium.Math.lerp(-tanX, tanX, column / (slice - 1));
      const point = normalizeSensorDirection(xRatio, yRatio);
      if (previous) {
        pushLineVertex(vertices, previous);
        pushLineVertex(vertices, point);
      }
      previous = point;
    }
  }

  for (let column = 1; column < gridCount - 1; column++) {
    const xRatio = Cesium.Math.lerp(-tanX, tanX, column / (gridCount - 1));
    let previous: Cesium.Cartesian3 | undefined;

    for (let row = 0; row < slice; row++) {
      const yRatio = Cesium.Math.lerp(-tanY, tanY, row / (slice - 1));
      const point = normalizeSensorDirection(xRatio, yRatio);
      if (previous) {
        pushLineVertex(vertices, previous);
        pushLineVertex(vertices, point);
      }
      previous = point;
    }
  }

  const vertexBuffer = createVertexBuffer(context, new Float32Array(vertices));
  return new C.VertexArray({
    context,
    attributes: [{
      index: attributeLocations.position,
      vertexBuffer,
      componentsPerAttribute: 3,
      componentDatatype: C.ComponentDatatype.FLOAT,
      offsetInBytes: 0,
      strideInBytes: 3 * Float32Array.BYTES_PER_ELEMENT,
    }],
  });
}

function createDomeVertexArray(context: any): any {
  const geometry = C.EllipsoidGeometry.createGeometry(new C.EllipsoidGeometry({
    vertexFormat: C.VertexFormat.POSITION_ONLY,
    stackPartitions: 32,
    slicePartitions: 32,
  }));
  return C.VertexArray.fromGeometry({
    context,
    geometry,
    attributeLocations,
    bufferUsage: C.BufferUsage.STATIC_DRAW,
    interleave: false,
  });
}

function createDomeLineVertexArray(context: any): any {
  const geometry = C.EllipsoidOutlineGeometry.createGeometry(new C.EllipsoidOutlineGeometry({
    vertexFormat: C.VertexFormat.POSITION_ONLY,
    stackPartitions: 32,
    slicePartitions: 32,
  }));
  return C.VertexArray.fromGeometry({
    context,
    geometry,
    attributeLocations,
    bufferUsage: C.BufferUsage.STATIC_DRAW,
    interleave: false,
  });
}

class ViewShadowPrimitive {
  public show = true;
  private _shadowMap: any;

  public constructor(shadowMap: any) {
    this._shadowMap = shadowMap;
  }

  public update(frameState: any): void {
    if (this.show && this._shadowMap && !this._shadowMap.isDestroyed()) {
      frameState.shadowMaps.push(this._shadowMap);
    }
  }

  public isDestroyed(): boolean {
    return !this._shadowMap || this._shadowMap.isDestroyed();
  }

  public destroy(): void {
    if (this._shadowMap && !this._shadowMap.isDestroyed()) {
      this._shadowMap.destroy();
    }
    this._shadowMap = undefined;
  }
}

interface ShadowShaderPatchState {
  users: number;
  shader: any;
  originalKeyword?: (...args: any[]) => string;
  originalFragment?: (...args: any[]) => any;
  keywordWrapper?: (...args: any[]) => string;
  fragmentWrapper?: (...args: any[]) => any;
}

const shadowShaderPatch: ShadowShaderPatchState = {
  users: 0,
  shader: undefined,
};

const isViewshedShadowMap = (shadowMap: any): boolean =>
  Boolean(shadowMap && shadowMap.isViewShed === true);

function installShadowShaderPatch(): () => void {
  if (!C.ShadowMapShader) {
    throw new Error("Cesium ShadowMapShader is unavailable.");
  }

  if (shadowShaderPatch.users === 0) {
    shadowShaderPatch.shader = C.ShadowMapShader;
    shadowShaderPatch.originalKeyword = shadowShaderPatch.shader.getShadowReceiveShaderKeyword;
    shadowShaderPatch.originalFragment = shadowShaderPatch.shader.createShadowReceiveFragmentShader;

    shadowShaderPatch.keywordWrapper = function (...args: any[]): string {
      const shadowMap = args[0];
      const keyword = shadowShaderPatch.originalKeyword!.apply(this, args);
      return isViewshedShadowMap(shadowMap) ? `${keyword} articleViewshed` : keyword;
    };

    shadowShaderPatch.fragmentWrapper = function (...args: any[]): any {
      const shadowMap = args[1];
      const original = shadowShaderPatch.originalFragment!.apply(this, args);
      if (!isViewshedShadowMap(shadowMap)) return original;

      const sources = original.sources.slice();
      const distanceClipCode = [
        "    vec3 articleViewshedDirectionEC = positionEC.xyz - shadowMap_lightPositionEC.xyz;",
        "    float articleViewshedDistance = length(articleViewshedDirectionEC);",
        "    if (articleViewshedDistance > shadowMap_normalOffsetScaleDistanceMaxDistanceAndDarkness.y)",
        "    {",
        "        return;",
        "    }",
        "    vec3 directionEC = normalize(articleViewshedDirectionEC);",
      ].join("\n");
      const visibilityCode = `
    vec3 articleViewshedColor;
    if (visibility == 0.0)
    {
        articleViewshedColor = vec3(1.0, 0.04, 0.02);
    }
    else
    {
        articleViewshedColor = vec3(0.0, 1.0, 0.08);
    }
    out_FragColor.rgb = mix(out_FragColor.rgb, articleViewshedColor, 0.72);`;

      for (let i = sources.length - 1; i >= 0; i--) {
        let replaced = sources[i].replace(
          /    vec3 directionEC = normalize\(positionEC\.xyz - shadowMap_lightPositionEC\.xyz\);\s*\n/,
          `${distanceClipCode}\n`,
        );
        replaced = replaced.replace(
          /out_FragColor\.rgb\s*\*=\s*visibility\s*;/,
          visibilityCode,
        );
        if (replaced !== sources[i]) {
          sources[i] = replaced;
          break;
        }
      }

      return new C.ShaderSource({
        defines: original.defines.slice(),
        sources,
      });
    };

    shadowShaderPatch.shader.getShadowReceiveShaderKeyword = shadowShaderPatch.keywordWrapper;
    shadowShaderPatch.shader.createShadowReceiveFragmentShader = shadowShaderPatch.fragmentWrapper;
  }

  shadowShaderPatch.users++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    shadowShaderPatch.users--;
    if (shadowShaderPatch.users > 0) return;

    if (shadowShaderPatch.shader) {
      if (shadowShaderPatch.shader.getShadowReceiveShaderKeyword === shadowShaderPatch.keywordWrapper) {
        shadowShaderPatch.shader.getShadowReceiveShaderKeyword = shadowShaderPatch.originalKeyword;
      }
      if (shadowShaderPatch.shader.createShadowReceiveFragmentShader === shadowShaderPatch.fragmentWrapper) {
        shadowShaderPatch.shader.createShadowReceiveFragmentShader = shadowShaderPatch.originalFragment;
      }
    }
    shadowShaderPatch.shader = undefined;
    shadowShaderPatch.originalKeyword = undefined;
    shadowShaderPatch.originalFragment = undefined;
    shadowShaderPatch.keywordWrapper = undefined;
    shadowShaderPatch.fragmentWrapper = undefined;
  };
}

export interface ViewshedRendererOptions {
  observer: Cesium.Cartesian3;
  viewPosition: Cesium.Cartesian3;
  sensorFrame?: ArticleSensorFrame;
  radius: number;
  horizontalFov: number;
  verticalFov: number;
  showFrustum: boolean;
  showLines: boolean;
  sensorAlpha: number;
}

export class ArticleViewshedRenderer {
  private readonly viewer: Cesium.Viewer;
  private viewCamera: any;
  private shadowMap: any;
  private shadowPrimitive: ViewShadowPrimitive | undefined;
  private sensor: RectangularSensorPrimitive | undefined;
  private releaseShadowShaderPatch: (() => void) | undefined;
  private destroyed = false;

  public constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  public update(options: ViewshedRendererOptions): void {
    if (this.destroyed) return;
    this.ensureResources(options);

    const referenceUp =
      this.viewer.scene.mapProjection.ellipsoid.geodeticSurfaceNormal(
        options.observer,
        new Cesium.Cartesian3(),
      );
    const sensorFrame =
      options.sensorFrame ??
      createArticleSensorFrame(
        options.observer,
        options.viewPosition,
        referenceUp,
      );
    const { direction, up, right } = sensorFrame;

    this.viewCamera.position = Cesium.Cartesian3.clone(
      options.observer,
      this.viewCamera.position,
    );
    this.viewCamera.direction = Cesium.Cartesian3.clone(
      direction,
      this.viewCamera.direction,
    );
    this.viewCamera.up = Cesium.Cartesian3.clone(up, this.viewCamera.up);
    this.viewCamera.right = Cesium.Cartesian3.clone(right, this.viewCamera.right);

    const { fov, aspectRatio } = getArticlePerspectiveFrustum(
      options.horizontalFov,
      options.verticalFov,
    );
    const near = Math.max(0.001, options.radius * 0.001);

    this.viewCamera.frustum.fov = fov;
    this.viewCamera.frustum.aspectRatio = aspectRatio;
    this.viewCamera.frustum.near = near;
    this.viewCamera.frustum.far = options.radius;

    const modelMatrix = createArticleSensorModelMatrix(
      options.observer,
      sensorFrame,
    );

    this.sensor!.setModelMatrix(modelMatrix);
    this.sensor!.setRadius(options.radius);
    this.sensor!.setAngles(options.horizontalFov / 2, options.verticalFov / 2);
    this.sensor!.setVisibility(options.showFrustum, options.showLines);
    this.sensor!.setColor(Cesium.Color.AQUA.withAlpha(
      Math.max(0.05, Math.min(0.55, options.sensorAlpha)),
    ));

    this.shadowMap._lightCamera = this.viewCamera;
    this.shadowMap.maximumDistance = Math.max(5000000, options.radius + 1000);
    this.shadowMap.darkness = 0;
    this.shadowMap._darkness = 0;
    this.shadowMap._needsUpdate = true;
    this.shadowMap._boundingSphere = new Cesium.BoundingSphere();
  }

  public clear(): void {
    if (this.shadowPrimitive) {
      this.viewer.scene.primitives.remove(this.shadowPrimitive);
      this.shadowPrimitive = undefined;
    }
    if (this.sensor) {
      this.viewer.scene.primitives.remove(this.sensor);
      this.sensor = undefined;
    }
    this.shadowMap = undefined;
    this.viewCamera = undefined;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.clear();
    this.releaseShadowShaderPatch?.();
    this.releaseShadowShaderPatch = undefined;
    this.destroyed = true;
  }

  private ensureResources(options: ViewshedRendererOptions): void {
    if (this.shadowMap && this.sensor && this.viewCamera) return;
    this.releaseShadowShaderPatch ??= installShadowShaderPatch();
    this.viewCamera = new C.Camera(this.viewer.scene);
    this.viewCamera.frustum = new C.PerspectiveFrustum();
    const { fov, aspectRatio } = getArticlePerspectiveFrustum(
      options.horizontalFov,
      options.verticalFov,
    );
    this.viewCamera.frustum.fov = fov;
    this.viewCamera.frustum.aspectRatio = aspectRatio;
    this.viewCamera.frustum.near = Math.max(0.001, options.radius * 0.001);
    this.viewCamera.frustum.far = options.radius;

    this.shadowMap = new C.ShadowMap({
      context: this.viewer.scene.context,
      lightCamera: this.viewCamera,
      cascadesEnabled: false,
      maximumDistance: Math.max(5000000, options.radius + 1000),
      fadingEnabled: false,
      darkness: 0,
      normalOffset: true,
      softShadows: false,
      size: 2048,
    });
    Object.defineProperty(this.shadowMap, "isViewShed", {
      configurable: true,
      enumerable: false,
      get: () => true,
    });
    this.wrapShadowMapUpdate(this.shadowMap);

    this.sensor = new RectangularSensorPrimitive({
      modelMatrix: Cesium.Matrix4.IDENTITY,
      radius: options.radius,
      xHalfAngle: options.horizontalFov / 2,
      yHalfAngle: options.verticalFov / 2,
      color: Cesium.Color.AQUA.withAlpha(options.sensorAlpha),
      lineColor: Cesium.Color.WHITE,
      show: options.showFrustum,
      showLines: options.showLines,
    });

    this.viewer.scene.primitives.add(this.sensor);
    this.shadowPrimitive = this.viewer.scene.primitives.add(
      new ViewShadowPrimitive(this.shadowMap),
    );
  }

  private wrapShadowMapUpdate(shadowMap: any): void {
    const originalUpdate = shadowMap.update.bind(shadowMap);
    shadowMap.update = (frameState: any) => {
      const shadowState = frameState.shadowState;
      const frustum = this.viewCamera.frustum;
      const oldNear = shadowState?.nearPlane;
      const oldFar = shadowState?.farPlane;

      shadowMap._fitNearFar = true;
      shadowMap._boundingSphere = new Cesium.BoundingSphere();
      if (shadowState) {
        shadowState.nearPlane = frustum.near;
        shadowState.farPlane = frustum.far;
      }

      try {
        originalUpdate(frameState);
        shadowMap._distance = frustum.far;
      } finally {
        if (shadowState) {
          shadowState.nearPlane = oldNear;
          shadowState.farPlane = oldFar;
        }
      }
    };
  }
}
