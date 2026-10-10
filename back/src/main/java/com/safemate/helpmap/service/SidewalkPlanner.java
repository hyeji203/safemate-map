package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.RouteResponse;
import com.safemate.helpmap.entity.Edge;
import com.safemate.helpmap.entity.Node;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.PriorityQueue;
import java.util.function.ToDoubleFunction;
import java.util.function.ToLongFunction;

/**
 * 도로망 그래프는 차도 중심선이라, 큰 도로를 따라가는 경로가 도로 한가운데에 그려지고 언제 길을 건너는지 보이지 않는다.
 * 큰 도로 구간은 보도 쪽으로 옮겨 그리고, 보도 쪽이 바뀌는 교차로에는 횡단보도 구간을 만든다.
 * <p>
 * 교차로에서 큰 도로 방향(팔)들이 주변을 몇 개의 모퉁이 구역으로 나누고, 한 구역에서 다른 구역으로 가려면
 * 사이에 있는 팔 개수만큼 도로를 건너야 한다. search는 걷는 거리와 건너는 비용(횡단보도가 있는 곳은 싸게,
 * 없는 곳은 비싸게)을 합친 비용이 가장 작은 경로와 큰 도로 구간마다 걸을 보도(진행 방향 기준 오른쪽/왼쪽)를 함께 고르고,
 * plan은 그 결과를 지도에 그릴 모양으로 바꾼다.
 */
final class SidewalkPlanner {

    private static final int RIGHT = 0;
    private static final int LEFT = 1;
    private static final double METERS_PER_DEG_LAT = 111_320;
    private static final double TWO_PI = 2 * Math.PI;
    // 큰 도로(팔) 하나를 건널 때 경로 비용에 더하는 값(m 상당). 경로를 고를 때부터 반영해서,
    // 횡단보도가 있는 곳에서 건너고 없는 곳은 꽤 돌아가더라도 피하게 한다
    // - 그 도로 방향에 횡단보도(직접 찍은 좌표 또는 공공데이터)가 있음
    private static final double CROSSWALK_CROSSING_METERS = 15;
    // - 이 교차로의 어느 도로 방향에도 횡단보도가 붙지 않았지만, 근처(40m)에 공공데이터 횡단보도가 있음 (좌표가 부정확해서 방향은 모름)
    private static final double KNOWN_CROSSING_METERS = 25;
    // - 횡단보도가 없는 방향: 큰 도로끼리 만나는 교차로(팔 3개 이상)와 골목 입구·도로 중간
    private static final double JUNCTION_CROSSING_METERS = 50;
    private static final double MID_BLOCK_CROSSING_METERS = 80;
    // - 직접 찍은 횡단보도가 붙은 교차로에서 찍지 않은 방향: 사람이 확인한 곳이라 그 방향엔 실제로 횡단보도가 없다.
    //   사실상 못 건너는 곳으로 보되, 다른 길이 전혀 없을 때는 경로가 끊기지 않게 아주 비싸게만 둔다
    private static final double SURVEYED_NO_CROSSWALK_METERS = 300;
    // 중앙분리대 판정: 큰 도로 간선 가운데에서 옆으로 이 범위 안에 나란한 다른 큰 도로(맞은편 차로)가 있으면 그쪽은 중앙분리대
    private static final double MEDIAN_MIN_METERS = 3;
    private static final double MEDIAN_MAX_METERS = 30;
    private static final double MEDIAN_PARALLEL_COS = Math.cos(Math.toRadians(30));
    private static final int NO_MEDIAN = -1;
    // 연달아 건너는 두 횡단을 같은 횡단보도로 합치는 기준: 사이 거리, 방향 차이(50도 이내).
    // 큰 횡단보도 바로 앞의 작은 횡단보도(연결 차로, 예: 단대오거리 북동쪽 모퉁이)는 47도쯤 꺾여도 한 번에 건너는 것으로 본다.
    // 모퉁이에서 두 도로를 꺾어 건너는 것은 90도 가까이 꺾여서 따로 센다.
    // 한 횡단보도를 차로마다 나눈 조각 사이는 3~7m(단대오거리 북쪽)이고, 보도를 20m쯤 걸어 다음 횡단보도로 가는 것은
    // 따로 센다 (25m로 두었을 때 단대오거리 동쪽 광명로·남동쪽 산성대로 횡단보도가 대각선 하나로 합쳐졌다)
    private static final double MERGE_GAP_METERS = 12;
    private static final double MERGE_DIRECTION_COS = Math.cos(Math.toRadians(50));
    // 그리는 선에서 지울 뾰족한 점: 앞이나 뒤 점까지 이 거리 안이고, 갔던 방향으로 45도 안쪽으로 되돌아오는 점
    private static final double SPIKE_MAX_METERS = 15;
    private static final double SPIKE_TURN_COS = Math.cos(Math.toRadians(45));
    // 탐색 상태의 특별한 모퉁이 구역 값: 출발 좌표가 따로 없어서 어느 모퉁이에서든 출발 가능 / 도착 완료
    private static final int ANY_SECTOR = -1;
    private static final int DONE = -2;
    // 큰 도로 중간(도로 위 임시 지점)에 도착한 상태는 모퉁이 구역 대신 걸어온 보도 쪽으로 나눈다: GOAL_SIDE - side.
    // 임시 도착 노드에서 나가는 간선은 없어서 이 값이 모퉁이 구역으로 쓰이지 않는다
    private static final int GOAL_SIDE = -3;
    // 횡단보도 좌표가 도로에서 이 거리 안이면 그 도로 위의 횡단보도로 본다 (공공데이터는 주소 좌표라 중간값 약 14m 떨어져 있음)
    private static final double CROSSWALK_SNAP_METERS = 25;
    // 직접 찍은 좌표는 줄무늬 위라서 더 좁게 본다. 넓으면 바로 옆 교차로가 같은 횡단보도를 다른 도로에 갖다 붙인다
    private static final double SURVEYED_SNAP_METERS = 10;
    // 교차로에서 이보다 가까운 횡단보도는 교차로 모퉁이에서 바로 건너는 것으로 그린다
    private static final double CROSSWALK_MIN_DISTANCE = 8;
    // 떨어진 횡단보도가 다음 교차로에 너무 붙지 않게 도로 끝에서 남겨 두는 거리
    private static final double CROSSWALK_END_MARGIN = 3;
    // 팔의 도로 모양을 옆길 입구 너머로 이어 붙이는 최대 길이 (CrosswalkCatalog의 교차로 매칭 거리 40m보다 조금 길게)
    private static final double RAY_EXTEND_METERS = 50;
    // 대각선 횡단보도 좌표가 교차로 중심에서 이 거리 안이어야 그 교차로의 것으로 본다 (옆 교차로가 가져가지 않게)
    private static final double DIAGONAL_MATCH_METERS = 10;

    record Result(List<RouteResponse.LatLng> geometry, List<RouteResponse.Crossing> crossings) {
    }

    /** 탐색 결과: 지나는 간선과 간선마다 걸을 보도 쪽(RIGHT/LEFT, 골목이면 0) */
    record Route(List<Edge> edges, int[] sides) {
    }

    /** 탐색 상태: 노드(다익스트라 키)와 그 교차로에서 서 있는 모퉁이 구역 */
    private record State(long key, int sector) {
    }

    /** 상태에 도착한 방법: 이전 상태와 지나온 간선, 그 간선의 보도 쪽 */
    private record Step(State from, Edge edge, int side) {
    }

    private record Entry(double cost, State state) {
    }

    private final Map<Long, List<Edge>> adjacency;
    private final CrosswalkCatalog crosswalkCatalog;
    private final Map<Long, Junction> junctions = new HashMap<>();
    // 출발/도착 도로 위 지점(임시 노드, id 없음)의 교차로. 탐색 중 여러 번 쓰여서 노드 객체 기준으로 따로 둔다
    private final Map<Node, Junction> virtualJunctions = new IdentityHashMap<>();
    // 간선 -> 중앙분리대 쪽 보도(RIGHT/LEFT, 없으면 NO_MEDIAN). 탐색 중 필요한 간선만 계산해 둔다
    private final Map<Edge, Integer> medianSides = new IdentityHashMap<>();
    private List<MainRoad> mainRoads; // 중앙분리대 판정용 큰 도로 목록 (처음 쓸 때 만든다)

