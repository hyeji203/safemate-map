package com.safemate.helpmap.config;

import com.safemate.helpmap.entity.Cctv;
import com.safemate.helpmap.repository.CctvRepository;
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
 * 공공데이터(전국CCTV표준데이터)에서 시연 지역만 추려 resources/data/cctv.csv 로 넣어 둔 CCTV 위치를 적재한다.
 * tools/build_cctv_csv.py 가 만든다. 파일이 아직 없으면 아무것도 하지 않는다 (지도의 CCTV 레이어가 "데이터 없음"으로 표시됨).
 * DB의 개수가 CSV와 같으면 그대로 두고, 다르면 다시 적재한다 (가로등 로더와 같은 방식).
 * 컬럼: purpose,cameraCount,latitude,longitude (UTF-8, 쉼표 포함 값 없음)
 */
@Slf4j
@Component
@Order(4)
@RequiredArgsConstructor
public class CctvCsvLoader implements CommandLineRunner {

    private static final String CSV_PATH = "data/cctv.csv";

    private final CctvRepository cctvRepository;

    @Override
    public void run(String... args) throws IOException {
        ClassPathResource resource = new ClassPathResource(CSV_PATH);
        if (!resource.exists()) {
            log.info("CCTV CSV({}) 없음 - CCTV 레이어는 비어 있음. tools/build_cctv_csv.py로 만들 수 있음", CSV_PATH);
            return;
        }

        List<Cctv> cctvs = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            reader.readLine(); // 헤더
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                String[] cols = line.split(",");
                String purpose = cols[0].trim();
                int cameraCount = Integer.parseInt(cols[1].trim());
                double latitude = Double.parseDouble(cols[2].trim());
                double longitude = Double.parseDouble(cols[3].trim());
                cctvs.add(new Cctv(latitude, longitude, purpose, Math.max(1, cameraCount)));
            }
        }

        if (cctvRepository.count() == cctvs.size()) {
            return;
        }
        cctvRepository.deleteAllInBatch();
        cctvRepository.saveAll(cctvs);
        log.info("CCTV CSV 적재: {}개 지점", cctvs.size());
    }
}
