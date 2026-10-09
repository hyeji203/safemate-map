package com.safemate.helpmap.service;

import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인하지 않은 사용자용: 브라우저가 발급한 deviceId를 Member.email 자리에 그대로 써서
 * 재방문 시 같은 회원으로 인식한다. 로그인 여부에 따른 선택은 CurrentMemberService가 한다.
 */
@Service
@RequiredArgsConstructor
public class AnonymousMemberService {

    private final MemberRepository memberRepository;

    public static String emailOf(String deviceId) {
        return "anon:" + deviceId;
    }

    @Transactional
    public Member findOrCreate(String deviceId) {
        String email = emailOf(deviceId);
        return memberRepository.findByEmail(email)
                .orElseGet(() -> memberRepository.save(new Member(email, "", "익명 사용자")));
    }
}
