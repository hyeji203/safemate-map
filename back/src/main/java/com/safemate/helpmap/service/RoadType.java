package com.safemate.helpmap.service;

import java.util.Map;
import java.util.Set;

/**
 * OSM 도로 종류별 도보 비용 배율. 1.0이 기준이고 클수록 걷기 불편/위험한 길로 보고 피한다.
 * 보도가 없는 큰 차도는 높게, 계단은 가장 높게, 보행자 전용길은 낮게 잡는다.
 */
final class RoadType {

    private static final Map<String, Double> FACTORS = Map.ofEntries(
            Map.entry("pedestrian", 0.9),
            Map.entry("footway", 0.95),
            Map.entry("path", 1.0),
            Map.entry("living_street", 1.0),
            Map.entry("residential", 1.0),
            Map.entry("service", 1.1),
            Map.entry("unclassified", 1.1),
            Map.entry("track", 1.2),
            Map.entry("tertiary", 1.2),
            Map.entry("tertiary_link", 1.2),
            // secondary는 대체로 보도가 확보된 간선도로다(예: 광명로는 OSM에 sidewalk=both로 명시돼 있음).
            // residential과 동일하게 잡아서, 실제로는 큰 차이 안 나는 거리인데 큰 도로라는 이유만으로
            // 부자연스럽게 좁은 골목으로 돌아가지 않게 한다. 다만 정말 차량 위주인 primary는 그대로 높게 둔다.
            Map.entry("secondary", 1.0),
            Map.entry("secondary_link", 1.0),
            Map.entry("primary", 2.0),
            Map.entry("primary_link", 2.0),
            Map.entry("steps", 2.5));

    // 도로 조명(차도 가로등)이 설치되는 간선도로. 가로등 데이터(보안등 정보 현황)는 골목·주택가 보안등만 담고
    // 차도 가로등은 빠져 있어서, 이 도로들은 데이터상 가로등이 없어도 밝은 길로 본다.
    // (확인 결과 데이터상 어두움 비율이 primary 95%, secondary 82%, tertiary 59%로 실제와 반대로 나왔음)
    private static final Set<String> LIT_ARTERIALS = Set.of(
            "trunk", "trunk_link", "primary", "primary_link",
            "secondary", "secondary_link", "tertiary", "tertiary_link");

    // 건널 때 횡단보도를 표시하는 큰 도로의 중심선~보도 거리(m, 대략값). 여기 없는 골목·램프(_link)는 그냥 지나간다.
    private static final Map<String, Double> HALF_WIDTHS = Map.of(
            "primary", 12.0,
            "secondary", 9.0,
            "tertiary", 6.0);

    private RoadType() {
    }

    /** 보도로 걷고 횡단보도로 건너야 하는 큰 도로면 중심선~보도 거리(m), 아니면 0 */
    static double halfWidthMeters(String roadType) {
        return roadType == null ? 0 : HALF_WIDTHS.getOrDefault(roadType, 0.0);
    }

    static double walkingFactor(String roadType) {
        return roadType == null ? 1.0 : FACTORS.getOrDefault(roadType, 1.0);
    }

    /** 차도 가로등이 있는 것으로 보는 간선도로인지 */
    static boolean isLitArterial(String roadType) {
        return roadType != null && LIT_ARTERIALS.contains(roadType);
    }
}
