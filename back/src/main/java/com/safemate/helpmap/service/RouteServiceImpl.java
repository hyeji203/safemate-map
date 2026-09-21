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

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;
    private final StreetLightRepository streetLightRepository;
    private final ReportRepository reportRepository;
    private final RiskWeightCalculator riskWeightCalculator;

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

        List<Edge> shortest = dijkstra(start, goal, adjacency, Edge::getDistanceMeters);
        List<Edge> safe = dijkstra(start, goal, adjacency,
                e -> e.getDistanceMeters() * (1 + RISK_PENALTY * risks.get(e.getId()).total()));

        return new RoutesResponse(toResponse(start, shortest, risks), toResponse(start, safe, risks));
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

    private RouteResponse toResponse(Node start, List<Edge> pathEdges, Map<Long, EdgeRisk> risks) {
        List<RouteResponse.Point> points = new ArrayList<>();
        points.add(toPoint(start));
        double total = 0;
        double dark = 0;
        double reported = 0;
        for (Edge edge : pathEdges) {
            EdgeRisk risk = risks.get(edge.getId());
            points.add(toPoint(edge.getToNode()));
            total += edge.getDistanceMeters();
            dark += edge.getDistanceMeters() * risk.darkness();
            if (risk.hasReport()) {
                reported += edge.getDistanceMeters();
            }
        }
        return new RouteResponse(total, (int) Math.ceil(total / WALKING_METERS_PER_MINUTE), dark, reported, points);
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
