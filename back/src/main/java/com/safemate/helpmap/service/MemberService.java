package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.LoginRequest;
import com.safemate.helpmap.dto.SignupRequest;
import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.repository.FavoriteRepository;
import com.safemate.helpmap.repository.MemberRepository;
import com.safemate.helpmap.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

/**
 * 이메일·비밀번호 회원가입/로그인. 로그인 상태 유지(세션)는 MemberController가 맡는다.
 * 로그인은 선택 사항이라, 로그인하지 않은 사용자는 계속 AnonymousMemberService의 익명 회원으로 이용한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    /**
     * 탈퇴한 회원의 제보를 넘겨받는 계정. 제보는 다른 사람의 안심경로에 계속 쓰이도록 이 계정의 익명 제보로 남긴다.
     * 이메일 형식이 아니라서 회원가입으로는 같은 계정을 만들 수 없고, 비밀번호가 비어 있어 로그인도 되지 않는다.
     */
    public static final String WITHDRAWN_EMAIL = "withdrawn:system";

    private final MemberRepository memberRepository;
    private final ReportRepository reportRepository;
    private final FavoriteRepository favoriteRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public Member signup(SignupRequest request) {
        String email = normalize(request.email());
        if (memberRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 가입된 이메일입니다.");
        }
        Member member = memberRepository.save(
                new Member(email, passwordEncoder.encode(request.password()), request.nickname().strip()));
        moveAnonymousData(request.deviceId(), member);
        return member;
    }

    @Transactional
    public Member login(LoginRequest request) {
        // 익명 회원(anon:...)은 비밀번호가 비어 있어 matches가 항상 false라 여기서 로그인되지 않는다
        Member member = memberRepository.findByEmail(normalize(request.email()))
                .filter(m -> passwordEncoder.matches(request.password(), m.getPassword()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."));
        moveAnonymousData(request.deviceId(), member);
        return member;
    }

    /**
     * 회원탈퇴: 비밀번호를 확인한 뒤 즐겨찾기와 계정을 지우고, 올린 제보는 "탈퇴한 사용자" 계정으로 넘겨 익명으로 남긴다.
     * 이렇게 남은 제보는 다른 사용자가 "해결됐어요"로 지울 수 있다 (ReportService.resolve).
     */
    @Transactional
    public void withdraw(Long memberId, String password) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        if (!passwordEncoder.matches(password, member.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비밀번호가 올바르지 않습니다.");
        }
        reportRepository.changeReporter(member, withdrawnMember());
        favoriteRepository.deleteByOwner(member);
        memberRepository.delete(member);
    }

    private Member withdrawnMember() {
        return memberRepository.findByEmail(WITHDRAWN_EMAIL)
                .orElseGet(() -> memberRepository.save(new Member(WITHDRAWN_EMAIL, "", "탈퇴한 사용자")));
    }

    // 로그인 전에 이 브라우저에서 익명으로 남긴 제보·즐겨찾기를 계정으로 옮겨, 로그인 후에도 "내 제보"에 그대로 보이게 한다.
    private void moveAnonymousData(String deviceId, Member account) {
        memberRepository.findByEmail(AnonymousMemberService.emailOf(deviceId))
                .filter(anonymous -> !anonymous.getId().equals(account.getId()))
                .ifPresent(anonymous -> {
                    reportRepository.changeReporter(anonymous, account);
                    favoriteRepository.changeOwner(anonymous, account);
                });
    }

    private static String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
