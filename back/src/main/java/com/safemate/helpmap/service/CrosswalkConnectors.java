package com.safemate.helpmap.service;

import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;
import com.safemate.helpmap.util.GeoUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 직접 찍은 횡단보도 건너편에 있는 길이 OSM에서 큰 도로와 이어져 있지 않은 곳을 잇는다.
 * 예: 신구대 캠퍼스 도로는 금빛로 동쪽에 나란히 있고 금빛로77번길 앞 횡단보도 건너편까지 와 있는데,
 * OSM에는 금빛로와 잇는 길이 없어서 캠퍼스에서 횡단보도로 가는 경로가 남쪽 광명로 교차로까지 돌아갔다.
 * <p>
 * 횡단보도가 놓인 큰 도로 간선의 양쪽 보도 끝에서 CONNECT_METERS 안에, 그 큰 도로와 이어지지 않은 작은 길이 있으면
 * "횡단보도에 가까운 큰 도로 교차로 -> 보도 끝 -> 작은 길 위 지점 -> 작은 길 양 끝 교차로" 간선을 만든다
 * (DB에는 저장하지 않고 경로 계산 때만 쓴다). 길을 건너는 비용과 횡단보도 그리기는 SidewalkPlanner가 그 교차로에서 처리한다.
 * 사람이 확인한 횡단보도에서만 만들어서, 담장으로 막힌 곳을 잇는 일이 없게 한다.
 */
final class CrosswalkConnectors {

    static final String ROAD_TYPE = "footway";

    private static final double METERS_PER_DEG_LAT = 111_320;
    // 횡단보도가 큰 도로 중심선에서 이 거리 안이어야 그 도로 위의 횡단보도로 본다 (SidewalkPlanner.SURVEYED_SNAP_METERS와 같음)
    private static final double ON_ROAD_METERS = 10;
    // 보도 끝에서 이 거리 안의 작은 길만 잇는다 (신구대 캠퍼스 도로는 약 12m)
    private static final double CONNECT_METERS = 15;
    // 횡단보도가 큰 도로 교차로에서 이 거리 안이어야 그 교차로에서 잇는다 (CrosswalkCatalog.MATCH_METERS와 같음)
    private static final double JUNCTION_METERS = CrosswalkCatalog.MATCH_METERS;

    private CrosswalkConnectors() {
    }

    /** 경로 계산용으로 추가할 연결 간선(양방향)을 만든다. edges는 DB의 간선(양방향 모두 있음) */
    static List<Edge> build(List<Edge> edges, CrosswalkCatalog catalog) {
        List<Edge> roads = new ArrayList<>();
        List<Edge> smallRoads = new ArrayList<>();
        Map<Long, Set<Long>> neighbors = new HashMap<>();
        for (Edge e : edges) {
            if (e.getId() == null) {
                continue;
            }
            neighbors.computeIfAbsent(e.getFromNode().getId(), k -> new HashSet<>()).add(e.getToNode().getId());
            if (RoadType.halfWidthMeters(e.getRoadType()) > 0) {
                if (e.getFromNode().getId() < e.getToNode().getId()) {
                    roads.add(e); // 같은 도로가 양방향으로 두 번 있으므로 한 방향만 본다
                }
            } else {
                smallRoads.add(e);
            }
        }

        List<Edge> result = new ArrayList<>();
        for (CrosswalkCatalog.Crosswalk cw : catalog.surveyed()) {
            if (cw.diagonal()) {
                continue;
            }
            double metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(Math.toRadians(cw.latitude()));
            double[] onRoad = null; // {x, y, 진행방향 x, 진행방향 y, 거리}
            Edge road = null;
            for (Edge e : roads) {
                double[] p = nearestPoint(e, cw, metersPerDegLng);
                if (p != null && p[4] <= ON_ROAD_METERS && (onRoad == null || p[4] < onRoad[4])) {
                    onRoad = p;
                    road = e;
                }
            }
            if (road == null) {
                continue;
            }
            Node junction = nearerEnd(road, cw);
            if (GeoUtils.haversineMeters(cw.latitude(), cw.longitude(), junction.getLatitude(), junction.getLongitude())
                    > JUNCTION_METERS) {
                continue;
            }
            double w = RoadType.halfWidthMeters(road.getRoadType());
            // 진행 방향의 오른쪽(dy, -dx)과 왼쪽 보도 끝
            for (int sign : new int[]{1, -1}) {
                double[] end = toLatLng(cw, metersPerDegLng,
                        onRoad[0] + sign * w * onRoad[3], onRoad[1] - sign * w * onRoad[2]);
                connect(junction, road, end, smallRoads, neighbors, result);
            }
        }
        return result;
    }

