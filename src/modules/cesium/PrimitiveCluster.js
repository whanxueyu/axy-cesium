// import {
//   BoundingRectangle,
//   Cartesian2,
//   Cartesian3,
//   defaultValue,
//   defined,
//   EllipsoidalOccluder,
//   Event,
//   Matrix4,
//   Billboard,
//   BillboardCollection,
//   Label,
//   LabelCollection,
//   PointPrimitive,
//   PointPrimitiveCollection,
//   SceneMode,
// } from "cesium";
import KDBush from "kdbush";
import * as Cesium from "cesium";
/**
 * Defines how screen space objects (billboards, points, labels) are clustered.
 *
 * @param {Object} [options] An object with the following properties:
 * @param {Boolean} [options.enabled=false] Whether or not to enable clustering.
 * @param {Number} [options.pixelRange=80] The pixel range to extend the screen space bounding box.
 * @param {Number} [options.minimumClusterSize=2] The minimum number of screen space objects that can be clustered.
 * @param {Boolean} [options.clusterBillboards=true] Whether or not to cluster the billboards of an entity.
 * @param {Boolean} [options.clusterLabels=true] Whether or not to cluster the labels of an entity.
 * @param {Boolean} [options.clusterPoints=true] Whether or not to cluster the points of an entity.
 * @param {Boolean} [options.show=true] Determines if the entities in the cluster will be shown.
 *
 * @alias PrimitiveCluster
 * @constructor
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?src=Clustering.html|Cesium Sandcastle Clustering Demo}
 */
function PrimitiveCluster(options) {
  options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

  this._enabled = Cesium.defaultValue(options.enabled, false);
  this._pixelRange = Cesium.defaultValue(options.pixelRange, 80);
  this._minimumClusterSize = Cesium.defaultValue(options.minimumClusterSize, 2);
  this._clusterBillboards = Cesium.defaultValue(options.clusterBillboards, true);
  this._clusterLabels = Cesium.defaultValue(options.clusterLabels, true);
  this._clusterPoints = Cesium.defaultValue(options.clusterPoints, true);
  this._delay = Cesium.defaultValue(options.delay, 800)
  this._labelCollection = undefined;
  this._billboardCollection = undefined;
  this._pointCollection = undefined;

  this._clusterBillboardCollection = undefined;
  this._clusterLabelCollection = undefined;
  this._clusterPointCollection = undefined;

  this._collectionIndicesByEntity = {};

  this._unusedLabelIndices = [];
  this._unusedBillboardIndices = [];
  this._unusedPointIndices = [];

  this._previousClusters = [];
  this._previousHeight = undefined;

  this._enabledDirty = false;
  this._clusterDirty = false;

  this._cluster = undefined;
  this._removeEventListener = undefined;

  this._clusterEvent = new Cesium.Event();

  /**
   * Determines if entities in this collection will be shown.
   *
   * @type {Boolean}
   * @default true
   */
  this.show = Cesium.defaultValue(options.show, true);
}

function getX(point) {
  return point.coord.x;
}

function getY(point) {
  return point.coord.y;
}

function expandBoundingBox(bbox, pixelRange) {
  bbox.x -= pixelRange;
  bbox.y -= pixelRange;
  bbox.width += pixelRange * 2.0;
  bbox.height += pixelRange * 2.0;
}

const labelBoundingBoxScratch = new Cesium.BoundingRectangle();

function getBoundingBox(item, coord, pixelRange, entityCluster, result) {
  if (Cesium.defined(item._labelCollection) && entityCluster._clusterLabels) {
    result = Cesium.Label.getScreenSpaceBoundingBox(item, coord, result);
  } else if (
    Cesium.defined(item._billboardCollection) &&
    entityCluster._clusterBillboards
  ) {
    result = Cesium.Billboard.getScreenSpaceBoundingBox(item, coord, result);
  } else if (
    Cesium.defined(item._pointPrimitiveCollection) &&
    entityCluster._clusterPoints
  ) {
    result = Cesium.PointPrimitive.getScreenSpaceBoundingBox(item, coord, result);
  }

  expandBoundingBox(result, pixelRange);

  if (
    entityCluster._clusterLabels &&
    !Cesium.defined(item._labelCollection) &&
    Cesium.defined(item.id) &&
    hasLabelIndex(entityCluster, item.id.id) &&
    Cesium.defined(item.id._label)
  ) {
    const labelIndex =
      entityCluster._collectionIndicesByEntity[item.id.id].labelIndex;
    const label = entityCluster._labelCollection.get(labelIndex);
    const labelBBox = Cesium.Label.getScreenSpaceBoundingBox(
      label,
      coord,
      labelBoundingBoxScratch
    );
    expandBoundingBox(labelBBox, pixelRange);
    result = Cesium.BoundingRectangle.union(result, labelBBox, result);
  }

  return result;
}

