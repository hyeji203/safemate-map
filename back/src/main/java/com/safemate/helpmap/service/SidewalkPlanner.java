package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.RouteResponse;
import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 도로망 그래프는 차도 중심선이라, 큰 도로를 따라가는 경로가 도로 한가운데에 그려지고 언제 길을 건너는지 보이지 않는다.
 * 큰 도로 구간은 보도 쪽으로 옮겨 그리고, 보도 쪽이 바뀌는 교차로에는 횡단보도 구간을 만든다.
 * <p>
 * 교차로에서 큰 도로 방향(팔)들이 주변을 몇 개의 모퉁이 구역으로 나누고, 한 구역에서 다른 구역으로 가려면
 * 사이에 있는 팔 개수만큼 도로를 건너야 한다. 경로 전체에서 건너는 횟수가 가장 적도록
 * 큰 도로 구간마다 걸을 보도(진행 방향 기준 오른쪽/왼쪽)를 고른다.
 * 공공데이터에 횡단보도가 있는 교차로는 건너는 비용을 낮춰서, 횟수가 같으면 그곳에서 건너게 한다.
 */
final class SidewalkPlanner {

    private static final int RIGHT = 0;
    private static final int LEFT = 1;
    private static final double METERS_PER_DEG_LAT = 111_320;
    private static final double TWO_PI = 2 * Math.PI;
    // 횡단 한 번의 비용. 큰 도로끼리 만나는 교차로(팔 3개 이상)가 아닌 곳, 즉 골목 입구나 도로 중간에서 건너면
    // 비용을 더 줘서, 건너는 횟수가 같으면 신호등·횡단보도가 있을 가능성이 큰 교차로에서 건너게 한다
    private static final int CROSSING_COST = 10;
    private static final int MID_BLOCK_CROSSING_COST = 14;
    // 공공데이터(CrosswalkCatalog)에 횡단보도가 있는 교차로에서 건널 때의 비용
    private static final int KNOWN_CROSSING_COST = 8;

    record Result(List<RouteResponse.LatLng> geometry, List<RouteResponse.Crossing> crossings) {
    }

    private final Map<Long, List<Edge>> adjacency;
    private final CrosswalkCatalog crosswalkCatalog;
    private final Map<Long, Junction> junctions = new HashMap<>();
    private final double refLat;
    private final double refLng;
    private final double metersPerDegLng;

    SidewalkPlanner(Map<Long, List<Edge>> adjacency, CrosswalkCatalog crosswalkCatalog, double refLat, double refLng) {
        this.adjacency = adjacency;
        this.crosswalkCatalog = crosswalkCatalog;
        this.refLat = refLat;
        this.refLng = refLng;
        this.metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(Math.toRadians(refLat));
    }

    /**
     * @param origin      출발 노드와 떨어진 실제 출발 좌표 [위도, 경도]. 노드와 같은 지점이면 null
     * @param destination 도착 노드와 떨어진 실제 도착 좌표. 노드와 같은 지점이면 null
     */
    Result plan(Node start, List<Edge> edges, double[] origin, double[] destination) {
        List<double[]> points = new ArrayList<>();
        List<RouteResponse.Crossing> crossings = new ArrayList<>();
        if (origin != null) {
            points.add(toXY(origin[0], origin[1]));
        }

        Junction first = junction(start);
        if (edges.isEmpty()) {
            points.add(new double[]{first.x, first.y});
            if (destination != null) {
                points.add(toXY(destination[0], destination[1]));
            }
            return toResult(points, crossings);
        }

        int[] sides = chooseSides(first, edges, origin, destination);

        // 출발 교차로: 실제 출발 좌표 쪽 모퉁이에서 첫 구간의 보도로
        Edge firstEdge = edges.get(0);
        int departSector = departSector(first, firstEdge, sides[0]);
        int arriveSector = origin != null ? first.sectorOf(first.angleTo(toXY(origin[0], origin[1]))) : departSector;
        appendJunction(first, arriveSector, departSector, null, 0, firstEdge, sides[0], points, crossings);

        for (int i = 0; i < edges.size(); i++) {
            Edge edge = edges.get(i);
            List<double[]> shape = shape(edge, sides[i]);
            points.addAll(shape.subList(1, shape.size() - 1));

            Junction j = junction(edge.getToNode());
            int arrive = arriveSector(j, edge, sides[i]);
            Edge next = i + 1 < edges.size() ? edges.get(i + 1) : null;
            int depart;
            if (next != null) {
                depart = departSector(j, next, sides[i + 1]);
            } else if (destination != null) {
                depart = j.sectorOf(j.angleTo(toXY(destination[0], destination[1])));
            } else {
                depart = arrive;
            }
            appendJunction(j, arrive, depart, edge, sides[i], next, next != null ? sides[i + 1] : 0, points, crossings);
        }

        if (destination != null) {
            points.add(toXY(destination[0], destination[1]));
        }
        return toResult(points, crossings);
    }

