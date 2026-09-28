package com.safemate.helpmap.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safemate.helpmap.dto.PlaceResponse;
import com.safemate.helpmap.util.GeoUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 카카오 로컬 API(REST API 키 사용) 연동 서비스.
 * 지도 화면의 장소·주소 검색(출발지/도착지 지정)에 사용. REST API 키는 서버 전용이므로 절대 프론트로 내려주지 않는다.
 */
@Service
public class KakaoLocalService {

    private static final String BASE_URL = "https://dapi.kakao.com";
    // 경로 탐색 시연 지역 중심(tools/build_osm_graph.py의 CENTER와 동일).
    // 검색 결과를 이 지점에서 가까운 순으로 정렬해, 그래프가 없는 먼 지역 결과보다 시연 지역 결과가 먼저 오게 한다.
    private static final double CENTER_LAT = 37.4488;
    private static final double CENTER_LNG = 127.1677;

    // 지도를 눌렀을 때 건물 이름으로 찾은 장소를 인정하는 반경(m). 캠퍼스처럼 건물이 큰 곳도 잡히도록 넉넉하게
    private static final int BUILDING_PLACE_RADIUS_METERS = 50;
    // 건물 이름이 없을 때 주변 가게·역 등을 찾는 반경(m). 너무 넓으면 누른 곳과 상관없는 장소가 나온다
    private static final int NEARBY_PLACE_RADIUS_METERS = 20;
    // 카카오 로컬 API의 카테고리 그룹 코드 전체 (마트, 편의점, 학교, 지하철역, 음식점, 카페, 병원 등)
    private static final List<String> CATEGORY_GROUP_CODES = List.of(
            "MT1", "CS2", "PS3", "SC4", "AC5", "PK6", "OL7", "SW8", "BK9",
            "CT1", "AG2", "PO3", "AT4", "AD5", "FD6", "CE7", "HP8", "PM9");

