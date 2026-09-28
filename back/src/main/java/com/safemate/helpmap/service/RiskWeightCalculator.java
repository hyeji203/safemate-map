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
    // 간선 길이 이만큼마다 가로등이 1개씩 있으면 어두움 0. 개수만 보면 20m 길과 200m 길이 같은 기준을 받으므로
    // 길이 대비 밀도로 본다. 짧은 간선도 최소 1개는 있어야 밝은 것으로 본다
    static final double METERS_PER_LIGHT = 40;

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

            double lightsNeeded = Math.max(1, edge.getDistanceMeters() / METERS_PER_LIGHT);
            double darkness = Math.max(0, 1.0 - lightCount / lightsNeeded);
            double reportRisk = Math.min(1.0, (double) reportCount / REPORTS_FOR_FULL_RISK);
            risks.put(edge.getId(), new EdgeRisk(darkness, reportRisk));
        }
        return risks;
    }

    /** 간선(도로 모양 폴리라인)에서 반경 이내에 있는 점들의 weight 합 */
    private <T> long countNear(Edge edge, List<T> points, double radiusMeters,
                               ToDoubleFunction<T> latitude, ToDoubleFunction<T> longitude,
                               ToIntFunction<T> weight) {
        List<double[]> line = edge.polyline();
        return points.stream()
                .filter(p -> distanceToPolylineMeters(latitude.applyAsDouble(p), longitude.applyAsDouble(p), line)
                        <= radiusMeters)
                .mapToInt(weight)
                .sum();
    }

    private double distanceToPolylineMeters(double lat, double lng, List<double[]> line) {
        double min = Double.MAX_VALUE;
        for (int i = 0; i + 1 < line.size(); i++) {
            double[] a = line.get(i);
            double[] b = line.get(i + 1);
            min = Math.min(min, GeoUtils.distanceToSegmentMeters(lat, lng, a[0], a[1], b[0], b[1]));
        }
        return min;
    }
}
