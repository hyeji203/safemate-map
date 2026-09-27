package com.safemate.helpmap.dto;

/** 주소/장소 검색 결과 한 건. 경로 탐색 화면에서 출발지/도착지 후보로 쓴다. */
public record PlaceResponse(String placeName, String addressName, double latitude, double longitude) {
}
