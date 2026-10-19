package com.safemate.helpmap.controller;

import com.safemate.helpmap.dto.ReportCreateRequest;
import com.safemate.helpmap.dto.ReportResponse;
import com.safemate.helpmap.entity.type.ReportCategory;
import com.safemate.helpmap.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ReportResponse> create(
            @RequestParam String deviceId,
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam ReportCategory category,
            @RequestPart(required = false) MultipartFile image
    ) {
        var request = new ReportCreateRequest(deviceId, latitude, longitude, category);
        ReportResponse response = reportService.create(request, image);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public List<ReportResponse> findAll() {
        return reportService.findAll();
    }

    @GetMapping("/mine")
    public List<ReportResponse> findMine(@RequestParam String deviceId) {
        return reportService.findMine(deviceId);
    }

    /** 탈퇴한 사용자가 남긴 제보를 "해결됐어요"로 지운다 (누구나 가능) */
    @PostMapping("/{id}/resolve")
    public ResponseEntity<Void> resolve(@PathVariable Long id) {
        reportService.resolve(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestParam String deviceId) {
        reportService.delete(id, deviceId);
        return ResponseEntity.noContent().build();
    }
}
