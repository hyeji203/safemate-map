package com.safemate.helpmap.dto;

/**
 * 주소/장소 검색 결과 한 건. 지도 화면의 장소 정보 카드와 출발지/도착지 후보로 쓴다.
 *
 * @param categoryName   카카오 분류의 마지막 단계 (예: "아이스크림"). 없으면 빈 문자열
 * @param phone          전화번호. 없으면 빈 문자열
 * @param placeUrl       카카오맵 장소 상세 페이지 URL
 * @param distanceMeters 시연 지역 중심에서의 거리(m)
 * @param nearby         장소 검색에서 "가까운 곳" 묶음(아래쪽)에 속하는 결과인지. 검색어와 잘 맞는 위쪽 결과와 지도 클릭 결과는 false
 */
public record PlaceResponse(String placeName, String addressName, double latitude, double longitude,
                            String categoryName, String phone, String placeUrl, int distanceMeters,
                            boolean nearby) {
}
