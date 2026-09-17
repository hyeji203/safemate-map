package com.safemate.helpmap.dto;

import com.safemate.helpmap.entity.type.ReportCategory;
import jakarta.validation.constraints.NotNull;

/**
 * POST /api/reports 요청 바디. 지도 클릭 좌표 + 선택한 카테고리.
 */
public record ReportCreateRequest(
        @NotNull Long reporterId,
        @NotNull Double latitude,
        @NotNull Double longitude,
        @NotNull ReportCategory category
) {
}
