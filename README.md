# 도와줘, 맵! (세이프메이트)

> **3인 팀 졸업작품의 공개 사본입니다.** 원본은 팀원 저장소(비공개)에 있고, 커밋 기록과 작성자는 원본 그대로입니다.
> 신혜지 담당: 지도·경로 탐색 (OpenStreetMap·공공데이터 가공, 안심경로 계산 서버, 지도 화면)
> 포트폴리오: https://hyeji203.github.io


기획/작업 순서는 `docs/3-2-Capstone_Project_Plan.md` 참고. 현재 상태는 **2단계(제보 → 경로 반영) 핵심 기능과 마이페이지·즐겨찾기·알림 완료, 3단계 다듬기 남음**입니다.

## 폴더 구조
- `back/` — Spring Boot (Maven) REST API + WebSocket 서버
- `front/` — React (Vite) 프론트엔드
- `tools/` — 도로망/가로등 데이터 생성 파이썬 스크립트
- `docs/` — 기획 문서

## 실행 방법

### 0) 환경변수 (`.env`, 저장소 루트 하나만 사용)
- back/front가 각자 `.env`를 갖지 않고, 저장소 루트의 `.env` 하나를 공유함
  - 백엔드: `back/pom.xml`의 spring-boot-maven-plugin에 `-Dspringdotenv.directory=..` 설정으로 back에서 한 단계 위(루트) `.env`를 읽음
  - 프론트: `front/vite.config.js`의 `envDir: '..'` 설정으로 동일하게 루트 `.env`를 읽음
- `.env`는 `.gitignore`에 포함되어 있음. 새 팀원은 `.env.example`을 복사해 값을 직접 채워야 함.

### 1) 백엔드 (`back/`)
1. MySQL을 로컬에 설치하고 `help_map` 데이터베이스를 생성 (`CREATE DATABASE help_map;`)
2. 루트 `.env`의 `MYSQL_USERNAME` / `MYSQL_PASSWORD`를 본인 환경에 맞게 수정
3. 실행 (반드시 `back/` 폴더 안에서): `./mvnw.cmd spring-boot:run` — `GET http://localhost:8080/api/health` 응답이 `{"status":"ok"}`이면 정상
   - 첫 실행 시 `back/src/main/resources/data/`의 도로망·가로등 CSV가 DB에 자동 적재됨 (CSV가 바뀌었을 때만 다시 적재)
   - 패키징된 jar(`java -jar target/*.jar`)로 직접 실행할 때는 `-Dspringdotenv.directory=..` 옵션을 수동으로 붙여야 루트 `.env`를 찾음

### 2) 프론트엔드 (`front/`)
1. `npm install` (이미 설치되어 있다면 생략 가능)
2. 실행: `npm run dev` — `http://localhost:5173` 접속, 지도가 뜨면 정상
   - dev 서버는 `/api`, `/ws-stomp` 요청을 자동으로 `http://localhost:8080` 백엔드로 proxy 함 (`vite.config.js` 참고)

### 백엔드 실행이 안 될 때
- **`Public Key Retrieval is not allowed`**: MySQL 8 인증 문제. DB 접속 URL에 `allowPublicKeyRetrieval=true`를 추가 (로컬 개발용)
- **`Port 8080 was already in use`**: 이전에 실행한 백엔드가 아직 떠 있음. 해당 프로세스를 종료한 뒤 다시 실행
- MySQL 포트가 3306이 아니면: `application.yml`은 그대로 두고, 루트 `.env`에 `spring.datasource.url=jdbc:mysql://localhost:<포트>/help_map?...` 한 줄을 추가해 덮어씀
- 로그 맨 아래 `BUILD FAILURE`는 결과 요약일 뿐이고, 진짜 원인은 중간의 `Caused by:` 줄에 있음

## API 키 (루트 `.env`에 위치)
- `REACT_APP_KAKAO_JS_KEY`: 카카오맵 SDK, 지도 렌더링용 (프론트에서 사용, `REACT_APP_` 접두사 필수 — Vite가 이 접두사 붙은 변수만 브라우저에 노출)
- `KAKAO_REST_API_KEY`: 카카오 로컬 API, 장소 검색용 — 서버 전용, 절대 프론트에 노출 금지

## 지금까지 만들어진 것

### 지도 & 경로
- **실제 도로망 그래프**: OpenStreetMap 도로 데이터로 만든 노드(교차로) 약 3,630개 / 간선(도로) 약 5,890개. 시연 지역은 가천대역~상대원동, 단대동~수진역 사각형 범위(약 5.9km x 2.6km)
- **최단경로 + 안심경로 동시 계산**: 같은 다익스트라에 비용 함수만 다르게 넣어 두 경로를 구하고, 지도에 회색(최단)·노란색(안심) 선으로 함께 표시
  - 도보 비용 = 거리 × 도로 종류 배율 (보행자길 0.9 ~ 큰 차도 2.0, 계단 2.5)
  - 안심 비용 = 도보 비용 × (1 + 2.0 × 위험도)
  - 굽은 도로 모양 그대로 경로선을 그림
- **위험도 계산** (간선별 0~2)
  - 어두움(0~1): 공공데이터(성남시 중원구 보안등) 기준, 도로 25m마다 가로등 1개가 있으면 밝음 (길이 대비 밀도)
  - 제보 위험(0~1): 도로 25m 안의 제보 수 (2건 이상이면 1). 제보를 등록하면 다음 경로 요청부터 바로 반영
