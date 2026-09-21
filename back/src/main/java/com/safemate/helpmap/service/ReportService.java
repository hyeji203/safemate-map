package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.ReportCreateRequest;
import com.safemate.helpmap.dto.ReportResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface ReportService {

    ReportResponse create(ReportCreateRequest request, MultipartFile image);

    List<ReportResponse> findAll();
}