    /** 중앙분리대 판정에 쓰는 큰 도로(연결 차로 제외) 간선과 평면 좌표 모양 */
    private record MainRoad(Edge edge, List<double[]> line, double length) {
    }
    private final double refLat;
    private final double refLng;
    private final double metersPerDegLng;

    SidewalkPlanner(Map<Long, List<Edge>> adjacency, CrosswalkCatalog crosswalkCatalog, double refLat, double refLng) {
        this.adjacency = adjacency;
        this.crosswalkCatalog = crosswalkCatalog;
        this.refLat = refLat;
        this.refLng = refLng;
        this.metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(Math.toRadians(refLat));
    }

    /**
     * 탐색한 경로를 지도에 그릴 모양과 횡단보도 구간으로 바꾼다.
     *
     * @param sides       간선마다 걸을 보도 쪽 (search 결과)
     * @param origin      출발 노드와 떨어진 실제 출발 좌표 [위도, 경도]. 노드와 같은 지점이면 null
     * @param destination 도착 노드와 떨어진 실제 도착 좌표. 노드와 같은 지점이면 null
     */
    Result plan(Node start, List<Edge> edges, int[] sides, double[] origin, double[] destination) {
        List<double[]> points = new ArrayList<>();
        List<RouteResponse.Crossing> crossings = new ArrayList<>();
        if (origin != null) {
            points.add(toXY(origin[0], origin[1]));
        }

        Junction first = junction(start);
        if (edges.isEmpty()) {
            points.add(new double[]{first.x, first.y});
            if (destination != null) {
                points.add(toXY(destination[0], destination[1]));
            }
            return toResult(points, crossings);
        }

        // 출발 교차로: 실제 출발 좌표 쪽 모퉁이에서 첫 구간의 보도로
        Edge firstEdge = edges.get(0);
        int departSector = departSector(first, firstEdge, sides[0]);
        int arriveSector = origin != null ? first.sectorOf(first.angleTo(toXY(origin[0], origin[1]))) : departSector;
        Trace trace = new Trace(points);
        trace.keepFrom = points.size(); // 실제 출발 좌표는 잘라내지 않는다
        double[] originXY = origin != null ? toXY(origin[0], origin[1]) : null;
        double[] destinationXY = destination != null ? toXY(destination[0], destination[1]) : null;
        appendJunction(first, arriveSector, departSector, null, 0, firstEdge, sides[0], trace, crossings, originXY, null);

        for (int i = 0; i < edges.size(); i++) {
            Edge edge = edges.get(i);
            List<double[]> shape = shape(edge, sides[i]);
            for (double[] p : shape.subList(1, shape.size() - 1)) {
                trace.add(p);
            }
            if (MedianCrossings.ROAD_TYPE.equals(edge.getRoadType())) {
                // 중앙분리대 도로 횡단 간선: 가운데 두 점(양쪽 보도의 횡단보도 끝) 사이가 횡단보도
                RouteResponse.LatLng from = toLatLng(shape.get(1));
                RouteResponse.LatLng to = toLatLng(shape.get(2));
                boolean signal = crosswalkCatalog.near((from.latitude() + to.latitude()) / 2,
                        (from.longitude() + to.longitude()) / 2).map(CrosswalkCatalog.Crosswalk::hasSignal).orElse(false);
                crossings.add(new RouteResponse.Crossing(from, to, signal));
                trace.keepFrom = points.size(); // 다음 교차로에서 들어온 길을 잘라낼 때 횡단보도는 남긴다
            }

            Junction j = junction(edge.getToNode());
            int arrive = arriveSector(j, edge, sides[i]);
            Edge next = i + 1 < edges.size() ? edges.get(i + 1) : null;
            int depart;
            if (next != null) {
                depart = departSector(j, next, sides[i + 1]);
            } else if (destination != null) {
                depart = j.sectorOf(j.angleTo(toXY(destination[0], destination[1])));
            } else {
                depart = arrive;
            }
            appendJunction(j, arrive, depart, edge, sides[i], next, next != null ? sides[i + 1] : 0, trace, crossings,
                    null, next == null ? destinationXY : null);
        }

        if (destination != null) {
            points.add(toXY(destination[0], destination[1]));
        }
        return toResult(points, crossings);
    }

    /**
     * 보도와 횡단을 함께 따지는 최소 비용 경로 탐색 (다익스트라).
     * 상태는 "노드 + 그 교차로에서 서 있는 모퉁이 구역"이고, 큰 도로를 따라갈 때는 오른쪽/왼쪽 보도를 따로 본다.
     * 교차로에서 모퉁이를 옮기려면 사이에 있는 도로(팔)를 건너야 하고, 건널 때마다 횡단 비용(m 상당)을 더한다.
     * 예전에는 차도 중심선에서 최단 노드 순서를 먼저 정한 뒤 그 노드들에서만 건널 곳을 골라서,
     * 횡단보도가 옆 교차로에 있어도 쓰지 못하고 횡단보도 없는 곳에서 건너는 경로가 나왔다 (예: 단대오거리).
     *
     * @param graph       탐색용 그래프 (다익스트라 키 -> 나가는 간선). 출발/도착 도로 위 지점의 부분 간선 포함
     * @param keyOf       노드 -> 다익스트라 키 (임시 출발/도착 노드는 id가 없어서 따로 정한 키)
     * @param cost        간선 하나를 걷는 비용 (도로 종류·위험도 반영)
     * @param origin      출발 노드와 떨어진 실제 출발 좌표. 없으면 null
     * @param destination 도착 노드와 떨어진 실제 도착 좌표. 없으면 null
     * @return 경로가 없으면 null
     */
    Route search(Node start, Node goal, Map<Long, List<Edge>> graph, ToLongFunction<Node> keyOf,
                 ToDoubleFunction<Edge> cost, double[] origin, double[] destination) {
        long goalKey = keyOf.applyAsLong(goal);
        if (keyOf.applyAsLong(start) == goalKey) {
            return new Route(List.of(), new int[0]);
        }
        Junction first = junction(start);
        State startState = new State(keyOf.applyAsLong(start),
                origin == null ? ANY_SECTOR : first.sectorOf(first.angleTo(toXY(origin[0], origin[1]))));
        State done = new State(goalKey, DONE);

        Map<Long, Node> nodes = new HashMap<>();
        nodes.put(startState.key(), start);
        Map<State, Double> dist = new HashMap<>();
        Map<State, Step> prev = new HashMap<>();
        PriorityQueue<Entry> queue = new PriorityQueue<>(Comparator.comparingDouble(Entry::cost));
        dist.put(startState, 0.0);
        queue.add(new Entry(0, startState));

        while (!queue.isEmpty()) {
            Entry top = queue.poll();
            State state = top.state();
            if (top.cost() > dist.getOrDefault(state, Double.MAX_VALUE)) {
                continue; // 이미 더 싼 경로로 처리된 낡은 항목
            }
            if (state.equals(done)) {
                break;
            }
            Junction here = junction(nodes.get(state.key()));
            for (Edge edge : graph.getOrDefault(state.key(), List.of())) {
                Node next = edge.getToNode();
                long nextKey = keyOf.applyAsLong(next);
                Junction there = junction(next);
                for (int side = 0; side < options(edge); side++) {
                    if (options(edge) == 2 && medianSide(edge) == side) {
                        continue; // 중앙분리대 쪽에는 보도가 없다
                    }
                    double c = top.cost() + departMeters(here, state, startState, edge, side, origin)
                            + cost.applyAsDouble(edge)
                            // 중앙분리대 횡단 간선은 그 자체가 횡단보도 한 번
                            + (MedianCrossings.ROAD_TYPE.equals(edge.getRoadType()) ? CROSSWALK_CROSSING_METERS : 0);
                    // 큰 도로 중간에 도착하면 모퉁이 구역이 없어 어느 보도로 왔든 같은 상태가 되는데, 보도마다 도착 비용
                    // (건물 쪽으로 건너야 하는지)이 달라서 보도별로 나눈다. 안 나누면 건너지 않는 보도로 비용을 매기고
                    // 경로는 반대쪽 보도로 되짚어, 끝에서 횡단보도 없이 도로를 가로지르는 선이 그려진다
                    boolean midRoadGoal = nextKey == goalKey && next.getId() == null && options(edge) == 2;
                    State arrived = new State(nextKey, midRoadGoal ? GOAL_SIDE - side : arriveSector(there, edge, side));
                    nodes.putIfAbsent(nextKey, next);
                    relax(arrived, c, new Step(state, edge, side), dist, prev, queue);
                    if (nextKey == goalKey) {
                        // 도착 교차로에서 실제 도착 좌표 쪽 모퉁이까지 건너는 비용까지 더한 것을 "도착 완료" 상태로 둔다
                        double finish = c + finishMeters(there, arrived.sector(), edge, side, destination);
                        relax(done, finish, new Step(arrived, null, side), dist, prev, queue);
                    }
                }
            }
        }

        if (!prev.containsKey(done)) {
            return null;
        }
        LinkedList<Edge> edges = new LinkedList<>();
        LinkedList<Integer> sides = new LinkedList<>();
        State cursor = prev.get(done).from();
        while (!cursor.equals(startState)) {
            Step step = prev.get(cursor);
            edges.addFirst(step.edge());
            sides.addFirst(step.side());
            cursor = step.from();
        }
        return new Route(new ArrayList<>(edges), sides.stream().mapToInt(Integer::intValue).toArray());
    }

