package com.safemate.helpmap.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 마이페이지 - 자주 가는 장소(집/학교 등) 즐겨찾기. 선택 시 그 좌표로 바로 경로 계산에 연결하는 용도.
 */
@Entity
@Table(name = "favorites")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Favorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member owner;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    // 목록에 좌표 대신 보여줄 주소. 장소 검색 결과에 주소가 없을 수 있어 nullable
    private String address;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Favorite(Member owner, String label, double latitude, double longitude, String address) {
        this.owner = owner;
        this.label = label;
        this.latitude = latitude;
        this.longitude = longitude;
        this.address = address;
    }
}