function addNonClusteredItem(item, entityCluster) {
  item.clusterShow = true;

  if (
    !Cesium.defined(item._labelCollection) &&
    Cesium.defined(item.id) &&
    hasLabelIndex(entityCluster, item.id.id) &&
    Cesium.defined(item.id._label)
  ) {
    const labelIndex =
      entityCluster._collectionIndicesByEntity[item.id.id].labelIndex;
    const label = entityCluster._labelCollection.get(labelIndex);
    label.clusterShow = true;
  }
}

function addCluster(position, numPoints, ids, entityCluster) {
  const cluster = {
    billboard: entityCluster._clusterBillboardCollection.add(),
    label: entityCluster._clusterLabelCollection.add(),
    point: entityCluster._clusterPointCollection.add(),
  };

  cluster.billboard.show = false;
  cluster.point.show = false;
  cluster.label.show = true;
  cluster.label.text = numPoints.toLocaleString();
  cluster.label.id = ids;
  cluster.billboard.position = cluster.label.position = cluster.point.position = position;

  entityCluster._clusterEvent.raiseEvent(ids, cluster);
}

function hasLabelIndex(entityCluster, entityId) {
  return (
    Cesium.defined(entityCluster) &&
    Cesium.defined(entityCluster._collectionIndicesByEntity[entityId]) &&
    Cesium.defined(entityCluster._collectionIndicesByEntity[entityId].labelIndex)
  );
}

function getScreenSpacePositions(
  collection,
  points,
  scene,
  occluder,
  entityCluster
) {
  if (!Cesium.defined(collection)) {
    return;
  }

  const length = collection.length;
  for (let i = 0; i < length; ++i) {
    const item = collection.get(i);
    item.clusterShow = false;

    if (
      !item.show ||
      (entityCluster._scene.mode === Cesium.SceneMode.SCENE3D &&
        !occluder.isPointVisible(item.position))
    ) {
      continue;
    }

    // const canClusterLabels =
    //   entityCluster._clusterLabels && Cesium.defined(item._labelCollection);
    // const canClusterBillboards =
    //   entityCluster._clusterBillboards && Cesium.defined(item.id._billboard);
    // const canClusterPoints =
    //   entityCluster._clusterPoints && Cesium.defined(item.id._point);
    // if (canClusterLabels && (canClusterPoints || canClusterBillboards)) {
    //   continue;
    // }

    const coord = item.computeScreenSpacePosition(scene);
    if (!Cesium.defined(coord)) {
      continue;
    }

    points.push({
      index: i,
      collection: collection,
      clustered: false,
      coord: coord,
    });
  }
}

const pointBoundinRectangleScratch = new Cesium.BoundingRectangle();
const totalBoundingRectangleScratch = new Cesium.BoundingRectangle();
const neighborBoundingRectangleScratch = new Cesium.BoundingRectangle();

