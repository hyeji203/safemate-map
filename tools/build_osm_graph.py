"""
OpenStreetMap 도로망에서 시연 지역의 보행 그래프(교차로 노드 + 간선)를 만들어 CSV로 저장한다.

- 데이터: OpenStreetMap 공식 API(bbox 조회). (c) OpenStreetMap contributors, ODbL
- 출력: back/src/main/resources/data/graph-nodes.csv, graph-edges.csv (UTF-8)
  edges 컬럼: fromIndex,toIndex,distanceMeters,roadType(OSM highway 값),geometry("위도 경도;위도 경도;..." from->to 도로 모양)
- 사용법:  python tools/build_osm_graph.py            # OSM에서 새로 받아 생성
           python tools/build_osm_graph.py --xml f.xml # 이미 받아 둔 OSM XML 사용

노드 = 도로가 만나는 교차로 + 도로 끝점. 간선 = 인접한 노드 사이 도로 구간(실제 도로를 따라 잰 길이).
서버는 실행 중에 OSM에 접속하지 않고, 이 스크립트가 만든 CSV만 읽는다.
"""
import argparse
import collections
import math
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# 시연 지역: 신구대학교(성남시 중원구 금광동) 중심, 카카오 로컬 API 키워드 검색 결과
CENTER = (37.4488, 127.1677)
# 시연 범위. 220m = 노드 25개(기획서의 20~30개 범위). 250m는 62개.
RADIUS_METERS = 220

# 보행 가능한 것으로 보는 도로 종류
WALKABLE = {
    "primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "pedestrian",
    "footway", "path", "steps", "service", "primary_link", "secondary_link", "tertiary_link", "track",
}

OUT_DIR = Path(__file__).resolve().parent.parent / "back" / "src" / "main" / "resources" / "data"


def haversine(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def fetch_osm_xml():
    # 반경보다 넉넉하게(약 +100m) 받아서 가장자리 도로가 잘리지 않게 한다
    margin = RADIUS_METERS + 100
    d_lat = margin / 111_000
    d_lng = margin / (111_000 * math.cos(math.radians(CENTER[0])))
    bbox = f"{CENTER[1] - d_lng},{CENTER[0] - d_lat},{CENTER[1] + d_lng},{CENTER[0] + d_lat}"
    url = f"https://api.openstreetmap.org/api/0.6/map?bbox={bbox}"
    req = urllib.request.Request(url, headers={"User-Agent": "safemate-map-student-project/1.0"})
    return urllib.request.urlopen(req, timeout=60).read()


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
        return node_id in pos and haversine(*CENTER, *pos[node_id]) <= RADIUS_METERS

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
                if last is not None and last != n:
                    key = (min(last, n), max(last, n))
                    shape = pts if key[0] == last else pts[::-1]
                    if key not in edges or acc < edges[key][0]:
                        edges[key] = (acc, highway, shape)
                last, acc, pts = n, 0.0, [pos[n]]
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
