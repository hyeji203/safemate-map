package com.safemate.helpmap.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 최소 사용자 구분용 엔티티 (제보자 식별, 중복 제보 방지, 신뢰도 점수 관리).
 */
@Entity
@Table(name = "members")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String nickname;

    // 어뷰징 방지용 신뢰도 점수 (고도화 단계에서 실제 계산 로직 추가 예정)
    @Column(nullable = false)
    private int reliabilityScore = 100;

    public Member(String email, String password, String nickname) {
        this.email = email;
        this.password = password;
        this.nickname = nickname;
    }
}
