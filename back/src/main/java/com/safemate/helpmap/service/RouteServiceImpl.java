package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.RouteResponse;
import com.safemate.helpmap.dto.RoutesResponse;
import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;
import com.safemate.helpmap.repository.EdgeRepository;
import com.safemate.helpmap.repository.NodeRepository;
import com.safemate.helpmap.repository.ReportRepository;
import com.safemate.helpmap.repository.StreetLightRepository;
import com.safemate.helpmap.util.GeoUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.function.ToDoubleFunction;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RouteServiceImpl implements RouteService {

    // 도보 속도 약 4km/h
    private static final double WALKING_METERS_PER_MINUTE = 4000.0 / 60;
    // 위험도 1(가로등 없음)인 간선의 비용을 거리의 (1 + 이 값)배로 계산. 클수록 멀리 돌아서라도 밝은 길을 택한다
    private static final double RISK_PENALTY = 2.0;
    // 스냅 거리(요청 좌표 <-> 가장 가까운 노드)가 이보다 작으면 사실상 같은 지점으로 보고 별도 구간을 만들지 않는다
    private static final double SNAP_GAP_THRESHOLD_METERS = 3;

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;
    private final StreetLightRepository streetLightRepository;
    private final ReportRepository reportRepository;
    private final RiskWeightCalculator riskWeightCalculator;
    private final CrosswalkCatalog crosswalkCatalog;

    @Override
    public RoutesResponse findRoutes(double fromLat, double fromLng, double toLat, double toLng) {
        List<Node> nodes = nodeRepository.findAll();
        if (nodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "보행로 노드 데이터가 없습니다.");
        }

        Node start = nearestNode(nodes, fromLat, fromLng);
        Node goal = nearestNode(nodes, toLat, toLng);

        List<Edge> edges = edgeRepository.findAllWithNodes();
        // 제보를 등록하면 다음 경로 요청부터 바로 반영되도록, 요청마다 최신 제보를 읽어 위험도를 계산한다
        Map<Long, EdgeRisk> risks = riskWeightCalculator.calculate(
                edges, streetLightRepository.findAll(), reportRepository.findAll());

        Map<Long, List<Edge>> adjacency = new HashMap<>();
        for (Edge edge : edges) {
            adjacency.computeIfAbsent(edge.getFromNode().getId(), k -> new ArrayList<>()).add(edge);
        }

        // 도보 비용 = 거리 x 도로 종류 배율(큰 차도/계단은 피함). 안심경로는 여기에 위험도 가중을 더한다.
        ToDoubleFunction<Edge> walkingCost = e -> e.getDistanceMeters() * RoadType.walkingFactor(e.getRoadType());
        List<Edge> shortest = dijkstra(start, goal, adjacency, walkingCost);
        List<Edge> safe = dijkstra(start, goal, adjacency,
                e -> walkingCost.applyAsDouble(e) * (1 + RISK_PENALTY * risks.get(e.getId()).total()));

        SidewalkPlanner sidewalks = new SidewalkPlanner(adjacency, crosswalkCatalog, start.getLatitude(), start.getLongitude());
        return new RoutesResponse(
                toResponse(fromLat, fromLng, toLat, toLng, start, goal, shortest, risks, sidewalks),
                toResponse(fromLat, fromLng, toLat, toLng, start, goal, safe, risks, sidewalks));
    }

    /** 주어진 비용 함수 기준 최소 비용 경로의 간선 목록을 반환한다. */
    private List<Edge> dijkstra(Node start, Node goal, Map<Long, List<Edge>> adjacency,
                                ToDoubleFunction<Edge> cost) {
        Map<Long, Double> dist = new HashMap<>();
        Map<Long, Edge> prevEdge = new HashMap<>();
        PriorityQueue<double[]> queue = new PriorityQueue<>(Comparator.comparingDouble(a -> a[0]));

        dist.put(start.getId(), 0.0);
        queue.add(new double[]{0.0, start.getId()});

        while (!queue.isEmpty()) {
            double[] top = queue.poll();
            long currentId = (long) top[1];
            if (top[0] > dist.getOrDefault(currentId, Double.MAX_VALUE)) {
                continue; // 이미 더 짧은 경로로 처리된 낡은 항목
            }
            if (currentId == goal.getId()) {
                break;
            }
            for (Edge edge : adjacency.getOrDefault(currentId, List.of())) {
                long nextId = edge.getToNode().getId();
                double nextDist = top[0] + cost.applyAsDouble(edge);
                if (nextDist < dist.getOrDefault(nextId, Double.MAX_VALUE)) {
                    dist.put(nextId, nextDist);
                    prevEdge.put(nextId, edge);
                    queue.add(new double[]{nextDist, nextId});
                }
            }
        }

        if (!dist.containsKey(goal.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "출발지와 도착지를 잇는 경로가 없습니다.");
        }

        LinkedList<Edge> path = new LinkedList<>();
        Node cursor = goal;
        while (!cursor.getId().equals(start.getId())) {
            Edge edge = prevEdge.get(cursor.getId());
            path.addFirst(edge);
            cursor = edge.getFromNode();
        }
        return path;
    }

    private RouteResponse toResponse(double fromLat, double fromLng, double toLat, double toLng,
                                     Node start, Node goal, List<Edge> pathEdges, Map<Long, EdgeRisk> risks,
                                     SidewalkPlanner sidewalks) {
        List<RouteResponse.Point> points = new ArrayList<>();
        points.add(toPoint(start));
        double total = 0;
        double dark = 0;
        double reported = 0;

        // 요청 좌표(예: 검색으로 찍은 건물 위치)는 그래프 노드와 정확히 일치하지 않을 수 있다.
        // 그 사이는 도로 데이터가 없어 직선으로 이어주고, 거리/소요시간에도 반영한다.
        double startGap = GeoUtils.haversineMeters(fromLat, fromLng, start.getLatitude(), start.getLongitude());
        double[] origin = null;
        if (startGap > SNAP_GAP_THRESHOLD_METERS) {
            origin = new double[]{fromLat, fromLng};
            total += startGap;
        }

        for (Edge edge : pathEdges) {
            EdgeRisk risk = risks.get(edge.getId());
            points.add(toPoint(edge.getToNode()));
            total += edge.getDistanceMeters();
            dark += edge.getDistanceMeters() * risk.darkness();
            if (risk.hasReport()) {
                reported += edge.getDistanceMeters();
            }
        }

        double endGap = GeoUtils.haversineMeters(goal.getLatitude(), goal.getLongitude(), toLat, toLng);
        double[] destination = null;
        if (endGap > SNAP_GAP_THRESHOLD_METERS) {
            destination = new double[]{toLat, toLng};
            total += endGap;
        }

        // 지도에 그릴 모양: 큰 도로는 보도 쪽으로 옮기고, 건너는 곳은 횡단보도 구간으로 따로 알려준다
        SidewalkPlanner.Result drawn = sidewalks.plan(start, pathEdges, origin, destination);
        return new RouteResponse(total, (int) Math.ceil(total / WALKING_METERS_PER_MINUTE), dark, reported, points,
                drawn.geometry(), drawn.crossings());
    }

    private Node nearestNode(List<Node> nodes, double lat, double lng) {
        return nodes.stream()
                .min(Comparator.comparingDouble(
                        n -> GeoUtils.haversineMeters(lat, lng, n.getLatitude(), n.getLongitude())))
                .orElseThrow();
    }

    private RouteResponse.Point toPoint(Node node) {
        return new RouteResponse.Point(node.getId(), node.getName(), node.getLatitude(), node.getLongitude());
    }
}
