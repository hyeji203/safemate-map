package com.safemate.helpmap.entity.type;

/**
 * 위험구간 제보 카테고리.
 * STREETLIGHT_BROKEN, EMPTY_STREET = 객관적/체감 위험 구분은 고도화 단계(차등 가중치)에서 사용.
 */
public enum ReportCategory {
    STREETLIGHT_BROKEN, // 가로등 고장
    DARK_ALLEY,         // 어두움
    EMPTY_STREET,       // 인적 드묾
    SIDEWALK_DAMAGED    // 인도 파손
}
