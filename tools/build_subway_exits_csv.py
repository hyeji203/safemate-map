"""
공공데이터(서울교통공사_에스컬레이터 설치현황)에서 역마다 에스컬레이터가 있는 출구 번호를 추려
back/src/main/resources/data/subway-exit-escalators.csv 로 저장한다.

- 원본: 공공데이터포털 "서울교통공사_에스컬레이터 설치현황" CSV (data.go.kr 15044260, CP949 또는 UTF-8 인코딩)
  필요한 컬럼(이름으로 찾음): 호선, 역  명(가운데 공백 2칸), (근접)출입구번호
  (근접)출입구번호가 "1번출구"면 그 출구와 지하를 잇는 에스컬레이터, "내부"면 역 안(대합실-승강장) 에스컬레이터
- 출력: line,station,escalatorExit (UTF-8). 에스컬레이터가 있는 출구마다 한 줄,
  출구 에스컬레이터가 하나도 없는 역은 escalatorExit를 비운 한 줄 (서버가 "이 역 출구는 모두 계단"으로 본다)
  역 이름의 "(8)" 같은 호선 표시는 뺀다 (예: 모란(8) -> 모란)
- 사용법: python tools/build_subway_exits_csv.py <원본_CSV_경로>

서울교통공사가 운영하는 역만 들어 있다 (수인분당선 등 코레일 역은 없어서 서버가 계단/에스컬레이터를 모르는 출구로 둔다).
"""
import argparse
import csv
import re
from pathlib import Path

OUT_PATH = (Path(__file__).resolve().parent.parent / "back" / "src" / "main" / "resources" / "data"
            / "subway-exit-escalators.csv")


def open_source(path):
    # 공공데이터 파일은 CP949인 경우가 많지만 UTF-8(BOM 포함)로 받는 경우도 있어서 둘 다 시도한다
    for encoding in ("utf-8-sig", "cp949"):
        try:
            with open(path, encoding=encoding) as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise SystemExit("원본 CSV 인코딩을 읽을 수 없습니다 (UTF-8, CP949 모두 실패)")


def column(row, name):
    # 컬럼 이름에 공백이 섞여 있어서("역  명") 공백을 빼고 찾는다
    for key, value in row.items():
        if key and key.replace(" ", "") == name:
            return (value or "").strip()
    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source_csv", help="원본 서울교통공사_에스컬레이터 설치현황 CSV 경로")
    args = parser.parse_args()

    exits = {}  # (호선, 역) -> 에스컬레이터가 있는 출구 번호 집합
    for row in open_source(args.source_csv):
        line = column(row, "호선")
        station = re.sub(r"\(.*\)", "", column(row, "역명")).strip()
        if not line or not station:
            continue
        numbers = exits.setdefault((line, station), set())
        m = re.match(r"(\d+)번\s*출구", column(row, "(근접)출입구번호"))
        if m:
            numbers.add(int(m.group(1)))

    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("line,station,escalatorExit\n")
        for (line, station), numbers in sorted(exits.items()):
            if not numbers:
                f.write(f"{line},{station},\n")
            for number in sorted(numbers):
                f.write(f"{line},{station},{number}\n")

    with_exit = sum(1 for numbers in exits.values() if numbers)
    print(f"역 {len(exits)}곳 (출구 에스컬레이터 있는 역 {with_exit}곳) 저장 완료 → {OUT_PATH}")


if __name__ == "__main__":
    main()
