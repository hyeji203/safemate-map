package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.RoutesResponse;

public interface RouteService {

    /**
     * 출발/도착 좌표를 도로에 붙여 최단경로와 안심경로를 함께 계산한다.
     *
     * @param fromAddress 출발 장소 주소 (도로명주소면 출입구가 면한 도로를 고르는 데 쓴다). 없으면 null
     * @param toAddress   도착 장소 주소. 없으면 null
     * @param fromName    출발 장소 이름. 지하철역(예: "남한산성입구역 8호선")이면 가장 빠른 출구에서 출발한다. 없으면 null
     * @param toName      도착 장소 이름. 지하철역이면 가장 빠른 출구로 들어간다. 없으면 null
     */
    RoutesResponse findRoutes(double fromLat, double fromLng, double toLat, double toLng,
                              String fromAddress, String toAddress, String fromName, String toName);
}