function createDeclutterCallback(entityCluster) {
  return function (amount) {
    if ((Cesium.defined(amount) && amount < 0.05) || !entityCluster.enabled) {
      return;
    }

    const scene = entityCluster._scene;

    const labelCollection = entityCluster._labelCollection;
    const billboardCollection = entityCluster._billboardCollection;
    const pointCollection = entityCluster._pointCollection;

    if (
      (!Cesium.defined(labelCollection) &&
        !Cesium.defined(billboardCollection) &&
        !Cesium.defined(pointCollection)) ||
      (!entityCluster._clusterBillboards &&
        !entityCluster._clusterLabels &&
        !entityCluster._clusterPoints)
    ) {
      return;
    }

    let clusteredLabelCollection = entityCluster._clusterLabelCollection;
    let clusteredBillboardCollection =
      entityCluster._clusterBillboardCollection;
    let clusteredPointCollection = entityCluster._clusterPointCollection;

    if (Cesium.defined(clusteredLabelCollection)) {
      clusteredLabelCollection.removeAll();
    } else {
      clusteredLabelCollection = entityCluster._clusterLabelCollection = new Cesium.LabelCollection(
        {
          scene: scene,
        }
      );
    }

    if (Cesium.defined(clusteredBillboardCollection)) {
      clusteredBillboardCollection.removeAll();
    } else {
      clusteredBillboardCollection = entityCluster._clusterBillboardCollection = new Cesium.BillboardCollection(
        {
          scene: scene,
        }
      );
    }

    if (Cesium.defined(clusteredPointCollection)) {
      clusteredPointCollection.removeAll();
    } else {
      clusteredPointCollection = entityCluster._clusterPointCollection = new Cesium.PointPrimitiveCollection();
    }

    const pixelRange = entityCluster._pixelRange;
    const minimumClusterSize = entityCluster._minimumClusterSize;

    const clusters = entityCluster._previousClusters;
    const newClusters = [];

    const previousHeight = entityCluster._previousHeight;
    const currentHeight = scene.camera.positionCartographic.height;

    const ellipsoid = scene.mapProjection.ellipsoid;
    const cameraPosition = scene.camera.positionWC;
    const occluder = new Cesium.EllipsoidalOccluder(ellipsoid, cameraPosition);

    const points = [];
    if (entityCluster._clusterLabels) {
      getScreenSpacePositions(
        labelCollection,
        points,
        scene,
        occluder,
        entityCluster
      );
    }
    if (entityCluster._clusterBillboards) {
      getScreenSpacePositions(
        billboardCollection,
        points,
        scene,
        occluder,
        entityCluster
      );
    }
    if (entityCluster._clusterPoints) {
      getScreenSpacePositions(
        pointCollection,
        points,
        scene,
        occluder,
        entityCluster
      );
    }

    let i;
    let j;
    let length;
    let bbox;
    let neighbors;
    let neighborLength;
    let neighborIndex;
    let neighborPoint;
    let ids;
    let numPoints;

    let collection;
    let collectionIndex;

    const index = new KDBush(points, getX, getY, 64, Int32Array);
    console.log(index)
    if (currentHeight < previousHeight) {
      length = clusters.length;
      for (i = 0; i < length; ++i) {
        const cluster = clusters[i];

        if (!occluder.isPointVisible(cluster.position)) {
          continue;
        }

        const coord = Cesium.Billboard._computeScreenSpacePosition(
          Cesium.Matrix4.IDENTITY,
          cluster.position,
          Cesium.Cartesian3.ZERO,
          Cesium.Cartesian2.ZERO,
          scene
        );
        if (!Cesium.defined(coord)) {
          continue;
        }

        const factor = 1.0 - currentHeight / previousHeight;
        let width = (cluster.width = cluster.width * factor);
        let height = (cluster.height = cluster.height * factor);

        width = Math.max(width, cluster.minimumWidth);
        height = Math.max(height, cluster.minimumHeight);

        const minX = coord.x - width * 0.5;
        const minY = coord.y - height * 0.5;
        const maxX = coord.x + width;
        const maxY = coord.y + height;

        neighbors = index.range(minX, minY, maxX, maxY);
        neighborLength = neighbors.length;
        numPoints = 0;
        ids = [];

        for (j = 0; j < neighborLength; ++j) {
          neighborIndex = neighbors[j];
          neighborPoint = points[neighborIndex];
          if (!neighborPoint.clustered) {
            ++numPoints;

            collection = neighborPoint.collection;
            collectionIndex = neighborPoint.index;
            ids.push(collection.get(collectionIndex).id);
          }
        }

        if (numPoints >= minimumClusterSize) {
          addCluster(cluster.position, numPoints, ids, entityCluster);
          newClusters.push(cluster);

          for (j = 0; j < neighborLength; ++j) {
            points[neighbors[j]].clustered = true;
          }
        }
      }
    }

    length = points.length;
    for (i = 0; i < length; ++i) {
      const point = points[i];
      if (point.clustered) {
        continue;
      }

      point.clustered = true;

      collection = point.collection;
      collectionIndex = point.index;

      const item = collection.get(collectionIndex);
      bbox = getBoundingBox(
        item,
        point.coord,
        pixelRange,
        entityCluster,
        pointBoundinRectangleScratch
      );
      const totalBBox = Cesium.BoundingRectangle.clone(
        bbox,
        totalBoundingRectangleScratch
      );

      neighbors = index.range(
        bbox.x,
        bbox.y,
        bbox.x + bbox.width,
        bbox.y + bbox.height
      );
      neighborLength = neighbors.length;

      const clusterPosition = Cesium.Cartesian3.clone(item.position);
      numPoints = 1;
      ids = [item.id];

      for (j = 0; j < neighborLength; ++j) {
        neighborIndex = neighbors[j];
        neighborPoint = points[neighborIndex];
        if (!neighborPoint.clustered) {
          const neighborItem = neighborPoint.collection.get(
            neighborPoint.index
          );
          const neighborBBox = getBoundingBox(
            neighborItem,
            neighborPoint.coord,
            pixelRange,
            entityCluster,
            neighborBoundingRectangleScratch
          );

          Cesium.Cartesian3.add(
            neighborItem.position,
            clusterPosition,
            clusterPosition
          );

          Cesium.BoundingRectangle.union(totalBBox, neighborBBox, totalBBox);
          ++numPoints;

          ids.push(neighborItem.id);
        }
      }

      if (numPoints >= minimumClusterSize) {
        const position = Cesium.Cartesian3.multiplyByScalar(
          clusterPosition,
          1.0 / numPoints,
          clusterPosition
        );
        addCluster(position, numPoints, ids, entityCluster);
        newClusters.push({
          position: position,
          width: totalBBox.width,
          height: totalBBox.height,
          minimumWidth: bbox.width,
          minimumHeight: bbox.height,
        });

        for (j = 0; j < neighborLength; ++j) {
          points[neighbors[j]].clustered = true;
        }
      } else {
        addNonClusteredItem(item, entityCluster);
      }
    }

    if (clusteredLabelCollection.length === 0) {
      clusteredLabelCollection.destroy();
      entityCluster._clusterLabelCollection = undefined;
    }

    if (clusteredBillboardCollection.length === 0) {
      clusteredBillboardCollection.destroy();
      entityCluster._clusterBillboardCollection = undefined;
    }

    if (clusteredPointCollection.length === 0) {
      clusteredPointCollection.destroy();
      entityCluster._clusterPointCollection = undefined;
    }

    entityCluster._previousClusters = newClusters;
    entityCluster._previousHeight = currentHeight;
  };
}

