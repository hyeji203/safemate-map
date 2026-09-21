package com.safemate.helpmap.dto;

import com.safemate.helpmap.entity.type.ReportCategory;

/**
 * 제보 등록 요청. multipart/form-data로 전달되며 사진은 컨트롤러에서 별도 MultipartFile로 받는다.
 * deviceId는 로그인 없는 익명 제보자를 구분하기 위한 값 (프론트에서 브라우저에 발급해 저장).
 */
public record ReportCreateRequest(
        String deviceId,
        double latitude,
        double longitude,
        ReportCategory category
) {
}
