package com.safemate.helpmap.service;

import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인 없는 MVP용 임시 처리: 브라우저가 발급한 deviceId를 Member.email 자리에 그대로 써서
 * 재방문 시 같은 회원으로 인식한다. 제보·즐겨찾기 등 여러 기능에서 공통으로 사용.
 * 정식 로그인이 붙으면 이 클래스만 교체하면 됨.
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