    /** 경로를 따라가며 큰 도로 구간마다 오른쪽/왼쪽 보도 중 전체 횡단 비용이 최소가 되는 쪽을 고른다 (동적 계획법) */
    private int[] chooseSides(Junction first, List<Edge> edges, double[] origin, double[] destination) {
        int n = edges.size();
        int[][] cost = new int[n][2];
        int[][] prev = new int[n][2];

        for (int s = 0; s < options(edges.get(0)); s++) {
            cost[0][s] = origin == null ? 0
                    : first.crossingCost(first.sectorOf(first.angleTo(toXY(origin[0], origin[1]))),
                    departSector(first, edges.get(0), s));
        }
        for (int i = 1; i < n; i++) {
            Junction j = junction(edges.get(i).getFromNode());
            for (int s = 0; s < options(edges.get(i)); s++) {
                cost[i][s] = Integer.MAX_VALUE;
                for (int p = 0; p < options(edges.get(i - 1)); p++) {
                    int c = cost[i - 1][p] + j.crossingCost(
                            arriveSector(j, edges.get(i - 1), p), departSector(j, edges.get(i), s));
                    if (c < cost[i][s]) {
                        cost[i][s] = c;
                        prev[i][s] = p;
                    }
                }
            }
        }

        Edge last = edges.get(n - 1);
        Junction end = junction(last.getToNode());
        int best = 0;
        int bestCost = Integer.MAX_VALUE;
        for (int s = 0; s < options(last); s++) {
            int c = cost[n - 1][s] + (destination == null ? 0
                    : end.crossingCost(arriveSector(end, last, s),
                    end.sectorOf(end.angleTo(toXY(destination[0], destination[1])))));
            if (c < bestCost) {
                bestCost = c;
                best = s;
            }
        }

        int[] sides = new int[n];
        sides[n - 1] = best;
        for (int i = n - 1; i > 0; i--) {
            sides[i - 1] = prev[i][sides[i]];
        }
        return sides;
    }

    /** 교차로에서 도착 모퉁이 -> 출발 모퉁이까지 지나는 모퉁이 점을 잇고, 모퉁이 사이 구간을 횡단보도로 기록한다 */
    private void appendJunction(Junction j, int arrive, int depart, Edge in, int inSide, Edge out, int outSide,
                                List<double[]> points, List<RouteResponse.Crossing> crossings) {
        if (j.rayCount() < 2) {
            // 건널 큰 도로가 없는 교차로: 들어온 길 끝점과 나갈 길 시작점을 그대로 잇는다
            if (in != null) {
                List<double[]> shape = shape(in, inSide);
                points.add(shape.get(shape.size() - 1));
            }
            if (out != null) {
                points.add(shape(out, outSide).get(0));
            }
            if (in == null && out == null) {
                points.add(new double[]{j.x, j.y});
            }
            return;
        }
        List<Integer> sectors = j.sectorsBetween(arrive, depart);
        double[] previous = null;
        for (int sector : sectors) {
            double[] corner = j.corner(sector);
            if (previous != null) {
                crossings.add(new RouteResponse.Crossing(toLatLng(previous), toLatLng(corner), j.hasSignal));
            }
            points.add(corner);
            previous = corner;
        }
    }