PrimitiveCluster.prototype._initialize = function (scene) {
  this._scene = scene;

  const cluster = createDeclutterCallback(this);
  this._cluster = cluster;
  var _t = null;
  const _self = this;
  // this._removeEventListener = scene.camera.changed.addEventListener(cluster);
  this._removeEventListener = scene.camera.changed.addEventListener(function(amount) {
    if (_t) {
      clearTimeout(_t);
      _t = null;
    }
    _t = setTimeout(() => {
      cluster(amount);
    }, _self._delay);
  });
};

Object.defineProperties(PrimitiveCluster.prototype, {
  /**
   * Gets or sets whether clustering is enabled.
   * @memberof PrimitiveCluster.prototype
   * @type {Boolean}
   */
  enabled: {
    get: function () {
      return this._enabled;
    },
    set: function (value) {
      this._enabledDirty = value !== this._enabled;
      this._enabled = value;
    },
  },
  delay: {
    get: function () {
      return this._delay;
    },
    set: function (value) {
      this._delay = value;
    },
  },
  /**
   * Gets or sets the pixel range to extend the screen space bounding box.
   * @memberof PrimitiveCluster.prototype
   * @type {Number}
   */
  pixelRange: {
    get: function () {
      return this._pixelRange;
    },
    set: function (value) {
      this._clusterDirty = this._clusterDirty || value !== this._pixelRange;
      this._pixelRange = value;
    },
  },
  /**
   * Gets or sets the minimum number of screen space objects that can be clustered.
   * @memberof PrimitiveCluster.prototype
   * @type {Number}
   */
  minimumClusterSize: {
    get: function () {
      return this._minimumClusterSize;
    },
    set: function (value) {
      this._clusterDirty =
        this._clusterDirty || value !== this._minimumClusterSize;
      this._minimumClusterSize = value;
    },
  },
  /**
   * Gets the event that will be raised when a new cluster will be displayed. The signature of the event listener is {@link PrimitiveCluster.newClusterCallback}.
   * @memberof PrimitiveCluster.prototype
   * @type {Cesium.Event<PrimitiveCluster.newClusterCallback>}
   */
  clusterEvent: {
    get: function () {
      return this._clusterEvent;
    },
  },
  /**
   * Gets or sets whether clustering billboard entities is enabled.
   * @memberof PrimitiveCluster.prototype
   * @type {Boolean}
   */
  clusterBillboards: {
    get: function () {
      return this._clusterBillboards;
    },
    set: function (value) {
      this._clusterDirty =
        this._clusterDirty || value !== this._clusterBillboards;
      this._clusterBillboards = value;
    },
  },
  /**
   * Gets or sets whether clustering labels entities is enabled.
   * @memberof PrimitiveCluster.prototype
   * @type {Boolean}
   */
  clusterLabels: {
    get: function () {
      return this._clusterLabels;
    },
    set: function (value) {
      this._clusterDirty = this._clusterDirty || value !== this._clusterLabels;
      this._clusterLabels = value;
    },
  },
  /**
   * Gets or sets whether clustering point entities is enabled.
   * @memberof PrimitiveCluster.prototype
   * @type {Boolean}
   */
  clusterPoints: {
    get: function () {
      return this._clusterPoints;
    },
    set: function (value) {
      this._clusterDirty = this._clusterDirty || value !== this._clusterPoints;
      this._clusterPoints = value;
    },
  },
});

