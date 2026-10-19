package com.safemate.helpmap.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 지하철역 출구가 계단인지 에스컬레이터인지. 공공데이터(서울교통공사_에스컬레이터 설치현황, 데이터 기준일자 2026-09-01)를
 * tools/build_subway_exits_csv.py 가 resources/data/subway-exit-escalators.csv 로 추린 것을 메모리에 둔다.
 * 컬럼: line,station,escalatorExit (escalatorExit가 빈 줄 = 출구 에스컬레이터가 없는 역)
 * <p>
 * 데이터에 있는 역은 에스컬레이터가 없는 출구를 계단으로 본다. 서울교통공사 역이 아니면(수인분당선 등) 모른다(null).
 */
@Slf4j
@Component
public class SubwayExitCatalog {

    private static final String CSV_PATH = "data/subway-exit-escalators.csv";
    // 카카오 장소 이름 "남한산성입구역 8호선" -> 역 "남한산성입구", 호선 "8호선" (호선은 없을 수도 있다)
    private static final Pattern KAKAO_STATION = Pattern.compile("^(\\S+)역(?: (\\S+선))?$");

    public static final String ESCALATOR = "ESCALATOR";
    public static final String STAIRS = "STAIRS";

    // "8호선|남한산성입구" -> 에스컬레이터가 있는 출구 번호들. 데이터에 있는 역은 출구 에스컬레이터가 없어도 빈 집합으로 들어 있다
    private final Map<String, Set<Integer>> escalatorExits = new HashMap<>();
    // "남한산성입구" -> 같은 이름의 역이 있는 호선들 ("남한산성입구역"처럼 호선 없이 검색한 장소용)
    private final Map<String, Set<String>> linesByStation = new HashMap<>();

    public SubwayExitCatalog() {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ClassPathResource(CSV_PATH).getInputStream(), StandardCharsets.UTF_8))) {
            reader.readLine(); // 헤더
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                String[] cols = line.split(",", -1);
                Set<Integer> exits = escalatorExits.computeIfAbsent(cols[0] + "|" + cols[1], k -> new HashSet<>());
                if (!cols[2].isBlank()) {
                    exits.add(Integer.parseInt(cols[2].trim()));
                }
                linesByStation.computeIfAbsent(cols[1], k -> new HashSet<>()).add(cols[0]);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("지하철 출구 CSV를 읽지 못했습니다: " + CSV_PATH, e);
        }
        log.info("지하철 출구 에스컬레이터 CSV 적재: 역 {}곳", escalatorExits.size());
    }

    /**
     * 카카오 장소 이름(예: "남한산성입구역 8호선")인 역의 exitNumber번 출구가 ESCALATOR인지 STAIRS인지.
     * 데이터에 없는 역이거나, 호선 없이 이름만 있는데 같은 이름의 역이 여러 호선에 있으면 null
     */
    public String typeOf(String placeName, int exitNumber) {
        if (placeName == null) {
            return null;
        }
        Matcher m = KAKAO_STATION.matcher(placeName.trim());
        if (!m.matches()) {
            return null;
        }
        String station = m.group(1);
        String line = m.group(2);
        if (line == null) {
            Set<String> lines = linesByStation.getOrDefault(station, Set.of());
            if (lines.size() != 1) {
                return null;
            }
            line = lines.iterator().next();
        }
        Set<Integer> exits = escalatorExits.get(line + "|" + station);
        if (exits == null) {
            return null;
        }
        return exits.contains(exitNumber) ? ESCALATOR : STAIRS;
    }
}
