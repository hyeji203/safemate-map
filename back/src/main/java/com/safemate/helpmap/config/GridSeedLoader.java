package com.safemate.helpmap.config;

import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;
import com.safemate.helpmap.repository.EdgeRepository;
import com.safemate.helpmap.repository.NodeRepository;
import com.safemate.helpmap.util.GeoUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 1단계 검증용 더미 그래프. 신구대학교 인근(성남시 중원구)을 중심으로 5x5 격자(노드 25개)를 만든다.
 * nodes 테이블이 비어 있을 때만 동작한다.
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class GridSeedLoader implements CommandLineRunner {

    private static final int SIZE = 5;
    // 신구대학교(성남시 중원구 금광동) 좌표 — 카카오 로컬 API 키워드 검색 결과
    private static final double CENTER_LAT = 37.4488;
    private static final double CENTER_LNG = 127.1677;
    // 약 60m 간격
    private static final double LAT_STEP = 0.00054;
    private static final double LNG_STEP = 0.00068;

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;

    @Override
    public void run(String... args) {
        if (nodeRepository.count() > 0) {
            return;
        }

        Node[][] grid = new Node[SIZE][SIZE];
        List<Node> nodes = new ArrayList<>();
        for (int r = 0; r < SIZE; r++) {
            for (int c = 0; c < SIZE; c++) {
                double lat = CENTER_LAT + (SIZE / 2 - r) * LAT_STEP;
                double lng = CENTER_LNG + (c - SIZE / 2) * LNG_STEP;
                grid[r][c] = new Node("격자-" + r + "-" + c, lat, lng);
                nodes.add(grid[r][c]);
            }
        }
        nodeRepository.saveAll(nodes);

        // 상하좌우 인접 노드를 양방향 간선으로 연결
        List<Edge> edges = new ArrayList<>();
        for (int r = 0; r < SIZE; r++) {
            for (int c = 0; c < SIZE; c++) {
                if (c + 1 < SIZE) {
                    addBidirectional(edges, grid[r][c], grid[r][c + 1]);
                }
                if (r + 1 < SIZE) {
                    addBidirectional(edges, grid[r][c], grid[r + 1][c]);
                }
            }
        }
        edgeRepository.saveAll(edges);
        log.info("더미 격자 그래프 생성: 노드 {}개, 간선 {}개", nodes.size(), edges.size());
    }

    private void addBidirectional(List<Edge> edges, Node a, Node b) {
        double meters = GeoUtils.haversineMeters(a.getLatitude(), a.getLongitude(), b.getLatitude(), b.getLongitude());
        edges.add(new Edge(a, b, meters));
        edges.add(new Edge(b, a, meters));
    }
}
