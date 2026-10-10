package com.safemate.helpmap.service;

import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;
import com.safemate.helpmap.util.GeoUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 출발/도착 좌표(건물 위치)를 가장 가까운 도로 위 지점에 붙인 결과.
 * 예전에는 가장 가까운 교차로로 바로 이어서 건물에서 교차로까지 담장·건물을 가로지르는 직선이 그려졌다.
 * 이제는 건물에서 가장 가까운 도로로 나와서, 그 도로를 따라 양 끝 교차로 중 유리한 쪽으로 간다.
 */
final class RoadSnap {

    // 도로 위 지점이 간선 끝 교차로와 이보다 가까우면 그 교차로에 붙은 것으로 본다 (길이 0에 가까운 부분 간선을 만들지 않음)
    private static final double NODE_SNAP_METERS = 1;
    // 이보다 먼 도로는 붙일 후보로 보지 않는다 (가로막는 도로 검사도 이 안의 도로만 본다)
    private static final double SEARCH_METERS = 300;
    // 가까운 순으로 이만큼까지 "다른 도로에 가로막혔는지" 확인하고, 모두 막히면 가장 가까운 도로에 붙인다
    private static final int MAX_TRIES = 10;
    // 도로명주소가 큰 길 이름일 때, 보도까지 이 거리 안의 큰 도로를 먼저 붙인다
    private static final double MAIN_ROAD_METERS = 25;
    // 도로명주소에서 "도로명 + 건물번호" 부분 (예: "광명로 319", "산성대로 지하 365", "광명로323번길 25-1")
    private static final Pattern ROAD_ADDRESS = Pattern.compile("(\\S+(?:로|길))\\s+(?:지하\\s+)?\\d");

    /**
     * 도로명주소의 도로가 큰 길 이름인지. "번길"이 붙은 도로명(예: 광명로323번길)은 큰 길에서 갈라진 골목이고,
     * 지번 주소(예: 신흥동 2467)나 주소가 없으면 판단하지 않는다
     */
    static boolean facesMainRoad(String address) {
        if (address == null) {
            return false;
        }
        Matcher m = ROAD_ADDRESS.matcher(address);
        return m.find() && !m.group(1).contains("번길");
    }

    final Edge edge;          // 붙은 간선 (방향은 fromNode -> toNode)
    final double latitude;    // 도로 위 지점
    final double longitude;
    private final List<double[]> towardFrom; // 도로 위 지점 -> fromNode 도로 모양 (양 끝 포함)
    private final List<double[]> towardTo;   // 도로 위 지점 -> toNode 도로 모양 (양 끝 포함)

    private RoadSnap(Edge edge, double[] point, List<double[]> towardFrom, List<double[]> towardTo) {
        this.edge = edge;
        this.latitude = point[0];
        this.longitude = point[1];
        this.towardFrom = towardFrom;
        this.towardTo = towardTo;
    }

    /** 붙일 후보 간선: 좌표에서 가장 가까운 선분 위치, 보도까지 거리, 그 지점(평면 좌표, 원래 좌표가 원점) */
    private record Candidate(Edge edge, List<double[]> xy, int segment, double t, double offset, double[] point) {
    }

