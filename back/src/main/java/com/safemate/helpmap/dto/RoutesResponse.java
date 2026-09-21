package com.safemate.helpmap.dto;

/** 최단경로(거리 기준)와 안심경로(위험도 반영)를 함께 반환한다. */
public record RoutesResponse(RouteResponse shortest, RouteResponse safe) {
}