function createGetEntity(
  collectionProperty,
  CollectionConstructor,
  unusedIndicesProperty,
  entityIndexProperty
) {
  return function (entity) {
    let collection = this[collectionProperty];

    if (!Cesium.defined(this._collectionIndicesByEntity)) {
      this._collectionIndicesByEntity = {};
    }

    let entityIndices = this._collectionIndicesByEntity[entity.id];

    if (!Cesium.defined(entityIndices)) {
      entityIndices = this._collectionIndicesByEntity[entity.id] = {
        billboardIndex: undefined,
        labelIndex: undefined,
        pointIndex: undefined,
      };
    }

    if (Cesium.defined(collection) && Cesium.defined(entityIndices[entityIndexProperty])) {
      return collection.get(entityIndices[entityIndexProperty]);
    }

    if (!Cesium.defined(collection)) {
      collection = this[collectionProperty] = new CollectionConstructor({
        scene: this._scene,
      });
    }

    let index;
    let entityItem;

    const unusedIndices = this[unusedIndicesProperty];
    if (unusedIndices.length > 0) {
      index = unusedIndices.pop();
      entityItem = collection.get(index);
    } else {
      entityItem = collection.add();
      index = collection.length - 1;
    }

    entityIndices[entityIndexProperty] = index;

    const that = this;
    Promise.resolve().then(function () {
      that._clusterDirty = true;
    });

    return entityItem;
  };
}

function removeEntityIndicesIfUnused(entityCluster, entityId) {
  const indices = entityCluster._collectionIndicesByEntity[entityId];

  if (
    !Cesium.defined(indices.billboardIndex) &&
    !Cesium.defined(indices.labelIndex) &&
    !Cesium.defined(indices.pointIndex)
  ) {
    delete entityCluster._collectionIndicesByEntity[entityId];
  }
}

/**
 * Returns a new {@link Cesium.Label}.
 * @param {Entity} entity The entity that will use the returned {@link Cesium.Label} for visualization.
 * @returns {Cesium.Label} The label that will be used to visualize an entity.
 *
 * @private
 */
PrimitiveCluster.prototype.getLabel = createGetEntity(
  "_labelCollection",
  Cesium.LabelCollection,
  "_unusedLabelIndices",
  "labelIndex"
);

/**
 * Removes the {@link Cesium.Label} associated with an entity so it can be reused by another entity.
 * @param {Entity} entity The entity that will uses the returned {@link Cesium.Label} for visualization.
 *
 * @private
 */
PrimitiveCluster.prototype.removeLabel = function (entity) {
  const entityIndices =
    this._collectionIndicesByEntity &&
    this._collectionIndicesByEntity[entity.id];
  if (
    !Cesium.defined(this._labelCollection) ||
    !Cesium.defined(entityIndices) ||
    !Cesium.defined(entityIndices.labelIndex)
  ) {
    return;
  }

  const index = entityIndices.labelIndex;
  entityIndices.labelIndex = undefined;
  removeEntityIndicesIfUnused(this, entity.id);

  const label = this._labelCollection.get(index);
  label.show = false;
  label.text = "";
  label.id = undefined;

  this._unusedLabelIndices.push(index);

  this._clusterDirty = true;
};