    /**
     * 찾아 둔 경로를 search와 같은 방식(보도·횡단·도착 비용 포함)으로 다시 매긴 비용.
     * 다른 후보를 찾으려고 간선에 벌점을 준 탐색 결과도 원래 비용으로 비교하려고 쓴다
     */
    double cost(Node start, Route route, ToLongFunction<Node> keyOf, ToDoubleFunction<Edge> cost,
                double[] origin, double[] destination) {
        List<Edge> edges = route.edges();
        if (edges.isEmpty()) {
            return 0;
        }
        Junction first = junction(start);
        State startState = new State(keyOf.applyAsLong(start),
                origin == null ? ANY_SECTOR : first.sectorOf(first.angleTo(toXY(origin[0], origin[1]))));
        State state = startState;
        Node here = start;
        double total = 0;
        for (int i = 0; i < edges.size(); i++) {
            Edge edge = edges.get(i);
            int side = route.sides()[i];
            Node next = edge.getToNode();
            Junction there = junction(next);
            total += departMeters(junction(here), state, startState, edge, side, origin) + cost.applyAsDouble(edge)
                    + (MedianCrossings.ROAD_TYPE.equals(edge.getRoadType()) ? CROSSWALK_CROSSING_METERS : 0);
            boolean last = i == edges.size() - 1;
            boolean midRoadGoal = last && next.getId() == null && options(edge) == 2;
            state = new State(keyOf.applyAsLong(next), midRoadGoal ? GOAL_SIDE - side : arriveSector(there, edge, side));
            if (last) {
                total += finishMeters(there, state.sector(), edge, side, destination);
            }
            here = next;
        }
        return total;
    }

    private static void relax(State state, double cost, Step step, Map<State, Double> dist, Map<State, Step> prev,
                              PriorityQueue<Entry> queue) {
        if (cost < dist.getOrDefault(state, Double.MAX_VALUE)) {
            dist.put(state, cost);
            prev.put(state, step);
            queue.add(new Entry(cost, state));
        }
    }

    /** 교차로 j의 state 모퉁이에서 edge의 side 보도로 나서기까지 건너는 비용 */
    private double departMeters(Junction j, State state, State startState, Edge edge, int side, double[] origin) {
        if (state.sector() == ANY_SECTOR) {
            return 0;
        }
        if (state.equals(startState) && origin != null && j.rayCount() < 2) {
            return sideCost(edge, true, origin, side); // 큰 도로 중간(도로 위 지점)에서 출발
        }
        return j.crossingMeters(state.sector(), departSector(j, edge, side));
    }

    /** edge의 side 보도로 도착 교차로 j의 arrive 모퉁이에 왔을 때, 실제 도착 좌표 쪽 모퉁이까지 건너는 비용 */
    private double finishMeters(Junction j, int arrive, Edge edge, int side, double[] destination) {
        if (destination == null) {
            return 0;
        }
        if (j.rayCount() < 2) {
            return sideCost(edge, false, destination, side); // 큰 도로 중간(도로 위 지점)에 도착
        }
        return j.crossingMeters(arrive, j.sectorOf(j.angleTo(toXY(destination[0], destination[1]))));
    }

