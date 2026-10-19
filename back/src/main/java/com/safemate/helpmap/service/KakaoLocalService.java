package com.safemate.helpmap.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safemate.helpmap.dto.PlaceResponse;
import com.safemate.helpmap.util.GeoUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 카카오 로컬 API(REST API 키 사용) 연동 서비스.
 * 지도 화면의 장소·주소 검색(출발지/도착지 지정)에 사용. REST API 키는 서버 전용이므로 절대 프론트로 내려주지 않는다.
 */
@Service
public class KakaoLocalService {

    private static final String BASE_URL = "https://dapi.kakao.com";
    // 경로 탐색 시연 지역 중심(tools/build_osm_graph.py의 BBOX 가운데, 단대오거리역 근처).
    // 검색 반경의 기준점. 같은 정확도면 이 지점에서 가까운 결과가 먼저 오고, 반경 밖 먼 지역 결과는 빠진다.
    private static final double CENTER_LAT = 37.4465;
    private static final double CENTER_LNG = 127.1565;

    // 장소 검색 반경(m). 카카오 API 최대값. 성남·서울 동남권 정도까지 들어온다
    private static final int SEARCH_RADIUS_METERS = 20000;
    // 검색 결과: 검색어와 잘 맞는 것 위쪽 몇 개 + 가까운 것 아래쪽 몇 개 (겹치면 하나만)
    private static final int ACCURATE_RESULT_COUNT = 7;
    private static final int NEARBY_RESULT_COUNT = 8;

    // 지도를 눌렀을 때 건물 이름으로 찾은 장소를 인정하는 반경(m). 캠퍼스처럼 건물이 큰 곳도 잡히도록 넉넉하게
    private static final int BUILDING_PLACE_RADIUS_METERS = 50;
    // 건물 이름이 없을 때 주변 가게·역 등을 찾는 반경(m). 너무 넓으면 누른 곳과 상관없는 장소가 나온다
    private static final int NEARBY_PLACE_RADIUS_METERS = 20;
    // 카카오 로컬 API의 카테고리 그룹 코드 전체 (마트, 편의점, 학교, 지하철역, 음식점, 카페, 병원 등)
    private static final List<String> CATEGORY_GROUP_CODES = List.of(
            "MT1", "CS2", "PS3", "SC4", "AC5", "PK6", "OL7", "SW8", "BK9",
            "CT1", "AG2", "PO3", "AT4", "AD5", "FD6", "CE7", "HP8", "PM9");

