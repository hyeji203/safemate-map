package com.safemate.helpmap.controller;

import com.safemate.helpmap.dto.LoginRequest;
import com.safemate.helpmap.dto.MemberResponse;
import com.safemate.helpmap.dto.SignupRequest;
import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.service.CurrentMemberService;
import com.safemate.helpmap.service.MemberService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 로그인 상태는 서버 세션(JSESSIONID 쿠키)으로 유지한다.
 * 프론트는 Vite proxy로 같은 출처에서 호출하므로 쿠키가 자동으로 오간다.
 */
@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;
    private final CurrentMemberService currentMemberService;

    @PostMapping("/signup")
    public ResponseEntity<MemberResponse> signup(@RequestBody @Valid SignupRequest request, HttpServletRequest httpRequest) {
        Member member = memberService.signup(request);
        startSession(httpRequest, member);
        return ResponseEntity.status(HttpStatus.CREATED).body(MemberResponse.from(member));
    }

    @PostMapping("/login")
    public MemberResponse login(@RequestBody @Valid LoginRequest request, HttpServletRequest httpRequest) {
        Member member = memberService.login(request);
        startSession(httpRequest, member);
        return MemberResponse.from(member);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.noContent().build();
    }

    /** 로그인 안 한 상태면 204(본문 없음) */
    @GetMapping("/me")
    public ResponseEntity<MemberResponse> me() {
        return currentMemberService.loggedInMember()
                .map(member -> ResponseEntity.ok(MemberResponse.from(member)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    // 로그인 전 세션을 버리고 새로 발급해서, 미리 심어둔 세션 id로 남의 로그인을 가로채는 공격(세션 고정)을 막는다
    private void startSession(HttpServletRequest httpRequest, Member member) {
        HttpSession old = httpRequest.getSession(false);
        if (old != null) {
            old.invalidate();
        }
        httpRequest.getSession(true).setAttribute(CurrentMemberService.SESSION_MEMBER_ID, member.getId());
    }
}
