package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.RouteResponse;

public interface RouteService {

    /** 출발/도착 좌표에서 가장 가까운 노드끼리 잇는 최단경로(거리 기준)를 반환한다. */
    RouteResponse findShortestRoute(double fromLat, double fromLng, double toLat, double toLng);
}
