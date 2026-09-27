"""
공공데이터(성남시 중원구 보안등 정보 현황)에서 시연 지역만 추려
back/src/main/resources/data/street-lights.csv 로 저장한다.

- 원본: 성남시 중원구 보안등 정보 현황 CSV (공공데이터포털, EUC-KR/CP949 인코딩)
  컬럼: 보안등위치명,설치개수,소재지도로명주소,소재지지번주소,위도,경도,설치연도,설치형태,관리기관전화번호,관리기관명,데이터기준일자
- 출력: name,installCount,latitude,longitude (UTF-8)
- 사용법: python tools/build_streetlights_csv.py <원본_CSV_경로>

CENTER/RADIUS는 tools/build_osm_graph.py와 맞춰서 쓴다. 보행로 그래프 가장자리 간선도
가로등 반경(25m) 안에서 조회되도록 그래프 반경보다 넉넉하게(+100m) 받는다.
"""
import argparse
import csv
import math
from pathlib import Path

CENTER = (37.4488, 127.1677)
RADIUS_METERS = 1150 + 100

OUT_PATH = Path(__file__).resolve().parent.parent / "back" / "src" / "main" / "resources" / "data" / "street-lights.csv"


def haversine(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source_csv", help="원본 보안등 정보 현황 CSV 경로")
    args = parser.parse_args()

    rows = []
    with open(args.source_csv, encoding="cp949") as f:
        reader = csv.reader(f)
        next(reader)  # 헤더
        for cols in reader:
            if len(cols) < 6:
                continue
            name = cols[0].strip()
            lat, lng = float(cols[4]), float(cols[5])
            if haversine(*CENTER, lat, lng) > RADIUS_METERS:
                continue
            try:
                install_count = int(cols[1].strip())
            except ValueError:
                install_count = 1
            rows.append((name, max(1, install_count), lat, lng))

    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("name,installCount,latitude,longitude\n")
        for name, count, lat, lng in rows:
            f.write(f"{name},{count},{lat:.6f},{lng:.6f}\n")

    print(f"시연 지역(반경 {RADIUS_METERS}m) 가로등 {len(rows)}개 저장 완료")


if __name__ == "__main__":
    main()
