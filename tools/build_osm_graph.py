"""
OpenStreetMap 도로망에서 시연 지역의 보행 그래프(교차로 노드 + 간선)를 만들어 CSV로 저장한다.

- 데이터: OpenStreetMap, Overpass API로 시연 지역의 도로(highway)만 조회. (c) OpenStreetMap contributors, ODbL
- 출력: back/src/main/resources/data/graph-nodes.csv, graph-edges.csv (UTF-8)
  edges 컬럼: fromIndex,toIndex,distanceMeters,roadType(OSM highway 값),geometry("위도 경도;위도 경도;..." from->to 도로 모양)
- 사용법:  python tools/build_osm_graph.py            # OSM에서 새로 받아 생성
           python tools/build_osm_graph.py --xml f.xml # 이미 받아 둔 OSM XML 사용
  만든 뒤에는 python tools/mark_wide_residential.py 를 이어서 돌린다 (횡단보도가 있는 골목 표시)

노드 = 도로가 만나는 교차로 + 도로 끝점. 간선 = 인접한 노드 사이 도로 구간(실제 도로를 따라 잰 길이).
서버는 실행 중에 OSM에 접속하지 않고, 이 스크립트가 만든 CSV만 읽는다.
"""
import argparse
import collections
import math
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# 시연 지역(남, 서, 북, 동). 서쪽 가천대역 ~ 동쪽 상대원동, 북쪽 단대동 ~ 남쪽 수진역/중앙동까지의 사각형
# (약 5.9km x 2.6km, 신구대·단대오거리역·신흥역 포함). 예전에는 신구대 중심 반경 1150m 원이었다.
BBOX = (37.4350, 127.1230, 37.4580, 127.1900)

# 보행 가능한 것으로 보는 도로 종류
WALKABLE = {
    "primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "pedestrian",
    "footway", "path", "steps", "service", "primary_link", "secondary_link", "tertiary_link", "track",
}

OUT_DIR = Path(__file__).resolve().parent.parent / "back" / "src" / "main" / "resources" / "data"

# 교차로 판정 로직(모든 way의 끝점 = 교차로)이 만드는 부작용: 같은 실제 교차로인데
# OSM에서 도로가 여러 way로 쪼개져 있으면(사이클링/보도 태그가 달라지는 지점 등) 그 경계마다
# 좌표가 살짝 다른 노드가 하나씩 더 생긴다. 이 거리 이내면 같은 교차로로 보고 하나로 합친다.
JUNCTION_MERGE_METERS = 12


def haversine(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def merge_close_junctions(junction_ids, pos):
    """threshold 이내로 가까운 교차로 노드들을 대표 id 하나로 묶어 {원래id: 대표id}를 반환한다."""
    parent = {n: n for n in junction_ids}

    def find(n):
        while parent[n] != n:
            parent[n] = parent[parent[n]]
            n = parent[n]
        return n

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    # 격자에 담아서 근처 후보만 비교한다 (전체 쌍 비교로는 노드가 많을 때 느려짐)
    cell_size = JUNCTION_MERGE_METERS / 111_000  # 위도 기준 대략적인 도(degree) 크기
    grid = collections.defaultdict(list)

    def cell_of(n):
        lat, lng = pos[n]
        return (int(lat / cell_size), int(lng / cell_size))

    for n in junction_ids:
        grid[cell_of(n)].append(n)

    for n in junction_ids:
        lat, lng = pos[n]
        cx, cy = cell_of(n)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for m in grid.get((cx + dx, cy + dy), []):
                    if m == n or find(m) == find(n):
                        continue
                    if haversine(lat, lng, *pos[m]) <= JUNCTION_MERGE_METERS:
                        union(n, m)

    return {n: find(n) for n in junction_ids}


def fetch_osm_xml():
    # 시연 지역보다 넉넉하게(약 +100m) 받아서 가장자리 도로가 잘리지 않게 한다.
    # 범위가 넓어 OSM 공식 API(/map, 노드 5만 개 제한)로는 건물까지 다 받아져 막히므로 Overpass로 도로만 받는다
    d_lat = 100 / 111_000
    d_lng = 100 / (111_000 * math.cos(math.radians(BBOX[0])))
    south, west, north, east = BBOX[0] - d_lat, BBOX[1] - d_lng, BBOX[2] + d_lat, BBOX[3] + d_lng
    query = f"way[highway]({south},{west},{north},{east});(._;>;);out body;"
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": "safemate-map-student-project/1.0"},
    )
    return urllib.request.urlopen(req, timeout=180).read()