    /**
     * 교차로에서 도착 모퉁이 -> 출발 모퉁이까지 지나는 모퉁이 점을 잇고, 모퉁이 사이 구간을 횡단보도로 기록한다.
     * 건너는 도로 방향에 교차로에서 떨어진 실제 횡단보도가 있으면 그 지점까지 보도를 따라가서 건넌다.
     * 들어온 길을 그 횡단보도에서 건너면 들어온 길의 끝부분을, 나갈 길을 건너면 나갈 길의 앞부분을 잘라낸다.
     * 횡단보도가 큰 도로의 옆길 입구 너머에 있으면 잘라내는 범위도 그 너머까지 이어진다.
     *
     * @param fromPoint 경로 첫 교차로일 때 실제 출발 좌표(평면), 아니면 null
     * @param toPoint   경로 마지막 교차로일 때 실제 도착 좌표(평면), 아니면 null
     */
    private void appendJunction(Junction j, int arrive, int depart, Edge in, int inSide, Edge out, int outSide,
                                Trace trace, List<RouteResponse.Crossing> crossings,
                                double[] fromPoint, double[] toPoint) {
        List<double[]> points = trace.points;
        if (j.rayCount() < 2) {
            // 건널 큰 도로가 없는 교차로: 들어온 길 끝점과 나갈 길 시작점을 그대로 잇는다
            if (in != null) {
                List<double[]> shape = shape(in, inSide);
                trace.add(shape.get(shape.size() - 1));
            }
            if (out != null) {
                trace.add(shape(out, outSide).get(0));
            }
            if (in == null && out == null) {
                trace.add(new double[]{j.x, j.y});
            }
            return;
        }
        List<Integer> sectors = j.sectorsBetween(arrive, depart);
        int n = sectors.size();
        if (n == 1 && j.rayCount() == 2) {
            // 큰 도로가 곧게 이어지기만 하는 곳(옆길 입구)을 건너지 않고 지나감: 팔을 이어 붙인 것처럼 잘라내기를 이어간다
            trace.add(j.corner(sectors.get(0)));
            if (in != null && options(in) == 1) {
                // 옆길에서 큰 도로 보도로 올라탄 곳: 다음 교차로가 떨어진 횡단보도 때문에 들어온 길 끝을 잘라낼 때
                // 이 모퉁이를 넘어 옆길까지 지우면 옆길에서 횡단보도로 건물을 가로지르는 선이 그려진다 (예: 광명로335번길 입구)
                trace.keepFrom = points.size();
            }
            if (trace.trimDistance > 0) {
                // trimCenter를 이 노드로 옮기고 이동한 거리만큼 trimDistance를 줄인다.
                // 안 하면 이전 교차로 기준으로 계속 비교해 간선 전체가 skip될 수 있다.
                double moved = Math.hypot(j.x - trace.trimCenter[0], j.y - trace.trimCenter[1]);
                double remaining = trace.trimDistance - moved;
                if (remaining <= 0) {
                    trace.trimDistance = 0;
                } else {
                    trace.trimDistance = remaining;
                    trace.trimCenter = new double[]{j.x, j.y};
                }
            }
            return;
        }
        trace.trimDistance = 0; // 앞 교차로에서 시작한 잘라내기는 다음 큰 교차로를 넘어가지 않는다
        if (j.crossesDiagonally(n - 1)) {
            // 대각선 횡단보도: 맞은편 모퉁이까지 한 번에 건넌다
            double[] from = j.corner(sectors.get(0));
            double[] to = j.corner(sectors.get(n - 1));
            points.add(from);
            points.add(to);
            crossings.add(new RouteResponse.Crossing(toLatLng(from), toLatLng(to), j.diagonalCrosswalk.hasSignal()));
            trace.keepFrom = points.size();
            return;
        }
        int step = j.step(arrive, depart);
        // 모퉁이 사이마다 건너는 도로 방향(팔)과, 그 팔의 실제 횡단보도 지점(없으면 null)
        int[] rays = new int[n];
        double[][][] atCrosswalk = new double[n][][];
        for (int k = 1; k < n; k++) {
            rays[k] = step > 0 ? sectors.get(k) : sectors.get(k - 1);
            atCrosswalk[k] = j.crosswalkCrossing(rays[k], sectors.get(k - 1), sectors.get(k));
        }
        // 두 팔이 거의 직선(150°~210°)이고 떨어진 횡단보도 지점이 없으면 모퉁이만 바로 잇는다.
        // 탐색 결과로 이런 곳에서 건너게 되더라도 모퉁이가 건물 안에 찍히는 것을 방지한다.
        // 횡단보도가 교차로에 바로 붙어 있으면(CROSSWALK_MIN_DISTANCE 안) 떨어진 지점은 없지만 실제로 건너는 곳이라
        // 횡단으로 기록한다 (예: 광명로와 금광동 골목이 만나는 곳의 직접 찍은 횡단보도). 횡단보도가 없으면 기록하지 않는다
        if (n == 2 && j.rayCount() == 2 && j.isLinear() && atCrosswalk[1] == null) {
            trace.trimDistance = 0;
            trace.add(j.corner(sectors.get(0)));
            trace.add(j.corner(sectors.get(1)));
            if (j.rayCrosswalks[rays[1]] != null) {
                crossings.add(new RouteResponse.Crossing(
                        toLatLng(j.corner(sectors.get(0))), toLatLng(j.corner(sectors.get(1))), j.signalOf(rays[1])));
            }
            trace.keepFrom = points.size();
            return;
        }
        int inRay = in != null ? (options(in) == 2 ? j.nearestRay(j.angleTo(beforeEnd(in))) : -1)
                : rayBeyondCrosswalk(j, fromPoint);
        int outRay = out != null ? (options(out) == 2 ? j.nearestRay(j.angleTo(afterStart(out))) : -1)
                : rayBeyondCrosswalk(j, toPoint);
        boolean trimIn = n > 1 && atCrosswalk[1] != null && rays[1] == inRay;
        boolean trimOut = n > 1 && atCrosswalk[n - 1] != null && rays[n - 1] == outRay && !(trimIn && n == 2);

        if (trimIn) {
            // 들어온 길에서 횡단보도보다 교차로 쪽에 있는 점은 지나지 않는다
            double distance = j.crosswalkDistance[rays[1]];
            while (points.size() > trace.keepFrom) {
                double[] p = points.get(points.size() - 1);
                if (Math.hypot(p[0] - j.x, p[1] - j.y) >= distance) {
                    break;
                }
                points.remove(points.size() - 1);
            }
        }
        for (int k = 0; k < n; k++) {
            if (k > 0) {
                if (atCrosswalk[k] != null) {
                    points.add(atCrosswalk[k][0]);
                    points.add(atCrosswalk[k][1]);
                    crossings.add(new RouteResponse.Crossing(
                            toLatLng(atCrosswalk[k][0]), toLatLng(atCrosswalk[k][1]), j.signalOf(rays[k])));
                } else {
                    crossings.add(new RouteResponse.Crossing(
                            toLatLng(j.corner(sectors.get(k - 1))), toLatLng(j.corner(sectors.get(k))), j.signalOf(rays[k])));
                }
            }
            boolean skipCorner = (k == 0 && trimIn) || (k == n - 1 && trimOut);
            if (!skipCorner) {
                points.add(j.corner(sectors.get(k)));
            }
        }
        trace.keepFrom = points.size();
        if (trimOut) {
            trace.trimCenter = new double[]{j.x, j.y};
            trace.trimDistance = j.crosswalkDistance[rays[n - 1]];
        }
    }

    /** 그리는 점 목록. 떨어진 횡단보도로 이미 건넜으면, 나갈 길에서 그 횡단보도보다 교차로 쪽에 있는 점은 건너뛴다 */
    private static final class Trace {
        final List<double[]> points;
        int keepFrom;        // 들어온 길 끝부분을 잘라낼 때 이보다 앞(마지막 큰 교차로까지)은 건드리지 않는다
        double[] trimCenter; // 잘라내기 기준 교차로 중심
        double trimDistance; // 이 거리 안의 점은 건너뛴다 (0이면 잘라내지 않음)

        Trace(List<double[]> points) {
            this.points = points;
        }

        void add(double[] p) {
            if (trimDistance > 0 && Math.hypot(p[0] - trimCenter[0], p[1] - trimCenter[1]) < trimDistance) {
                return;
            }
            trimDistance = 0;
            points.add(p);
        }
    }

    /**
     * 실제 출발/도착 좌표가 어떤 팔 방향으로 그 팔의 횡단보도보다 멀리 있으면 그 팔.
     * 그 팔을 횡단보도에서 건널 때 교차로 모퉁이까지 되돌아가지 않고 출발/도착 좌표와 바로 잇기 위해 쓴다.
     */
    private int rayBeyondCrosswalk(Junction j, double[] point) {
        if (point == null) {
            return -1;
        }
        double angle = j.angleTo(point);
        int ray = j.nearestRay(angle);
        double off = Math.abs(normalize(angle - j.angles[ray] + Math.PI) - Math.PI);
        double distance = Math.hypot(point[0] - j.x, point[1] - j.y);
        return off <= Math.PI / 4 && distance > j.crosswalkDistance[ray] ? ray : -1;
    }

    /** 간선이 끝 교차로에 닿기 직전 점 */
    private double[] beforeEnd(Edge edge) {
        List<double[]> line = edge.polyline();
        double[] p = line.get(line.size() - 2);
        return toXY(p[0], p[1]);
    }

    /** 간선이 시작 교차로를 떠난 직후 점 */
    private double[] afterStart(Edge edge) {
        double[] p = edge.polyline().get(1);
        return toXY(p[0], p[1]);
    }

    /** 간선의 그릴 모양(평면 좌표). 큰 도로는 고른 보도 쪽으로 평행 이동, 그 외는 도로 모양 그대로 */
    private List<double[]> shape(Edge edge, int side) {
        List<double[]> raw = new ArrayList<>();
        for (double[] p : edge.polyline()) {
            raw.add(toXY(p[0], p[1]));
        }
        double w = RoadType.halfWidthMeters(edge.getRoadType());
        if (w == 0) {
            return raw;
        }
        double sign = side == RIGHT ? 1 : -1;
        List<double[]> shifted = new ArrayList<>();
        for (int i = 0; i < raw.size(); i++) {
            // 앞뒤 선분의 오른쪽 법선을 더해 꼭짓점을 옮길 방향으로 쓴다
            double nx = 0;
            double ny = 0;
            for (int k = Math.max(0, i - 1); k < Math.min(raw.size() - 1, i + 1); k++) {
                double dx = raw.get(k + 1)[0] - raw.get(k)[0];
                double dy = raw.get(k + 1)[1] - raw.get(k)[1];
                double len = Math.hypot(dx, dy);
                if (len > 0) {
                    nx += dy / len;
                    ny += -dx / len;
                }
            }
            double len = Math.hypot(nx, ny);
            double[] p = raw.get(i);
            shifted.add(len == 0 ? p : new double[]{p[0] + sign * w * nx / len, p[1] + sign * w * ny / len});
        }
        return shifted;
    }

    private int options(Edge edge) {
        return RoadType.halfWidthMeters(edge.getRoadType()) > 0 ? 2 : 1;
    }

