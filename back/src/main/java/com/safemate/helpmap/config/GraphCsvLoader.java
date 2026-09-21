package com.safemate.helpmap.config;

import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;
import com.safemate.helpmap.repository.EdgeRepository;
import com.safemate.helpmap.repository.NodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 신구대학교 인근 실제 도로망(OpenStreetMap, (c) OpenStreetMap contributors, ODbL)을 적재한다.
 * resources/data/graph-nodes.csv, graph-edges.csv 는 tools/build_osm_graph.py 가 만든다.
 * 간선은 CSV에 한 번씩만 있고, 여기서 양방향 두 개로 저장한다. nodes 테이블이 비어 있을 때만 동작한다.
 */
@Slf4j
@Component
@Order(1) // 가로등 로더보다 먼저 실행
@RequiredArgsConstructor
public class GraphCsvLoader implements CommandLineRunner {

    private static final String NODES_CSV = "data/graph-nodes.csv";
    private static final String EDGES_CSV = "data/graph-edges.csv";

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;

    @Override
    public void run(String... args) throws IOException {
        if (nodeRepository.count() > 0) {
            return;
        }

        Map<Integer, Node> nodesByIndex = new HashMap<>();
        List<Node> nodes = new ArrayList<>();
        for (String[] cols : readRows(NODES_CSV)) {
            // 컬럼: index,name,latitude,longitude
            Node node = new Node(cols[1].trim(), Double.parseDouble(cols[2].trim()), Double.parseDouble(cols[3].trim()));
            nodesByIndex.put(Integer.parseInt(cols[0].trim()), node);
            nodes.add(node);
        }
        nodeRepository.saveAll(nodes);

        List<Edge> edges = new ArrayList<>();
        for (String[] cols : readRows(EDGES_CSV)) {
            // 컬럼: fromIndex,toIndex,distanceMeters
            Node from = nodesByIndex.get(Integer.parseInt(cols[0].trim()));
            Node to = nodesByIndex.get(Integer.parseInt(cols[1].trim()));
            double meters = Double.parseDouble(cols[2].trim());
            edges.add(new Edge(from, to, meters));
            edges.add(new Edge(to, from, meters));
        }
        edgeRepository.saveAll(edges);
        log.info("도로망 CSV 적재: 노드 {}개, 간선 {}개(양방향)", nodes.size(), edges.size());
    }

    /** 헤더를 건너뛰고 쉼표로 나눈 행을 돌려준다 (값에 쉼표가 없는 CSV 전용) */
    private List<String[]> readRows(String path) throws IOException {
        List<String[]> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ClassPathResource(path).getInputStream(), StandardCharsets.UTF_8))) {
            reader.readLine();
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isBlank()) {
                    rows.add(line.split(","));
                }
            }
        }
        return rows;
    }
}
