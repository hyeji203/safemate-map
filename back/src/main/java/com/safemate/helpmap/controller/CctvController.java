package com.safemate.helpmap.controller;

import com.safemate.helpmap.dto.CctvResponse;
import com.safemate.helpmap.repository.CctvRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 시연 지역 CCTV 위치 (지도 화면 안전시설 레이어). data/cctv.csv가 없으면 빈 목록 */
@RestController
@RequestMapping("/api/cctvs")
@RequiredArgsConstructor
public class CctvController {

    private final CctvRepository cctvRepository;

    @GetMapping
    public List<CctvResponse> findAll() {
        return cctvRepository.findAll().stream()
                .map(c -> new CctvResponse(c.getId(), c.getLatitude(), c.getLongitude(), c.getPurpose(), c.getCameraCount()))
                .toList();
    }
}
