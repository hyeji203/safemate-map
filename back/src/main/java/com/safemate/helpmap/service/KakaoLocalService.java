package com.safemate.helpmap.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * 카카오 로컬 API(REST API 키 사용) 연동 서비스.
 * 주소 -> 좌표 변환, 장소 검색 등에 사용. REST API 키는 서버 전용이므로 절대 프론트로 내려주지 않는다.
 */
@Service
public class KakaoLocalService {

    private static final String BASE_URL = "https://dapi.kakao.com";

    private final RestClient restClient;

    public KakaoLocalService(@Value("${kakao.rest-api-key}") String restApiKey) {
        this.restClient = RestClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "KakaoAK " + restApiKey)
                .build();
    }

    /**
     * 주소 문자열 -> 좌표 변환. (예: "서울 강남구 테헤란로 411")
     * TODO(1단계): 실제 응답 파싱용 DTO 추가하고 좌표(x=경도, y=위도) 반환하도록 구현
     */
    public String searchAddress(String query) {
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/v2/local/search/address.json")
                        .queryParam("query", query)
                        .build())
                .retrieve()
                .body(String.class);
    }
}
