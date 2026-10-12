package com.safemate.helpmap.service;

import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;
import com.safemate.helpmap.util.GeoUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 중앙분리대가 있는 큰 도로(예: 산성대로)는 OSM에 상행/하행 차로가 따로 그려져 있고, 골목은 각 차로에 T자로만 붙어 있다.
 * 그래서 두 차로를 잇는 간선이 없는 구간에서는 바로 건너편으로 가는 경로도 차로가 이어진 먼 교차로까지 돌아간다.
 * <p>
 * 직접 찍은 횡단보도(crosswalks-surveyed.csv)가 서로 이어지지 않은 나란한 두 차로 사이에 있으면,
 * 양쪽 차로 간선의 끝 교차로끼리 그 횡단보도로 건너는 간선을 만든다 (DB에는 저장하지 않고 경로 계산 때만 쓴다).
 * 간선 모양은 "이쪽 교차로 -> 이쪽 보도의 횡단보도 끝 -> 건너편 보도의 횡단보도 끝 -> 건너편 교차로"이고,
 * SidewalkPlanner는 가운데 두 점 사이를 횡단보도로 그린다.
 */
final class MedianCrossings {

    static final String ROAD_TYPE = "crossing";

    private static final double METERS_PER_DEG_LAT = 111_320;
    // 횡단보도 좌표에서 각 차로 중심선까지 이 거리 안이어야 그 차로를 건너는 횡단보도로 본다
    private static final double MAX_OFFSET_METERS = 15;
    // 두 차로 중심선 사이 거리 범위
    private static final double MIN_GAP_METERS = 4;
    private static final double MAX_GAP_METERS = 40;
    // 횡단보도가 두 차로 "사이"에 있는지 판정할 때 허용 오차 (차로까지 거리 합 ≈ 차로 사이 거리)
    private static final double BETWEEN_TOLERANCE_METERS = 2;
    // 두 차로가 이 각도(30도) 안으로 나란해야 한 도로의 양쪽 차로로 본다
    private static final double PARALLEL_COS = Math.cos(Math.toRadians(30));
    // 간선 양 끝이 횡단보도에서 이보다 멀면 계산하지 않는다 (간선은 길어도 300m 안쪽)
    private static final double SEARCH_METERS = 400;

    /** 횡단보도에서 본 차로 간선 하나: 가장 가까운 점(평면 좌표, 횡단보도가 원점), 그 거리, 그 자리의 진행 방향 */
    private record Lane(Edge edge, double[] point, double offset, double[] direction) {
    }

    private MedianCrossings() {
    }

    /** 경로 계산용으로 추가할 횡단 간선(양방향)을 만든다. edges는 DB의 간선(양방향 모두 있음) */
    static List<Edge> build(List<Edge> edges, CrosswalkCatalog catalog) {
        List<Edge> roads = new ArrayList<>();
        Map<Long, Set<Long>> neighbors = new HashMap<>();
        for (Edge e : edges) {
            neighbors.computeIfAbsent(e.getFromNode().getId(), k -> new HashSet<>()).add(e.getToNode().getId());
            // 같은 도로가 양방향으로 두 번 있으므로 한 방향만 본다. 교차로 안 연결 차로(_link)는 본 도로와 겹쳐 있어서
            // 차로 한 쌍으로 잘못 잡히므로 뺀다 (예: 단대오거리 횡단보도가 광명로와 연결 차로 사이로 잡힘). 넓은 골목도 차로가 하나라 뺀다
            if (RoadType.mayBeDivided(e.getRoadType()) && e.getFromNode().getId() < e.getToNode().getId()) {
                roads.add(e);
            }
        }

        List<Edge> result = new ArrayList<>();
        for (CrosswalkCatalog.Crosswalk cw : catalog.surveyed()) {
            if (cw.diagonal()) {
                continue;
            }
            double metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(Math.toRadians(cw.latitude()));
            List<Lane> lanes = new ArrayList<>();
            for (Edge e : roads) {
                Lane lane = nearestPoint(e, cw, metersPerDegLng);
                if (lane != null && lane.offset() <= MAX_OFFSET_METERS) {
                    lanes.add(lane);
                }
            }
            Lane a = lanes.stream().min((x, y) -> Double.compare(x.offset(), y.offset())).orElse(null);
            if (a == null) {
                continue;
            }
            Lane b = null;
            for (Lane lane : lanes) {
                if (isOppositeLane(a, lane, neighbors) && (b == null || lane.offset() < b.offset())) {
                    b = lane;
                }
            }
            if (b != null) {
                addCrossings(a, b, cw, metersPerDegLng, result);
            }
        }
        return result;
    }

