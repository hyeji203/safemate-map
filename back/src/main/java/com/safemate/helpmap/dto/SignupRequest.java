package com.safemate.helpmap.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * deviceId: 가입 전 이 브라우저에서 익명으로 남긴 제보·즐겨찾기를 새 계정으로 옮기기 위한 값.
 */
public record SignupRequest(
        @NotBlank @Email @Size(max = 100) String email,
        @NotBlank @Size(min = 8, max = 64) String password,
        @NotBlank @Size(max = 20) String nickname,
        @NotBlank String deviceId
) {
}
