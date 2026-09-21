package com.safemate.helpmap.dto;

import java.util.List;

/**
 * @param darkDistanceMeters 위험도를 길이로 환산한 어두운 구간 합(m). 가로등이 없는 간선 길이의 합
 */
public record RouteResponse(
        double totalDistanceMeters,
        int estimatedMinutes,
        double darkDistanceMeters,
        List<Point> path
) {
    public record Point(Long nodeId, String name, double latitude, double longitude) {
    }
}
