"""
공공데이터(성남시 중원구 보안등 정보 현황)에서 시연 지역만 추려
back/src/main/resources/data/street-lights.csv 로 저장한다.

- 원본: 성남시 중원구 보안등 정보 현황 CSV (공공데이터포털, EUC-KR/CP949 인코딩)
  컬럼: 보안등위치명,설치개수,소재지도로명주소,소재지지번주소,위도,경도,설치연도,설치형태,관리기관전화번호,관리기관명,데이터기준일자
- 출력: name,installCount,latitude,longitude (UTF-8)
- 사용법: python tools/build_streetlights_csv.py <원본_CSV_경로>

BBOX는 tools/build_osm_graph.py와 맞춰서 쓴다. 보행로 그래프 가장자리 간선도
가로등 반경(25m) 안에서 조회되도록 그래프 범위보다 넉넉하게(+100m) 받는다.
"""
import argparse
import csv
import math
from pathlib import Path

# tools/build_osm_graph.py의 BBOX(남, 서, 북, 동)와 같게 맞추고, 가장자리용으로 사방 MARGIN_METERS씩 더 받는다
BBOX = (37.4350, 127.1230, 37.4580, 127.1900)
MARGIN_METERS = 100

OUT_PATH = Path(__file__).resolve().parent.parent / "back" / "src" / "main" / "resources" / "data" / "street-lights.csv"


def inside(lat, lng):
    d_lat = MARGIN_METERS / 111_000
    d_lng = MARGIN_METERS / (111_000 * math.cos(math.radians(BBOX[0])))
    return BBOX[0] - d_lat <= lat <= BBOX[2] + d_lat and BBOX[1] - d_lng <= lng <= BBOX[3] + d_lng


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source_csv", help="원본 보안등 정보 현황 CSV 경로")
    args = parser.parse_args()

    rows = []
    with open(args.source_csv, encoding="cp949") as f:
        reader = csv.reader(f)
        next(reader)  # 헤더
        for cols in reader:
            if len(cols) < 10:
                continue
            # 분당구 제외 (시연 지역은 수정구·중원구)
            address = cols[3].strip()
            agency = cols[9].strip()
            if "분당구" in address or "분당구" in agency:
                continue
            name = cols[0].strip().replace(",", " ")  # 서버가 쉼표로 컬럼을 나누므로 이름 속 쉼표는 공백으로
            lat, lng = float(cols[4]), float(cols[5])
            if not inside(lat, lng):
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

    print(f"시연 지역 가로등 {len(rows)}개 저장 완료")


if __name__ == "__main__":
    main()
