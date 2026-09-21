package com.safemate.helpmap.config;

import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.StreetLight;
import com.safemate.helpmap.repository.EdgeRepository;
import com.safemate.helpmap.repository.StreetLightRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * 1단계 검증용 더미 가로등. 격자 간선 중 일부의 중간 지점에 가로등을 놓고, 나머지 간선은 일부러 어둡게 남겨
 * 이후 "가로등이 적은 구간 = 위험" 가중치가 경로를 바꾸는지 확인할 수 있게 한다.
 * 실제 공공데이터(보안등 CSV)를 적재하게 되면 이 로더를 교체할 것.
 * street_lights 테이블이 비어 있을 때만 동작한다.
 */
@Slf4j
@Component
@Order(2) // 노드/간선을 만드는 GridSeedLoader(@Order 1) 이후에 실행
@RequiredArgsConstructor
public class StreetLightSeedLoader implements CommandLineRunner {

    // 간선 중 가로등이 설치되는 비율
    private static final double LIT_RATIO = 0.6;

    private final StreetLightRepository streetLightRepository;
    private final EdgeRepository edgeRepository;

    @Override
    public void run(String... args) {
        if (streetLightRepository.count() > 0) {
            return;
        }

        Random random = new Random(42); // 재실행해도 같은 배치가 나오도록 시드 고정
        List<StreetLight> lights = new ArrayList<>();
        for (Edge edge : edgeRepository.findAllWithNodes()) {
            // 양방향 간선 쌍 중 한 방향만 사용
            if (edge.getFromNode().getId() > edge.getToNode().getId()) {
                continue;
            }
            if (random.nextDouble() < LIT_RATIO) {
                double lat = (edge.getFromNode().getLatitude() + edge.getToNode().getLatitude()) / 2;
                double lng = (edge.getFromNode().getLongitude() + edge.getToNode().getLongitude()) / 2;
                lights.add(new StreetLight(lat, lng));
            }
        }
        streetLightRepository.saveAll(lights);
        log.info("더미 가로등 생성: {}개", lights.size());
    }
}
