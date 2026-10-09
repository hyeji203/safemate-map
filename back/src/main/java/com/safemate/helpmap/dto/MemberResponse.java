package com.safemate.helpmap.dto;

import com.safemate.helpmap.entity.Member;

public record MemberResponse(
        Long id,
        String email,
        String nickname,
        int reliabilityScore
) {
    public static MemberResponse from(Member member) {
        return new MemberResponse(
                member.getId(),
                member.getEmail(),
                member.getNickname(),
                member.getReliabilityScore()
        );
    }
}
