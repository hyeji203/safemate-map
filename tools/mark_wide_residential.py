"""
직접 찍은 횡단보도(crosswalks-surveyed.csv)가 놓인 골목(residential) 간선을 graph-edges.csv에서 residential_wide로 바꾼다.

- 왜: 서버는 tertiary 이상 큰 도로만 보도·횡단보도를 따로 다루고 골목은 차도 가운데로 그냥 지나간다.
  그런데 산성대로437번길(단대동 GS25 앞)처럼 OSM에는 residential이지만 실제로는 횡단보도가 있는 2차로 도로가 있어서,
  직접 찍은 횡단보도가 있는 골목은 큰 도로처럼 보도로 걷고 횡단보도로 건너게 한다 (RoadType.WIDE_RESIDENTIAL).
- 사용법:  python tools/mark_wide_residential.py
  build_osm_graph.py로 도로망을 새로 만들었거나 crosswalks-surveyed.csv에 좌표를 추가했으면 다시 돌린다.
  지금 residential_wide인 간선도 residential로 보고 처음부터 다시 판정하므로 여러 번 돌려도 결과가 같다.
"""
import csv
import math
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "back" / "src" / "main" / "resources" / "data"
WIDE = "residential_wide"

# 횡단보도 좌표가 간선 중심선에서 이 거리 안이고, 모든 간선 중 그 간선이 가장 가까울 때 그 간선 위의 횡단보도로 본다
MATCH_METERS = 6

METERS_PER_DEG_LAT = 111_320


def to_xy(lat, lng):
    return lng * METERS_PER_DEG_LAT * math.cos(math.radians(37.44)), lat * METERS_PER_DEG_LAT


def segment_distance(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dy * dy
    t = 0 if length2 == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def main():
    edges_path = DATA_DIR / "graph-edges.csv"
    with open(edges_path, encoding="utf-8", newline="") as f:
        lines = f.read().splitlines()
    header, rows = lines[0], [line.split(",") for line in lines[1:] if line.strip()]
    for cols in rows:
        if cols[3] == WIDE:
            cols[3] = "residential"
    shapes = [[to_xy(*map(float, p.split())) for p in cols[4].split(";")] for cols in rows]

    marked = set()
    with open(DATA_DIR / "crosswalks-surveyed.csv", encoding="utf-8") as f:
        for cw in csv.DictReader(f):
            if (cw.get("diagonal") or "").strip() == "true":
                continue  # 사거리 대각선 횡단보도는 어느 한 도로 위의 것이 아니다
            p = to_xy(float(cw["latitude"]), float(cw["longitude"]))
            distance, i = min(
                (min(segment_distance(p, a, b) for a, b in zip(shape, shape[1:])), i)
                for i, shape in enumerate(shapes)
            )
            if distance <= MATCH_METERS and rows[i][3] == "residential":
                marked.add(i)

    for i in marked:
        rows[i][3] = WIDE
    with open(edges_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(header + "\n")
        for cols in rows:
            f.write(",".join(cols) + "\n")
    print(f"residential_wide로 표시한 간선 {len(marked)}개")


if __name__ == "__main__":
    main()
