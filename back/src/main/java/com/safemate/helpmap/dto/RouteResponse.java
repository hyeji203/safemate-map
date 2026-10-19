package com.safemate.helpmap.dto;

import java.util.List;

/**
 * @param darkDistanceMeters     가로등 부족으로 인한 어두운 구간 길이(m). 가로등이 없는 간선 길이의 합
 * @param reportedDistanceMeters 시민 제보가 있는 구간 길이(m)
 * @param path                   지나는 교차로(노드) 목록
 * @param geometry               지도에 그릴 실제 도로 모양 좌표 (교차로 사이 굽은 길 포함, 큰 도로는 보도 쪽으로 옮김)
 * @param crossings              큰 도로를 건너는 횡단보도 구간 (geometry 위의 두 점).
 *                               hasSignal = 공공데이터상 보행자 신호등이 있는 횡단보도 (false면 없거나 데이터에 없음)
 * @param fromExit               출발지가 지하철역이면 이 경로가 나오는 출구 (역 가운데 대신 출구에서 출발). 역이 아니면 null
 * @param toExit                 도착지가 지하철역이면 이 경로가 들어가는 출구. 역이 아니면 null
 */
public record RouteResponse(
        double totalDistanceMeters,
        int estimatedMinutes,
        double darkDistanceMeters,
        double reportedDistanceMeters,
        List<Point> path,
        List<LatLng> geometry,
        List<Crossing> crossings,
        Exit fromExit,
        Exit toExit
) {
    /**
     * 지하철역 출구. label은 "4번 출구".
     * type: "ESCALATOR"(출구 에스컬레이터 있음) | "STAIRS"(계단만) | null(모름, 서울교통공사 역이 아닌 경우 등)
     */
    public record Exit(String label, double latitude, double longitude, String type) {
    }

    public record LatLng(double latitude, double longitude) {
    }

    public record Crossing(LatLng start, LatLng end, boolean hasSignal) {
    }

    public record Point(Long nodeId, String name, double latitude, double longitude) {
    }
}
