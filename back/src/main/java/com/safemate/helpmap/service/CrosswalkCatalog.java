package com.safemate.helpmap.service;

import com.safemate.helpmap.util.GeoUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * 공공데이터(전국횡단보도표준데이터, 성남시 제공분, 데이터기준일자 2025-11-30)에서 시연 지역만 추린 횡단보도 위치.
 * tools/build_crosswalks_csv.py 가 resources/data/crosswalks.csv 로 만든다. 값이 바뀌지 않아 DB 없이 메모리에 둔다.
 * <p>
 * 실제 횡단보도의 일부만 있고 좌표도 주소 기준이라 도로에서 떨어져 있을 수 있어서, 경로에서는
 * "이 교차로 근처에 횡단보도가 있다"는 보조 정보로만 쓴다 (없다고 해서 못 건너는 곳으로 보지 않는다).
 * 컬럼: roadName,latitude,longitude,hasSignal (UTF-8, 쉼표 포함 값 없음)
 */
@Slf4j
@Component
public class CrosswalkCatalog {

    private static final String CSV_PATH = "data/crosswalks.csv";
    // 주소 좌표라 도로 중심선에서 중간값 약 14m, 멀면 50m까지 떨어져 있어서 교차로와 이 거리 안이면 같은 곳으로 본다
    private static final double MATCH_METERS = 40;

    record Crosswalk(String roadName, double latitude, double longitude, boolean hasSignal) {
    }

    private final List<Crosswalk> crosswalks = new ArrayList<>();

    public CrosswalkCatalog() {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ClassPathResource(CSV_PATH).getInputStream(), StandardCharsets.UTF_8))) {
            reader.readLine(); // 헤더
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                String[] cols = line.split(",");
                crosswalks.add(new Crosswalk(cols[0].trim(), Double.parseDouble(cols[1].trim()),
                        Double.parseDouble(cols[2].trim()), Boolean.parseBoolean(cols[3].trim())));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        log.info("횡단보도 CSV 적재: {}개", crosswalks.size());
    }

    /** 교차로 근처(MATCH_METERS 이내)에서 가장 가까운 횡단보도 */
    Optional<Crosswalk> near(double latitude, double longitude) {
        return crosswalks.stream()
                .filter(c -> GeoUtils.haversineMeters(latitude, longitude, c.latitude(), c.longitude()) <= MATCH_METERS)
                .min(Comparator.comparingDouble(
                        c -> GeoUtils.haversineMeters(latitude, longitude, c.latitude(), c.longitude())));
    }
}
