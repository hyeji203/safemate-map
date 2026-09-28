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

CENTER/RADIUS는 tools/build_osm_graph.py와 맞춰서 쓴다 (가장자리 교차로도 찾도록 +100m).
"""
import argparse
import csv
import math
from pathlib import Path

CENTER = (37.4488, 127.1677)
RADIUS_METERS = 1150 + 100

OUT_PATH = Path(__file__).resolve().parent.parent / "back" / "src" / "main" / "resources" / "data" / "crosswalks.csv"


def haversine(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


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
            if haversine(*CENTER, lat, lng) > RADIUS_METERS:
                continue
            road = row["도로명"].strip().replace(",", " ")
            rows.append((road, lat, lng, row["보행자신호등유무"].strip() == "Y"))

    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("roadName,latitude,longitude,hasSignal\n")
        for road, lat, lng, signal in rows:
            f.write(f"{road},{lat:.6f},{lng:.6f},{str(signal).lower()}\n")

    print(f"시연 지역(반경 {RADIUS_METERS}m) 횡단보도 {len(rows)}개 저장 완료")


if __name__ == "__main__":
    main()