    /**
     * 좌표(건물)를 붙일 도로 위 지점. 중앙분리대 횡단 간선처럼 실제 도로가 아닌 간선은 제외한다.
     * <ul>
     *   <li>건물은 큰 도로의 중심선이 아니라 보도에 붙어 있다. 중심선 거리로 비교하면 넓은 큰 도로가 실제보다 멀게 나와서
     *       큰 도로에 입구가 있는 가게도 뒷골목에 붙으므로(예: 광명로 배스킨라빈스) 보도까지 거리로 비교한다.</li>
     *   <li>다만 건물에서 그 도로까지 가는 직선이 다른 도로를 가로지르면 그 도로는 다른 도로 뒤에 있는 것이라 건너뛴다
     *       (예: 산성해장국 앞은 광명로 차로보다 진입로가 먼저 있어서, 차로에 붙이면 차로 끝 교차로까지 돌아간다).</li>
     *   <li>preferMainRoad면(도로명주소가 큰 길 이름) 보도 거리 MAIN_ROAD_METERS 안의 큰 도로를 먼저 본다.
     *       카카오 좌표는 건물 한가운데라 큰 길에서 25m쯤 떨어지기도 해서, 거리만 보면 건물 뒤 골목에 붙는다
     *       (예: "광명로 319" 파리바게뜨는 광명로 보도까지 16m, 뒷골목까지 7m).</li>
     * </ul>
     */
    static RoadSnap nearest(List<Edge> edges, double lat, double lng, boolean preferMainRoad) {
        double metersPerDegLng = GeoUtils.haversineMeters(lat, lng, lat, lng + 1);
        double metersPerDegLat = GeoUtils.haversineMeters(lat, lng, lat + 1, lng);
        List<Candidate> candidates = new ArrayList<>();
        for (Edge edge : edges) {
            if (edge.getId() == null) {
                continue;
            }
            List<double[]> xy = new ArrayList<>();
            for (double[] p : edge.polyline()) {
                xy.add(new double[]{(p[1] - lng) * metersPerDegLng, (p[0] - lat) * metersPerDegLat});
            }
            double halfWidth = RoadType.halfWidthMeters(edge.getRoadType());
            Candidate best = null;
            for (int i = 0; i + 1 < xy.size(); i++) {
                // 원점(좌표)을 선분에 투영
                double[] a = xy.get(i);
                double dx = xy.get(i + 1)[0] - a[0];
                double dy = xy.get(i + 1)[1] - a[1];
                double len2 = dx * dx + dy * dy;
                double t = len2 == 0 ? 0 : Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len2));
                double[] point = {a[0] + t * dx, a[1] + t * dy};
                // 좌표가 큰 도로 안쪽(역·교차로 한가운데 등)이면 음수: 도로 안으로 깊이 들어가 있을수록 그 도로에 붙인다.
                // 0으로 자르면 교차로 안에서 여러 도로가 같은 값이 되어 엉뚱한 차로에 붙는다
                double offset = Math.hypot(point[0], point[1]) - halfWidth;
                if (best == null || offset < best.offset()) {
                    best = new Candidate(edge, xy, i, t, offset, point);
                }
            }
            if (best != null && best.offset() <= SEARCH_METERS) {
                candidates.add(best);
            }
        }
        if (candidates.isEmpty()) {
            return null;
        }
        candidates.sort(Comparator.comparingDouble(Candidate::offset));
        Candidate chosen = null;
        if (preferMainRoad) {
            for (Candidate c : candidates) {
                if (c.offset() > MAIN_ROAD_METERS) {
                    break;
                }
                if (RoadType.halfWidthMeters(c.edge().getRoadType()) > 0 && !blocked(c, candidates)) {
                    chosen = c;
                    break;
                }
            }
        }
        if (chosen == null) {
            chosen = candidates.get(0);
            for (Candidate c : candidates.subList(0, Math.min(MAX_TRIES, candidates.size()))) {
                if (!blocked(c, candidates)) {
                    chosen = c;
                    break;
                }
            }
        }

        List<double[]> line = chosen.edge().polyline();
        double[] a = line.get(chosen.segment());
        double[] b = line.get(chosen.segment() + 1);
        double t = chosen.t();
        double[] point = {a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])};
        int bestSegment = chosen.segment();

        List<double[]> towardFrom = new ArrayList<>();
        towardFrom.add(point);
        for (int i = bestSegment; i >= 0; i--) {
            towardFrom.add(line.get(i));
        }
        List<double[]> towardTo = new ArrayList<>();
        towardTo.add(point);
        for (int i = bestSegment + 1; i < line.size(); i++) {
            towardTo.add(line.get(i));
        }
        return new RoadSnap(chosen.edge(), point, towardFrom, towardTo);
    }

    /** 원점(건물)에서 후보 도로 위 지점까지 직선이 다른 도로를 가로지르는지. 같은 도로(끝 교차로를 공유하는 간선)는 제외 */
    private static boolean blocked(Candidate target, List<Candidate> others) {
        Long from = target.edge().getFromNode().getId();
        Long to = target.edge().getToNode().getId();
        double[] origin = {0, 0};
        for (Candidate other : others) {
            Long otherFrom = other.edge().getFromNode().getId();
            Long otherTo = other.edge().getToNode().getId();
            if (from.equals(otherFrom) || from.equals(otherTo) || to.equals(otherFrom) || to.equals(otherTo)) {
                continue;
            }
            List<double[]> xy = other.xy();
            for (int i = 0; i + 1 < xy.size(); i++) {
                if (segmentsCross(origin, target.point(), xy.get(i), xy.get(i + 1))) {
                    return true;
                }
            }
        }
        return false;
    }

    /** 두 선분이 서로 가로지르는지 (끝점이 닿기만 하는 경우는 제외) */
    private static boolean segmentsCross(double[] a, double[] b, double[] c, double[] d) {
        return orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0;
    }

    private static double orientation(double[] p, double[] q, double[] r) {
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    }

    /** 도로 위 지점에서 간선 양 끝 교차로 (fromNode, toNode) */
    List<Node> ends() {
        return List.of(edge.getFromNode(), edge.getToNode());
    }

    /** 도로 위 지점에서 node(간선 끝 교차로)까지 도로를 따라간 거리(m) */
    double metersTo(Node node) {
        return length(node.getId().equals(edge.getFromNode().getId()) ? towardFrom : towardTo);
    }

    /** 이 지점이 node(간선 끝 교차로)와 사실상 같은 곳인지 */
    boolean isAt(Node node) {
        return metersTo(node) < NODE_SNAP_METERS;
    }

    /**
     * 출발/도착 지점이 같은 도로(간선) 위에 있을 때 둘을 도로를 따라 바로 잇는 간선 (교차로까지 갔다 오지 않게).
     * 다른 도로면 null
     */
    Edge directEdge(RoadSnap goal, Node startNode, Node goalNode) {
        boolean sameRoad = edge.getFromNode().getId().equals(goal.edge.getFromNode().getId())
                && edge.getToNode().getId().equals(goal.edge.getToNode().getId())
                || edge.getFromNode().getId().equals(goal.edge.getToNode().getId())
                && edge.getToNode().getId().equals(goal.edge.getFromNode().getId());
        if (!sameRoad) {
            return null;
        }
        // 이 간선의 fromNode에서 각 지점까지 거리로 위치를 비교하고, 그 사이의 도로 모양 점을 순서대로 넣는다
        Node from = edge.getFromNode();
        double startAt = metersTo(from);
        double goalAt = goal.metersTo(from);
        List<double[]> line = edge.polyline();
        List<double[]> between = new ArrayList<>();
        double walked = 0;
        for (int i = 0; i < line.size(); i++) {
            if (i > 0) {
                walked += GeoUtils.haversineMeters(line.get(i - 1)[0], line.get(i - 1)[1], line.get(i)[0], line.get(i)[1]);
            }
            if (walked > Math.min(startAt, goalAt) && walked < Math.max(startAt, goalAt)) {
                between.add(line.get(i));
            }
        }
        if (startAt > goalAt) {
            Collections.reverse(between);
        }
        List<double[]> shape = new ArrayList<>();
        shape.add(new double[]{latitude, longitude});
        shape.addAll(between);
        shape.add(new double[]{goal.latitude, goal.longitude});
        return new Edge(startNode, goalNode, length(shape), edge.getRoadType(), geometry(shape));
    }

    /**
     * 경로 계산용 부분 간선. outbound면 (출발) 도로 위 지점 -> node, 아니면 node -> (도착) 도로 위 지점.
     * 도로 위 지점은 DB에 없는 노드(id 없음)로 만들고, 도로 종류는 원래 간선과 같게 둔다.
     */
    Edge partialEdge(Node node, Node snapNode, boolean outbound) {
        List<double[]> shape = new ArrayList<>(node.getId().equals(edge.getFromNode().getId()) ? towardFrom : towardTo);
        if (!outbound) {
            Collections.reverse(shape);
        }
        return outbound
                ? new Edge(snapNode, node, length(shape), edge.getRoadType(), geometry(shape))
                : new Edge(node, snapNode, length(shape), edge.getRoadType(), geometry(shape));
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
