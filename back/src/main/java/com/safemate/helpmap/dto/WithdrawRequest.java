package com.safemate.helpmap.dto;

import jakarta.validation.constraints.NotBlank;

/** 회원탈퇴 요청. 본인 확인을 위해 비밀번호를 한 번 더 받는다 */
public record WithdrawRequest(@NotBlank String password) {
}
