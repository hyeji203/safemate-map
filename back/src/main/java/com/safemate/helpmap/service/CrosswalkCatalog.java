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
 * <p>
 * 시연 경로 주변은 카카오맵을 최대로 확대해 실제 줄무늬 위치를 찍은 좌표를 crosswalks-surveyed.csv 에 따로 둔다
 * (루트 .env에 REACT_APP_CROSSWALK_SURVEY=true 를 넣고 프론트를 개발 모드로 띄워 지도를 누르면 CSV 한 줄이 복사된다). 스크립트를 다시 돌려도 덮어써지지 않게 파일을 나눴고,
 * 교차로의 같은 도로 방향에 둘 다 있으면 직접 찍은 좌표를 먼저 쓴다.
 * 컬럼: roadName,latitude,longitude,hasSignal[,diagonal] (UTF-8, 쉼표 포함 값 없음)
 * diagonal은 선택 컬럼으로, true면 사거리를 대각선으로 한 번에 건너는 횡단보도다 (교차로 가운데 근처를 찍는다).
 */
@Slf4j
@Component
public class CrosswalkCatalog {

    private static final String CSV_PATH = "data/crosswalks.csv";
    private static final String SURVEYED_CSV_PATH = "data/crosswalks-surveyed.csv";
    // 주소 좌표라 도로 중심선에서 중간값 약 14m, 멀면 50m까지 떨어져 있어서 교차로와 이 거리 안이면 같은 곳으로 본다
    static final double MATCH_METERS = 40;
    // 직접 찍은 좌표는 교차로에서 떨어진 블록 중간 횡단보도도 있어서(예: 단대오거리 서쪽 광명로, 교차로에서 50~70m),
    // 교차로의 도로 방향(팔) 위에 있는지 볼 후보를 더 멀리까지 넘긴다. 팔 위인지는 SidewalkPlanner가 10m 기준으로 다시 본다
    private static final double SURVEYED_RAY_METERS = 80;

    /** surveyed: 직접 찍은 좌표(true)인지 공공데이터(false)인지. diagonal: 사거리 대각선 횡단보도인지 */
    record Crosswalk(String roadName, double latitude, double longitude, boolean hasSignal, boolean surveyed,
                     boolean diagonal) {
    }

    private final List<Crosswalk> crosswalks;
    private final List<Crosswalk> surveyed;

    public CrosswalkCatalog() {
        crosswalks = load(CSV_PATH, false);
        ClassPathResource surveyedFile = new ClassPathResource(SURVEYED_CSV_PATH);
        surveyed = surveyedFile.exists() ? load(SURVEYED_CSV_PATH, true) : List.of();
        log.info("횡단보도 CSV 적재: 공공데이터 {}개, 직접 찍은 좌표 {}개", crosswalks.size(), surveyed.size());
    }

    private static List<Crosswalk> load(String path, boolean surveyed) {
        List<Crosswalk> list = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ClassPathResource(path).getInputStream(), StandardCharsets.UTF_8))) {
            reader.readLine(); // 헤더
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                String[] cols = line.split(",");
                list.add(new Crosswalk(cols[0].trim(), Double.parseDouble(cols[1].trim()),
                        Double.parseDouble(cols[2].trim()), Boolean.parseBoolean(cols[3].trim()), surveyed,
                        cols.length > 4 && Boolean.parseBoolean(cols[4].trim())));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return list;
    }

    /** 교차로 근처(MATCH_METERS 이내)에서 가장 가까운 횡단보도. 직접 찍은 좌표가 있으면 그쪽을 먼저 본다 */
    Optional<Crosswalk> near(double latitude, double longitude) {
        return nearest(surveyed, latitude, longitude).or(() -> nearest(crosswalks, latitude, longitude));
    }

    /** 직접 찍은 횡단보도 전부 (MedianCrossings가 중앙분리대 도로 횡단 간선을 만드는 데 쓴다) */
    List<Crosswalk> surveyed() {
        return surveyed;
    }

    /**
     * 교차로 근처의 횡단보도 전부 (사거리면 방향마다 하나씩 있을 수 있음).
     * 공공데이터는 MATCH_METERS, 직접 찍은 좌표는 SURVEYED_RAY_METERS 이내
     */
    List<Crosswalk> within(double latitude, double longitude) {
        List<Crosswalk> result = new ArrayList<>();
        for (Crosswalk c : surveyed) {
            if (GeoUtils.haversineMeters(latitude, longitude, c.latitude(), c.longitude()) <= SURVEYED_RAY_METERS) {
                result.add(c);
            }
        }
        for (Crosswalk c : crosswalks) {
            if (GeoUtils.haversineMeters(latitude, longitude, c.latitude(), c.longitude()) <= MATCH_METERS) {
                result.add(c);
            }
        }
        return result;
    }

    private static Optional<Crosswalk> nearest(List<Crosswalk> list, double latitude, double longitude) {
        return list.stream()
                .filter(c -> GeoUtils.haversineMeters(latitude, longitude, c.latitude(), c.longitude()) <= MATCH_METERS)
                .min(Comparator.comparingDouble(
                        c -> GeoUtils.haversineMeters(latitude, longitude, c.latitude(), c.longitude())));
    }
}
