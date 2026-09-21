package com.safemate.helpmap.dto;

import java.util.List;

/**
 * @param darkDistanceMeters     가로등 부족으로 인한 어두운 구간 길이(m). 가로등이 없는 간선 길이의 합
 * @param reportedDistanceMeters 시민 제보가 있는 구간 길이(m)
 */
public record RouteResponse(
        double totalDistanceMeters,
        int estimatedMinutes,
        double darkDistanceMeters,
        double reportedDistanceMeters,
        List<Point> path
) {
    public record Point(Long nodeId, String name, double latitude, double longitude) {
    }
}
