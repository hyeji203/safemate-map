package com.safemate.helpmap.dto;

import com.safemate.helpmap.entity.Report;
import com.safemate.helpmap.entity.type.ReportCategory;

import java.time.LocalDateTime;

/**
 * 지도 위 마커 표시용 응답. 제보자 개인정보는 노출하지 않는다.
 * withdrawnReporter: 제보자가 탈퇴해 익명으로 남은 제보인지. 이런 제보는 누구나 "해결됐어요"로 지울 수 있다.
 */
public record ReportResponse(
        Long id,
        double latitude,
        double longitude,
        ReportCategory category,
        String imageUrl,
        String address,
        LocalDateTime createdAt,
        boolean withdrawnReporter
) {
    public static ReportResponse from(Report report) {
        return from(report, false);
    }

    public static ReportResponse from(Report report, boolean withdrawnReporter) {
        String imageUrl = report.getImagePath() == null ? null : "/uploads/" + report.getImagePath();
        return new ReportResponse(
                report.getId(),
                report.getLatitude(),
                report.getLongitude(),
                report.getCategory(),
                imageUrl,
                report.getAddress(),
                report.getCreatedAt(),
                withdrawnReporter
        );
    }
}
