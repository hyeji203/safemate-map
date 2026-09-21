package com.safemate.helpmap.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 가로등(보안등) 위치. 제보(Report)와 달리 시간이 지나도 사라지지 않는 고정 인프라 데이터이며,
 * 간선 주변 가로등 밀도로 위험 가중치를 계산하는 데 쓴다 (2단계).
 */
@Entity
@Table(name = "street_lights")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StreetLight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    // 한 지점에 설치된 가로등 수 (공공데이터의 '설치개수')
    @Column(nullable = false)
    private int installCount = 1;

    public StreetLight(double latitude, double longitude, int installCount) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.installCount = installCount;
    }
}
