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

// 점에서 꺾은선(경로)까지 가장 가까운 거리(m). 경로 한 구간이 짧아서 점 근처를 평면으로 펴서 계산한다
export function distanceToPolylineMeters(lat, lng, points) {
  const mPerDegLat = 111_320
  const mPerDegLng = 111_320 * Math.cos(toRadians(lat))
  const toXY = (p) => [(p.lng - lng) * mPerDegLng, (p.lat - lat) * mPerDegLat] // 점을 원점으로
  let min = Infinity
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = toXY(points[i])
    if (i === points.length - 1) {
      if (points.length === 1) min = Math.hypot(ax, ay)
      break
    }
    const [bx, by] = toXY(points[i + 1])
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return min
}