    /** edge로 교차로 j를 떠날 때 서 있는 모퉁이 구역 */
    private int departSector(Junction j, Edge edge, int side) {
        List<double[]> line = edge.polyline();
        double angle = j.angleTo(toXY(line.get(1)[0], line.get(1)[1]));
        if (options(edge) == 1 || j.rayCount() == 0) { // 팔이 없는 곳 = 출발/도착 도로 위 지점(임시 노드)

            return j.sectorOf(angle);
        }
        // 진행 방향 오른쪽 보도 = 그 도로 방향(팔)의 시계 방향 쪽 구역
        int ray = j.nearestRay(angle);
        return side == RIGHT ? j.previousSector(ray) : ray;
    }

    /** edge로 교차로 j에 도착했을 때 서 있는 모퉁이 구역 */
    private int arriveSector(Junction j, Edge edge, int side) {
        List<double[]> line = edge.polyline();
        double[] before = line.get(line.size() - 2);
        double angle = j.angleTo(toXY(before[0], before[1]));
        if (options(edge) == 1 || j.rayCount() == 0) { // 팔이 없는 곳 = 출발/도착 도로 위 지점(임시 노드)

            return j.sectorOf(angle);
        }
        // 들어오는 방향 오른쪽 보도 = 온 쪽 팔의 반시계 방향 쪽 구역
        int ray = j.nearestRay(angle);
        return side == RIGHT ? ray : j.previousSector(ray);
    }

    private Junction junction(Node node) {
        if (node.getId() == null) {
            return virtualJunctions.computeIfAbsent(node, Junction::new); // 출발·도착 임시 노드는 둘 다 id가 없다
        }
        return junctions.computeIfAbsent(node.getId(), id -> new Junction(node));
    }

    /**
     * 큰 도로 중간(교차로가 아닌 도로 위 지점)에서 출발/도착할 때, 건물이 있는 쪽 보도가 아니면 도로를 한 번 건너야 한다.
     * edge를 side 보도로 걸을 때 point(건물 위치)와 반대쪽이면 횡단 한 번의 비용. 골목이면 0
     *
     * @param atStart true면 edge 시작점(출발), false면 끝점(도착) 기준
     */
    /**
     * 큰 도로 간선의 중앙분리대 쪽 보도(RIGHT/LEFT). 중앙분리대가 있는 도로는 OSM에 상행/하행 차로가 따로 그려져 있어서,
     * 각 차로를 양쪽 보도가 있는 도로로 보면 두 차로 사이(중앙분리대)를 걷는 경로가 나온다 (예: 단대오거리 산성대로).
     * 간선 가운데에서 옆으로 MEDIAN_MIN~MAX 거리에 나란한 다른 큰 도로가 한쪽에만 있으면 그쪽을 중앙분리대로 본다.
     * 연결 차로(_link)도 바로 옆에 나란한 큰 도로가 있으면 그 사이는 걸을 수 없는 교통섬으로 본다
     * (예: 단대오거리 북서쪽 연결 차로와 광명로 사이). 맞은편 차로로 보는 쪽은 연결 차로를 빼고 큰 도로만 본다.
     */
    private int medianSide(Edge edge) {
        Integer cached = medianSides.get(edge);
        if (cached != null) {
            return cached;
        }
        int result = NO_MEDIAN;
        if (RoadType.halfWidthMeters(edge.getRoadType()) > 0) {
            List<double[]> line = toXYLine(edge);
            double[] mid = pointAlong(line, length(line) / 2); // {x, y, 진행방향 x, 진행방향 y}
            boolean left = false;
            boolean right = false;
            for (MainRoad other : mainRoads()) {
                if (sharesNode(edge, other.edge()) || farFrom(other, mid)) {
                    continue;
                }
                double[] near = nearestOn(other.line(), mid); // {x, y, 진행방향 x, 진행방향 y}
                double vx = near[0] - mid[0];
                double vy = near[1] - mid[1];
                double distance = Math.hypot(vx, vy);
                if (distance < MEDIAN_MIN_METERS || distance > MEDIAN_MAX_METERS
                        || Math.abs(vx * mid[2] + vy * mid[3]) > distance / 2 // 옆이 아니라 앞뒤에 있음
                        || Math.abs(near[2] * mid[2] + near[3] * mid[3]) < MEDIAN_PARALLEL_COS) {
                    continue;
                }
                if (mid[2] * vy - mid[3] * vx > 0) {
                    left = true; // 진행 방향 왼쪽
                } else {
                    right = true;
                }
            }
            if (left != right) {
                result = left ? LEFT : RIGHT;
            }
        }
        medianSides.put(edge, result);
        return result;
    }

    private static boolean isMainRoad(Edge edge) {
        return RoadType.halfWidthMeters(edge.getRoadType()) > 0 && !edge.getRoadType().endsWith("_link");
    }

    private List<MainRoad> mainRoads() {
        if (mainRoads == null) {
            mainRoads = new ArrayList<>();
            for (List<Edge> out : adjacency.values()) {
                for (Edge e : out) {
                    if (isMainRoad(e)) {
                        List<double[]> line = toXYLine(e);
                        mainRoads.add(new MainRoad(e, line, length(line)));
                    }
                }
            }
        }
        return mainRoads;
    }

    /** 두 간선이 끝 교차로를 공유하는지 (같은 도로의 반대 방향, 바로 이어진 도로) */
    private static boolean sharesNode(Edge a, Edge b) {
        for (Node p : List.of(a.getFromNode(), a.getToNode())) {
            for (Node q : List.of(b.getFromNode(), b.getToNode())) {
                if (p.getId() != null && p.getId().equals(q.getId())) {
                    return true;
                }
            }
        }
        return false;
    }

    /** 간선의 어느 점도 p에서 MEDIAN_MAX_METERS 안에 들 수 없을 만큼 먼지 (양 끝에서 길이만큼 이내가 아니면 멀다) */
    private static boolean farFrom(MainRoad road, double[] p) {
        double[] a = road.line().get(0);
        double[] b = road.line().get(road.line().size() - 1);
        double reach = road.length() + MEDIAN_MAX_METERS;
        return Math.hypot(a[0] - p[0], a[1] - p[1]) > reach && Math.hypot(b[0] - p[0], b[1] - p[1]) > reach;
    }

