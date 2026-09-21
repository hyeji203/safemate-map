package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.RouteResponse;
import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;
import com.safemate.helpmap.repository.EdgeRepository;
import com.safemate.helpmap.repository.NodeRepository;
import com.safemate.helpmap.util.GeoUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RouteServiceImpl implements RouteService {

    // 도보 속도 약 4km/h
    private static final double WALKING_METERS_PER_MINUTE = 4000.0 / 60;

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;

    @Override
    public RouteResponse findShortestRoute(double fromLat, double fromLng, double toLat, double toLng) {
        List<Node> nodes = nodeRepository.findAll();
        if (nodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "보행로 노드 데이터가 없습니다.");
        }

        Node start = nearestNode(nodes, fromLat, fromLng);
        Node goal = nearestNode(nodes, toLat, toLng);

        Map<Long, List<Edge>> adjacency = new HashMap<>();
        for (Edge edge : edgeRepository.findAllWithNodes()) {
            adjacency.computeIfAbsent(edge.getFromNode().getId(), k -> new ArrayList<>()).add(edge);
        }

        return dijkstra(start, goal, adjacency);
    }

    private RouteResponse dijkstra(Node start, Node goal, Map<Long, List<Edge>> adjacency) {
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
                double nextDist = top[0] + edge.getDistanceMeters();
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

        LinkedList<RouteResponse.Point> path = new LinkedList<>();
        Node cursor = goal;
        path.addFirst(toPoint(cursor));
        while (!cursor.getId().equals(start.getId())) {
            cursor = prevEdge.get(cursor.getId()).getFromNode();
            path.addFirst(toPoint(cursor));
        }

        double total = dist.get(goal.getId());
        return new RouteResponse(total, (int) Math.ceil(total / WALKING_METERS_PER_MINUTE), path);
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
