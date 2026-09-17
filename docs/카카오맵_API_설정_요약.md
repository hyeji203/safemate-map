# 카카오맵 API 키 설정 작업 요약 (Claude Code 전달용)

## 프로젝트 배경
- 프로젝트명: "우리 동네 안전 리포트" (서비스명: 도와줘, 맵! / 팀명: 세이프메이트)
- 실시간 위험구간 제보 + 위험 회피 안심 귀갓길 추천 서비스
- 스택: Frontend React, Backend Spring Boot, DB MySQL, 실시간 통신 WebSocket(STOMP+SockJS)
- 지도는 Kakao Maps SDK만 사용 (T맵 등 외부 길찾기 API는 미사용)
- 경로 계산(위험구간 회피)은 외부 API 대신 팀이 직접 도로망 그래프 + 다익스트라 알고리즘으로 구현 예정

## 완료된 작업
카카오 디벨로퍼스(developers.kakao.com)에서 앱 등록 완료.
발급받은 키는 아래 2가지이며, 각각 용도가 다름:

| 키 종류 | 용도 | 사용 위치 |
|---|---|---|
| JavaScript 키 | Kakao Maps SDK로 지도 렌더링 (지도 표시, 마커 등) | Frontend (React) |
| REST API 키 | 카카오 로컬 API 호출 (주소↔좌표 변환, 장소 검색 등) | Backend (Spring Boot) |

※ 네이티브 앱 키는 발급되었지만 웹 서비스라 사용하지 않음.

## 앞으로 해야 할 작업 (Claude Code에게 요청할 내용)

1. **`.env` 파일 신규 생성** (프로젝트 루트 또는 각 서브프로젝트별)
   - Frontend(React)용: `.env`에 `REACT_APP_KAKAO_JS_KEY=발급받은_JavaScript_키` 형태로 저장
   - Backend(Spring Boot)용: `application.yml` 또는 `.env`에 `KAKAO_REST_API_KEY=발급받은_REST_API_키` 형태로 저장 (Spring Boot는 보통 `application.yml`에서 `${KAKAO_REST_API_KEY}`로 환경변수 참조하는 방식 권장)

2. **`.gitignore`에 `.env` 추가**
   - 이미 `.gitignore`가 있으면 `.env` 라인이 있는지 확인하고, 없으면 추가
   - 없으면 새로 만들어서 최소한 아래 내용 포함:
     ```
     .env
     .env.local
     *.env
     ```
   - **중요**: REST API 키는 서버 키라 노출되면 안 되므로, `.env` 파일이 이미 git에 커밋된 적이 있는지 `git log --all --full-history -- .env`로 확인 필요. 만약 과거 커밋에 이미 올라간 적이 있다면 `.gitignore` 추가만으로는 안 지워지므로 별도 조치(git filter-repo 등) 필요.

3. **프론트엔드 코드에 키 적용**
   - `index.html`의 `<head>` 또는 컴포넌트에서 동적 로드하는 방식으로 Kakao Maps SDK 스크립트 태그에 `appkey` 파라미터로 JavaScript 키 삽입
   - 하드코딩 금지, `process.env.REACT_APP_KAKAO_JS_KEY`로 참조

4. **백엔드 코드에 키 적용**
   - Spring Boot 설정 파일에서 REST API 키를 환경변수로 참조하도록 설정
   - 이 키로 카카오 로컬 API(주소→좌표 변환 등)를 호출하는 서비스 클래스 작성 예정

## 참고
- JavaScript 키는 클라이언트에 노출되는 게 정상(공개 키 개념)이라 `.env`에 넣더라도 git에 안 올라가게만 하면 되고, 실제 배포 시엔 도메인 등록(카카오 디벨로퍼스 플랫폼 설정)으로 오남용을 막는 구조
- REST API 키는 절대 프론트 코드나 클라이언트에 노출되면 안 됨 (서버 전용)
