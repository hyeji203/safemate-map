package com.safemate.helpmap.dto;

import java.util.List;

public record RouteResponse(
        double totalDistanceMeters,
        int estimatedMinutes,
        List<Point> path
) {
    public record Point(Long nodeId, String name, double latitude, double longitude) {
    }
}
