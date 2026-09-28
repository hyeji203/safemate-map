package com.safemate.helpmap.service;

import java.util.Map;

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

    private RoadType() {
    }

    static double walkingFactor(String roadType) {
        return roadType == null ? 1.0 : FACTORS.getOrDefault(roadType, 1.0);
    }
}
