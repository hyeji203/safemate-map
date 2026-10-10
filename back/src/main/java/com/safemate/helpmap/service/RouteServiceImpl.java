package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.RouteResponse;
import com.safemate.helpmap.dto.RoutesResponse;
import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;
import com.safemate.helpmap.repository.EdgeRepository;
import com.safemate.helpmap.repository.ReportRepository;
import com.safemate.helpmap.repository.StreetLightRepository;
import com.safemate.helpmap.util.GeoUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.function.Function;
import java.util.function.ToDoubleFunction;
import java.util.function.ToLongFunction;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RouteServiceImpl implements RouteService {

    // 도보 속도 약 4km/h
    private static final double WALKING_METERS_PER_MINUTE = 4000.0 / 60;
    // 위험도 1(가로등 없음)인 간선의 비용을 거리의 (1 + 이 값)배로 계산. 클수록 멀리 돌아서라도 밝은 길을 택한다
    private static final double RISK_PENALTY = 2.0;
    // 요청 좌표 <-> 도로 위 지점 거리가 이보다 작으면 사실상 같은 지점으로 보고 별도 구간을 만들지 않는다
    private static final double SNAP_GAP_THRESHOLD_METERS = 3;
    // 임시 출발/도착 노드(도로 위 지점)의 다익스트라 키. DB id는 양수라 겹치지 않는다
    private static final long START_KEY = -1;
    private static final long GOAL_KEY = -2;
    private static final EdgeRisk NO_RISK = new EdgeRisk(0, 0);
    // 탐색은 차도 중심선 길이로 거리를 재서, 큰 교차로(예: 단대오거리)처럼 차로·연결 차로 노드가 얽힌 곳을 지나는 경로는
    // 실제로 걷는 길(모퉁이에서 바로 건넘)보다 훨씬 길게 잡힌다. 그래서 후보 경로를 몇 개 더 찾아
    // 실제로 그려지는 길이로 다시 비교한다. 후보는 앞서 찾은 경로의 간선에 벌점을 주고 다시 탐색해서 얻는다
    private static final int ROUTE_CANDIDATES = 4;
    private static final double ALTERNATIVE_PENALTY = 1.3;

    private final EdgeRepository edgeRepository;
    private final StreetLightRepository streetLightRepository;
    private final ReportRepository reportRepository;
    private final RiskWeightCalculator riskWeightCalculator;
    private final CrosswalkCatalog crosswalkCatalog;

    @Override
    public RoutesResponse findRoutes(double fromLat, double fromLng, double toLat, double toLng,
                                     String fromAddress, String toAddress) {
        List<Edge> edges = new ArrayList<>(edgeRepository.findAllWithNodes());
        if (edges.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "보행로 데이터가 없습니다.");
        }
        // 제보를 등록하면 다음 경로 요청부터 바로 반영되도록, 요청마다 최신 제보를 읽어 위험도를 계산한다
        Map<Long, EdgeRisk> risks = riskWeightCalculator.calculate(
                edges, streetLightRepository.findAll(), reportRepository.findAll());
        // 중앙분리대 도로의 두 차로를 직접 찍은 횡단보도로 잇는 간선 (DB에 없어서 id가 없다)
        edges.addAll(MedianCrossings.build(edges, crosswalkCatalog));

        Map<Long, List<Edge>> adjacency = new HashMap<>();
        for (Edge edge : edges) {
            adjacency.computeIfAbsent(edge.getFromNode().getId(), k -> new ArrayList<>()).add(edge);
        }

        // 출발/도착 좌표(건물 위치)는 가장 가까운 도로 위 지점으로 나와서, 그 도로를 따라 양 끝 교차로 중 유리한 쪽으로 간다
        // 도로명주소가 큰 길 이름이면(예: "광명로 319") 출입구가 그 길에 있으므로 가까운 큰 도로를 먼저 본다
        RoadSnap fromSnap = RoadSnap.nearest(edges, fromLat, fromLng, RoadSnap.facesMainRoad(fromAddress));
        RoadSnap toSnap = RoadSnap.nearest(edges, toLat, toLng, RoadSnap.facesMainRoad(toAddress));
        Node start = snapNode(fromSnap, "출발 지점");
        Node goal = snapNode(toSnap, "도착 지점");

        // 도로 위 지점 <-> 양 끝 교차로 부분 간선은 경로 탐색용 그래프에만 넣는다
        // (보도 계산용 adjacency에 넣으면 교차로에서 같은 도로가 두 번 잡힌다)
        Map<Edge, EdgeRisk> partialRisks = new IdentityHashMap<>();
        Map<Long, List<Edge>> searchGraph = new HashMap<>(adjacency);
        if (start.getId() == null) {
            List<Edge> outs = new ArrayList<>();
            for (Node end : fromSnap.ends()) {
                Edge partial = fromSnap.partialEdge(end, start, true);
                partialRisks.put(partial, risks.get(fromSnap.edge.getId()));
                outs.add(partial);
            }
            Edge direct = goal.getId() == null ? fromSnap.directEdge(toSnap, start, goal) : null;
            if (direct != null) {
                partialRisks.put(direct, risks.get(fromSnap.edge.getId()));
                outs.add(direct);
            }
            searchGraph.put(START_KEY, outs);
        }
        if (goal.getId() == null) {
            for (Node end : toSnap.ends()) {
                Edge partial = toSnap.partialEdge(end, goal, false);
                partialRisks.put(partial, risks.get(toSnap.edge.getId()));
                List<Edge> outs = new ArrayList<>(searchGraph.getOrDefault(end.getId(), List.of()));
                outs.add(partial);
                searchGraph.put(end.getId(), outs);
            }
        }
        // 부분 간선은 원래 도로의 위험도, MedianCrossings 횡단 간선은 차도 가로등이 있는 큰 도로를 건너는 짧은 구간이라 0
        Function<Edge, EdgeRisk> riskOf = e -> e.getId() != null ? risks.get(e.getId())
                : partialRisks.getOrDefault(e, NO_RISK);

        // 출발/도착 좌표가 도로 위 지점과 떨어져 있으면 그 좌표 쪽 모퉁이·보도에서 출발/도착한다
        double[] origin = gapOver(fromLat, fromLng, start) ? new double[]{fromLat, fromLng} : null;
        double[] destination = gapOver(toLat, toLng, goal) ? new double[]{toLat, toLng} : null;

        // 도보 비용 = 거리 x 도로 종류 배율(큰 차도/계단은 피함). 안심경로는 여기에 위험도 가중을 더한다.
        // 길을 건너는 비용(횡단보도가 있는 곳은 싸게, 없는 곳은 비싸게)은 SidewalkPlanner.search가 더한다.
        ToDoubleFunction<Edge> walkingCost = e -> e.getDistanceMeters() * RoadType.walkingFactor(e.getRoadType());
        SidewalkPlanner sidewalks = new SidewalkPlanner(adjacency, crosswalkCatalog, start.getLatitude(), start.getLongitude());
        ToLongFunction<Node> keys = n -> keyOf(n, start, goal);
        ToDoubleFunction<Edge> safeCost = e -> walkingCost.applyAsDouble(e) * (1 + RISK_PENALTY * riskOf.apply(e).total());
        Planned shortest = bestRoute(sidewalks, start, goal, searchGraph, keys, walkingCost, origin, destination);
        Planned safe = bestRoute(sidewalks, start, goal, searchGraph, keys, safeCost, origin, destination);
        if (shortest == null || safe == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "출발지와 도착지를 잇는 경로가 없습니다.");
        }

        return new RoutesResponse(
                toResponse(fromLat, fromLng, toLat, toLng, start, goal, shortest, riskOf, origin, destination),
                toResponse(fromLat, fromLng, toLat, toLng, start, goal, safe, riskOf, origin, destination));
    }

    /** 고른 경로와 그 경로를 지도에 그릴 모양 */
    private record Planned(SidewalkPlanner.Route route, SidewalkPlanner.Result drawn) {
    }

    /**
     * 후보 경로를 ROUTE_CANDIDATES개까지 찾아, 탐색 비용을 실제로 그려지는 길이 비율로 고친 값이 가장 작은 경로.
     * 그려지는 길이는 큰 교차로를 모퉁이에서 바로 건너는 모양이라 실제로 걷는 거리에 가깝다
     */
    private Planned bestRoute(SidewalkPlanner sidewalks, Node start, Node goal, Map<Long, List<Edge>> graph,
                              ToLongFunction<Node> keys, ToDoubleFunction<Edge> cost,
                              double[] origin, double[] destination) {
        Set<Edge> used = Collections.newSetFromMap(new IdentityHashMap<>());
        List<List<Edge>> seen = new ArrayList<>();
        Planned best = null;
        double bestScore = Double.MAX_VALUE;
        for (int k = 0; k < ROUTE_CANDIDATES; k++) {
            ToDoubleFunction<Edge> penalized = e -> cost.applyAsDouble(e) * (used.contains(e) ? ALTERNATIVE_PENALTY : 1);
            SidewalkPlanner.Route route = sidewalks.search(start, goal, graph, keys, penalized, origin, destination);
            if (route == null) {
                break;
            }
            used.addAll(route.edges());
            if (seen.contains(route.edges())) {
                continue; // 벌점을 줘도 같은 길이면 다른 후보가 없는 것
            }
            seen.add(route.edges());
            SidewalkPlanner.Result drawn = sidewalks.plan(start, route.edges(), route.sides(), origin, destination);
            double graphLength = graphLength(start, goal, route, origin, destination);
            double score = sidewalks.cost(start, route, keys, cost, origin, destination)
                    * (graphLength > 0 ? length(drawn.geometry()) / graphLength : 1);
            if (score < bestScore) {
                bestScore = score;
                best = new Planned(route, drawn);
            }
        }
        return best;
    }

    /** 그래프 간선 길이 합 + 요청 좌표와 도로 위 지점 사이 (탐색 비용이 재는 거리와 같은 기준) */
    private static double graphLength(Node start, Node goal, SidewalkPlanner.Route route,
                                      double[] origin, double[] destination) {
        double total = 0;
        for (Edge edge : route.edges()) {
            total += edge.getDistanceMeters();
        }
        if (origin != null) {
            total += GeoUtils.haversineMeters(origin[0], origin[1], start.getLatitude(), start.getLongitude());
        }
        if (destination != null) {
            total += GeoUtils.haversineMeters(goal.getLatitude(), goal.getLongitude(), destination[0], destination[1]);
        }
        return total;
    }

    /** 그리는 선의 길이 */
    private static double length(List<RouteResponse.LatLng> line) {
        double total = 0;
        for (int i = 0; i + 1 < line.size(); i++) {
            RouteResponse.LatLng a = line.get(i);
            RouteResponse.LatLng b = line.get(i + 1);
            total += GeoUtils.haversineMeters(a.latitude(), a.longitude(), b.latitude(), b.longitude());
        }
        return total;
    }

    /** 요청 좌표와 노드(도로 위 지점) 사이가 따로 그릴 만큼 떨어져 있는지 */
    private static boolean gapOver(double lat, double lng, Node node) {
        return GeoUtils.haversineMeters(lat, lng, node.getLatitude(), node.getLongitude()) > SNAP_GAP_THRESHOLD_METERS;
    }

    /** 도로 위 지점이 간선 끝 교차로와 사실상 같으면 그 교차로, 아니면 DB에 없는(id 없는) 임시 노드 */
    private Node snapNode(RoadSnap snap, String name) {
        for (Node end : snap.ends()) {
            if (snap.isAt(end)) {
                return end;
            }
        }
        return new Node(name, snap.latitude, snap.longitude);
    }

    /** 경로 탐색에서 쓰는 노드 키. 임시 출발/도착 노드는 id가 없어서 따로 정한 키를 쓴다 */
    private static long keyOf(Node node, Node start, Node goal) {
        if (node.getId() != null) {
            return node.getId();
        }
        return node == start ? START_KEY : GOAL_KEY;
    }

    private RouteResponse toResponse(double fromLat, double fromLng, double toLat, double toLng,
                                     Node start, Node goal, Planned planned, Function<Edge, EdgeRisk> riskOf,
                                     double[] origin, double[] destination) {
        SidewalkPlanner.Route route = planned.route();
        List<RouteResponse.Point> points = new ArrayList<>();
        addPoint(points, start);
        double total = 0;
        double dark = 0;
        double reported = 0;

        // 요청 좌표(검색으로 찍은 건물 위치)와 도로 위 지점 사이는 도로 데이터가 없어 직선으로 이어주고, 거리/소요시간에도 반영한다.
        if (origin != null) {
            total += GeoUtils.haversineMeters(fromLat, fromLng, start.getLatitude(), start.getLongitude());
        }
        for (Edge edge : route.edges()) {
            EdgeRisk risk = riskOf.apply(edge);
            addPoint(points, edge.getToNode());
            total += edge.getDistanceMeters();
            dark += edge.getDistanceMeters() * risk.darkness();
            if (risk.hasReport()) {
                reported += edge.getDistanceMeters();
            }
        }
        if (destination != null) {
            total += GeoUtils.haversineMeters(goal.getLatitude(), goal.getLongitude(), toLat, toLng);
        }

        // 지도에 그릴 모양: 큰 도로는 보도 쪽으로 옮기고, 건너는 곳은 횡단보도 구간으로 따로 알려준다.
        // 거리·소요 시간은 그 모양의 길이로 보여 준다 (간선 길이 합은 큰 교차로 안의 차로를 따라 도는 만큼 길게 나온다)
        SidewalkPlanner.Result drawn = planned.drawn();
        if (!drawn.geometry().isEmpty()) {
            total = length(drawn.geometry());
        }
        return new RouteResponse(total, (int) Math.ceil(total / WALKING_METERS_PER_MINUTE), dark, reported, points,
                drawn.geometry(), drawn.crossings());
    }

    /** 지나는 교차로 목록에 추가. 임시 출발/도착 노드(도로 위 지점)는 교차로가 아니라서 넣지 않는다 */
    private void addPoint(List<RouteResponse.Point> points, Node node) {
        if (node.getId() != null) {
            points.add(toPoint(node));
        }
    }

    private RouteResponse.Point toPoint(Node node) {
        return new RouteResponse.Point(node.getId(), node.getName(), node.getLatitude(), node.getLongitude());
    }
}