    /** 간선의 그릴 모양(평면 좌표). 큰 도로는 고른 보도 쪽으로 평행 이동, 그 외는 도로 모양 그대로 */
    private List<double[]> shape(Edge edge, int side) {
        List<double[]> raw = new ArrayList<>();
        for (double[] p : edge.polyline()) {
            raw.add(toXY(p[0], p[1]));
        }
        double w = RoadType.halfWidthMeters(edge.getRoadType());
        if (w == 0) {
            return raw;
        }
        double sign = side == RIGHT ? 1 : -1;
        List<double[]> shifted = new ArrayList<>();
        for (int i = 0; i < raw.size(); i++) {
            // 앞뒤 선분의 오른쪽 법선을 더해 꼭짓점을 옮길 방향으로 쓴다
            double nx = 0;
            double ny = 0;
            for (int k = Math.max(0, i - 1); k < Math.min(raw.size() - 1, i + 1); k++) {
                double dx = raw.get(k + 1)[0] - raw.get(k)[0];
                double dy = raw.get(k + 1)[1] - raw.get(k)[1];
                double len = Math.hypot(dx, dy);
                if (len > 0) {
                    nx += dy / len;
                    ny += -dx / len;
                }
            }
            double len = Math.hypot(nx, ny);
            double[] p = raw.get(i);
            shifted.add(len == 0 ? p : new double[]{p[0] + sign * w * nx / len, p[1] + sign * w * ny / len});
        }
        return shifted;
    }

    private int options(Edge edge) {
        return RoadType.halfWidthMeters(edge.getRoadType()) > 0 ? 2 : 1;
    }

    /** edge로 교차로 j를 떠날 때 서 있는 모퉁이 구역 */
    private int departSector(Junction j, Edge edge, int side) {
        List<double[]> line = edge.polyline();
        double angle = j.angleTo(toXY(line.get(1)[0], line.get(1)[1]));
        if (options(edge) == 1) {
            return j.sectorOf(angle);
        }
        // 진행 방향 오른쪽 보도 = 그 도로 방향(팔)의 시계 방향 쪽 구역
        int ray = j.nearestRay(angle);
        return side == RIGHT ? j.previousSector(ray) : ray;
    }

    /** edge로 교차로 j에 도착했을 때 서 있는 모퉁이 구역 */
    private int arriveSector(Junction j, Edge edge, int side) {
        List<double[]> line = edge.polyline();
        double[] before = line.get(line.size() - 2);
        double angle = j.angleTo(toXY(before[0], before[1]));
        if (options(edge) == 1) {
            return j.sectorOf(angle);
        }
        // 들어오는 방향 오른쪽 보도 = 온 쪽 팔의 반시계 방향 쪽 구역
        int ray = j.nearestRay(angle);
        return side == RIGHT ? ray : j.previousSector(ray);
    }

    private Junction junction(Node node) {
        return junctions.computeIfAbsent(node.getId(), id -> new Junction(node));
    }

    private double[] toXY(double lat, double lng) {
        return new double[]{(lng - refLng) * metersPerDegLng, (lat - refLat) * METERS_PER_DEG_LAT};
    }

    private RouteResponse.LatLng toLatLng(double[] xy) {
        return new RouteResponse.LatLng(refLat + xy[1] / METERS_PER_DEG_LAT, refLng + xy[0] / metersPerDegLng);
    }

    private Result toResult(List<double[]> points, List<RouteResponse.Crossing> crossings) {
        List<RouteResponse.LatLng> geometry = new ArrayList<>();
        double[] last = null;
        for (double[] p : points) {
            if (last == null || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.01) {
                geometry.add(toLatLng(p));
                last = p;
            }
        }
        return new Result(geometry, crossings);
    }

    private static double normalize(double angle) {
        double a = angle % TWO_PI;
        return a < 0 ? a + TWO_PI : a;
    }

