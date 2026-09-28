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

    /** 지도에서 누른 좌표의 장소 이름·주소. 주소도 없는 곳이면 204 */
    @GetMapping("/at")
    public ResponseEntity<PlaceResponse> findAt(@RequestParam double lat, @RequestParam double lng) {
        return kakaoLocalService.findPlaceAt(lat, lng)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
