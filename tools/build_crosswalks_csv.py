"""
공공데이터(전국횡단보도표준데이터, 성남시 제공분)에서 시연 지역만 추려
back/src/main/resources/data/crosswalks.csv 로 저장한다.

- 원본: 횡단보도현황(제공표준) CSV (공공데이터포털, EUC-KR/CP949 인코딩)
  사용 컬럼: 도로명, 위도, 경도, 보행자신호등유무
- 출력: roadName,latitude,longitude,hasSignal (UTF-8)
- 사용법: python tools/build_crosswalks_csv.py <원본_CSV_경로>

주의: 성남시가 올린 횡단보도는 일부뿐이고(시연 지역 42개, 신구대 앞 사거리도 빠져 있음) 좌표도
횡단보도 자리가 아니라 주소 좌표라 도로에서 수십 m 떨어져 있기도 하다. 그래서 서버는 이 데이터를
"근처 교차로에서 건너는 쪽을 조금 더 우선"하는 보조 정보로만 쓴다.

BBOX는 tools/build_osm_graph.py와 맞춰서 쓴다 (가장자리 교차로도 찾도록 +100m).
"""
import argparse
import csv
import math
from pathlib import Path

# tools/build_osm_graph.py의 BBOX(남, 서, 북, 동)와 같게 맞추고, 가장자리용으로 사방 MARGIN_METERS씩 더 받는다
BBOX = (37.4350, 127.1230, 37.4580, 127.1900)
MARGIN_METERS = 100

# 시연 지역을 직접 확인해 보니 그 자리에서 큰 도로를 건너는 횡단보도가 없는 공공데이터 행 (도로명, 위도, 경도).
# 주소 좌표라 큰 도로 옆 골목 입구에 찍혀 있어서, 서버가 큰 도로의 횡단보도로 붙여 줄무늬 없는 곳에서 건너는 경로가 나왔다
EXCLUDE = {
    ("자혜로", "37.445008", "127.159214"),  # 광명로 단대오거리 서쪽 골목 입구 (광명로를 건너는 횡단보도 없음)
    ("광명로", "37.444914", "127.160438"),  # 광명로가 두 차로로 갈라지는 교차로 (실제 횡단보도는 서쪽 50m, 직접 찍은 좌표 있음)
}

OUT_PATH = Path(__file__).resolve().parent.parent / "back" / "src" / "main" / "resources" / "data" / "crosswalks.csv"


def inside(lat, lng):
    d_lat = MARGIN_METERS / 111_000
    d_lng = MARGIN_METERS / (111_000 * math.cos(math.radians(BBOX[0])))
    return BBOX[0] - d_lat <= lat <= BBOX[2] + d_lat and BBOX[1] - d_lng <= lng <= BBOX[3] + d_lng


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source_csv", help="원본 횡단보도현황(제공표준) CSV 경로")
    args = parser.parse_args()

    rows = []
    with open(args.source_csv, encoding="cp949") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                lat, lng = float(row["위도"]), float(row["경도"])
            except (TypeError, ValueError):
                continue  # 좌표가 빈 행
            if not inside(lat, lng):
                continue
            road = row["도로명"].strip().replace(",", " ")
            if (road, f"{lat:.6f}", f"{lng:.6f}") in EXCLUDE:
                continue
            rows.append((road, lat, lng, row["보행자신호등유무"].strip() == "Y"))

    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("roadName,latitude,longitude,hasSignal\n")
        for road, lat, lng, signal in rows:
            f.write(f"{road},{lat:.6f},{lng:.6f},{str(signal).lower()}\n")

    print(f"시연 지역 횡단보도 {len(rows)}개 저장 완료")


if __name__ == "__main__":
    main()