    /** 보도 끝 end 가까이에 큰 도로와 이어지지 않은 작은 길이 있으면 junction에서 그 길의 양 끝 교차로까지 간선을 만든다 */
    private static void connect(Node junction, Edge road, double[] end, List<Edge> smallRoads,
                                Map<Long, Set<Long>> neighbors, List<Edge> result) {
        List<Edge> candidates = new ArrayList<>();
        for (Edge e : smallRoads) {
            if (!connected(road, e, neighbors)) {
                candidates.add(e);
            }
        }
        RoadSnap snap = RoadSnap.nearest(candidates, end[0], end[1], false);
        if (snap == null
                || GeoUtils.haversineMeters(end[0], end[1], snap.latitude, snap.longitude) > CONNECT_METERS) {
            return;
        }
        Node point = new Node("횡단보도 연결", snap.latitude, snap.longitude);
        for (Node target : snap.ends()) {
            // 보도 끝 -> 작은 길 위 지점 -> 그 길을 따라 target까지 (target에 붙은 지점이면 바로 target)
            List<double[]> shape = new ArrayList<>();
            shape.add(new double[]{junction.getLatitude(), junction.getLongitude()});
            shape.add(end);
            if (snap.isAt(target)) {
                shape.add(new double[]{target.getLatitude(), target.getLongitude()});
            } else {
                shape.addAll(snap.partialEdge(target, point, true).polyline());
            }
            double distance = length(shape);
            List<double[]> reversed = new ArrayList<>(shape);
            Collections.reverse(reversed);
            result.add(new Edge(junction, target, distance, ROAD_TYPE, geometry(shape)));
            result.add(new Edge(target, junction, distance, ROAD_TYPE, geometry(reversed)));
        }
    }

    /** 두 간선이 끝 교차로를 공유하거나 바로 이웃한 교차로에 붙어 있는지 (이미 원래 그래프로 오갈 수 있는 길) */
    private static boolean connected(Edge x, Edge y, Map<Long, Set<Long>> neighbors) {
        for (Node p : List.of(x.getFromNode(), x.getToNode())) {
            for (Node q : List.of(y.getFromNode(), y.getToNode())) {
                if (p.getId().equals(q.getId())
                        || neighbors.getOrDefault(p.getId(), Set.of()).contains(q.getId())) {
                    return true;
                }
            }
        }
        return false;
    }

    private static Node nearerEnd(Edge road, CrosswalkCatalog.Crosswalk cw) {
        Node a = road.getFromNode();
        Node b = road.getToNode();
        return GeoUtils.haversineMeters(cw.latitude(), cw.longitude(), a.getLatitude(), a.getLongitude())
                <= GeoUtils.haversineMeters(cw.latitude(), cw.longitude(), b.getLatitude(), b.getLongitude()) ? a : b;
    }

    /** 간선 도로 모양에서 횡단보도와 가장 가까운 점(평면 좌표, 횡단보도가 원점): {x, y, 진행방향 x, 진행방향 y, 거리} */
    private static double[] nearestPoint(Edge edge, CrosswalkCatalog.Crosswalk cw, double metersPerDegLng) {
        List<double[]> line = new ArrayList<>();
        for (double[] p : edge.polyline()) {
            line.add(new double[]{(p[1] - cw.longitude()) * metersPerDegLng, (p[0] - cw.latitude()) * METERS_PER_DEG_LAT});
        }
        double[] best = null;
        for (int i = 0; i + 1 < line.size(); i++) {
            double[] s = line.get(i);
            double[] t = line.get(i + 1);
            double dx = t[0] - s[0];
            double dy = t[1] - s[1];
            double segment = Math.hypot(dx, dy);
            if (segment == 0) {
                continue;
            }
            double k = Math.max(0, Math.min(1, -(s[0] * dx + s[1] * dy) / (segment * segment)));
            double x = s[0] + k * dx;
            double y = s[1] + k * dy;
            double offset = Math.hypot(x, y);
            if (best == null || offset < best[4]) {
                best = new double[]{x, y, dx / segment, dy / segment, offset};
            }
        }
        return best;
    }

    private static double[] toLatLng(CrosswalkCatalog.Crosswalk origin, double metersPerDegLng, double x, double y) {
        return new double[]{origin.latitude() + y / METERS_PER_DEG_LAT, origin.longitude() + x / metersPerDegLng};
    }

    private static String geometry(List<double[]> shape) {
        StringBuilder geometry = new StringBuilder();
        for (double[] p : shape) {
            if (!geometry.isEmpty()) {
                geometry.append(';');
            }
            geometry.append(String.format(Locale.ROOT, "%.7f %.7f", p[0], p[1]));
        }
        return geometry.toString();
    }

    private static double length(List<double[]> line) {
        double total = 0;
        for (int i = 0; i + 1 < line.size(); i++) {
            total += GeoUtils.haversineMeters(line.get(i)[0], line.get(i)[1], line.get(i + 1)[0], line.get(i + 1)[1]);
        }
        return total;
    }
}
