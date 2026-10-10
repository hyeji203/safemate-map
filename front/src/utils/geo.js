const EARTH_RADIUS_METERS = 6_371_000

const toRadians = (deg) => (deg * Math.PI) / 180

// 하버사인 공식으로 두 좌표 사이의 거리(m)를 계산한다. 백엔드 util/GeoUtils.haversineMeters와 같은 식.
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a))
}
