package com.safemate.helpmap.controller;

import com.safemate.helpmap.dto.PlaceResponse;
import com.safemate.helpmap.service.KakaoLocalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** 지도 화면의 장소·주소 검색 (출발지/도착지 지정용). 카카오 REST API 키는 서버에서만 사용한다. */
@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor
public class PlaceController {

    private final KakaoLocalService kakaoLocalService;

    @GetMapping("/search")
    public List<PlaceResponse> search(@RequestParam String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return kakaoLocalService.searchKeyword(query);
    }

    // 안전시설 레이어 검색을 허용하는 지도 범위(위도·경도 각 변의 길이, 도). 약 3km. 이보다 넓으면 카카오를 호출하지 않는다
    private static final double FACILITY_MAX_SPAN_DEGREES = 0.03;

    /**
     * 지금 보이는 지도 범위 안의 안전시설 (지도 화면 안전시설 레이어).
     * type: convenience(편의점) | police(파출소·지구대). 범위가 너무 넓으면 빈 목록 (프론트는 확대 안내를 띄운다)
     */
    @GetMapping("/facilities")
    public ResponseEntity<List<PlaceResponse>> facilities(@RequestParam String type,
                                                          @RequestParam double swLat, @RequestParam double swLng,
                                                          @RequestParam double neLat, @RequestParam double neLng) {
        if (!type.equals("convenience") && !type.equals("police")) {
            return ResponseEntity.badRequest().build();
        }
        if (neLat <= swLat || neLng <= swLng
                || neLat - swLat > FACILITY_MAX_SPAN_DEGREES || neLng - swLng > FACILITY_MAX_SPAN_DEGREES) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(kakaoLocalService.searchFacilities(type, swLat, swLng, neLat, neLng));
    }

    /** 지도에서 누른 좌표의 장소 이름·주소. 주소도 없는 곳이면 204 */
    @GetMapping("/at")
    public ResponseEntity<PlaceResponse> findAt(@RequestParam double lat, @RequestParam double lng) {
        return kakaoLocalService.findPlaceAt(lat, lng)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** 좌표의 주소만 (제보 모달의 "선택 위치" 표시용). 도로명 주소 우선, 주소가 없는 곳이면 204 */
    @GetMapping("/address")
    public ResponseEntity<Map<String, String>> address(@RequestParam double lat, @RequestParam double lng) {
        String address = kakaoLocalService.coordToAddress(lat, lng);
        return address == null || address.isBlank()
                ? ResponseEntity.noContent().build()
                : ResponseEntity.ok(Map.of("address", address));
    }
}
