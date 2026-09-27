package com.safemate.helpmap.config;

import com.safemate.helpmap.entity.StreetLight;
import com.safemate.helpmap.repository.StreetLightRepository;
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
import java.util.List;

/**
 * 공공데이터(성남시 중원구 보안등 정보 현황, 데이터기준일자 2025-11-27)에서 시연 지역만 추려
 * resources/data/street-lights.csv 로 넣어 둔 실제 가로등 위치를 적재한다.
 * tools/build_streetlights_csv.py 가 만들며, 보행로 그래프 반경(tools/build_osm_graph.py)보다 넉넉하게 자른다.
 * DB의 개수가 CSV와 같으면 그대로 두고, 다르면(CSV를 새로 만들어 반경이 바뀐 경우 등) 다시 적재한다.
 * 컬럼: name,installCount,latitude,longitude (UTF-8, 쉼표 포함 값 없음)
 */
@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
public class StreetLightCsvLoader implements CommandLineRunner {

    private static final String CSV_PATH = "data/street-lights.csv";

    private final StreetLightRepository streetLightRepository;

    @Override
    public void run(String... args) throws IOException {
        List<StreetLight> lights = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ClassPathResource(CSV_PATH).getInputStream(), StandardCharsets.UTF_8))) {
            reader.readLine(); // 헤더
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                String[] cols = line.split(",");
                int installCount = Integer.parseInt(cols[1].trim());
                double latitude = Double.parseDouble(cols[2].trim());
                double longitude = Double.parseDouble(cols[3].trim());
                lights.add(new StreetLight(latitude, longitude, Math.max(1, installCount)));
            }
        }

        if (streetLightRepository.count() == lights.size()) {
            return;
        }
        streetLightRepository.deleteAllInBatch();
        streetLightRepository.saveAll(lights);
        log.info("가로등 CSV 적재: {}개 지점", lights.size());
    }
}
