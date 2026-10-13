package com.safemate.helpmap.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * CCTV 위치. 가로등처럼 고정 인프라 데이터로, 지도 화면 "안전시설 레이어"의 CCTV 표시에만 쓴다 (경로 위험도 계산에는 아직 안 씀).
 */
@Entity
@Table(name = "cctvs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Cctv {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    // 공공데이터의 '설치목적구분' (생활방범, 어린이보호, 교통단속 등)
    @Column(nullable = false, length = 50)
    private String purpose;

    // 한 지점에 설치된 카메라 수 (공공데이터의 '카메라대수')
    @Column(nullable = false)
    private int cameraCount = 1;

    public Cctv(double latitude, double longitude, String purpose, int cameraCount) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.purpose = purpose;
        this.cameraCount = cameraCount;
    }
}