    /** 선 위에서 p와 가장 가까운 점과 그 자리의 진행 방향(단위 벡터): {x, y, dx, dy} */
    private static double[] nearestOn(List<double[]> line, double[] p) {
        double[] best = null;
        double bestDistance = Double.MAX_VALUE;
        for (int i = 0; i + 1 < line.size(); i++) {
            double[] a = line.get(i);
            double[] b = line.get(i + 1);
            double dx = b[0] - a[0];
            double dy = b[1] - a[1];
            double len = Math.hypot(dx, dy);
            if (len == 0) {
                continue;
            }
            double t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len)));
            double x = a[0] + t * dx;
            double y = a[1] + t * dy;
            double distance = Math.hypot(p[0] - x, p[1] - y);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = new double[]{x, y, dx / len, dy / len};
            }
        }
        return best != null ? best : new double[]{line.get(0)[0], line.get(0)[1], 1, 0};
    }

    private double sideCost(Edge edge, boolean atStart, double[] point, int side) {
        if (options(edge) == 1) {
            return 0;
        }
        List<double[]> line = toXYLine(edge);
        double[] a = atStart ? line.get(0) : line.get(line.size() - 2);
        double[] b = atStart ? line.get(1) : line.get(line.size() - 1);
        double[] at = atStart ? a : b;
        double[] p = toXY(point[0], point[1]);
        // 진행 방향 오른쪽 법선(dy, -dx)과 건물 방향의 내적이 양수면 건물은 오른쪽
        double dot = (b[1] - a[1]) * (p[0] - at[0]) - (b[0] - a[0]) * (p[1] - at[1]);
        int buildingSide = dot >= 0 ? RIGHT : LEFT;
        return buildingSide == side ? 0 : MID_BLOCK_CROSSING_METERS;
    }

    private double[] toXY(double lat, double lng) {
        return new double[]{(lng - refLng) * metersPerDegLng, (lat - refLat) * METERS_PER_DEG_LAT};
    }

    private RouteResponse.LatLng toLatLng(double[] xy) {
        return new RouteResponse.LatLng(refLat + xy[1] / METERS_PER_DEG_LAT, refLng + xy[0] / metersPerDegLng);
    }

    private Result toResult(List<double[]> points, List<RouteResponse.Crossing> crossings) {
        List<RouteResponse.Crossing> merged = mergeCrossings(crossings);
        List<double[]> drawn = new ArrayList<>(points);
        for (RouteResponse.Crossing c : merged) {
            straightenCrossing(drawn, c);
        }
        removeSpikes(drawn, merged);
        List<RouteResponse.LatLng> geometry = new ArrayList<>();
        double[] last = null;
        for (double[] p : drawn) {
            if (last == null || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.01) {
                geometry.add(toLatLng(p));
                last = p;
            }
        }
        return new Result(geometry, merged);
    }

    /**
     * 합친 횡단의 시작점과 끝점 사이에 있는 그리는 점을 지워 횡단보도를 따라 곧게 건너게 한다.
     * 합치기 전 조각 사이에는 그래프의 차로·연결 차로를 따라 걷는 점이 남아 있어서, 지우지 않으면 횡단보도 밑으로
     * 내려갔다 올라오는 모양이 그려진다 (예: 단대오거리 북쪽 횡단보도).
     */
    private void straightenCrossing(List<double[]> points, RouteResponse.Crossing c) {
        double[] start = toXY(c.start().latitude(), c.start().longitude());
        double[] end = toXY(c.end().latitude(), c.end().longitude());
        int from = indexOf(points, start, 0);
        int to = from < 0 ? -1 : indexOf(points, end, from + 1);
        if (from >= 0 && to > from + 1) {
            points.subList(from + 1, to).clear();
        }
    }

    /**
     * 짧게 나갔다가 거의 같은 방향으로 되돌아오는 점(뾰족하게 튀어나온 점)을 지운다.
     * 교차로 모퉁이 점을 찍고 다음 길로 이어 붙이다 보면, 횡단보도를 건넌 직후 모퉁이 쪽으로 몇 m 들어갔다 나오는
     * 모양이 생긴다 (예: 단대오거리 북쪽·서쪽 횡단보도 끝). 횡단보도 양 끝점과 경로의 처음·끝은 지우지 않는다.
     */
    private void removeSpikes(List<double[]> points, List<RouteResponse.Crossing> crossings) {
        List<double[]> keep = new ArrayList<>();
        for (RouteResponse.Crossing c : crossings) {
            keep.add(toXY(c.start().latitude(), c.start().longitude()));
            keep.add(toXY(c.end().latitude(), c.end().longitude()));
        }
        int i = 1;
        while (i + 1 < points.size()) {
            double[] a = points.get(i - 1);
            double[] b = points.get(i);
            double[] c = points.get(i + 1);
            double abx = a[0] - b[0];
            double aby = a[1] - b[1];
            double cbx = c[0] - b[0];
            double cby = c[1] - b[1];
            double ab = Math.hypot(abx, aby);
            double cb = Math.hypot(cbx, cby);
            boolean isSpike = ab > 0.01 && cb > 0.01 && Math.min(ab, cb) <= SPIKE_MAX_METERS
                    && (abx * cbx + aby * cby) / (ab * cb) >= SPIKE_TURN_COS;
            if (isSpike && indexOf(keep, b, 0) < 0) {
                points.remove(i);
                i = Math.max(1, i - 1); // 지운 뒤 앞 점이 새로 뾰족해졌을 수 있다
            } else {
                i++;
            }
        }
    }

    /** points에서 fromIndex부터 p와 같은 점(1cm 이내)의 위치. 없으면 -1 */
    private static int indexOf(List<double[]> points, double[] p, int fromIndex) {
        for (int i = fromIndex; i < points.size(); i++) {
            if (Math.hypot(points.get(i)[0] - p[0], points.get(i)[1] - p[1]) < 0.01) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 실제로는 횡단보도 하나인데 그래프에서 여러 도로로 나뉘어 연달아 건너는 것을 하나로 합친다.
     * 예: 단대오거리 북쪽 횡단보도는 산성대로 동쪽 차로·서쪽 차로·연결 차로를 한 번에 건너는데, 그래프에서는 세 번으로 나온다.
     * 앞 횡단이 끝난 곳과 다음 횡단이 시작하는 곳이 가깝고(MERGE_GAP_METERS) 건너는 방향이 거의 같으면 합친다.
     * 모퉁이에서 두 도로를 꺾어 건너는 것(방향이 크게 다름)은 따로 센다. 신호등은 하나라도 있으면 있는 것으로 본다.
     */
    private List<RouteResponse.Crossing> mergeCrossings(List<RouteResponse.Crossing> crossings) {
        List<RouteResponse.Crossing> merged = new ArrayList<>();
        for (RouteResponse.Crossing c : crossings) {
            if (!merged.isEmpty()) {
                RouteResponse.Crossing prev = merged.get(merged.size() - 1);
                double[] prevStart = toXY(prev.start().latitude(), prev.start().longitude());
                double[] prevEnd = toXY(prev.end().latitude(), prev.end().longitude());
                double[] start = toXY(c.start().latitude(), c.start().longitude());
                double[] end = toXY(c.end().latitude(), c.end().longitude());
                double gap = Math.hypot(start[0] - prevEnd[0], start[1] - prevEnd[1]);
                double ax = prevEnd[0] - prevStart[0];
                double ay = prevEnd[1] - prevStart[1];
                double bx = end[0] - start[0];
                double by = end[1] - start[1];
                double cos = (ax * bx + ay * by) / Math.max(1e-9, Math.hypot(ax, ay) * Math.hypot(bx, by));
                if (gap <= MERGE_GAP_METERS && cos >= MERGE_DIRECTION_COS) {
                    merged.set(merged.size() - 1,
                            new RouteResponse.Crossing(prev.start(), c.end(), prev.hasSignal() || c.hasSignal()));
                    continue;
                }
            }
            merged.add(c);
        }
        return merged;
    }

    private List<double[]> toXYLine(Edge edge) {
        List<double[]> line = new ArrayList<>();
        for (double[] p : edge.polyline()) {
            line.add(toXY(p[0], p[1]));
        }
        return line;
    }

    private static double length(List<double[]> line) {
        double total = 0;
        for (int i = 0; i + 1 < line.size(); i++) {
            total += Math.hypot(line.get(i + 1)[0] - line.get(i)[0], line.get(i + 1)[1] - line.get(i)[1]);
        }
        return total;
    }

    /** 선의 i번째 점에서 다음 점으로 가는 방향(라디안) */
    private static double heading(List<double[]> line, int i) {
        return Math.atan2(line.get(i + 1)[1] - line.get(i)[1], line.get(i + 1)[0] - line.get(i)[0]);
    }

    /** 점을 선 위에 투영:{선 시작부터 투영점까지 따라간 거리, 점과 선 사이 거리, 선 전체 길이} */
    private static double[] project(List<double[]> line, double[] p) {
        double bestAlong = 0;
        double bestOffset = Double.MAX_VALUE;
        double walked = 0;
        for (int i = 0; i + 1 < line.size(); i++) {
            double[] a = line.get(i);
            double[] b = line.get(i + 1);
            double dx = b[0] - a[0];
            double dy = b[1] - a[1];
            double len = Math.hypot(dx, dy);
            double t = len == 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len)));
            double offset = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
            if (offset < bestOffset) {
                bestOffset = offset;
                bestAlong = walked + t * len;
            }
            walked += len;
        }
        return new double[]{bestAlong, bestOffset, walked};
    }

    /** 선 시작부터 distance만큼 따라간 점과 그 자리의 진행 방향(단위 벡터): {x, y, dx, dy} */
    private static double[] pointAlong(List<double[]> line, double distance) {
        double remaining = distance;
        for (int i = 0; i + 1 < line.size(); i++) {
            double[] a = line.get(i);
            double[] b = line.get(i + 1);
            double len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (len == 0) {
                continue;
            }
            double ux = (b[0] - a[0]) / len;
            double uy = (b[1] - a[1]) / len;
            if (remaining <= len || i + 2 == line.size()) {
                double t = Math.min(remaining, len);
                return new double[]{a[0] + t * ux, a[1] + t * uy, ux, uy};
            }
            remaining -= len;
        }
        double[] only = line.get(0);
        return new double[]{only[0], only[1], 1, 0};
    }

    private static double normalize(double angle) {
        double a = angle % TWO_PI;
        return a < 0 ? a + TWO_PI : a;
    }

    /**
     * 교차로 하나. 큰 도로 방향(팔)을 각도순으로 정렬해 두고, 구역 k = 팔 k와 팔 k+1 사이(반시계 방향)로 본다.
     */
    private final class Junction {
        final double x;
        final double y;
        final double[] angles;
        final double[] widths;
        final List<List<double[]>> rayLines; // 팔마다 교차로에서 뻗어 나가는 도로 모양(평면 좌표)
        final boolean knownCrosswalk; // 근처에 횡단보도 데이터가 있음
        final boolean hasSignal;      // 가장 가까운 횡단보도에 보행자 신호등이 있음 (팔별 횡단보도가 없을 때 씀)
        // 팔마다 그 팔 위의 횡단보도. 사거리면 방향마다 따로 있을 수 있다
        final CrosswalkCatalog.Crosswalk[] rayCrosswalks;
        // 교차로에서 팔을 따라 그 횡단보도까지의 거리(m). 횡단보도가 없거나 교차로에 붙어 있으면 0
        final double[] crosswalkDistance;
        final CrosswalkCatalog.Crosswalk diagonalCrosswalk; // 사거리 대각선 횡단보도 (없으면 null)

        Junction(Node node) {
            Optional<CrosswalkCatalog.Crosswalk> crosswalk =
                    crosswalkCatalog.near(node.getLatitude(), node.getLongitude());
            this.knownCrosswalk = crosswalk.isPresent();
            this.hasSignal = crosswalk.map(CrosswalkCatalog.Crosswalk::hasSignal).orElse(false);
            double[] c = toXY(node.getLatitude(), node.getLongitude());
            this.x = c[0];
            this.y = c[1];
            List<Edge> rayEdges = new ArrayList<>();
            for (Edge e : adjacency.getOrDefault(node.getId(), List.of())) {
                if (RoadType.halfWidthMeters(e.getRoadType()) > 0) {
                    rayEdges.add(e);
                }
            }
            rayEdges.sort(Comparator.comparingDouble(e -> angleTo(afterStart(e))));
            angles = rayEdges.stream().mapToDouble(e -> angleTo(afterStart(e))).toArray();
            widths = rayEdges.stream().mapToDouble(e -> RoadType.halfWidthMeters(e.getRoadType())).toArray();
            rayLines = new ArrayList<>();
            for (Edge e : rayEdges) {
                rayLines.add(rayLine(e));
            }
            rayCrosswalks = new CrosswalkCatalog.Crosswalk[rayLines.size()];
            crosswalkDistance = new double[rayLines.size()];
            CrosswalkCatalog.Crosswalk diagonal = null;
            for (CrosswalkCatalog.Crosswalk cw : crosswalkCatalog.within(node.getLatitude(), node.getLongitude())) {
                if (!cw.diagonal()) {
                    placeCrosswalk(cw);
                } else if (Math.hypot(toXY(cw.latitude(), cw.longitude())[0] - x,
                        toXY(cw.latitude(), cw.longitude())[1] - y) <= DIAGONAL_MATCH_METERS) {
                    diagonal = cw; // 어느 한 도로 위의 횡단보도가 아니라 교차로 전체에 딸린 것
                }
            }
            diagonalCrosswalk = diagonal;
            dropPublicWhereSurveyed();
        }

        /**
         * 직접 찍은 횡단보도가 붙은 교차로는 사람이 확인한 곳이라, 다른 방향에 붙은 공공데이터 횡단보도는 버린다
         * (그 방향은 rayCrossingMeters에서 횡단보도 없는 곳으로 본다). 공공데이터는 주소 좌표라 엉뚱한 방향에 붙기도 해서,
         * 남겨 두면 실제 횡단보도와 비용이 같아져 줄무늬 없는 쪽에서 건너는 경로가 나왔다 (예: 단대전통시장 앞 광명로)
         */
        private void dropPublicWhereSurveyed() {
            if (!hasNearSurveyed()) {
                return;
            }
            for (int k = 0; k < rayCrosswalks.length; k++) {
                if (rayCrosswalks[k] != null && !rayCrosswalks[k].surveyed()) {
                    rayCrosswalks[k] = null;
                    crosswalkDistance[k] = 0;
                }
            }
        }

        /** 교차로에서 MATCH_METERS 안의 직접 찍은 횡단보도가 어느 팔에든 붙었는지 (블록 중간 횡단보도는 세지 않는다) */
        private boolean hasNearSurveyed() {
            for (CrosswalkCatalog.Crosswalk cw : rayCrosswalks) {
                if (cw != null && cw.surveyed() && Math.hypot(toXY(cw.latitude(), cw.longitude())[0] - x,
                        toXY(cw.latitude(), cw.longitude())[1] - y) <= CrosswalkCatalog.MATCH_METERS) {
                    return true;
                }
            }
            return false;
        }

        /**
         * 팔의 도로 모양. 바로 앞에 옆길 입구 같은 작은 노드가 있어도 큰 도로가 그대로 이어지면
         * RAY_EXTEND_METERS 까지 이어 붙인다 (그 너머의 횡단보도도 이 교차로의 것으로 보기 위해)
         */
        private List<double[]> rayLine(Edge first) {
            List<double[]> line = toXYLine(first);
            Edge current = first;
            for (int guard = 0; guard < 10 && length(line) < RAY_EXTEND_METERS; guard++) {
                Edge continuation = null;
                int count = 0;
                for (Edge e : adjacency.getOrDefault(current.getToNode().getId(), List.of())) {
                    if (RoadType.halfWidthMeters(e.getRoadType()) > 0
                            && !e.getToNode().getId().equals(current.getFromNode().getId())) {
                        continuation = e;
                        count++;
                    }
                }
                if (count != 1) {
                    break; // 큰 도로가 갈라지거나 끝나는 곳 = 다른 교차로
                }
                List<double[]> next = toXYLine(continuation);
                double turn = normalize(heading(next, 0) - heading(line, line.size() - 2) + Math.PI) - Math.PI;
                if (Math.abs(turn) > Math.PI / 4) {
                    break; // 45도 넘게 꺾이면 다른 도로로 본다
                }
                line.addAll(next.subList(1, next.size()));
                current = continuation;
            }
            return line;
        }

        /**
         * 횡단보도 좌표를 가장 가까운 팔 위로 투영해서 그 팔의 횡단보도로 둔다. 한 팔에 여러 개면
         * 직접 찍은 좌표를 먼저, 같은 종류끼리는 교차로에 가까운 것을 쓴다.
         */
        private void placeCrosswalk(CrosswalkCatalog.Crosswalk cw) {
            double[] point = toXY(cw.latitude(), cw.longitude());
            int ray = -1;
            double[] best = null; // {따라간 거리, 도로에서 떨어진 거리, 전체 길이}
            for (int k = 0; k < rayLines.size(); k++) {
                double[] projection = project(rayLines.get(k), point);
                if (best == null || projection[1] < best[1]) {
                    best = projection;
                    ray = k;
                }
            }
            if (best == null || best[1] > (cw.surveyed() ? SURVEYED_SNAP_METERS : CROSSWALK_SNAP_METERS)) {
                return;
            }
            // 교차로에서 MATCH_METERS보다 먼 직접 찍은 횡단보도는 블록 중간 횡단보도일 때만 쓴다.
            // 팔 끝(다음 교차로) 근처에 있으면 그 교차로의 횡단보도라서, 여기서 쓰면 거기까지 걸어갔다 되돌아오는 경로가 나온다
            if (Math.hypot(point[0] - x, point[1] - y) > CrosswalkCatalog.MATCH_METERS
                    && best[2] - best[0] < CrosswalkCatalog.MATCH_METERS) {
                return;
            }
            // 다음 교차로를 넘어가지 않게, 끝에서 조금 앞까지로 제한한다
            double distance = Math.min(best[0], best[2] - CROSSWALK_END_MARGIN);
            CrosswalkCatalog.Crosswalk current = rayCrosswalks[ray];
            if (current != null && (current.surveyed() && !cw.surveyed()
                    || current.surveyed() == cw.surveyed() && rawDistance(ray, current) <= distance)) {
                return;
            }
            rayCrosswalks[ray] = cw;
            // 교차로에 붙은 횡단보도는 모퉁이끼리 잇는 원래 방식이 더 자연스럽다
            crosswalkDistance[ray] = distance < CROSSWALK_MIN_DISTANCE ? 0 : distance;
        }

        private double rawDistance(int ray, CrosswalkCatalog.Crosswalk cw) {
            double[] projection = project(rayLines.get(ray), toXY(cw.latitude(), cw.longitude()));
            return Math.min(projection[0], projection[2] - CROSSWALK_END_MARGIN);
        }

        /** 팔 ray를 건널 때 보행자 신호등이 있는지. 그 팔의 횡단보도가 없으면 교차로에서 가장 가까운 횡단보도 기준 */
        boolean signalOf(int ray) {
            return rayCrosswalks[ray] != null ? rayCrosswalks[ray].hasSignal() : hasSignal;
        }

        /**
         * 팔 ray를 from 구역에서 to 구역으로 건널 때, 그 팔의 떨어진 횡단보도 양 끝점 {from쪽, to쪽}.
         * 이 팔에 떨어진 횡단보도가 없으면 null (모퉁이끼리 잇는다)
         */
        double[][] crosswalkCrossing(int ray, int from, int to) {
            if (crosswalkDistance[ray] <= 0) {
                return null;
            }
            double[] at = pointAlong(rayLines.get(ray), crosswalkDistance[ray]); // {x, y, 진행방향 x, 진행방향 y}
            double w = widths[ray];
            // 구역 ray는 팔의 반시계 방향(진행 방향 왼쪽), 구역 ray-1은 오른쪽
            double leftX = -at[3];
            double leftY = at[2];
            double[] left = {at[0] + w * leftX, at[1] + w * leftY};
            double[] right = {at[0] - w * leftX, at[1] - w * leftY};
            return new double[][]{from == ray ? left : right, to == ray ? left : right};
        }

        int rayCount() {
            return angles.length;
        }

        /** 두 팔이 거의 반대 방향(150°~210°)으로 이어지면 직선 도로로 본다 */
        boolean isLinear() {
            if (angles.length != 2) return false;
            double gap = normalize(angles[1] - angles[0]);
            return Math.abs(gap - Math.PI) < Math.toRadians(30);
        }

        double angleTo(double[] p) {
            return normalize(Math.atan2(p[1] - y, p[0] - x));
        }

        int sectorOf(double angle) {
            if (angles.length == 0) {
                return 0;
            }
            double a = normalize(angle);
            for (int k = angles.length - 1; k >= 0; k--) {
                if (angles[k] <= a) {
                    return k;
                }
            }
            return angles.length - 1;
        }

        int nearestRay(double angle) {
            int best = 0;
            double bestDiff = Double.MAX_VALUE;
            for (int k = 0; k < angles.length; k++) {
                double d = Math.abs(normalize(angle - angles[k] + Math.PI) - Math.PI);
                if (d < bestDiff) {
                    bestDiff = d;
                    best = k;
                }
            }
            return best;
        }

        int previousSector(int ray) {
            return (ray - 1 + angles.length) % angles.length;
        }

        /** from 구역에서 to 구역으로 옮기는 비용(m 상당). 시계/반시계 중 싼 쪽으로 돌며 건너는 팔마다 횡단 비용을 더한다 */
        double crossingMeters(int from, int to) {
            int m = angles.length;
            if (m < 2 || from == to) {
                return 0;
            }
            int ccw = ((to - from) % m + m) % m;
            if (crossesDiagonally(Math.min(ccw, m - ccw))) {
                return CROSSWALK_CROSSING_METERS; // 대각선 횡단보도로 두 번 건널 것을 한 번에 건넌다
            }
            return Math.min(directionMeters(from, ccw, 1), directionMeters(from, m - ccw, -1));
        }

        /** from 구역에서 step 방향(1 = 반시계, -1 = 시계)으로 팔 count개를 건너는 비용 */
        private double directionMeters(int from, int count, int step) {
            int m = angles.length;
            double total = 0;
            for (int k = 1; k <= count; k++) {
                // 반시계: 팔 from+1 ~ to, 시계: 팔 from ~ to+1
                total += rayCrossingMeters(step > 0 ? (from + k) % m : ((from - k + 1) % m + m) % m);
            }
            return total;
        }

        /** 팔 ray 하나를 건너는 비용 */
        private double rayCrossingMeters(int ray) {
            if (rayCrosswalks[ray] != null) {
                return CROSSWALK_CROSSING_METERS;
            }
            boolean anyOnRays = false;
            for (CrosswalkCatalog.Crosswalk cw : rayCrosswalks) {
                anyOnRays |= cw != null;
            }
            if (hasNearSurveyed()) {
                return SURVEYED_NO_CROSSWALK_METERS; // 예: 단대오거리 산성대로 남쪽은 횡단보도가 없다
            }
            // 다른 팔에는 횡단보도가 붙었는데 이 팔에만 없으면, 이 방향엔 실제로 횡단보도가 없는 것으로 본다
            if (!anyOnRays && knownCrosswalk) {
                return KNOWN_CROSSING_METERS;
            }
            return angles.length >= 3 ? JUNCTION_CROSSING_METERS : MID_BLOCK_CROSSING_METERS;
        }

        /** 도로 count개를 건너야 하는 이동을 대각선 횡단보도 한 번으로 건널 수 있는지 (사거리 이상에서 맞은편 모퉁이로) */
        boolean crossesDiagonally(int count) {
            return diagonalCrosswalk != null && count == 2 && angles.length >= 4;
        }

        /**
         * from 구역에서 to 구역으로 갈 때 도는 방향 (1 = 반시계, -1 = 시계). 탐색(crossingMeters)과 같은 기준으로
         * 횡단 비용이 싼 쪽을 고르고, 같으면 적게 건너는 쪽을 고른다.
         * 반시계로 돌면 팔 from+1 ~ to, 시계로 돌면 팔 from ~ to+1 을 건넌다.
         */
        int step(int from, int to) {
            int m = angles.length;
            int ccw = ((to - from) % m + m) % m;
            double ccwMeters = directionMeters(from, ccw, 1);
            double cwMeters = directionMeters(from, m - ccw, -1);
            if (ccwMeters != cwMeters) {
                return ccwMeters < cwMeters ? 1 : -1;
            }
            return ccw <= m - ccw ? 1 : -1;
        }

        /** from 구역에서 to 구역까지 적게 건너는 방향으로 지나는 구역 목록 (양 끝 포함) */
        List<Integer> sectorsBetween(int from, int to) {
            int m = angles.length;
            int step = step(from, to);
            List<Integer> sectors = new ArrayList<>();
            for (int k = from; ; k = ((k + step) % m + m) % m) {
                sectors.add(k);
                if (k == to) {
                    return sectors;
                }
            }
        }

        /** 구역의 모퉁이 점: 양쪽 도로의 보도선이 만나는 곳 */
        double[] corner(int sector) {
            int m = angles.length;
            int nextRay = (sector + 1) % m;
            double gap = normalize(angles[nextRay] - angles[sector]);
            double w = Math.max(widths[sector], widths[nextRay]);
            double sin = Math.sin(gap / 2);
            double distance = sin <= 1.0 / 3 ? 3 * w : w / sin; // 아주 좁은 모퉁이는 너무 멀어지지 않게 제한
            double direction = angles[sector] + gap / 2;
            return new double[]{x + distance * Math.cos(direction), y + distance * Math.sin(direction)};
        }
    }
}
