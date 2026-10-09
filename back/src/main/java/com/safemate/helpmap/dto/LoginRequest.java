package com.safemate.helpmap.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * deviceId: 로그인 전 이 브라우저에서 익명으로 남긴 제보·즐겨찾기를 계정으로 옮기기 위한 값.
 */
public record LoginRequest(
        @NotBlank String email,
        @NotBlank String password,
        @NotBlank String deviceId
) {
}