    /** lane이 a와 이어지지 않은 나란한 맞은편 차로이고, 횡단보도가 둘 사이에 있는지 */
    private static boolean isOppositeLane(Lane a, Lane lane, Map<Long, Set<Long>> neighbors) {
        if (connected(a.edge(), lane.edge(), neighbors)) {
            return false; // 이미 두 차로를 잇는 간선이 있으면 원래 그래프로 건널 수 있다
        }
        double dot = a.direction()[0] * lane.direction()[0] + a.direction()[1] * lane.direction()[1];
        if (Math.abs(dot) < PARALLEL_COS) {
            return false;
        }
        double gap = Math.hypot(lane.point()[0] - a.point()[0], lane.point()[1] - a.point()[1]);
        return gap >= MIN_GAP_METERS && gap <= MAX_GAP_METERS
                && Math.abs(a.offset() + lane.offset() - gap) <= BETWEEN_TOLERANCE_METERS;
    }

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

    /** 양쪽 차로 간선의 끝 교차로끼리(2 x 2) 횡단보도로 건너는 간선을 양방향으로 만든다 */
    private static void addCrossings(Lane a, Lane b, CrosswalkCatalog.Crosswalk cw, double metersPerDegLng,
                                     List<Edge> result) {
        // a 차로 -> b 차로 방향 단위 벡터. 횡단보도 끝은 각 차로 중심선에서 바깥쪽(보도 쪽)으로 도로 반폭만큼
        double ux = b.point()[0] - a.point()[0];
        double uy = b.point()[1] - a.point()[1];
        double len = Math.hypot(ux, uy);
        ux /= len;
        uy /= len;
        double wa = RoadType.halfWidthMeters(a.edge().getRoadType());
        double wb = RoadType.halfWidthMeters(b.edge().getRoadType());
        double[] endA = toLatLng(cw, metersPerDegLng, a.point()[0] - wa * ux, a.point()[1] - wa * uy);
        double[] endB = toLatLng(cw, metersPerDegLng, b.point()[0] + wb * ux, b.point()[1] + wb * uy);

        for (Node na : List.of(a.edge().getFromNode(), a.edge().getToNode())) {
            for (Node nb : List.of(b.edge().getFromNode(), b.edge().getToNode())) {
                double distance = GeoUtils.haversineMeters(na.getLatitude(), na.getLongitude(), endA[0], endA[1])
                        + GeoUtils.haversineMeters(endA[0], endA[1], endB[0], endB[1])
                        + GeoUtils.haversineMeters(endB[0], endB[1], nb.getLatitude(), nb.getLongitude());
                result.add(new Edge(na, nb, distance, ROAD_TYPE, geometry(na, endA, endB, nb)));
                result.add(new Edge(nb, na, distance, ROAD_TYPE, geometry(nb, endB, endA, na)));
            }
        }
    }

    private static String geometry(Node from, double[] p, double[] q, Node to) {
        return String.format(Locale.ROOT, "%.7f %.7f;%.7f %.7f;%.7f %.7f;%.7f %.7f",
                from.getLatitude(), from.getLongitude(), p[0], p[1], q[0], q[1], to.getLatitude(), to.getLongitude());
    }

    /** 간선 도로 모양에서 횡단보도와 가장 가까운 점. 간선이 너무 멀면 null */
    private static Lane nearestPoint(Edge edge, CrosswalkCatalog.Crosswalk cw, double metersPerDegLng) {
        if (GeoUtils.haversineMeters(cw.latitude(), cw.longitude(),
                edge.getFromNode().getLatitude(), edge.getFromNode().getLongitude()) > SEARCH_METERS
                && GeoUtils.haversineMeters(cw.latitude(), cw.longitude(),
                edge.getToNode().getLatitude(), edge.getToNode().getLongitude()) > SEARCH_METERS) {
            return null;
        }
        List<double[]> line = new ArrayList<>();
        for (double[] p : edge.polyline()) {
            line.add(new double[]{(p[1] - cw.longitude()) * metersPerDegLng, (p[0] - cw.latitude()) * METERS_PER_DEG_LAT});
        }
        Lane best = null;
        for (int i = 0; i + 1 < line.size(); i++) {
            double[] s = line.get(i);
            double[] t = line.get(i + 1);
            double dx = t[0] - s[0];
            double dy = t[1] - s[1];
            double segment = Math.hypot(dx, dy);
            if (segment == 0) {
                continue;
            }
            // 원점(횡단보도)을 선분에 투영
            double k = Math.max(0, Math.min(1, -(s[0] * dx + s[1] * dy) / (segment * segment)));
            double[] point = {s[0] + k * dx, s[1] + k * dy};
            double offset = Math.hypot(point[0], point[1]);
            if (best == null || offset < best.offset()) {
                best = new Lane(edge, point, offset, new double[]{dx / segment, dy / segment});
            }
        }
        return best;
    }

    private static double[] toLatLng(CrosswalkCatalog.Crosswalk origin, double metersPerDegLng, double x, double y) {
        return new double[]{origin.latitude() + y / METERS_PER_DEG_LAT, origin.longitude() + x / metersPerDegLng};
    }
}
