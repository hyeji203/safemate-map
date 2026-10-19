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

    // 지하철역 출구 후보: 반대쪽 끝에서 직선거리로 가까운 순으로 이만큼만 실제 경로를 구해 비교한다 (출구마다 탐색을 다시 해서)
    private static final int EXIT_CANDIDATES = 3;

    private final EdgeRepository edgeRepository;
    private final StreetLightRepository streetLightRepository;
    private final ReportRepository reportRepository;
    private final RiskWeightCalculator riskWeightCalculator;
    private final CrosswalkCatalog crosswalkCatalog;
    private final KakaoLocalService kakaoLocalService;
    private final SubwayExitCatalog subwayExitCatalog;

    @Override
    public RoutesResponse findRoutes(double fromLat, double fromLng, double toLat, double toLng,
                                     String fromAddress, String toAddress, String fromName, String toName) {
        // 출발/도착이 지하철역이면 역 가운데(선로 위 좌표) 대신 출구에서 출발/도착한다. 출구마다 경로를 구해
        // 최단경로는 가장 짧은 출구, 안심경로는 가장 안전한 출구를 따로 고른다 (두 경로가 서로 다른 출구일 수 있다)
        List<Endpoint> froms = endpoints(fromName, fromLat, fromLng, fromAddress, toLat, toLng);
        List<Endpoint> tos = endpoints(toName, toLat, toLng, toAddress, fromLat, fromLng);

        List<Edge> edges = new ArrayList<>(edgeRepository.findAllWithNodes());
        if (edges.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "보행로 데이터가 없습니다.");
        }
        // 제보를 등록하면 다음 경로 요청부터 바로 반영되도록, 요청마다 최신 제보를 읽어 위험도를 계산한다
        Map<Long, EdgeRisk> risks = riskWeightCalculator.calculate(
                edges, streetLightRepository.findAll(), reportRepository.findAll());
        // 중앙분리대 도로의 두 차로를 직접 찍은 횡단보도로 잇는 간선 (DB에 없어서 id가 없다)
        List<Edge> medianCrossings = MedianCrossings.build(edges, crosswalkCatalog);
        // 직접 찍은 횡단보도 건너편에서 큰 도로와 끊겨 있는 작은 길을 잇는 간선 (예: 신구대 캠퍼스 도로 <-> 금빛로)
        edges.addAll(CrosswalkConnectors.build(edges, crosswalkCatalog));
        edges.addAll(medianCrossings);

        Map<Long, List<Edge>> adjacency = new HashMap<>();
        for (Edge edge : edges) {
            adjacency.computeIfAbsent(edge.getFromNode().getId(), k -> new ArrayList<>()).add(edge);
        }

        Option shortest = null;
        Option safe = null;
        for (Endpoint from : froms) {
            for (Endpoint to : tos) {
                Options options = plan(edges, adjacency, risks, from, to);
                if (options == null) {
                    continue;
                }
                if (shortest == null || options.shortest().score() < shortest.score()) {
                    shortest = options.shortest();
                }
                if (safe == null || options.safe().score() < safe.score()) {
                    safe = options.safe();
                }
            }
        }
        if (shortest == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "출발지와 도착지를 잇는 경로가 없습니다.");
        }
        // 출구가 다르면 안심경로 쪽 출구가 실제로 더 짧을 수 있다. 그때는 최단경로도 그 길로 한다
        if (safe.response().totalDistanceMeters() < shortest.response().totalDistanceMeters()) {
            shortest = safe;
        }
        return new RoutesResponse(shortest.response(), safe.response());
    }

    /** 경로의 한쪽 끝. exit은 지하철역 출구일 때만 있다 */
    private record Endpoint(double lat, double lng, String address, RouteResponse.Exit exit) {
    }

    /**
     * 한 출발·도착 조합으로 구한 경로와 출구끼리 비교하는 값.
     * 최단경로는 실제로 걷는 거리(m), 안심경로는 위험도를 더한 탐색 비용. 최단경로를 탐색 비용으로 고르면
     * 큰 도로·횡단 비용 때문에 더 먼 출구가 골라져 안심경로보다 길게 나오는 일이 있었다
     */
    private record Option(RouteResponse response, double score) {
    }

    private record Options(Option shortest, Option safe) {
    }

    /**
     * 장소가 지하철역이면 출구 후보들(반대쪽 끝에서 가까운 EXIT_CANDIDATES곳), 아니면 장소 좌표 하나.
     * 출구 좌표는 보도 위라 가장 가까운 도로에 붙이면 되므로 주소(큰 길 판단)는 쓰지 않는다
     */
    private List<Endpoint> endpoints(String name, double lat, double lng, String address,
                                     double otherLat, double otherLng) {
        List<KakaoLocalService.SubwayExit> exits;
        try {
            exits = kakaoLocalService.findSubwayExits(name, lat, lng);
        } catch (RuntimeException e) {
            exits = List.of(); // 카카오 검색이 실패해도 경로는 역 좌표로 찾는다
        }
        if (exits.isEmpty()) {
            return List.of(new Endpoint(lat, lng, address, null));
        }
        return exits.stream()
                .sorted(Comparator.comparingDouble(
                        e -> GeoUtils.haversineMeters(e.latitude(), e.longitude(), otherLat, otherLng)))
                .limit(EXIT_CANDIDATES)
                .map(e -> new Endpoint(e.latitude(), e.longitude(), null,
                        new RouteResponse.Exit(e.label(), e.latitude(), e.longitude(),
                                subwayExitCatalog.typeOf(name, e.number()))))
                .toList();
    }

    /** 출발·도착 한 조합의 최단경로와 안심경로. 잇는 길이 없으면 null */
    private Options plan(List<Edge> edges, Map<Long, List<Edge>> adjacency, Map<Long, EdgeRisk> risks,
                         Endpoint from, Endpoint to) {
        double fromLat = from.lat();
        double fromLng = from.lng();
        double toLat = to.lat();
        double toLng = to.lng();
        String fromAddress = from.address();
        String toAddress = to.address();

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
        // 부분 간선은 원래 도로의 위험도, MedianCrossings 횡단 간선·CrosswalkConnectors 연결 간선은
        // 차도 가로등이 있는 큰 도로 횡단보도 옆의 짧은 구간이라 0
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
            return null;
        }
        // 안심경로가 최단경로 기준으로도 더 나으면 최단경로도 그 길로 한다. 탐색 비용은 그래프 기준이라 실제 걷는 길과
        // 조금 어긋나서(예: 횡단보도를 건넌 뒤 골목 입구까지 되돌아가는 거리는 안 셈), 안심경로가 더 짧게 표시되는 일이 있었다
        double shortestScore = score(sidewalks, start, goal, shortest, keys, walkingCost, origin, destination);
        double safeWalkingScore = score(sidewalks, start, goal, safe, keys, walkingCost, origin, destination);
        if (safeWalkingScore < shortestScore) {
            shortest = safe;
            shortestScore = safeWalkingScore;
        }
        double safeScore = score(sidewalks, start, goal, safe, keys, safeCost, origin, destination);

        RouteResponse shortestResponse = toResponse(from, to, start, goal, shortest, riskOf, origin, destination);
        return new Options(
                new Option(shortestResponse, shortestResponse.totalDistanceMeters()),
                new Option(toResponse(from, to, start, goal, safe, riskOf, origin, destination), safeScore));
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
            Planned planned = new Planned(route, sidewalks.plan(start, route.edges(), route.sides(), origin, destination));
            double score = score(sidewalks, start, goal, planned, keys, cost, origin, destination);
            if (score < bestScore) {
                bestScore = score;
                best = planned;
            }
        }
        return best;
    }

    /** 경로를 비교하는 값: 탐색 비용(보도·횡단·도착 비용 포함)을 실제로 그려지는 길이 비율로 고친 것 */
    private static double score(SidewalkPlanner sidewalks, Node start, Node goal, Planned planned,
                                ToLongFunction<Node> keys, ToDoubleFunction<Edge> cost,
                                double[] origin, double[] destination) {
        double graphLength = graphLength(start, goal, planned.route(), origin, destination);
        return sidewalks.cost(start, planned.route(), keys, cost, origin, destination)
                * (graphLength > 0 ? length(planned.drawn().geometry()) / graphLength : 1);
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

    private RouteResponse toResponse(Endpoint from, Endpoint to,
                                     Node start, Node goal, Planned planned, Function<Edge, EdgeRisk> riskOf,
                                     double[] origin, double[] destination) {
        double fromLat = from.lat();
        double fromLng = from.lng();
        double toLat = to.lat();
        double toLng = to.lng();
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
                drawn.geometry(), drawn.crossings(), from.exit(), to.exit());
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
