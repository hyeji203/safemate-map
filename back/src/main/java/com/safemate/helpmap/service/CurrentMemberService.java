package com.safemate.helpmap.service;

import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.repository.MemberRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * 요청을 보낸 "현재 사용자"를 정한다. 제보·즐겨찾기 등 여러 기능에서 공통으로 사용.
 * 로그인한 상태(세션에 회원 id가 있음)면 그 계정, 아니면 기존처럼 브라우저 deviceId 기반 익명 회원.
 */
@Service
@RequiredArgsConstructor
public class CurrentMemberService {

    public static final String SESSION_MEMBER_ID = "LOGIN_MEMBER_ID";

    private final HttpServletRequest request;
    private final MemberRepository memberRepository;
    private final AnonymousMemberService anonymousMemberService;

    public Optional<Member> loggedInMember() {
        // getSession(false): 익명 요청마다 빈 세션이 새로 만들어지지 않도록 있는 세션만 본다
        HttpSession session = request.getSession(false);
        if (session == null || !(session.getAttribute(SESSION_MEMBER_ID) instanceof Long memberId)) {
            return Optional.empty();
        }
        return memberRepository.findById(memberId);
    }

    @Transactional
    public Member resolve(String deviceId) {
        return loggedInMember().orElseGet(() -> anonymousMemberService.findOrCreate(deviceId));
    }

    /** 조회·본인 확인용. 익명 회원을 새로 만들지 않고 이메일만 계산한다. */
    public String currentEmail(String deviceId) {
        return loggedInMember()
                .map(Member::getEmail)
                .orElseGet(() -> AnonymousMemberService.emailOf(deviceId));
    }
}