/**
 * Returns a new {@link Cesium.Billboard}.
 * @param {Entity} entity The entity that will use the returned {@link Cesium.Billboard} for visualization.
 * @returns {Billboard} The label that will be used to visualize an entity.
 *
 * @private
 */
PrimitiveCluster.prototype.getBillboard = createGetEntity(
  "_billboardCollection",
  Cesium.BillboardCollection,
  "_unusedBillboardIndices",
  "billboardIndex"
);

/**
 * Removes the {@link Cesium.Billboard} associated with an entity so it can be reused by another entity.
 * @param {Entity} entity The entity that will uses the returned {@link Cesium.Billboard} for visualization.
 *
 * @private
 */
PrimitiveCluster.prototype.removeBillboard = function (entity) {
  const entityIndices =
    this._collectionIndicesByEntity &&
    this._collectionIndicesByEntity[entity.id];
  if (
    !Cesium.defined(this._billboardCollection) ||
    !Cesium.defined(entityIndices) ||
    !Cesium.defined(entityIndices.billboardIndex)
  ) {
    return;
  }

  const index = entityIndices.billboardIndex;
  entityIndices.billboardIndex = undefined;
  removeEntityIndicesIfUnused(this, entity.id);

  const billboard = this._billboardCollection.get(index);
  billboard.id = undefined;
  billboard.show = false;
  billboard.image = undefined;

  this._unusedBillboardIndices.push(index);

  this._clusterDirty = true;
};

/**
 * Returns a new {@link Point}.
 * @param {Entity} entity The entity that will use the returned {@link Point} for visualization.
 * @returns {Point} The label that will be used to visualize an entity.
 *
 * @private
 */
PrimitiveCluster.prototype.getPoint = createGetEntity(
  "_pointCollection",
  Cesium.PointPrimitiveCollection,
  "_unusedPointIndices",
  "pointIndex"
);

/**
 * Removes the {@link Point} associated with an entity so it can be reused by another entity.
 * @param {Entity} entity The entity that will uses the returned {@link Point} for visualization.
 *
 * @private
 */
PrimitiveCluster.prototype.removePoint = function (entity) {
  const entityIndices =
    this._collectionIndicesByEntity &&
    this._collectionIndicesByEntity[entity.id];
  if (
    !Cesium.defined(this._pointCollection) ||
    !Cesium.defined(entityIndices) ||
    !Cesium.defined(entityIndices.pointIndex)
  ) {
    return;
  }

  const index = entityIndices.pointIndex;
  entityIndices.pointIndex = undefined;
  removeEntityIndicesIfUnused(this, entity.id);

  const point = this._pointCollection.get(index);
  point.show = false;
  point.id = undefined;

  this._unusedPointIndices.push(index);

  this._clusterDirty = true;
};

function disableCollectionClustering(collection) {
  if (!Cesium.defined(collection)) {
    return;
  }

  const length = collection.length;
  for (let i = 0; i < length; ++i) {
    collection.get(i).clusterShow = true;
  }
}

function updateEnable(entityCluster) {
  if (entityCluster.enabled) {
    return;
  }

  if (Cesium.defined(entityCluster._clusterLabelCollection)) {
    entityCluster._clusterLabelCollection.destroy();
  }
  if (Cesium.defined(entityCluster._clusterBillboardCollection)) {
    entityCluster._clusterBillboardCollection.destroy();
  }
  if (Cesium.defined(entityCluster._clusterPointCollection)) {
    entityCluster._clusterPointCollection.destroy();
  }

  entityCluster._clusterLabelCollection = undefined;
  entityCluster._clusterBillboardCollection = undefined;
  entityCluster._clusterPointCollection = undefined;

  disableCollectionClustering(entityCluster._labelCollection);
  disableCollectionClustering(entityCluster._billboardCollection);
  disableCollectionClustering(entityCluster._pointCollection);
}

/**
 * Gets the draw commands for the clustered billboards/points/labels if enabled, otherwise,
 * queues the draw commands for billboards/points/labels created for entities.
 * @private
 */