    private final RestClient restClient;
    // 카테고리 검색은 코드마다 따로 호출해야 해서 한꺼번에 병렬로 보낸다
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

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
                        Double.parseDouble(d.x()),
                        lastCategory(d.categoryName()),
                        d.phone() == null ? "" : d.phone(),
                        d.placeUrl(),
                        d.distance() == null || d.distance().isBlank() ? 0 : Integer.parseInt(d.distance())))
                .toList();
    }

    /**
     * 지도에서 누른 좌표의 장소를 찾는다.
     * 1) 좌표 → 주소 변환으로 건물 이름을 얻고, 그 이름으로 주변 장소를 검색한다 (예: 신구대학 → 신구대학교 남관)
     * 2) 건물 이름이 없으면 주변의 가게·역·병원 등을 카테고리별로 찾아 가장 가까운 곳을 쓴다
     * 3) 둘 다 없으면 건물 이름이나 주소를 장소 이름으로 쓴다. 주소도 없는 곳이면 빈 값을 돌려준다
     */
    public Optional<PlaceResponse> findPlaceAt(double lat, double lng) {
        CoordToAddressResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/v2/local/geo/coord2address.json")
                        .queryParam("x", lng)
                        .queryParam("y", lat)
                        .build())
                .retrieve()
                .body(CoordToAddressResponse.class);
        if (response == null || response.documents() == null || response.documents().isEmpty()) {
            return Optional.empty();
        }

        CoordToAddressResponse.Document doc = response.documents().get(0);
        String buildingName = doc.roadAddress() == null || doc.roadAddress().buildingName() == null
                ? "" : doc.roadAddress().buildingName();
        String address = doc.roadAddress() != null ? doc.roadAddress().addressName()
                : doc.address() != null ? doc.address().addressName() : "";

        Optional<KeywordSearchResponse.Document> place = buildingName.isBlank()
                ? findNearestByCategory(lat, lng)
                : findNearestByKeyword(buildingName, lat, lng);
        if (place.isPresent()) {
            return place.map(this::toPlaceResponse);
        }

        return Optional.of(new PlaceResponse(
                buildingName.isBlank() ? address : buildingName, address, lat, lng, "", "", null,
                distanceFromCenter(lat, lng)));
    }

    private Optional<KeywordSearchResponse.Document> findNearestByKeyword(String query, double lat, double lng) {
        KeywordSearchResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/v2/local/search/keyword.json")
                        .queryParam("query", query)
                        .queryParam("x", lng)
                        .queryParam("y", lat)
                        .queryParam("radius", BUILDING_PLACE_RADIUS_METERS)
                        .queryParam("sort", "distance")
                        .queryParam("size", 1)
                        .build())
                .retrieve()
                .body(KeywordSearchResponse.class);
        if (response == null || response.documents() == null) {
            return Optional.empty();
        }
        return response.documents().stream().findFirst();
    }

    private Optional<KeywordSearchResponse.Document> findNearestByCategory(double lat, double lng) {
        List<CompletableFuture<List<KeywordSearchResponse.Document>>> futures = CATEGORY_GROUP_CODES.stream()
                .map(code -> CompletableFuture.supplyAsync(() -> searchCategory(code, lat, lng), executor))
                .toList();
        return futures.stream()
                .flatMap(f -> f.join().stream())
                .min(Comparator.comparingInt(d -> parseDistance(d.distance())));
    }

    private List<KeywordSearchResponse.Document> searchCategory(String code, double lat, double lng) {
        KeywordSearchResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/v2/local/search/category.json")
                        .queryParam("category_group_code", code)
                        .queryParam("x", lng)
                        .queryParam("y", lat)
                        .queryParam("radius", NEARBY_PLACE_RADIUS_METERS)
                        .queryParam("sort", "distance")
                        .queryParam("size", 1)
                        .build())
                .retrieve()
                .body(KeywordSearchResponse.class);
        return response == null || response.documents() == null ? List.of() : response.documents();
    }

    /** 지도에서 누른 곳 근처로 찾은 장소를 응답으로 바꾼다. distanceMeters는 시연 지역 중심 기준으로 다시 계산한다 */
    private PlaceResponse toPlaceResponse(KeywordSearchResponse.Document d) {
        double lat = Double.parseDouble(d.y());
        double lng = Double.parseDouble(d.x());
        return new PlaceResponse(
                d.placeName(),
                d.roadAddressName() != null && !d.roadAddressName().isBlank() ? d.roadAddressName() : d.addressName(),
                lat,
                lng,
                lastCategory(d.categoryName()),
                d.phone() == null ? "" : d.phone(),
                d.placeUrl(),
                distanceFromCenter(lat, lng));
    }

    private int distanceFromCenter(double lat, double lng) {
        return (int) Math.round(GeoUtils.haversineMeters(CENTER_LAT, CENTER_LNG, lat, lng));
    }

    private int parseDistance(String distance) {
        return distance == null || distance.isBlank() ? Integer.MAX_VALUE : Integer.parseInt(distance);
    }

    /** "음식점 > 간식 > 아이스크림" 에서 마지막 단계만 돌려준다 */
    private String lastCategory(String categoryName) {
        if (categoryName == null || categoryName.isBlank()) {
            return "";
        }
        String[] parts = categoryName.split(">");
        return parts[parts.length - 1].trim();
    }

    /**
     * 좌표를 주소로 변환한다 (제보 등록 시 위치를 사람이 읽을 수 있는 주소로 저장하는 용도).
     * 도로명 주소가 있으면 그걸 우선 쓰고, 없으면 지번 주소를 쓴다. 변환 실패 시 null.
     */
    public String coordToAddress(double latitude, double longitude) {
        CoordToAddressResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/v2/local/geo/coord2address.json")
                        .queryParam("x", longitude)
                        .queryParam("y", latitude)
                        .build())
                .retrieve()
                .body(CoordToAddressResponse.class);

        if (response == null || response.documents() == null || response.documents().isEmpty()) {
            return null;
        }
        var doc = response.documents().get(0);
        if (doc.roadAddress() != null && doc.roadAddress().addressName() != null && !doc.roadAddress().addressName().isBlank()) {
            return doc.roadAddress().addressName();
        }
        return doc.address() != null ? doc.address().addressName() : null;
    }

    /** 카카오 키워드 검색 API 응답 중 필요한 필드만 옮겨 담는 파싱용 DTO. */
    record KeywordSearchResponse(List<Document> documents) {
        record Document(
                @JsonProperty("place_name") String placeName,
                @JsonProperty("address_name") String addressName,
                @JsonProperty("road_address_name") String roadAddressName,
                @JsonProperty("category_name") String categoryName,
                String phone,
                @JsonProperty("place_url") String placeUrl,
                // 요청에 x, y를 넘겼을 때만 채워지는 중심점과의 거리(m, 문자열)
                String distance,
                String x,
                String y) {
        }
    }

    /** 카카오 좌표→주소 변환 API 응답 중 필요한 필드만 옮겨 담는 파싱용 DTO (지도 클릭 장소 조회, 제보 주소 저장에 같이 사용). */
    record CoordToAddressResponse(List<Document> documents) {
        record Document(
                @JsonProperty("road_address") RoadAddress roadAddress,
                Address address) {
        }

        record RoadAddress(
                @JsonProperty("address_name") String addressName,
                @JsonProperty("building_name") String buildingName) {
        }

        record Address(@JsonProperty("address_name") String addressName) {
        }
    }
}
