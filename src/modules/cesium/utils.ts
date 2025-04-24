import {latlngBounds2Bounds} from '@/utils'
import {
  Feature,
  MultiPolygon,
  Polygon,
  Position,
  Properties,
  polygon,
} from '@turf/turf'
import {LatLng, LatLngBounds, Map as LeafletMap, latLngBounds} from 'leaflet'
import proj4 from 'proj4'
type turfPolygon = ReturnType<typeof polygon<Properties>>
export function getSizeFromLatlngBounds(map: LeafletMap, bounds: LatLngBounds) {
  const bound = latlngBounds2Bounds(map, bounds)
  const size = bound.getSize()
  return {width: size.x, height: size.y}
}
export function bounds2BBox(bounds: LatLngBounds) {
  const min = bounds.getSouthWest(),
    max = bounds.getNorthEast()
  return `${min.lat},${min.lng},${max.lat},${max.lng}`
}
export function bounds2TurfPolygon(bounds: LatLngBounds): turfPolygon {
  const nw = bounds.getNorthWest(),
    ne = bounds.getNorthEast(),
    sw = bounds.getSouthWest(),
    se = bounds.getSouthEast()
  return polygon([
    [
      [nw.lng, nw.lat],
      [ne.lng, ne.lat],
      [se.lng, se.lat],
      [sw.lng, sw.lat],
      [nw.lng, nw.lat],
    ],
  ])
}
export function turfPolygon2Bounds(
  polygon: Feature<Polygon | MultiPolygon, Properties>,
) {
  let target: Position[]
  if (Array.isArray(polygon.geometry.coordinates[0][0][0])) {
    target = polygon.geometry.coordinates[0][0] as Position[]
  } else {
    target = polygon.geometry.coordinates[0] as Position[]
  }
  let maxLat = -Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    minLng = Infinity
  target.forEach(coord => {
    maxLat = Math.max(coord[1], maxLat)
    maxLng = Math.max(coord[0], maxLng)
    minLat = Math.min(coord[1], minLat)
    minLng = Math.min(coord[0], minLng)
  })
  return latLngBounds([minLat, minLng], [maxLat, maxLng])
}
export function bounds2PolygonLatlngs(
  bounds: [[number, number], [number, number]],
): LatLng[] {
  const llb = latLngBounds(bounds)
  return [
    llb.getNorthWest(),
    llb.getNorthEast(),
    llb.getSouthEast(),
    llb.getSouthWest(),
  ]
}

const proj4326To3857 = proj4(
  '+proj=longlat +datum=WGS84 +no_defs',
  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
)
export function calculateClipPath(
  rootBounds: LatLngBounds,
  childBounds: LatLngBounds,
) {
  if (rootBounds.equals(childBounds)) return {radius: 0.5, x: 0.5, y: 0.5}
  const rootNW = rootBounds.getNorthWest(),
    rootNE = rootBounds.getNorthEast(),
    rootSW = rootBounds.getSouthWest(),
    childNW = childBounds.getNorthWest(),
    childNE = childBounds.getNorthEast(),
    childSW = childBounds.getSouthWest(),
    rootNWPlain = proj4326To3857.forward({x: rootNW.lng, y: rootNW.lat}),
    rootNEPlain = proj4326To3857.forward({x: rootNE.lng, y: rootNE.lat}),
    rootSWPlain = proj4326To3857.forward({x: rootSW.lng, y: rootSW.lat}),
    childNWPlain = proj4326To3857.forward({x: childNW.lng, y: childNW.lat}),
    childNEPlain = proj4326To3857.forward({x: childNE.lng, y: childNE.lat}),
    childSWPlain = proj4326To3857.forward({x: childSW.lng, y: childSW.lat}),
    rootWidth = Math.abs(rootNWPlain.x - rootNEPlain.x),
    rootHeight = Math.abs(rootNWPlain.y - rootSWPlain.y),
    childWidth = Math.abs(childNWPlain.x - childNEPlain.x),
    childHeight = Math.abs(childNWPlain.y - childSWPlain.y),
    radiusPlain = rootHeight / 2,
    circleNCD = [
      ((rootNEPlain.x + rootSWPlain.x) / 2 - childNWPlain.x) / childWidth,
      (-1 * ((rootNEPlain.y + rootSWPlain.y) / 2 - childNWPlain.y)) /
        childHeight,
    ],
    radiusPlainNCD = radiusPlain / ((childWidth + childHeight) / 2)
  // return `circle(${radiusPlainNCD * 100}% at ${circleNCD[0] * 100}% ${
  //   circleNCD[1] * 100
  // }%)`
  return {radius: radiusPlainNCD, x: circleNCD[0], y: circleNCD[1]}
}
