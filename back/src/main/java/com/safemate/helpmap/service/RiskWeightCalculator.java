package com.safemate.helpmap.service;

import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Report;
import com.safemate.helpmap.entity.StreetLight;
import com.safemate.helpmap.util.GeoUtils;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.ToDoubleFunction;
import java.util.function.ToIntFunction;

/**
 * 간선별 위험도를 계산한다. 가로등 밀도(어두움)와 시민 제보(위험)를 각각 0~1로 계산해 합산한다.
 * 카테고리별 차등 가중치, 시간 경과에 따른 감쇄는 고도화 단계에서 추가할 예정이라 지금은 모든 제보를 같게 본다.
 */
@Component
public class RiskWeightCalculator {

    // 간선(선분)에서 이 거리 이내의 가로등만 그 간선을 밝히는 것으로 본다
    static final double LIGHT_RADIUS_METERS = 25;
    // 이 개수 이상의 가로등이 있으면 어두움 0. 실제 데이터로 교체할 때 가로등 간격에 맞춰 조정할 것
    static final int LIGHTS_FOR_FULL_SAFETY = 1;

    // 간선에서 이 거리 이내의 제보를 그 간선의 위험으로 본다
    static final double REPORT_RADIUS_METERS = 25;
    // 이 개수 이상의 제보가 있으면 제보 위험 1 (제보 밀도가 높을수록 가중치가 올라간다)
    static final int REPORTS_FOR_FULL_RISK = 2;

    /** 간선 id -> 위험도 */
    public Map<Long, EdgeRisk> calculate(List<Edge> edges, List<StreetLight> lights, List<Report> reports) {
        Map<Long, EdgeRisk> risks = new HashMap<>();
        for (Edge edge : edges) {
            // 가로등은 한 지점에 여러 개일 수 있어 설치개수를 합산하고, 제보는 1건씩 센다
            long lightCount = countNear(edge, lights, LIGHT_RADIUS_METERS,
                    StreetLight::getLatitude, StreetLight::getLongitude, StreetLight::getInstallCount);
            long reportCount = countNear(edge, reports, REPORT_RADIUS_METERS,
                    Report::getLatitude, Report::getLongitude, r -> 1);

            double darkness = Math.max(0, 1.0 - (double) lightCount / LIGHTS_FOR_FULL_SAFETY);
            double reportRisk = Math.min(1.0, (double) reportCount / REPORTS_FOR_FULL_RISK);
            risks.put(edge.getId(), new EdgeRisk(darkness, reportRisk));
        }
        return risks;
    }

    /** 간선(선분)에서 반경 이내에 있는 점들의 weight 합 */
    private <T> long countNear(Edge edge, List<T> points, double radiusMeters,
                               ToDoubleFunction<T> latitude, ToDoubleFunction<T> longitude,
                               ToIntFunction<T> weight) {
        return points.stream()
                .filter(p -> GeoUtils.distanceToSegmentMeters(
                        latitude.applyAsDouble(p), longitude.applyAsDouble(p),
                        edge.getFromNode().getLatitude(), edge.getFromNode().getLongitude(),
                        edge.getToNode().getLatitude(), edge.getToNode().getLongitude()) <= radiusMeters)
                .mapToInt(weight)
                .sum();
    }
}
