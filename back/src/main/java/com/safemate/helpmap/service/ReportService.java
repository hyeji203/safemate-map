package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.ReportCreateRequest;
import com.safemate.helpmap.dto.ReportResponse;

import java.util.List;

public interface ReportService {

    ReportResponse create(ReportCreateRequest request);

    List<ReportResponse> findAll();
}
