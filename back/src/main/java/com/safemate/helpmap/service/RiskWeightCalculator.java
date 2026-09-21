package com.safemate.helpmap.service;

import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.StreetLight;
import com.safemate.helpmap.util.GeoUtils;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 간선별 위험도(0~1)를 계산한다. 지금은 가로등 밀도만 반영하며, 이후 제보 데이터가 이 계산에 추가된다.
 * 0 = 충분히 밝음, 1 = 가로등이 전혀 없음.
 */
@Component
public class RiskWeightCalculator {

    // 간선(선분)에서 이 거리 이내의 가로등만 그 간선을 밝히는 것으로 본다
    static final double LIGHT_RADIUS_METERS = 25;
    // 이 개수 이상의 가로등이 있으면 위험도 0. 실제 데이터로 교체할 때 가로등 간격에 맞춰 조정할 것
    static final int LIGHTS_FOR_FULL_SAFETY = 1;

    /** 간선 id -> 위험도(0~1) */
    public Map<Long, Double> calculate(List<Edge> edges, List<StreetLight> lights) {
        Map<Long, Double> risks = new HashMap<>();
        for (Edge edge : edges) {
            long lightCount = lights.stream()
                    .filter(l -> GeoUtils.distanceToSegmentMeters(
                            l.getLatitude(), l.getLongitude(),
                            edge.getFromNode().getLatitude(), edge.getFromNode().getLongitude(),
                            edge.getToNode().getLatitude(), edge.getToNode().getLongitude()) <= LIGHT_RADIUS_METERS)
                    .count();
            risks.put(edge.getId(), Math.max(0, 1.0 - (double) lightCount / LIGHTS_FOR_FULL_SAFETY));
        }
        return risks;
    }
}
