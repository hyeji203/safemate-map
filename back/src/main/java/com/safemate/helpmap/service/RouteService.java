package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.RoutesResponse;

public interface RouteService {

    /** 출발/도착 좌표에서 가장 가까운 노드끼리 잇는 최단경로와 안심경로를 함께 계산한다. */
    RoutesResponse findRoutes(double fromLat, double fromLng, double toLat, double toLng);
}
