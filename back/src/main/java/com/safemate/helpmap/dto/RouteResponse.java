package com.safemate.helpmap.dto;

import java.util.List;

/**
 * @param darkDistanceMeters     가로등 부족으로 인한 어두운 구간 길이(m). 가로등이 없는 간선 길이의 합
 * @param reportedDistanceMeters 시민 제보가 있는 구간 길이(m)
 * @param path                   지나는 교차로(노드) 목록
 * @param geometry               지도에 그릴 실제 도로 모양 좌표 (교차로 사이 굽은 길 포함)
 */
public record RouteResponse(
        double totalDistanceMeters,
        int estimatedMinutes,
        double darkDistanceMeters,
        double reportedDistanceMeters,
        List<Point> path,
        List<LatLng> geometry
) {
    public record LatLng(double latitude, double longitude) {
    }

    public record Point(Long nodeId, String name, double latitude, double longitude) {
    }
}