    private final RestClient restClient;
    // 카테고리 검색은 코드마다 따로 호출해야 해서 한꺼번에 병렬로 보낸다 (키워드 검색의 정확도순/거리순 두 번 호출도 같이 쓴다)
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public KakaoLocalService(@Value("${kakao.rest-api-key}") String restApiKey) {
        this.restClient = RestClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "KakaoAK " + restApiKey)
                .build();
    }

    /**
     * 키워드(장소명/주소 일부)로 장소·주소를 검색한다.
     * 검색어와 잘 맞는 결과(accuracy)를 먼저 보여주고, 그 아래에 시연 지역에서 가까운 결과(distance)를 이어 붙인다(중복 제외).
     * 가까운 순만 쓰면 "신구대" 검색에 신구대학교 대신 근처 "○○ 신구대점" 가게들만 나오고,
     * 정확도 순만 쓰면 동네 가게를 찾기 어려워서 둘을 합친다.
     * 둘 다 시연 지역 중심에서 SEARCH_RADIUS_METERS 안으로 제한해 대전 신흥역 같은 먼 동명 장소는 뺀다.
     */
    public List<PlaceResponse> searchKeyword(String query) {
        CompletableFuture<List<KeywordSearchResponse.Document>> accurate =
                CompletableFuture.supplyAsync(() -> searchKeyword(query, "accuracy", ACCURATE_RESULT_COUNT), executor);
        CompletableFuture<List<KeywordSearchResponse.Document>> nearby =
                CompletableFuture.supplyAsync(() -> searchKeyword(query, "distance", NEARBY_RESULT_COUNT), executor);

        List<PlaceResponse> accurateResults = accurate.join().stream().map(d -> toSearchResult(d, false)).toList();
        // "가까운 곳"에는 위쪽 결과 중 가장 먼 것보다 가까운 장소만 넣는다.
        // 스타벅스처럼 위쪽이 이미 가까운 순이면 아래에 더 먼 지점만 붙어서 "가까운 곳"이라는 이름과 안 맞는다.
        int farthestAccurate = accurateResults.stream().mapToInt(PlaceResponse::distanceMeters).max().orElse(Integer.MAX_VALUE);

        // placeUrl 기준으로 중복 제거. 정확도순에 이미 있는 장소는 위쪽(nearby=false)에 남는다
        Map<String, PlaceResponse> merged = new LinkedHashMap<>();
        Stream.concat(
                        accurateResults.stream(),
                        nearby.join().stream()
                                .map(d -> toSearchResult(d, true))
                                .filter(p -> p.distanceMeters() < farthestAccurate))
                .forEach(p -> merged.putIfAbsent(p.placeUrl(), p));
        return List.copyOf(merged.values());
    }

    private PlaceResponse toSearchResult(KeywordSearchResponse.Document d, boolean nearby) {
        return new PlaceResponse(
                d.placeName(),
                d.roadAddressName() != null && !d.roadAddressName().isBlank() ? d.roadAddressName() : d.addressName(),
                Double.parseDouble(d.y()),
                Double.parseDouble(d.x()),
                lastCategory(d.categoryName()),
                d.phone() == null ? "" : d.phone(),
                d.placeUrl(),
                d.distance() == null || d.distance().isBlank() ? 0 : Integer.parseInt(d.distance()),
                nearby);
    }

    private List<KeywordSearchResponse.Document> searchKeyword(String query, String sort, int size) {
        KeywordSearchResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/v2/local/search/keyword.json")
                        .queryParam("query", query)
                        .queryParam("x", CENTER_LNG)
                        .queryParam("y", CENTER_LAT)
                        .queryParam("radius", SEARCH_RADIUS_METERS)
                        .queryParam("sort", sort)
                        .queryParam("size", size)
                        .build())
                .retrieve()
                .body(KeywordSearchResponse.class);
        return response == null || response.documents() == null ? List.of() : response.documents();
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
                distanceFromCenter(lat, lng), false));
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

    /**
     * 지도 화면 "안전시설 레이어": 지금 보이는 지도 범위(rect) 안의 편의점 / 파출소·지구대.
     * - convenience: 카테고리 검색 CS2(편의점). 카카오 API에 영업시간이 없어 24시 여부는 거르지 않는다
     * - police: 키워드 "지구대", "파출소"를 공공기관(PO3)으로 한정해 검색 (PO3만 쓰면 주민센터·우체국 등이 섞인다)
     * 한 번에 최대 15개씩 FACILITY_MAX_PAGES 페이지까지만 받는다 (카카오 API 상한 45개). 같은 장소는 placeUrl로 하나만.
     */
    public List<PlaceResponse> searchFacilities(String type, double swLat, double swLng, double neLat, double neLng) {
        String rect = swLng + "," + swLat + "," + neLng + "," + neLat;
        List<CompletableFuture<List<KeywordSearchResponse.Document>>> futures = switch (type) {
            case "convenience" -> List.of(
                    CompletableFuture.supplyAsync(() -> searchInRect(null, "CS2", rect), executor));
            case "police" -> POLICE_KEYWORDS.stream()
                    .map(keyword -> CompletableFuture.supplyAsync(() -> searchInRect(keyword, "PO3", rect), executor))
                    .toList();
            default -> throw new IllegalArgumentException("알 수 없는 시설 종류: " + type);
        };
        Map<String, PlaceResponse> merged = new LinkedHashMap<>();
        futures.stream()
                .flatMap(f -> f.join().stream())
                .map(this::toPlaceResponse)
                .forEach(p -> merged.putIfAbsent(p.placeUrl(), p));
        return List.copyOf(merged.values());
    }

    private static final List<String> POLICE_KEYWORDS = List.of("지구대", "파출소");
    private static final int FACILITY_PAGE_SIZE = 15; // 카카오 API 최대값
    private static final int FACILITY_MAX_PAGES = 3; // 카카오 API는 45개(3페이지)까지만 준다

    /** keyword가 null이면 카테고리 검색, 있으면 그 카테고리로 한정한 키워드 검색. 마지막 페이지(is_end)까지 이어 받는다 */
    private List<KeywordSearchResponse.Document> searchInRect(String keyword, String categoryCode, String rect) {
        List<KeywordSearchResponse.Document> results = new ArrayList<>();
        for (int page = 1; page <= FACILITY_MAX_PAGES; page++) {
            int currentPage = page;
            PagedSearchResponse response = restClient.get()
                    .uri(uriBuilder -> {
                        uriBuilder.path(keyword == null ? "/v2/local/search/category.json" : "/v2/local/search/keyword.json")
                                .queryParam("category_group_code", categoryCode)
                                .queryParam("rect", rect)
                                .queryParam("size", FACILITY_PAGE_SIZE)
                                .queryParam("page", currentPage);
                        if (keyword != null) {
                            uriBuilder.queryParam("query", keyword);
                        }
                        return uriBuilder.build();
                    })
                    .retrieve()
                    .body(PagedSearchResponse.class);
            if (response == null || response.documents() == null) {
                break;
            }
            results.addAll(response.documents());
            if (response.meta() == null || response.meta().isEnd()) {
                break;
            }
        }
        return results;
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
                distanceFromCenter(lat, lng),
                false);
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

    // 지하철역 장소 이름 (예: "남한산성입구역 8호선", "남한산성입구역"). 이런 이름일 때만 출구를 찾는다
    private static final Pattern STATION_NAME = Pattern.compile("^\\S+역( \\S+선)?$");
    private static final Pattern EXIT_NUMBER = Pattern.compile("(\\d+)번\\s*출구");
    // 출구 번호를 1번부터 이만큼까지 찾아본다. 시연 지역 역은 출구가 4~7개
    private static final int MAX_EXIT_NUMBER = 12;
    // 역 좌표에서 이 거리(m) 안의 출구만 그 역 출구로 본다. 번호 검색에 옆 역 출구가 섞여 나오는 것을 거른다
    private static final int EXIT_RADIUS_METERS = 400;

    /** 지하철역 출구 한 곳. label은 "4번 출구" */
    public record SubwayExit(int number, String label, double latitude, double longitude) {
    }

    /**
     * 지하철역 장소의 출구 목록. 카카오는 "역 출구"로 한꺼번에 검색하면 출구 대신 주변 가게를 주므로
     * "남한산성입구역 8호선 1번출구"처럼 번호마다 따로 검색한다 (병렬). 역 이름이 아니거나 출구를 못 찾으면 빈 목록.
     * 임시 폐쇄된 출구는 뺀다.
     */
    public List<SubwayExit> findSubwayExits(String placeName, double lat, double lng) {
        if (placeName == null || !STATION_NAME.matcher(placeName.trim()).matches()) {
            return List.of();
        }
        String station = placeName.trim();
        List<CompletableFuture<Optional<SubwayExit>>> futures = new ArrayList<>();
        for (int n = 1; n <= MAX_EXIT_NUMBER; n++) {
            int number = n;
            futures.add(CompletableFuture.supplyAsync(() -> findSubwayExit(station, number, lat, lng), executor));
        }
        return futures.stream().map(CompletableFuture::join).flatMap(Optional::stream).toList();
    }

    private Optional<SubwayExit> findSubwayExit(String station, int number, double lat, double lng) {
        KeywordSearchResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/v2/local/search/keyword.json")
                        .queryParam("query", station + " " + number + "번출구")
                        .queryParam("x", lng)
                        .queryParam("y", lat)
                        .queryParam("radius", EXIT_RADIUS_METERS)
                        .queryParam("size", 3)
                        .build())
                .retrieve()
                .body(KeywordSearchResponse.class);
        if (response == null || response.documents() == null) {
            return Optional.empty();
        }
        return response.documents().stream()
                .filter(d -> d.categoryName() != null && d.categoryName().endsWith("지하철출구"))
                .filter(d -> d.placeName().startsWith(station) && !d.placeName().contains("폐쇄"))
                .filter(d -> {
                    Matcher m = EXIT_NUMBER.matcher(d.placeName());
                    return m.find() && Integer.parseInt(m.group(1)) == number;
                })
                .findFirst()
                .map(d -> new SubwayExit(number, number + "번 출구", Double.parseDouble(d.y()), Double.parseDouble(d.x())));
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

    /** 여러 페이지를 이어 받는 검색(안전시설 레이어)용. 마지막 페이지 여부(meta.is_end)를 같이 읽는다 */
    record PagedSearchResponse(Meta meta, List<KeywordSearchResponse.Document> documents) {
        record Meta(@JsonProperty("is_end") boolean isEnd) {
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
