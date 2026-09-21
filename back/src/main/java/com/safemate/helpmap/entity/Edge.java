package com.safemate.helpmap.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * 노드 간 간선. distanceMeters는 고정, riskWeight는 제보가 쌓일수록 갱신된다 (2단계 핵심 로직).
 */
@Entity
@Table(name = "edges")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Edge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_node_id", nullable = false)
    private Node fromNode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_node_id", nullable = false)
    private Node toNode;

    @Column(nullable = false)
    private double distanceMeters;

    // 기본값 0 = 위험 요소 없음. 제보 반영 로직(2단계)에서 갱신.
    @Column(nullable = false)
    private double riskWeight = 0;

    // OSM highway 값 (residential, footway, steps ...). 도로 종류별 도보 비용 계산에 쓴다.
    private String roadType;

    // 도로 모양: "위도 경도;위도 경도;..." (fromNode -> toNode 방향). 없으면 두 노드를 직선으로 잇는다.
    @Column(columnDefinition = "TEXT")
    private String geometry;

    public Edge(Node fromNode, Node toNode, double distanceMeters, String roadType, String geometry) {
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.distanceMeters = distanceMeters;
        this.roadType = roadType;
        this.geometry = geometry;
    }

    /** 도로 모양을 따라가는 [위도, 경도] 좌표 목록 (fromNode -> toNode 순서, 양 끝 노드 포함) */
    public List<double[]> polyline() {
        if (geometry == null || geometry.isBlank()) {
            return List.of(
                    new double[]{fromNode.getLatitude(), fromNode.getLongitude()},
                    new double[]{toNode.getLatitude(), toNode.getLongitude()});
        }
        List<double[]> points = new ArrayList<>();
        for (String pair : geometry.split(";")) {
            String[] latLng = pair.trim().split(" ");
            points.add(new double[]{Double.parseDouble(latLng[0]), Double.parseDouble(latLng[1])});
        }
        return points;
    }
}