def build_graph(xml_bytes):
    root = ET.fromstring(xml_bytes)
    pos = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.findall("node")}

    ways = []
    for w in root.findall("way"):
        tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
        highway = tags.get("highway")
        if highway not in WALKABLE:
            continue
        if tags.get("foot") == "no" or tags.get("access") in ("private", "no"):
            continue
        if highway == "service" and tags.get("service") in ("parking_aisle", "driveway", "drive-through"):
            continue
        ways.append((highway, [n.get("ref") for n in w.findall("nd")]))

    def inside(node_id):
        if node_id not in pos:
            return False
        lat, lng = pos[node_id]
        return BBOX[0] <= lat <= BBOX[2] and BBOX[1] <= lng <= BBOX[3]

    # 둘 이상의 way가 지나거나 way의 끝인 점 = 교차로/끝점
    usage = collections.Counter()
    for _, nds in ways:
        for n in set(nds):
            usage[n] += 1
    junctions = {
        n
        for _, nds in ways
        for i, n in enumerate(nds)
        if inside(n) and (usage[n] >= 2 or i in (0, len(nds) - 1))
    }

    # 같은 실제 교차로가 way 경계 때문에 여러 노드로 쪼개진 경우를 하나로 합친다 (위 JUNCTION_MERGE_METERS 참고)
    merge = merge_close_junctions(junctions, pos)

    # 교차로 사이 도로 구간을 간선으로 만든다 (길이는 도로를 따라 누적, 도로 모양 좌표도 함께 저장)
    # edges[(a, b)] = (길이, 도로종류, [(lat, lng), ...] a->b 방향)
    edges = {}
    for highway, nds in ways:
        last, acc, prev, pts = None, 0.0, None, []
        for n in nds:
            if n not in pos:
                last, prev, pts = None, None, []
                continue
            if prev is not None and last is not None:
                acc += haversine(*pos[prev], *pos[n])
                pts.append(pos[n])
            prev = n
            if n in junctions:
                node_id = merge[n]
                if last is not None and last != node_id:
                    key = (min(last, node_id), max(last, node_id))
                    shape = pts if key[0] == last else pts[::-1]
                    if key not in edges or acc < edges[key][0]:
                        edges[key] = (acc, highway, shape)
                last, acc, pts = node_id, 0.0, [pos[n]]
            elif not inside(n):
                last, pts = None, []

    # 서로 이어지지 않은 조각은 경로 탐색에 쓸 수 없으니 가장 큰 연결 덩어리만 남긴다
    adjacency = collections.defaultdict(set)
    for a, b in edges:
        adjacency[a].add(b)
        adjacency[b].add(a)
    best, seen = set(), set()
    for start in adjacency:
        if start in seen:
            continue
        component, stack = {start}, [start]
        while stack:
            u = stack.pop()
            for v in adjacency[u]:
                if v not in component:
                    component.add(v)
                    stack.append(v)
        seen |= component
        if len(component) > len(best):
            best = component

    node_ids = sorted(best, key=int)
    edges = {k: v for k, v in edges.items() if k[0] in best and k[1] in best}
    return node_ids, pos, edges


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml", help="이미 받아 둔 OSM XML 파일 경로")
    args = parser.parse_args()

    xml_bytes = Path(args.xml).read_bytes() if args.xml else fetch_osm_xml()
    node_ids, pos, edges = build_graph(xml_bytes)

    index = {osm_id: i + 1 for i, osm_id in enumerate(node_ids)}
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(OUT_DIR / "graph-nodes.csv", "w", encoding="utf-8", newline="\n") as f:
        f.write("index,name,latitude,longitude\n")
        for osm_id in node_ids:
            lat, lng = pos[osm_id]
            f.write(f"{index[osm_id]},교차로-{index[osm_id]},{lat:.7f},{lng:.7f}\n")

    with open(OUT_DIR / "graph-edges.csv", "w", encoding="utf-8", newline="\n") as f:
        f.write("fromIndex,toIndex,distanceMeters,roadType,geometry\n")
        for (a, b), (meters, highway, shape) in sorted(
            edges.items(), key=lambda kv: (index[kv[0][0]], index[kv[0][1]])
        ):
            geometry = ";".join(f"{lat:.6f} {lng:.6f}" for lat, lng in shape)
            f.write(f"{index[a]},{index[b]},{meters:.2f},{highway},{geometry}\n")

    print(f"노드 {len(node_ids)}개, 간선 {len(edges)}개 (양방향은 서버가 적재할 때 만든다)")


if __name__ == "__main__":
    main()
