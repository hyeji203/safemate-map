package com.safemate.helpmap.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

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

    public Edge(Node fromNode, Node toNode, double distanceMeters) {
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.distanceMeters = distanceMeters;
    }
}
