package com.safemate.helpmap.service;

/**
 * 간선 하나의 위험도 구성.
 *
 * @param darkness   가로등 부족으로 인한 어두움 (0 = 충분히 밝음, 1 = 가로등 없음)
 * @param reportRisk 시민 제보로 인한 위험 (0 = 제보 없음, 1 = 제보 다수)
 */
public record EdgeRisk(double darkness, double reportRisk) {

    /** 경로 비용 계산에 쓰는 종합 위험도 (0 ~ 2) */
    public double total() {
        return darkness + reportRisk;
    }

    public boolean hasReport() {
        return reportRisk > 0;
    }
}
