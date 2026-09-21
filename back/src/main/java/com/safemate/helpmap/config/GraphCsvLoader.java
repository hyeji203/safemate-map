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
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 신구대학교 인근 실제 도로망(OpenStreetMap, (c) OpenStreetMap contributors, ODbL)을 적재한다.
 * resources/data/graph-nodes.csv, graph-edges.csv 는 tools/build_osm_graph.py 가 만든다.
 * 간선은 CSV에 한 번씩만 있고, 여기서 양방향 두 개로 저장한다. DB의 노드/간선이 CSV와 다를 때만 다시 적재한다.
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
        List<String[]> nodeRows = readRows(NODES_CSV);
        List<String[]> edgeRows = readRows(EDGES_CSV);

        if (nodeRepository.count() > 0) {
            // DB의 그래프가 CSV와 같으면 그대로 둔다. 개수가 다르거나 도로 종류가 없는 예전 형식이면
            // CSV로 다시 적재한다 (노드를 참조하는 다른 테이블은 없음)
            boolean upToDate = nodeRepository.count() == nodeRows.size()
                    && edgeRepository.count() == edgeRows.size() * 2L
                    && !edgeRepository.existsByRoadTypeIsNull();
            if (upToDate) {
                return;
            }
            edgeRepository.deleteAllInBatch();
            nodeRepository.deleteAllInBatch();
        }

        Map<Integer, Node> nodesByIndex = new HashMap<>();
        List<Node> nodes = new ArrayList<>();
        for (String[] cols : nodeRows) {
            // 컬럼: index,name,latitude,longitude
            Node node = new Node(cols[1].trim(), Double.parseDouble(cols[2].trim()), Double.parseDouble(cols[3].trim()));
            nodesByIndex.put(Integer.parseInt(cols[0].trim()), node);
            nodes.add(node);
        }
        nodeRepository.saveAll(nodes);

        List<Edge> edges = new ArrayList<>();
        for (String[] cols : edgeRows) {
            // 컬럼: fromIndex,toIndex,distanceMeters,roadType,geometry
            Node from = nodesByIndex.get(Integer.parseInt(cols[0].trim()));
            Node to = nodesByIndex.get(Integer.parseInt(cols[1].trim()));
            double meters = Double.parseDouble(cols[2].trim());
            String roadType = cols[3].trim();
            String geometry = cols[4].trim();
            edges.add(new Edge(from, to, meters, roadType, geometry));
            edges.add(new Edge(to, from, meters, roadType, reverseGeometry(geometry)));
        }
        edgeRepository.saveAll(edges);
        log.info("도로망 CSV 적재: 노드 {}개, 간선 {}개(양방향)", nodes.size(), edges.size());
    }

    /** "a;b;c" 형태의 도로 모양 좌표열을 반대 방향("c;b;a")으로 뒤집는다 */
    private String reverseGeometry(String geometry) {
        List<String> points = new ArrayList<>(List.of(geometry.split(";")));
        Collections.reverse(points);
        return String.join(";", points);
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