PrimitiveCluster.prototype.update = function (frameState) {
  if (!this.show) {
    return;
  }

  // If clustering is enabled before the label collection is updated,
  // the glyphs haven't been created so the screen space bounding boxes
  // are incorrect.
  let commandList;
  if (
    Cesium.defined(this._labelCollection) &&
    this._labelCollection.length > 0 &&
    this._labelCollection.get(0)._glyphs.length === 0
  ) {
    commandList = frameState.commandList;
    frameState.commandList = [];
    this._labelCollection.update(frameState);
    frameState.commandList = commandList;
  }

  // If clustering is enabled before the billboard collection is updated,
  // the images haven't been added to the image atlas so the screen space bounding boxes
  // are incorrect.
  if (
    Cesium.defined(this._billboardCollection) &&
    this._billboardCollection.length > 0 &&
    !Cesium.defined(this._billboardCollection.get(0).width)
  ) {
    commandList = frameState.commandList;
    frameState.commandList = [];
    this._billboardCollection.update(frameState);
    frameState.commandList = commandList;
  }

  if (this._enabledDirty) {
    this._enabledDirty = false;
    updateEnable(this);
    this._clusterDirty = true;
  }

  if (this._clusterDirty) {
    this._clusterDirty = false;
    this._cluster();
  }

  if (Cesium.defined(this._clusterLabelCollection)) {
    this._clusterLabelCollection.update(frameState);
  }
  if (Cesium.defined(this._clusterBillboardCollection)) {
    this._clusterBillboardCollection.update(frameState);
  }
  if (Cesium.defined(this._clusterPointCollection)) {
    this._clusterPointCollection.update(frameState);
  }

  if (Cesium.defined(this._labelCollection)) {
    this._labelCollection.update(frameState);
  }
  if (Cesium.defined(this._billboardCollection)) {
    this._billboardCollection.update(frameState);
  }
  if (Cesium.defined(this._pointCollection)) {
    this._pointCollection.update(frameState);
  }
};

/**
 * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
 * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
 * <p>
 * Unlike other objects that use WebGL resources, this object can be reused. For example, if a data source is removed
 * from a data source collection and added to another.
 * </p>
 */
PrimitiveCluster.prototype.destroy = function () {
  this._labelCollection =
    this._labelCollection && this._labelCollection.destroy();
  this._billboardCollection =
    this._billboardCollection && this._billboardCollection.destroy();
  this._pointCollection =
    this._pointCollection && this._pointCollection.destroy();

  this._clusterLabelCollection =
    this._clusterLabelCollection && this._clusterLabelCollection.destroy();
  this._clusterBillboardCollection =
    this._clusterBillboardCollection &&
    this._clusterBillboardCollection.destroy();
  this._clusterPointCollection =
    this._clusterPointCollection && this._clusterPointCollection.destroy();

  if (Cesium.defined(this._removeEventListener)) {
    this._removeEventListener();
    this._removeEventListener = undefined;
  }

  this._labelCollection = undefined;
  this._billboardCollection = undefined;
  this._pointCollection = undefined;

  this._clusterBillboardCollection = undefined;
  this._clusterLabelCollection = undefined;
  this._clusterPointCollection = undefined;

  this._collectionIndicesByEntity = undefined;

  this._unusedLabelIndices = [];
  this._unusedBillboardIndices = [];
  this._unusedPointIndices = [];

  this._previousClusters = [];
  this._previousHeight = undefined;

  this._enabledDirty = false;
  this._pixelRangeDirty = false;
  this._minimumClusterSizeDirty = false;

  return undefined;
};

/**
 * A event listener function used to style clusters.
 * @callback PrimitiveCluster.newClusterCallback
 *
 * @param {Entity[]} clusteredEntities An array of the entities contained in the cluster.
 * @param {Object} cluster An object containing the Billboard, Label, and Point
 * primitives that represent this cluster of entities.
 * @param {Cesium.Billboard} cluster.billboard
 * @param {Cesium.Label} cluster.label
 * @param {Cesium.PointPrimitive} cluster.point
 *
 * @example
 * // The default cluster values.
 * dataSource.clustering.clusterEvent.addEventListener(function(entities, cluster) {
 *     cluster.label.show = true;
 *     cluster.label.text = entities.length.toLocaleString();
 * });
 */
export default PrimitiveCluster;
