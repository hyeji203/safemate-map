package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.ReportCreateRequest;
import com.safemate.helpmap.dto.ReportResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface ReportService {

    ReportResponse create(ReportCreateRequest request, MultipartFile image);

    List<ReportResponse> findAll();

    List<ReportResponse> findMine(String deviceId);

    void delete(Long reportId, String deviceId);

    /** 탈퇴한 회원이 남긴 제보를 "해결됐어요"로 지운다. 다른 제보는 403 */
    void resolve(Long reportId);
}