- **장소 검색**: 지도 상단 검색창 → 장소 선택 시 지도 이동 + 하단 정보 카드(분류, 주소, 전화번호)에서 출발/도착 지정. 시연 지역 밖 장소는 안내 문구 표시
- 지도의 교차로 노드를 차례로 클릭해 출발/도착을 정할 수도 있음 (검증용)
- 가로등·노드 마커는 확대했을 때만 표시

### 제보
- 지도 클릭 → 카테고리 선택(가로등 고장 / 어두움 / 인적 드묾 / 인도 파손) + 사진 첨부로 등록
- 제보 마커 표시, 상세보기 / 삭제 / 같은 위치 추가 제보

### 마이페이지
- **내 제보 내역**: `GET /api/reports/mine`으로 내가 올린 제보를 최신순으로 표시 (카테고리 아이콘, 등록 일시, 주소 — 주소가 없으면 좌표)
  - 카드를 누르면 지도 화면이 그 제보 위치를 중심으로 열림 / "제보 취소"로 서버에서 삭제
  - 로그인하면 회원 기준, 비로그인이면 브라우저 deviceId 기준으로 "내 것"을 구분 (로그인/로그아웃 시 목록 다시 불러옴)
- 사용 가이드 다시 보기 (제보 신뢰도 점수는 팀 결정으로 표시하지 않음)

### 즐겨찾기
- **등록**: 지도에서 장소 검색 → 하단 정보 카드의 "즐겨찾기에 추가" → 이름 입력(기본값: 장소 이름, 최대 50자) 후 저장. 이미 저장한 장소(5m 이내)는 "즐겨찾기됨"으로 표시
- **목록**(즐겨찾기 탭): 이름 + 주소(검색 결과의 주소를 함께 저장, 없으면 좌표) 표시, 삭제
- 항목을 누르면 지도 화면에서 그 장소가 **도착지로 지정된 채** 열림 → 출발지만 정하면 바로 경로 표시

### 알림 (새 제보 실시간 알림)
- 제보가 등록되면 서버가 DB 커밋 후 WebSocket(STOMP) `/topic/reports`로 브로드캐스트 → 앱 전체에서 한 번만 연결해 수신
- 내가 올린 제보는 알림에서 제외, **즐겨찾기 장소 300m 이내** 제보는 "즐겨찾기한 ○○ 근처에 새 제보"로 강조
- 하단 알림 탭에 안 읽은 개수 배지, 알림을 누르면 읽음 처리 + 지도에서 제보 위치 표시, "모두 읽음"
- 알림 목록은 브라우저 localStorage(`safemate-notifications`)에 최근 50개까지 보관

### 회원
- 회원가입·로그인·로그아웃 (서버 세션 쿠키로 로그인 유지, 로그인 시 세션 id를 새로 발급해 세션 고정 공격 방지)
- 로그인하지 않아도 브라우저 deviceId로 제보·즐겨찾기 사용 가능. 가입/로그인하면 이 브라우저에서 익명으로 남긴 제보·즐겨찾기가 계정으로 옮겨짐

### 기타
- 하단 4탭 네비게이션(지도/즐겨찾기/알림/마이페이지), 헬스체크 API, CORS 설정

### 주요 API
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/routes?fromLat&fromLng&toLat&toLng` | 최단/안심 경로 (`{ shortest, safe }`) |
| GET | `/api/places/search?query=` | 장소 검색 (시연 지역에서 가까운 순) |
| GET | `/api/nodes` | 보행로 노드 목록 |
| GET | `/api/street-lights` | 가로등 목록 |
| GET / POST / DELETE | `/api/reports` | 제보 조회 / 등록(multipart) / 삭제 |
| GET | `/api/reports/mine?deviceId=` | 내 제보 목록 |
| GET / POST / DELETE | `/api/favorites` | 내 즐겨찾기 조회 / 등록(`label`, 좌표, `address`) / 삭제 |
| POST | `/api/members/signup`, `/api/members/login`, `/api/members/logout` | 회원가입 / 로그인 / 로그아웃 |
| GET | `/api/members/me` | 로그인한 회원 정보 (비로그인이면 204) |
| STOMP 구독 | `/topic/reports` (`/ws-stomp`로 연결) | 새 제보 실시간 수신 |

### 데이터 다시 만들기 (`tools/`)
- `python tools/build_osm_graph.py` — OSM에서 시연 지역 도로망을 받아 `graph-nodes.csv`, `graph-edges.csv` 생성
- `python tools/build_streetlights_csv.py <원본_CSV>` — 보안등 공공데이터에서 시연 지역만 추려 `street-lights.csv` 생성
- 세 스크립트의 시연 지역 범위(`BBOX`)는 서로 맞춰서 수정할 것

## 다음 할 일
- **마이페이지 남은 것**
  - 즐겨찾기 **경로**(출발→도착 묶음) 저장 — 지금은 장소만 저장 가능
  - 알림은 브라우저별 localStorage에만 저장되어 다른 기기와 공유되지 않음 (앱을 닫아둔 동안 올라온 제보도 받지 못함)
- **3단계 다듬기**: 반응형 확인, 에러 처리, 시연용 더미 제보 데이터 세팅
- **고도화** (`docs/3-2-Capstone_Project_Plan.md` 순서): 실시간 제보 반영 중 지도 마커·경로 자동 갱신(지금은 알림 탭만 실시간, 지도 마커는 지도 화면을 다시 열어야 반영), 제보 시간 감쇄, 카테고리별 차등 가중치 등
  - 완료된 고도화: OSM 기반 도로망 자동 생성, 제보 카테고리 확장(인도 파손), 새 제보 실시간 브로드캐스트·알림
