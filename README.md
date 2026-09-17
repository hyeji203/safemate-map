# 도와줘, 맵! (세이프메이트)

기획/작업 순서는 `docs/3-2-Capstone_Project_Plan.md` 참고. 현재 상태는 **0단계(프로젝트 셋업) 기초 틀**입니다.

## 폴더 구조
- `back/` — Spring Boot (Maven) REST API + WebSocket 서버
- `front/` — React (Vite) 프론트엔드
- `docs/` — 기획 문서

## 실행 방법

### 0) 환경변수 (`.env`, 저장소 루트 하나만 사용)
- back/front가 각자 `.env`를 갖지 않고, 루트의 `help_map/.env` 하나를 공유함
  - 백엔드: `back/pom.xml`의 spring-boot-maven-plugin에 `-Dspringdotenv.directory=..` 설정으로 back에서 한 단계 위(루트) `.env`를 읽음
  - 프론트: `front/vite.config.js`의 `envDir: '..'` 설정으로 동일하게 루트 `.env`를 읽음
- `.env`는 `.gitignore`에 포함되어 있음. 새 팀원은 값을 직접 채워야 함.

### 1) 백엔드 (`back/`)
1. MySQL을 로컬에 설치하고 `help_map` 데이터베이스를 생성 (`CREATE DATABASE help_map;`)
2. 루트 `.env`의 `MYSQL_USERNAME` / `MYSQL_PASSWORD`를 본인 환경에 맞게 수정
3. 실행 (반드시 `back/` 폴더 안에서): `./mvnw.cmd spring-boot:run` — `GET http://localhost:8080/api/health` 응답이 `{"status":"ok"}`이면 정상
   - 패키징된 jar(`java -jar target/*.jar`)로 직접 실행할 때는 `-Dspringdotenv.directory=..` 옵션을 수동으로 붙여야 루트 `.env`를 찾음

### 2) 프론트엔드 (`front/`)
1. `npm install` (이미 설치되어 있다면 생략 가능)
2. 실행: `npm run dev` — `http://localhost:5173` 접속, 지도가 뜨면 정상
   - dev 서버는 `/api`, `/ws-stomp` 요청을 자동으로 `http://localhost:8080` 백엔드로 proxy 함 (`vite.config.js` 참고)

## API 키 (루트 `.env`에 위치)
- `REACT_APP_KAKAO_JS_KEY`: 카카오맵 SDK, 지도 렌더링용 (프론트에서 사용, `REACT_APP_` 접두사 필수 — Vite가 이 접두사 붙은 변수만 브라우저에 노출)
- `KAKAO_REST_API_KEY`: 카카오 로컬 API, 주소/좌표 변환용 — 서버 전용, 절대 프론트에 노출 금지

## 지금까지 만들어진 것 (0단계)
- 백엔드: 헬스체크 API, WebSocket(STOMP) 엔드포인트(`/ws-stomp`) 설정, CORS 설정, 제보(Report) 기본 CRUD API, `Member`/`Report`/`Node`/`Edge` 엔티티 뼈대, 카카오 REST API 호출 서비스 뼈대
- 프론트엔드: 하단 4탭 네비게이션(지도/즐겨찾기/알림/마이페이지), MVP 5화면 페이지 틀(지도/경로탐색/제보/경로상세/로그인), 카카오맵 컴포넌트, axios/WebSocket 클라이언트 뼈대

## 다음 할 일 (1단계부터)
`docs/3-2-Capstone_Project_Plan.md`의 "단계별 구현 순서" 참고 — 보행로 노드/간선 데이터 입력, 다익스트라 최단경로 구현부터 시작.
