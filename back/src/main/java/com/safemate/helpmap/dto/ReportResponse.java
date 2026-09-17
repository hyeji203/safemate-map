package com.safemate.helpmap.dto;

import com.safemate.helpmap.entity.Report;
import com.safemate.helpmap.entity.type.ReportCategory;

import java.time.LocalDateTime;

/**
 * 지도 위 마커 표시용 응답. 제보자 개인정보는 노출하지 않는다.
 */
public record ReportResponse(
        Long id,
        double latitude,
        double longitude,
        ReportCategory category,
        LocalDateTime createdAt
) {
    public static ReportResponse from(Report report) {
        return new ReportResponse(
                report.getId(),
                report.getLatitude(),
                report.getLongitude(),
                report.getCategory(),
                report.getCreatedAt()
        );
    }
}
