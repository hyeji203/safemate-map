package com.safemate.helpmap.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safemate.helpmap.dto.PlaceResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * 카카오 로컬 API(REST API 키 사용) 연동 서비스.
 * 경로 탐색 화면의 출발지/도착지 주소·장소 검색에 사용. REST API 키는 서버 전용이므로 절대 프론트로 내려주지 않는다.
 */
@Service
public class KakaoLocalService {

    private static final String BASE_URL = "https://dapi.kakao.com";
    // 경로 탐색 시연 지역 중심(tools/build_osm_graph.py의 CENTER와 동일).
    // 검색 결과를 이 지점에서 가까운 순으로 정렬해, 그래프가 없는 먼 지역 결과보다 시연 지역 결과가 먼저 오게 한다.
    private static final double CENTER_LAT = 37.4488;
    private static final double CENTER_LNG = 127.1677;

    private final RestClient restClient;

    public KakaoLocalService(@Value("${kakao.rest-api-key}") String restApiKey) {
        this.restClient = RestClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "KakaoAK " + restApiKey)
                .build();
    }

    /** 키워드(장소명/주소 일부)로 장소·주소를 검색한다. 시연 지역과 가까운 순으로 정렬. */
    public List<PlaceResponse> searchKeyword(String query) {
        KeywordSearchResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/v2/local/search/keyword.json")
                        .queryParam("query", query)
                        .queryParam("x", CENTER_LNG)
                        .queryParam("y", CENTER_LAT)
                        .queryParam("sort", "distance")
                        .queryParam("size", 10)
                        .build())
                .retrieve()
                .body(KeywordSearchResponse.class);

        if (response == null || response.documents() == null) {
            return List.of();
        }
        return response.documents().stream()
                .map(d -> new PlaceResponse(
                        d.placeName(),
                        d.roadAddressName() != null && !d.roadAddressName().isBlank()
                                ? d.roadAddressName() : d.addressName(),
                        Double.parseDouble(d.y()),
                        Double.parseDouble(d.x())))
                .toList();
    }

    /** 카카오 키워드 검색 API 응답 중 필요한 필드만 옮겨 담는 파싱용 DTO. */
    record KeywordSearchResponse(List<Document> documents) {
        record Document(
                @JsonProperty("place_name") String placeName,
                @JsonProperty("address_name") String addressName,
                @JsonProperty("road_address_name") String roadAddressName,
                String x,
                String y) {
        }
    }
}