    /**
     * 교차로 하나. 큰 도로 방향(팔)을 각도순으로 정렬해 두고, 구역 k = 팔 k와 팔 k+1 사이(반시계 방향)로 본다.
     */
    private final class Junction {
        final double x;
        final double y;
        final double[] angles;
        final double[] widths;
        final boolean knownCrosswalk; // 공공데이터에 근처 횡단보도가 있음
        final boolean hasSignal;      // 그 횡단보도에 보행자 신호등이 있음

        Junction(Node node) {
            Optional<CrosswalkCatalog.Crosswalk> crosswalk =
                    crosswalkCatalog.near(node.getLatitude(), node.getLongitude());
            this.knownCrosswalk = crosswalk.isPresent();
            this.hasSignal = crosswalk.map(CrosswalkCatalog.Crosswalk::hasSignal).orElse(false);
            double[] c = toXY(node.getLatitude(), node.getLongitude());
            this.x = c[0];
            this.y = c[1];
            List<double[]> rays = new ArrayList<>();
            for (Edge e : adjacency.getOrDefault(node.getId(), List.of())) {
                double w = RoadType.halfWidthMeters(e.getRoadType());
                if (w > 0) {
                    double[] next = e.polyline().get(1);
                    rays.add(new double[]{angleTo(toXY(next[0], next[1])), w});
                }
            }
            rays.sort(Comparator.comparingDouble(r -> r[0]));
            angles = rays.stream().mapToDouble(r -> r[0]).toArray();
            widths = rays.stream().mapToDouble(r -> r[1]).toArray();
        }

        int rayCount() {
            return angles.length;
        }

        double angleTo(double[] p) {
            return normalize(Math.atan2(p[1] - y, p[0] - x));
        }

        int sectorOf(double angle) {
            if (angles.length == 0) {
                return 0;
            }
            double a = normalize(angle);
            for (int k = angles.length - 1; k >= 0; k--) {
                if (angles[k] <= a) {
                    return k;
                }
            }
            return angles.length - 1;
        }

        int nearestRay(double angle) {
            int best = 0;
            double bestDiff = Double.MAX_VALUE;
            for (int k = 0; k < angles.length; k++) {
                double d = Math.abs(normalize(angle - angles[k] + Math.PI) - Math.PI);
                if (d < bestDiff) {
                    bestDiff = d;
                    best = k;
                }
            }
            return best;
        }

        int previousSector(int ray) {
            return (ray - 1 + angles.length) % angles.length;
        }

        int crossingCost(int from, int to) {
            int m = angles.length;
            if (m < 2) {
                return 0;
            }
            int ccw = ((to - from) % m + m) % m;
            int cost = knownCrosswalk ? KNOWN_CROSSING_COST : m >= 3 ? CROSSING_COST : MID_BLOCK_CROSSING_COST;
            return Math.min(ccw, m - ccw) * cost;
        }

        /** from 구역에서 to 구역까지 적게 건너는 방향으로 지나는 구역 목록 (양 끝 포함) */
        List<Integer> sectorsBetween(int from, int to) {
            int m = angles.length;
            int ccw = ((to - from) % m + m) % m;
            int step = ccw <= m - ccw ? 1 : -1;
            List<Integer> sectors = new ArrayList<>();
            for (int k = from; ; k = ((k + step) % m + m) % m) {
                sectors.add(k);
                if (k == to) {
                    return sectors;
                }
            }
        }

        /** 구역의 모퉁이 점: 양쪽 도로의 보도선이 만나는 곳 */
        double[] corner(int sector) {
            int m = angles.length;
            int nextRay = (sector + 1) % m;
            double gap = normalize(angles[nextRay] - angles[sector]);
            double w = Math.max(widths[sector], widths[nextRay]);
            double sin = Math.sin(gap / 2);
            double distance = sin <= 1.0 / 3 ? 3 * w : w / sin; // 아주 좁은 모퉁이는 너무 멀어지지 않게 제한
            double direction = angles[sector] + gap / 2;
            return new double[]{x + distance * Math.cos(direction), y + distance * Math.sin(direction)};
        }
    }
}
