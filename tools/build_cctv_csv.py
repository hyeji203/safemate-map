"""
공공데이터(전국CCTV표준데이터)에서 시연 지역만 추려
back/src/main/resources/data/cctv.csv 로 저장한다.

- 원본: 공공데이터포털 "전국CCTV표준데이터" CSV (성남시 제공분 또는 전국 파일, CP949 또는 UTF-8 인코딩)
  필요한 컬럼(이름으로 찾음): 설치목적구분, 카메라대수, WGS84위도, WGS84경도
- 출력: purpose,cameraCount,latitude,longitude (UTF-8)
- 사용법: python tools/build_cctv_csv.py <원본_CSV_경로>

BBOX는 tools/build_osm_graph.py, tools/build_streetlights_csv.py와 맞춰서 쓴다.
"""
import argparse
import csv
import math
from pathlib import Path

# tools/build_osm_graph.py의 BBOX(남, 서, 북, 동)와 같게 맞추고, 가장자리용으로 사방 MARGIN_METERS씩 더 받는다
BBOX = (37.4350, 127.1230, 37.4580, 127.1900)
MARGIN_METERS = 100

OUT_PATH = Path(__file__).resolve().parent.parent / "back" / "src" / "main" / "resources" / "data" / "cctv.csv"


def inside(lat, lng):
    d_lat = MARGIN_METERS / 111_000
    d_lng = MARGIN_METERS / (111_000 * math.cos(math.radians(BBOX[0])))
    return BBOX[0] - d_lat <= lat <= BBOX[2] + d_lat and BBOX[1] - d_lng <= lng <= BBOX[3] + d_lng


def open_source(path):
    # 공공데이터 파일은 CP949인 경우가 많지만 UTF-8(BOM 포함)로 받는 경우도 있어서 둘 다 시도한다
    for encoding in ("utf-8-sig", "cp949"):
        try:
            with open(path, encoding=encoding) as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise SystemExit("원본 CSV 인코딩을 읽을 수 없습니다 (UTF-8, CP949 모두 실패)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source_csv", help="원본 전국CCTV표준데이터 CSV 경로")
    args = parser.parse_args()

    rows = []
    for row in open_source(args.source_csv):
        try:
            lat = float(row["WGS84위도"])
            lng = float(row["WGS84경도"])
        except (KeyError, TypeError, ValueError):
            continue
        if not inside(lat, lng):
            continue
        purpose = (row.get("설치목적구분") or "기타").strip().replace(",", " ")  # 서버가 쉼표로 컬럼을 나눔
        try:
            camera_count = int((row.get("카메라대수") or "1").strip())
        except ValueError:
            camera_count = 1
        rows.append((purpose or "기타", max(1, camera_count), lat, lng))

    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("purpose,cameraCount,latitude,longitude\n")
        for purpose, count, lat, lng in rows:
            f.write(f"{purpose},{count},{lat:.6f},{lng:.6f}\n")

    print(f"시연 지역 CCTV {len(rows)}개 저장 완료 → {OUT_PATH}")


if __name__ == "__main__":
    main()
