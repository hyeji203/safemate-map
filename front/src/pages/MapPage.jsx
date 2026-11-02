import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { routeApi } from '../api/routeApi'
import { getErrorKind } from '../api/errorKind'
import { placeApi } from '../api/placeApi'
import KakaoMap from '../components/KakaoMap'
import PlaceSearchBar, { PlaceResults } from '../components/PlaceSearchBar'
import PlaceSheet from '../components/PlaceSheet'
import { usePlaceSearch } from '../hooks/usePlaceSearch'
import { useRouteHistory, routeHistoryKey } from '../hooks/useRouteHistory'
import { useNotifications } from '../hooks/useNotifications'
import ReportModal from '../components/ReportModal'
import ReportDetail from '../components/ReportDetail'
import NearbyReportsSheet from '../components/NearbyReportsSheet'
import QuickStartSheet from '../components/QuickStartSheet'
import CoachMarks from '../components/CoachMarks'
import { useTutorial } from '../hooks/useTutorial'
import { useSafetyLayers, FACILITY_TYPES } from '../hooks/useSafetyLayers'
import SafetyChips from '../components/SafetyChips'
import { SAFETY_LAYERS } from '../constants/safetyLayers'
import { distanceToPolylineMeters, haversineMeters } from '../utils/geo'
import { reportApi } from '../api/reportApi'
import { favoriteApi } from '../api/favoriteApi'
import { colors } from '../styles/colors'
import { categoryLabel, categoryIcon } from '../constants/reportCategories'

// 시연 지역(가천대역~상대원동) 중심 (tools/build_osm_graph.py의 BBOX 가운데)
const DEMO_CENTER = { lat: 37.4465, lng: 127.1565 }

// "주변 제보" 버튼·목록에 넣는 반경(m). 현재 위치(없으면 지도 가운데)에서 이 거리 안의 제보만 센다
const NEARBY_REPORT_RADIUS_METERS = 1000
const NEARBY_REPORT_RADIUS_LABEL =
  NEARBY_REPORT_RADIUS_METERS >= 1000 ? `${NEARBY_REPORT_RADIUS_METERS / 1000}km` : `${NEARBY_REPORT_RADIUS_METERS}m`

// 가로등은 이 줌 레벨 이하(= 확대했을 때)에서만 표시 (카카오맵은 숫자가 작을수록 확대)
// 장소 검색 후 이동하는 레벨(2)에서도 보이도록 2으로 맞춘다
const STREETLIGHT_MAX_LEVEL = 2
// 지하철 출구는 이 줌 레벨 이하(골목 단위로 확대)에서 계단/에스컬레이터 그림과 이름표로, 그보다 축소하면 작은 흰 원으로 보인다
const EXIT_DETAIL_MAX_LEVEL = 3
// 출발 핀 색. KakaoMap의 현재 위치 파란 점과 같은 색
const START_PIN_COLOR = '#2F6FEE'
// 안전시설 레이어 종류별 색·아이콘 (칩 줄과 같은 값)
const SAFETY_LAYER_STYLE = Object.fromEntries(SAFETY_LAYERS.map((l) => [l.key, l]))
// 칩을 켰는데 지금 확대 정도에서는 안 보일 때 띄우는 안내
const LAYER_ZOOM_HINTS = {
  streetlight: '지도를 더 확대하면 가로등이 보여요',
  convenience: '지도를 확대하면 편의점이 보여요',
  police: '지도를 확대하면 파출소·지구대가 보여요',
}

// 선택한 장소가 이미 즐겨찾기에 있는지 볼 때, 이 거리(m) 안이면 같은 장소로 본다
const SAME_PLACE_METERS = 5

function isSamePlace(favorite, place) {
  const dLat = (favorite.latitude - place.lat) * 111_000
  const dLng = (favorite.longitude - place.lng) * 111_000 * Math.cos((place.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLng) <= SAME_PLACE_METERS
}

// 지도에 즐겨찾기 별을 표시할지 기억해 두는 localStorage 키 (장소 좌표가 아니라 켜짐/꺼짐만 저장)
const SHOW_FAVORITES_KEY = 'safemate_show_favorites'

// 첫 방문 코치마크(버튼 말풍선)를 "다시 표시 안 함"으로 닫았는지. 이 브라우저에만 기억한다
const COACH_MARKS_SEEN_KEY = 'safemate_coach_marks_seen'

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function saveFlag(key) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // 저장이 막혀 있으면 이번 화면에서만 적용된다
  }
}

// 빠른 출발 칩에 띄울 목적지 수 (즐겨찾기 먼저, 남는 자리는 최근 길찾기 목적지)
const QUICK_DESTINATION_COUNT = 3

// 즐겨찾기 이름으로 고르는 칩 아이콘 (간단한 규칙만)
function favoriteIcon(label = '') {
  if (/집|home/i.test(label)) return '🏠'
  if (/회사|직장|사무실/.test(label)) return '🏢'
  if (/학교|대학|캠퍼스/.test(label)) return '🏫'
  return '⭐'
}

// 오후 6시 ~ 오전 6시는 검색창 안내 문구를 밤길용으로
const isNightTime = (date = new Date()) => date.getHours() >= 18 || date.getHours() < 6

// 검색창에 차례대로 돌려 보여주는 안내 문구. 개인 검색 기록·장소 이름은 넣지 않는다
const SEARCH_HINTS = [
  '목적지를 검색하면 안심경로를 알려드려요',
  '어두운 길은 피해서 안내해 드려요',
  '자주 가는 곳은 ☆로 저장해 보세요',
  '위험한 곳은 ⚠ 버튼으로 제보해요',
]
// 밤에는 첫 문구를 밤길 안내로 바꿔서 시작한다
const searchHints = () =>
  isNightTime() ? ['🌙 밤길이에요. 목적지를 검색해 보세요', ...SEARCH_HINTS.slice(1)] : SEARCH_HINTS

// 코치마크 순서 (target은 강조할 요소의 data-coach 값. 하단 탭은 BottomNav의 알림·마이페이지 탭)
const COACH_STEPS = [
  {
    target: 'search',
    title: '목적지를 검색해 보세요',
    text: '도착지를 고르면 안심경로와 최단경로를 함께 비교해 드려요.',
  },
  {
    target: 'chips',
    title: '안전시설 · 주변 제보',
    text: `보고 싶은 안전시설을 눌러 지도에 표시해요. ⚠ 제보를 누르면 내 주변 ${NEARBY_REPORT_RADIUS_LABEL} 안의 위험 제보를 볼 수 있어요.`,
  },
  {
    target: 'favorites',
    title: '즐겨찾기',
    text: '자주 가는 곳을 저장해 두면 지도에 별로 표시돼 빠르게 찾을 수 있어요.',
  },
  {
    target: 'locate',
    title: '내 위치로 이동',
    text: '지도를 내 현재 위치로 다시 옮겨요.',
  },
  {
    target: 'report',
    title: '위험구간 제보',
    text: '어두운 골목, 고장 난 가로등을 발견하면 눌러서 지금 내 위치나 지도에서 고른 위치로 제보해 주세요.',
  },
  {
    target: 'tabs',
    title: '알림 · 마이페이지',
    text: '놓친 새 제보 알림과 내 제보·정보는 아래 탭에서 확인해요.',
  },
]

// "다시 표시 안 함" 없이 닫았을 때, 이번 접속(새로고침 전)에는 다른 탭에 갔다 와도 다시 띄우지 않는다
let coachClosedThisVisit = false

// 횡단보도 좌표 찍기 모드: 개발 모드에서 루트 .env에 REACT_APP_CROSSWALK_SURVEY=true 를 넣었을 때만 켜진다.
// 시연 때 개발 서버(npm run dev)로 띄워도 줄 번호 마커·좌표 안내가 보이지 않도록 기본은 꺼 둔다. 배포 빌드에는 들어가지 않는다.
const CROSSWALK_SURVEY = import.meta.env.DEV && import.meta.env.REACT_APP_CROSSWALK_SURVEY === 'true'

// 좌표 찍기 모드 전용: 직접 찍은 횡단보도(crosswalks-surveyed.csv)를 지도에 CSV 줄 번호로 표시한다.
// 파일을 저장하면 바로 다시 그려진다 (백엔드 경로 계산에 반영하려면 백엔드는 재시작해야 함).
const SURVEYED_CROSSWALK_CSV = CROSSWALK_SURVEY
  ? (Object.values(
      import.meta.glob('../../../back/src/main/resources/data/crosswalks-surveyed.csv', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    )[0] ?? '')
  : ''

function parseSurveyedCrosswalks(csv) {
  return csv
    .split(/\r?\n/)
    .map((text, i) => ({ text, lineNo: i + 1 }))
    .slice(1) // 헤더
    .filter(({ text }) => text.trim())
    .map(({ text, lineNo }) => {
      const cols = text.split(',').map((c) => c.trim())
      return { lineNo, text, lat: Number(cols[1]), lng: Number(cols[2]), diagonal: cols[4] === 'true' }
    })
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
}

// 가로등 점 색: 카카오 POI 아이콘(주황 계열)과 헷갈리지 않도록 amber보다 밝은 노랑을 쓴다
const STREETLIGHT_COLOR = '#FFD21F'

// 경로선·경로 카드 색 (안심경로 = 노랑, 최단경로 = 회색)
const ROUTE_COLORS = { safe: colors.amber, shortest: colors.gray }
// 안심·최단경로가 같다는 안내가 서서히 사라지는 시간
const SAME_ROUTE_FADE_MS = 800
// 다른 사람의 새 제보가 보고 있는 경로(안심·최단)에서 이 거리(m) 안이면 경로를 다시 찾는다.
// 서버는 길에서 25m 안의 제보만 위험으로 세므로(RiskWeightCalculator.REPORT_RADIUS_METERS) 여유를 두고 잡았다.
// 새 제보는 위험을 올리기만 하므로, 두 경로 어디에도 가깝지 않으면 다시 찾아도 결과가 같다
const REROUTE_REPORT_METERS = 50

// 경로를 지도 좌표 목록으로. geometry = 실제 도로 모양(굽은 길 포함), 없으면 교차로만 직선으로 잇는다
const routePoints = (route) =>
  (route.geometry?.length ? route.geometry : route.path).map((p) => ({ lat: p.latitude, lng: p.longitude }))
const routeNodeKey = (route) => route.path.map((p) => p.nodeId).join()

// 메인 지도 화면 (필수 MVP).
// - 상단 검색창에서 장소를 고르면 지도가 그 위치로 이동하고, 하단 정보 카드에서 출발/도착으로 지정한다
// - 지도 빈 곳을 누르면 그 곳의 장소 이름(없으면 주소)이 정보 카드로 뜬다
// - 출발/도착이 정해지면 최단경로(회색)와 안심경로(노랑)를 함께 그린다
// - 가로등(빛 번짐이 있는 노란 작은 점) 표시
// - 제보 마커 표시 + 지도 빈 공간 클릭으로 제보 등록까지 연결됨
export default function MapPage() {
  // 다른 화면에서 navigate('/', { state })로 넘긴 값. 최초 마운트 때 한 번만 읽는다.
  // - focus: { lat, lng }        그 위치에서 지도를 연다 (마이페이지 제보 내역)
  // - destination: { lat, lng, title }  그 장소를 도착지로 정한 채 연다 (즐겨찾기)
  // KakaoMap은 center/level을 최초 생성 때만 쓰고, 이 화면은 이동할 때마다 새로 마운트되므로 초기 중심으로 넘기면 된다.
  const location = useLocation()
  const navigate = useNavigate()
  const [routedState] = useState(() => location.state ?? {})
  const initialFocus = routedState.focus ?? routedState.destination

  // 읽은 뒤에는 history의 state를 비워서, 새로고침했을 때 같은 위치/도착지로 다시 열리지 않게 한다
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true })
  }, [location, navigate])

  // 경로 탐색 (지도&경로 담당)
  const [streetLights, setStreetLights] = useState([])
  const [start, setStart] = useState(null)
  const [editingPoint, setEditingPoint] = useState(null) // 위쪽 바에서 바꾸는 중인 지점: 'start' | 'end' | null
  const [end, setEnd] = useState(() =>
    routedState.destination ? { id: 'place-end', ...routedState.destination } : null,
  )
  const [routes, setRoutes] = useState(null) // { shortest, safe }
  const [selectedRouteKey, setSelectedRouteKey] = useState('safe') // 아래 카드에서 고른 경로: 'safe' | 'shortest'
  const [routeRefreshKey, setRouteRefreshKey] = useState(0) // 제보 등록 후 경로를 다시 계산하기 위한 트리거
  const routesRef = useRef(null) // 경로 다시 찾기 이펙트·새 제보 이펙트에서 지금 보이는 경로를 읽는 용도
  useEffect(() => {
    routesRef.current = routes
  }, [routes])
  const routedPointsRef = useRef({ start: null, end: null }) // 마지막으로 경로를 찾은 출발/도착
  const rerouteByReportRef = useRef(false) // 이번 다시 찾기가 다른 사람의 새 제보 때문인지 (끝나면 안내를 띄운다)
  const [routeNotice, setRouteNotice] = useState(null) // 새 제보로 경로를 다시 찾았다는 안내
  useEffect(() => {
    if (!routeNotice) return
    const timer = setTimeout(() => setRouteNotice(null), ROUTE_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [routeNotice])
  const [error, setError] = useState(null)

  // 가로등·제보·즐겨찾기 조회 실패는 경로 안내 바(error)를 덮어쓰지 않게 따로 짧은 토스트로 알린다
  const [loadErrorToast, setLoadErrorToast] = useState(null)
  const serverErrorShownRef = useRef(false) // 서버가 꺼져 있으면 여러 조회가 한꺼번에 실패하므로 server 안내는 한 번만
  const notifyLoadError = useCallback((err, message) => {
    if (getErrorKind(err) === 'server') {
      if (serverErrorShownRef.current) return
      serverErrorShownRef.current = true
      setLoadErrorToast('서버에 연결할 수 없어요')
      return
    }
    setLoadErrorToast(message)
  }, [])
  useEffect(() => {
    if (!loadErrorToast) return
    const timer = setTimeout(() => setLoadErrorToast(null), LOAD_ERROR_TOAST_MS)
    return () => clearTimeout(timer)
  }, [loadErrorToast])

  // 지도 상단 장소 검색. 결과를 고르면 search.selected가 정보 카드로 표시된다
  const search = usePlaceSearch()
  const routeHistory = useRouteHistory() // 최근 길찾기 (이 브라우저에만 저장)
  const addRouteHistory = routeHistory.add
  const selectedPlace = search.selected
  const mapClickSeqRef = useRef(0) // 지도 클릭 장소 조회 순번 (늦게 도착한 이전 응답 무시용)
  const [devCoord, setDevCoord] = useState(null) // 좌표 찍기 모드 전용: 마지막으로 누른 곳의 횡단보도 CSV 한 줄 + 복사 여부

  // 제보 (제보하기 담당)
  const [reports, setReports] = useState([])
  const [reportMode, setReportMode] = useState(false)
  const [pendingLocation, setPendingLocation] = useState(null)
  const [selectedReportGroup, setSelectedReportGroup] = useState(null) // 같은 좌표에 쌓인 제보 전체 (배열)
  const [nearbyOpen, setNearbyOpen] = useState(false) // "주변 제보" 시트
  const [detailFromNearby, setDetailFromNearby] = useState(false) // 지금 열린 제보 상세가 주변 제보 목록에서 고른 것인지
  const [mapCenter, setMapCenter] = useState(() => initialFocus ?? DEMO_CENTER) // 현재 위치가 없을 때 주변 제보 기준점

  // 현재 위치는 화면 진입 시부터 계속 추적해서 항상 파란 점 + 바라보는 방향으로 표시한다.
  // (안드로이드 전용이라 iOS의 별도 방향 센서 권한 처리는 필요 없음)
  // 개인정보 원칙: 현재 위치는 화면 표시에만 쓰고 저장하지 않는다.
  // 서버 API로 보내거나 DB·localStorage 등에 남기지 말 것 (팀 결정)
  const [myLocation, setMyLocation] = useState(null)
  const [locationFocus, setLocationFocus] = useState(null) // "현재 위치로 이동" 버튼 누르면 갱신 -> 지도 이동
  const watchIdRef = useRef(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 현재 위치를 지원하지 않습니다.')
      return
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError('현재 위치를 가져오지 못했습니다. 위치 권한을 확인해주세요.'),
      { enableHighAccuracy: true },
    )
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  // 지도 화면을 보는 중에 알림 팝업을 누르면 화면이 새로 마운트되지 않아 routedState(초기 중심)로는 못 받는다.
  // 그래서 최초 마운트 이후에 들어온 focus는 여기서 바로 그 위치로 이동시킨다.
  useEffect(() => {
    const focus = location.state?.focus
    if (focus && location.state !== routedState) setLocationFocus({ lat: focus.lat, lng: focus.lng, level: 3 })
  }, [location, routedState])

  // 도착지만 정해졌으면 출발지는 현재 위치로 자동으로 채운다 (위치 권한이 없으면 지금처럼 직접 검색).
  // 걸을 때마다 경로를 다시 찾지 않도록 정한 순간의 위치로 고정한다. 바꾸고 싶으면 위쪽 바에서 출발지를 누르면 된다.
  // 길찾기 기록에는 좌표 없이 "현재 위치에서 출발"이라는 표시만 남긴다 (useRouteHistory 참고)
  useEffect(() => {
    if (start || !end || !myLocation) return
    setStart({ id: 'place-start', lat: myLocation.lat, lng: myLocation.lng, title: '현재 위치', fromMyLocation: true })
  }, [start, end, myLocation])

  const handleLocateMe = () => {
    // level을 안 주면 KakaoMap의 focus 이펙트가 확대/축소는 안 바꾸고 이동만 한다 (지금 보던 배율 유지)
    if (myLocation) setLocationFocus({ lat: myLocation.lat, lng: myLocation.lng })
  }

  // 기기가 바라보는 방향(정북 기준 시계방향 도). 센서가 없으면 계속 null.
  const [heading, setHeading] = useState(null)

  useEffect(() => {
    const handleOrientation = (e) => {
      if (typeof e.webkitCompassHeading === 'number') {
        // iOS Safari: 이미 정북 기준 시계방향 각도로 줌
        setHeading(e.webkitCompassHeading)
      } else if (e.absolute && e.alpha != null) {
        // Android 등: alpha는 반시계 방향 기준이라 보정
        setHeading((360 - e.alpha) % 360)
      }
    }
    window.addEventListener('deviceorientationabsolute', handleOrientation, true)
    window.addEventListener('deviceorientation', handleOrientation, true)
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true)
      window.removeEventListener('deviceorientation', handleOrientation, true)
    }
  }, [])

  useEffect(() => {
    routeApi
      .findStreetLights()
      .then((res) => setStreetLights(res.data))
      .catch((err) => {
        console.error('[MapPage] 가로등 목록 조회 실패', err)
        notifyLoadError(err, '가로등 목록을 불러오지 못했어요')
      })
  }, [notifyLoadError])

  useEffect(() => {
    if (!start || !end) return
    // 출발/도착은 그대로인데 제보 때문에 다시 찾는 경우: 찾는 동안 지금 경로를 그대로 두고, 실패해도 지우지 않는다
    const prev = routedPointsRef.current
    const refreshing = prev.start === start && prev.end === end && routesRef.current != null
    const previousSafe = refreshing ? routesRef.current.safe : null
    const byReport = refreshing && rerouteByReportRef.current
    routedPointsRef.current = { start, end }
    rerouteByReportRef.current = false
    // 출발/도착이 바뀌었으면 실패해도 옛 목적지의 경로 선·카드가 남지 않게 먼저 비운다 (비어 있는 동안 안내 바에 "경로를 찾는 중..." 표시)
    if (!refreshing) setRoutes(null)
    setError(null)
    // 출발/도착이 다시 바뀌면 이전 요청을 취소해서 마지막 요청 결과만 반영한다
    const controller = new AbortController()
    routeApi
      .findRoute(
        {
          fromLat: start.lat,
          fromLng: start.lng,
          toLat: end.lat,
          toLng: end.lng,
          fromAddress: start.address,
          toAddress: end.address,
          // 지하철역이면 서버가 출구를 고른다. "현재 위치"는 장소 이름이 아니라서 보내지 않는다
          fromName: start.fromMyLocation ? undefined : start.title,
          toName: end.title,
        },
        controller.signal,
      )
      .then((res) => {
        if (controller.signal.aborted) return // 응답이 왔어도 그 사이 취소됐으면 버린다
        setRoutes(res.data)
        if (!refreshing) addRouteHistory(start, end) // 같은 길찾기를 다시 계산한 것은 기록 순서를 바꾸지 않는다
        if (byReport) {
          setRouteNotice(
            routeNodeKey(previousSafe) === routeNodeKey(res.data.safe)
              ? '경로 근처에 새 위험 제보가 있어요. 지금 안심경로가 그대로 가장 안전해요'
              : '경로 근처에 새 위험 제보가 있어 안심경로를 다시 찾았어요',
          )
        }
      })
      .catch((err) => {
        // 취소된 요청은 실패가 아니므로 오류 문구를 띄우지 않는다
        if (axios.isCancel(err) || err.name === 'CanceledError' || controller.signal.aborted) return
        if (refreshing) {
          // 이전 경로는 남겨 두고 짧게만 알린다
          setRouteNotice('새 제보를 반영한 경로를 찾지 못해 이전 경로를 보여드려요')
          return
        }
        setError(ROUTE_ERROR_MESSAGES[getErrorKind(err)] ?? ROUTE_ERROR_MESSAGES.default)
      })
    return () => {
      controller.abort()
    }
    // addRouteHistory는 useCallback이라 바뀌지 않아서 경로를 다시 찾게 만들지 않는다
  }, [start, end, routeRefreshKey, addRouteHistory])

  const loadReports = useCallback(async () => {
    try {
      const { data } = await reportApi.findAll()
      setReports(data)
    } catch (err) {
      console.error('[MapPage] 제보 목록 조회 실패', err)
      notifyLoadError(err, '제보 목록을 불러오지 못했어요')
    }
  }, [notifyLoadError])

  // 처음 들어올 때 + 누군가 새 제보를 올릴 때마다(실시간 알림) 제보 마커를 다시 불러온다
  const { reportVersion, incomingReport } = useNotifications()
  useEffect(() => {
    loadReports()
  }, [loadReports, reportVersion])

  // 다른 사람이 지금 보고 있는 경로 근처에 제보하면 그 제보까지 반영해 경로를 다시 찾는다 (내 제보는 handleSubmitted가 처리)
  useEffect(() => {
    const current = routesRef.current
    if (!incomingReport || !current) return
    const near = [current.safe, current.shortest].some(
      (route) =>
        distanceToPolylineMeters(incomingReport.latitude, incomingReport.longitude, routePoints(route)) <=
        REROUTE_REPORT_METERS,
    )
    if (!near) return
    rerouteByReportRef.current = true
    setRouteRefreshKey((k) => k + 1)
  }, [incomingReport])

  // 즐겨찾기 (마이페이지 담당). 장소 정보 카드에 "즐겨찾기됨" 표시를 하려고 미리 불러 둔다
  const [favorites, setFavorites] = useState([])

  useEffect(() => {
    favoriteApi
      .findMine()
      .then((res) => setFavorites(res.data))
      .catch((err) => {
        // 401/403은 로그인하지 않은 정상 상황이라 안내 없이 빈 목록으로 둔다
        if (getErrorKind(err) === 'auth') {
          setFavorites([])
          return
        }
        console.error('[MapPage] 즐겨찾기 조회 실패', err)
        notifyLoadError(err, '즐겨찾기를 불러오지 못했어요')
      })
  }, [notifyLoadError])

  // 즐겨찾기를 지도에 별로 표시할지 (오른쪽 위 별 버튼). 고른 값은 이 브라우저에 기억해 둔다
  const [showFavorites, setShowFavorites] = useState(() => {
    try {
      return localStorage.getItem(SHOW_FAVORITES_KEY) !== 'false'
    } catch {
      return true
    }
  })

  const toggleFavorites = () => {
    setShowFavorites((prev) => {
      try {
        localStorage.setItem(SHOW_FAVORITES_KEY, String(!prev))
      } catch {
        // 저장이 막혀 있으면 이번 화면에서만 적용된다
      }
      return !prev
    })
  }

  // 별을 누르면 그 장소의 정보 카드를 띄운다 (출발/도착 지정 가능)
  // 정보 카드를 보고 있는 장소는 핀과 이름표가 겹치지 않게 별을 빼고 핀만 보인다
  const favoriteMarkers = useMemo(
    () =>
      !showFavorites
        ? []
        : favorites.filter((f) => !selectedPlace || !isSamePlace(f, selectedPlace)).map((f) => ({
            id: `favorite-${f.id}`,
            lat: f.latitude,
            lng: f.longitude,
            title: f.label,
            label: f.label,
            star: true,
            onClick: () =>
              search.onSelect({ latitude: f.latitude, longitude: f.longitude, placeName: f.label, addressName: f.address }, { fromMap: true }),
          })),
    // search.onSelect는 렌더마다 새로 만들어지지만 내부 상태만 바꾸므로 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [favorites, showFavorites, selectedPlace],
  )

  const selectedFavorite = useMemo(
    () => (selectedPlace ? favorites.find((f) => isSamePlace(f, selectedPlace)) : null),
    [favorites, selectedPlace],
  )

  // 실패하면 PlaceSheet가 에러 문구를 보여주도록 예외를 그대로 넘긴다
  const addFavorite = async (label) => {
    const { data } = await favoriteApi.create({
      label,
      latitude: selectedPlace.lat,
      longitude: selectedPlace.lng,
      address: selectedPlace.address || null,
    })
    setFavorites((prev) => [data, ...prev])
  }

  // 안전시설 레이어 (검색창 아래 칩 줄). 지금 보이는 지도 범위를 받아 편의점·파출소를 그 범위만 검색한다.
  const [mapBounds, setMapBounds] = useState(null)
  const safety = useSafetyLayers(mapBounds)

  // 칩 줄 아래에 잠깐 뜨는 안내 (확대해야 보임)
  const [mapHint, setMapHint] = useState(null)
  useEffect(() => {
    if (!mapHint) return
    const timer = setTimeout(() => setMapHint(null), 2200)
    return () => clearTimeout(timer)
  }, [mapHint])

  // 칩을 켰는데 지금 확대 정도에서는 안 보이면 왜 안 보이는지 알려준다
  const toggleLayer = (key) => {
    const turningOn = !safety.layers[key]
    safety.toggle(key)
    if (!turningOn) return
    const level = mapBounds?.level
    const hidden = key === 'streetlight' ? level > STREETLIGHT_MAX_LEVEL : safety.tooWide
    setMapHint(hidden ? LAYER_ZOOM_HINTS[key] : null)
  }

  // 편의점·파출소 마커: 작고 반투명(subtle)하게, 제보 마커보다 눈에 덜 띄도록.
  // 편의점·파출소를 누르면 지도에서 장소를 누른 것과 같이 장소 정보 카드를 띄운다 (출발/도착 지정 가능)
  const safetyMarkers = useMemo(() => {
    const list = []
    if (!safety.tooWide) {
      for (const type of FACILITY_TYPES) {
        if (!safety.layers[type]) continue
        const { color, icon } = SAFETY_LAYER_STYLE[type]
        for (const f of safety.facilities[type]) {
          list.push({
            id: `${type}-${f.placeUrl ?? `${f.latitude},${f.longitude}`}`,
            lat: f.latitude,
            lng: f.longitude,
            title: f.placeName,
            color,
            icon,
            size: 18,
            subtle: true,
            onClick: () => search.onSelect(f, { fromMap: true }),
          })
        }
      }
    }
    return list
    // search.onSelect는 마커를 누를 때만 쓰므로 목록을 다시 만들 이유가 아니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safety.layers, safety.facilities, safety.tooWide])

  // 보행로 그래프 노드(교차로)는 경로 계산에만 쓰고 지도에는 표시하지 않는다
  const streetLightMarkers = useMemo(
    () =>
      streetLights.map((l) => ({
        id: `light-${l.id}`,
        lat: l.latitude,
        lng: l.longitude,
        title: '가로등',
        color: STREETLIGHT_COLOR,
        size: 8,
        glow: true, // 빛 번짐으로 가로등이 모인 골목은 환하게, 없는 곳은 어둡게 보이도록
        maxLevel: STREETLIGHT_MAX_LEVEL,
      })),
    [streetLights],
  )

  // 검색으로 정한 출발/도착은 별도 핀으로 표시한다
  // 정보 카드를 보고 있는 장소는 남색 물방울 핀 + 이름표로 표시한다 (빨강은 위험 제보 전용이라 쓰지 않는다)
  const searchedPointMarkers = useMemo(() => {
    const points = []
    if (selectedPlace) {
      points.push({
        id: 'selected-place',
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        title: selectedPlace.name,
        label: selectedPlace.name,
        color: colors.navy,
        pin: true,
      })
    }
    if (start) {
      // 출발지는 "출발" 글씨가 든 파란 핀 (현재 위치 표시와 같은 파란색)
      points.push({ id: start.id, lat: start.lat, lng: start.lng, title: start.title ?? '출발지', color: START_PIN_COLOR, pin: true, pinText: '출발' })
    }
    if (end) {
      // 도착지는 네이버지도처럼 "도착" 글씨가 든 빨간 핀
      points.push({ id: end.id, lat: end.lat, lng: end.lng, title: end.title ?? '도착지', color: colors.red, pin: true, pinText: '도착' })
    }
    return points
  }, [start, end, selectedPlace])

  // 검색으로 장소를 고르면 지도를 그 위치로 확대 이동한다 (레벨 3: 골목 단위까지 보이는 정도)
  // 지도를 눌러서 고른 장소는 이미 보고 있는 곳이라 이동하지 않고, 그것도 아니면
  // "현재 위치로 이동" 버튼을 눌렀을 때(locationFocus)만 이동한다
  const focus = useMemo(
    () =>
      selectedPlace && !selectedPlace.fromMap
        ? { lat: selectedPlace.lat, lng: selectedPlace.lng, level: 3 }
        : locationFocus,
    [selectedPlace, locationFocus],
  )

  const setPlaceAs = (setter, id) => {
    setter({
      id,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      title: selectedPlace.name,
      address: selectedPlace.address, // 도로명주소면 서버가 출입구 쪽 도로를 고르는 데 쓴다
    })
    search.reset()
  }

  // 같은 좌표(정확히 일치)에 등록된 제보는 마커가 완전히 겹쳐서 하나만 클릭되므로, 좌표 기준으로 묶어서
  // 마커 하나당 그 위치의 제보 전체를 들고 있게 한다 ("+ 추가 제보"는 항상 원본과 동일한 좌표를 쓰므로 안전하게 묶임).
  const reportGroups = useMemo(() => {
    const groups = new Map()
    reports.forEach((r) => {
      const key = `${r.latitude},${r.longitude}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(r)
    })
    return [...groups.values()]
  }, [reports])

  const reportMarkers = useMemo(
    () =>
      reportGroups.map((group) => {
        const latest = group[group.length - 1]
        return {
          id: `report-${latest.id}`,
          lat: latest.latitude,
          lng: latest.longitude,
          title: group.length > 1 ? `${categoryLabel(latest.category)} 외 ${group.length - 1}건` : categoryLabel(latest.category),
          color: colors.red,
          size: 22,
          icon: categoryIcon(latest.category),
          badge: group.length > 1 ? group.length : undefined,
          onClick: () => {
            setDetailFromNearby(false)
            setSelectedReportGroup(group)
          },
        }
      }),
    [reportGroups],
  )

  // 주변 제보: 현재 위치(없으면 지금 보고 있는 지도 가운데)에서 반경 안의 제보를 가까운 순으로.
  // 현재 위치는 여기서 거리 계산에만 쓰고 어디에도 저장·전송하지 않는다 (팀 원칙)
  const nearbyBasis = myLocation ?? mapCenter
  const nearbyReports = useMemo(
    () =>
      reports
        .map((r) => ({ ...r, distance: haversineMeters(nearbyBasis.lat, nearbyBasis.lng, r.latitude, r.longitude) }))
        .filter((r) => r.distance <= NEARBY_REPORT_RADIUS_METERS)
        .sort((a, b) => a.distance - b.distance),
    [reports, nearbyBasis.lat, nearbyBasis.lng],
  )

  const bottomSheetOpen = !!selectedPlace || nearbyOpen

  useEffect(() => {
    if (selectedPlace) setNearbyOpen(false)
  }, [selectedPlace])

  // 버튼이 "눌린" 상태: 목록이 떠 있거나, 목록에서 고른 제보 카드가 떠 있을 때
  const nearbyActive = nearbyOpen || detailFromNearby

  const closeNearby = () => {
    setNearbyOpen(false)
    if (detailFromNearby) {
      setSelectedReportGroup(null)
      setDetailFromNearby(false)
    }
  }

  const openNearbyReports = () => {
    search.reset() // 장소 정보 카드와 같은 자리에 뜨므로 하나만 보이게 한다
    setNearbyOpen(true)
  }

  // 지도 화면 사용 안내: 코치마크(처음 접속 시 자동, "?" 버튼으로 다시 보기) + 아래쪽 빠른 출발 시트
  const { mode: tutorialMode, replayHint } = useTutorial()
  const searchWrapRef = useRef(null)
  // 자동으로 띄울지: "다시 표시 안 함"을 체크하고 닫은 적이 없고, 이번 접속에 아직 닫지 않았을 때
  // 로그인 화면에서 "로그인 없이 시작하기"로 들어왔으면(guestStart) "다시 표시 안 함" 기록과 상관없이 띄운다
  const [coachAuto, setCoachAuto] = useState(
    () => !!routedState.guestStart || (!readFlag(COACH_MARKS_SEEN_KEY) && !coachClosedThisVisit),
  )
  const [coachReplay, setCoachReplay] = useState(false) // "?" 버튼으로 연 경우 (다시 표시 안 함과 상관없이 연다)
  // 아무것도 안 하고 지도만 보고 있는 상태 (경로·제보 모드·아래 카드·출발/도착 변경 중이 아님)
  const idle = !start && !end && !reportMode && !bottomSheetOpen && !editingPoint
  // 자동 표시는 7단계 가이드 모달과 닫은 직후의 "다시 볼 수 있어요" 안내가 다 사라진 뒤에 이어서 띄운다
  const showCoachMarks = coachReplay || (coachAuto && idle && tutorialMode === null && !replayHint)

  const closeCoachMarks = useCallback((dontShowAgain) => {
    if (dontShowAgain) saveFlag(COACH_MARKS_SEEN_KEY)
    coachClosedThisVisit = true
    setCoachAuto(false)
    setCoachReplay(false)
  }, [])

  const focusSearch = () => searchWrapRef.current?.querySelector('input')?.focus()

  // 빠른 출발: 즐겨찾기 → 최근 길찾기 목적지 순으로 최대 3곳 (같은 장소는 한 번만)
  const quickDestinations = useMemo(() => {
    const list = []
    const already = (place) => list.some((d) => isSamePlace({ latitude: d.place.lat, longitude: d.place.lng }, place))
    for (const f of favorites) {
      if (list.length >= QUICK_DESTINATION_COUNT) break
      const place = { lat: f.latitude, lng: f.longitude, title: f.label, address: f.address }
      if (!already(place)) list.push({ key: `fav-${f.id}`, icon: favoriteIcon(f.label), label: f.label, place })
    }
    for (const item of routeHistory.items) {
      if (list.length >= QUICK_DESTINATION_COUNT) break
      const place = item.end
      if (place.fromMyLocation || already(place)) continue
      list.push({ key: `history-${routeHistoryKey(item)}`, icon: '🕘', label: place.title ?? '최근 목적지', place })
    }
    return list
  }, [favorites, routeHistory.items])

  // 현재 위치 → 그 장소. 최근 길찾기에서 "현재 위치에서 출발" 기록을 누를 때와 같다:
  // 출발지를 비우고 도착지만 정하면 위 이펙트가 현재 위치를 출발지로 채워 경로를 찾는다.
  // 현재 위치가 없으면 아래 안내 바에 "출발지를 검색하세요"가 뜨고, 바로 검색창으로 보낸다
  const goToDestination = (place) => {
    setStart(null)
    setEnd({ id: 'place-end', lat: place.lat, lng: place.lng, title: place.title, address: place.address })
    if (!myLocation) focusSearch()
  }

  // ⚠ 제보 버튼: 현재 위치가 있으면 "지금 내 위치 / 지도에서 고르기" 메뉴를 띄우고, 없으면 바로 기존 제보 모드.
  // 제보 모드 중에 누르면 지금처럼 제보 모드를 끈다
  const [reportMenuOpen, setReportMenuOpen] = useState(false)
  const showReportMenu = reportMenuOpen && !reportMode && !bottomSheetOpen

  const handleReportButton = () => {
    if (reportMode) setReportMode(false)
    else if (myLocation) setReportMenuOpen((open) => !open)
    else setReportMode(true)
  }

  // "지금 내 위치 제보": 지도를 눌러 위치를 고른 것과 같이 제보 창을 연다
  const reportAtMyLocation = () => {
    setReportMenuOpen(false)
    if (myLocation) setPendingLocation({ lat: myLocation.lat, lng: myLocation.lng })
  }

  const reportOnMap = () => {
    setReportMenuOpen(false)
    setReportMode(true)
  }

  useEffect(() => {
    if (!showReportMenu) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setReportMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showReportMenu])

  // 목록에서 제보를 누르면 목록은 내려가고, 지도를 그 위치로 옮겨 핀을 꽂은 뒤 아래쪽 카드로 내용·사진을 보여준다.
  // 카드가 화면 아래쪽을 차지하므로 제보 위치는 화면 위쪽에 오게 옮긴다. 카드를 닫으면 목록으로 돌아간다
  const showNearbyReport = (report) => {
    setNearbyOpen(false)
    setLocationFocus({ lat: report.latitude, lng: report.longitude, level: 3, offsetY: Math.round(window.innerHeight * 0.27) })
    setSelectedReportGroup(reportGroups.find((g) => g.some((r) => r.id === report.id)) ?? [report])
    setDetailFromNearby(true)
  }

  const closeReportDetail = () => {
    setSelectedReportGroup(null)
    if (detailFromNearby) setNearbyOpen(true)
    setDetailFromNearby(false)
  }

  // 주변 제보에서 고른 제보 위치에 빨간 핀 + 카테고리 이름표 (상세 카드가 떠 있는 동안만)
  const nearbyFocusMarkers = useMemo(() => {
    const target = detailFromNearby && selectedReportGroup?.[0]
    if (!target) return []
    return [
      {
        id: 'nearby-selected-report',
        lat: target.latitude,
        lng: target.longitude,
        title: categoryLabel(target.category),
        label: categoryLabel(target.category),
        color: colors.red,
        pin: true,
      },
    ]
  }, [detailFromNearby, selectedReportGroup])

  // 좌표 찍기 모드 전용: 직접 찍은 횡단보도. 숫자 = CSV 줄 번호, 보라 = 일반, 분홍 = 대각선
  const surveyedCrosswalkMarkers = useMemo(
    () =>
      !CROSSWALK_SURVEY
        ? []
        : parseSurveyedCrosswalks(SURVEYED_CROSSWALK_CSV).map((c) => ({
            id: `surveyed-crosswalk-${c.lineNo}`,
            lat: c.lat,
            lng: c.lng,
            title: `crosswalks-surveyed.csv ${c.lineNo}번째 줄${c.diagonal ? ' (대각선)' : ''}: ${c.text}`,
            color: c.diagonal ? '#DB2777' : '#7C3AED',
            size: 18,
            icon: String(c.lineNo),
            maxLevel: 4,
          })),
    [],
  )

  // 출발/도착 중 하나라도 초기화되면 이전 경로는 숨긴다
  const visibleRoutes = start && end ? routes : null
  // 안심경로가 최단경로와 같은 길인지 (지나는 교차로가 모두 같으면 같은 길)
  const sameRoute =
    !!visibleRoutes && routeNodeKey(visibleRoutes.safe) === routeNodeKey(visibleRoutes.shortest)
  // 같은 길이라는 안내는 경로가 새로 나올 때 잠깐만 띄우고 서서히 사라지게 한다 (카드 위를 계속 가리지 않게)
  // 'shown' -> 'fading'(투명해지는 중) -> null(없앰)
  const [sameRouteNotice, setSameRouteNotice] = useState(null)
  useEffect(() => {
    if (!sameRoute) {
      setSameRouteNotice(null)
      return
    }
    setSameRouteNotice('shown')
    const fade = setTimeout(() => setSameRouteNotice('fading'), 3000)
    const hide = setTimeout(() => setSameRouteNotice(null), 3000 + SAME_ROUTE_FADE_MS)
    return () => {
      clearTimeout(fade)
      clearTimeout(hide)
    }
  }, [sameRoute, visibleRoutes])

  // 고른 경로에서 큰 도로를 건너는 곳은 네이버지도처럼 건너기 시작하는 지점에 횡단보도 배지를 단다
  // (경로선은 끊지 않고 그대로 둔다)
  const crossingMarkers = useMemo(() => {
    if (!visibleRoutes) return []
    return (visibleRoutes[selectedRouteKey].crossings ?? []).map((c) => ({
      id: `crossing-${c.start.latitude},${c.start.longitude}`,
      lat: c.start.latitude,
      lng: c.start.longitude,
      title: c.hasSignal ? '신호등 있는 횡단보도' : '횡단보도',
      crosswalk: true,
    }))
  }, [visibleRoutes, selectedRouteKey])

  // 출발/도착이 지하철역이면 고른 경로가 나오고 들어가는 출구를 표시한다 (경로선이 역 가운데가 아니라 이 출구에서 끝난다).
  // 네이버지도처럼 축소했을 때는 작은 흰 원, 확대하면 계단/에스컬레이터 그림 + "2번 출구" 이름표
  const exitMarkers = useMemo(() => {
    if (!visibleRoutes) return []
    const route = visibleRoutes[selectedRouteKey]
    return [route.fromExit, route.toExit].filter(Boolean).flatMap((exit) => {
      const base = { lat: exit.latitude, lng: exit.longitude, title: exit.label }
      const kind = exit.type === 'ESCALATOR' ? ' (에스컬레이터)' : exit.type === 'STAIRS' ? ' (계단)' : ''
      return [
        {
          ...base,
          id: `exit-dot-${exit.latitude},${exit.longitude}`,
          minLevel: EXIT_DETAIL_MAX_LEVEL + 1,
          color: colors.white,
          size: 12,
          borderColor: '#1F2937',
        },
        {
          ...base,
          id: `exit-${exit.latitude},${exit.longitude}`,
          title: exit.label + kind,
          maxLevel: EXIT_DETAIL_MAX_LEVEL,
          exit: { type: exit.type },
          icon: exit.label.replace(/\D/g, ''),
          label: exit.label,
        },
      ]
    })
  }, [visibleRoutes, selectedRouteKey])

  const allMarkers = useMemo(
    () => [
      ...(safety.layers.streetlight ? streetLightMarkers : []), // 가로등 칩을 끄면 숨긴다 (경로 위험도 계산과는 무관)
      ...safetyMarkers, // 제보 마커보다 먼저 그려 아래에 깔리게
      ...surveyedCrosswalkMarkers,
      ...reportMarkers,
      ...crossingMarkers,
      ...exitMarkers,
      ...favoriteMarkers,
      ...searchedPointMarkers,
      ...nearbyFocusMarkers,
    ],
    [
      safety.layers.streetlight,
      streetLightMarkers,
      safetyMarkers,
      surveyedCrosswalkMarkers,
      reportMarkers,
      crossingMarkers,
      exitMarkers,
      favoriteMarkers,
      searchedPointMarkers,
      nearbyFocusMarkers,
    ],
  )

  // 고른 경로는 굵고 진하게 맨 위에, 다른 경로는 가늘고 흐리게 아래에 깔아 비교만 할 수 있게 한다
  const paths = useMemo(() => {
    if (!visibleRoutes) return []
    const otherKey = selectedRouteKey === 'safe' ? 'shortest' : 'safe'
    return [
      { id: otherKey, points: routePoints(visibleRoutes[otherKey]), color: ROUTE_COLORS[otherKey], weight: 5, opacity: 0.4 },
      { id: selectedRouteKey, points: routePoints(visibleRoutes[selectedRouteKey]), color: ROUTE_COLORS[selectedRouteKey], weight: 9 },
    ]
  }, [visibleRoutes, selectedRouteKey])

  // 정한 출발/도착과 그려진 경로를 모두 지우고 처음 상태로 돌아간다
  const resetRoute = () => {
    setStart(null)
    setEnd(null)
    setRoutes(null)
    setSelectedRouteKey('safe')
    setError(null)
    setEditingPoint(null)
  }

  // 위쪽 "출발 → 도착" 바에서 한쪽을 누르면 그 자리가 검색창으로 바뀐다.
  // 지금 장소 이름을 그대로 채워 두고 고쳐 쓰게 한다 (비우면 원래 글자가 지워진 것처럼 보여서)
  // 단, 현재 위치는 검색어로 쓸 이름이 아니라서 빈 칸으로 연다
  const startEditingPoint = (which) => {
    const point = which === 'start' ? start : end
    search.reset(point?.fromMyLocation ? '' : (point?.title ?? ''))
    setEditingPoint(which)
  }

  const cancelEditingPoint = () => {
    search.reset()
    setEditingPoint(null)
  }

  // 변경 중인 검색창에서 결과를 고르면 정보 카드 없이 바로 출발/도착을 바꾼다 (경로는 자동으로 다시 계산됨)
  const applyEditedPoint = (place) => {
    const point = { lat: place.latitude, lng: place.longitude, title: place.placeName, address: place.addressName }
    if (editingPoint === 'start') setStart({ id: 'place-start', ...point })
    else setEnd({ id: 'place-end', ...point })
    cancelEditingPoint()
  }

  // 지도 빈 곳을 누르면: 제보 모드일 때는 제보 위치로 쓰고, 아닐 때는 그 곳의 장소 이름을 찾아 정보 카드로 띄운다
  const handleMapClick = async (latlng) => {
    // 좌표 찍기 모드 전용: 횡단보도 좌표 보정용. 지도를 최대로 확대해 줄무늬 가운데를 누르면
    // back/src/main/resources/data/crosswalks-surveyed.csv 에 붙여 넣을 한 줄을 화면에 띄우고 클립보드에 복사한다
    // (도로명·신호등 유무는 붙여 넣은 뒤 직접 고침)
    if (CROSSWALK_SURVEY) {
      const line = `도로명,${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)},true`
      console.log(`[횡단보도 좌표] ${line}`)
      setDevCoord({ line, copied: false })
      navigator.clipboard
        ?.writeText(line)
        .then(() => setDevCoord((cur) => (cur?.line === line ? { line, copied: true } : cur)))
        .catch(() => {})
    }
    // 빠르게 여러 번 누르면 마지막으로 누른 곳의 결과만 보여준다
    const seq = ++mapClickSeqRef.current
    if (reportMode) {
      setPendingLocation(latlng)
      setReportMode(false)
      return
    }
    setEditingPoint(null) // 출발/도착 변경 중에 지도를 누르면 변경은 그만두고 누른 장소를 보여준다
    setNearbyOpen(false) // 누른 장소의 정보 카드가 같은 자리에 뜬다
    try {
      const { data } = await placeApi.findAt(latlng.lat, latlng.lng)
      if (seq !== mapClickSeqRef.current || !data) return
      search.onSelect(data, { fromMap: true })
    } catch (err) {
      console.error('[MapPage] 지도 위치 장소 조회 실패', err)
    }
  }

  const handleSubmitted = () => {
    setPendingLocation(null)
    loadReports()
    // 새 제보가 위험도에 반영되도록, 이미 경로가 표시돼 있으면 다시 계산한다
    setRouteRefreshKey((k) => k + 1)
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <KakaoMap
        center={initialFocus ?? DEMO_CENTER}
        // 넘겨받은 위치가 있으면 골목 단위(3)로 확대, 아니면 시연 지역(약 5.9km x 2.6km)이 처음부터 한눈에 보이도록 축소
        level={initialFocus ? 3 : 6}
        markers={allMarkers}
        paths={paths}
        onMapClick={handleMapClick}
        onCenterChange={setMapCenter}
        onBoundsChange={setMapBounds}
        crosshair={reportMode}
        focus={focus}
        myLocation={myLocation}
        heading={heading}
      />

      {CROSSWALK_SURVEY && devCoord && (
        // 좌표 찍기 모드 전용 좌표 표시. 누르면 닫힌다
        <div
          onClick={() => setDevCoord(null)}
          style={{
            position: 'absolute',
            zIndex: 20,
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 10px',
            borderRadius: 6,
            background: 'rgba(26,43,76,.9)',
            color: '#fff',
            fontSize: 13,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          {devCoord.line} {devCoord.copied ? '(복사됨)' : ''}
        </div>
      )}


      <div
        style={{
          position: 'absolute',
          zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          gap: 8,
        }}
      >
        {start && end ? (
          // 출발/도착이 모두 정해지면 검색창 자리에 "출발 → 도착"을 띄운다
          // 한쪽 이름을 누르면 그 자리만 입력칸으로 바뀌고 반대쪽은 그대로 보인다 (결과 목록은 바 아래로 펼쳐짐)
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: colors.white,
                borderRadius: 24,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                padding: '12px 12px 12px 16px',
                color: colors.navy,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {/* 오른쪽 ✕와 같은 폭의 빈 칸. 출발지 칸과 도착지 칸이 같은 폭이 되게 한다 */}
              <span style={{ width: 24, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RoutePoint
                  color={colors.navy}
                  name={start.title ?? '출발지'}
                  label="출발지"
                  editing={editingPoint === 'start'}
                  search={search}
                  onEdit={() => startEditingPoint('start')}
                  onCancel={cancelEditingPoint}
                />
                <span style={{ color: colors.gray, flexShrink: 0 }}>→</span>
                <RoutePoint
                  color={colors.red}
                  name={end.title ?? '도착지'}
                  label="도착지"
                  editing={editingPoint === 'end'}
                  search={search}
                  onEdit={() => startEditingPoint('end')}
                  onCancel={cancelEditingPoint}
                />
              </div>
              {/* 변경 중에는 변경만 취소하고, 아닐 때는 경로 전체를 취소한다 */}
              <button
                type="button"
                onClick={editingPoint ? cancelEditingPoint : resetRoute}
                style={closeButtonStyle}
                aria-label={editingPoint ? '변경 취소' : '경로 취소'}
              >
                ✕
              </button>
            </div>
            {editingPoint && <PlaceResults search={search} onSelect={applyEditedPoint} />}
          </div>
        ) : (
          <div ref={searchWrapRef} data-coach="search" style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <PlaceSearchBar
            search={search}
            hints={searchHints()}
            history={{
              items: routeHistory.items,
              // 최근 길찾기를 누르면 그 출발→도착을 그대로 다시 찾는다 (경로는 자동으로 계산됨)
              // 현재 위치에서 출발한 기록은 출발지를 비워 두면 위 이펙트가 지금 위치로 채운다
              onPick: (item) => {
                setStart(item.start.fromMyLocation ? null : { id: 'place-start', ...item.start })
                setEnd({ id: 'place-end', ...item.end })
              },
              onRemove: routeHistory.remove,
              onClear: routeHistory.clear,
            }}
          />
          </div>
        )}
        {/* 도움말: 화면 사용법(코치마크)을 1단계부터 다시 본다. 경로 바(출발 → 도착)가 떠 있을 때는 이름 칸이 좁아지지 않게 숨긴다.
            7단계 사용 가이드 모달은 마이페이지에서 다시 볼 수 있다 */}
        {!(start && end) && (
          <button
            type="button"
            onClick={() => setCoachReplay(true)}
            className="map-fab"
            aria-label="화면 사용법 다시 보기"
            title="화면 사용법"
            style={{
              width: 44,
              flexShrink: 0,
              borderRadius: 22,
              padding: 0,
              fontSize: 18,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ?
          </button>
        )}
      </div>

      {reportMode && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 104, // 칩 줄(top 64~96) 아래, 즐겨찾기 별 자리 (제보 모드에서는 별을 숨긴다)
            left: 12,
            right: 12,
            background: colors.navy,
            color: colors.white,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          제보할 위치를 지도에서 클릭하세요
        </div>
      )}

      {visibleRoutes && !error && !bottomSheetOpen ? (
        // 경로가 나오면 아래에 안심경로·최단경로 카드를 따로따로 띄운다 (테두리 색 = 지도 위 경로선 색).
        // 카드를 누르면 그 경로를 골라 지도에 강조한다
        <div
          style={{
            position: 'absolute',
            zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
            bottom: 16,
            left: 12,
            right: 84, // 제보 버튼 자리
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            color: colors.navy,
          }}
        >
          {sameRouteNotice && (
            // 두 경로가 같으면 오류로 보일 수 있어서, 왜 같은지 카드 위에 알려 준다
            <div
              style={{
                alignSelf: 'flex-start',
                background: colors.navy,
                color: colors.white,
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                whiteSpace: 'nowrap', // 좁은 화면에서도 한 줄로
                opacity: sameRouteNotice === 'fading' ? 0 : 1,
                transition: `opacity ${SAME_ROUTE_FADE_MS}ms ease`,
              }}
            >
              {visibleRoutes.safe.darkDistanceMeters < 1 && visibleRoutes.safe.reportedDistanceMeters < 1
                ? '최단경로가 이미 안전한 길이에요'
                : '더 안전하게 돌아갈 길이 없어요'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
          <RouteCard
            label="안심경로"
            color={ROUTE_COLORS.safe}
            route={visibleRoutes.safe}
            selected={selectedRouteKey === 'safe'}
            onSelect={() => setSelectedRouteKey('safe')}
          />
          <RouteCard
            label="최단경로"
            color={ROUTE_COLORS.shortest}
            route={visibleRoutes.shortest}
            selected={selectedRouteKey === 'shortest'}
            onSelect={() => setSelectedRouteKey('shortest')}
          />
          </div>
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
            bottom: 16,
            left: 12,
            right: 84,
            // 장소 정보 카드·주변 제보가 떠 있을 때는 자리를 내준다.
            // 출발/도착을 하나도 정하지 않은 처음 상태는 같은 자리의 빠른 출발 시트가 맡으므로, 여기는 진행 상황(출발/도착 하나만 정함·경로 찾는 중·오류)만 보여준다
            display: bottomSheetOpen || (!start && !end) ? 'none' : 'flex',
            alignItems: 'flex-start',
            gap: 8,
            background: colors.white,
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            color: colors.navy,
            fontSize: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {error ??
              (start && end
                ? '경로를 찾는 중...'
                : start
                  ? `출발: ${start.title ?? '선택한 지점'} · 도착지를 검색하세요`
                  : end
                    ? `도착: ${end.title ?? '선택한 지점'} · 출발지를 검색하세요`
                    : null)}
          </div>
          {/* 서버에 닿지 못한 경우만 다시 시도할 의미가 있다 (경로 없음·잘못된 요청은 다시 보내도 같음) */}
          {error === ROUTE_ERROR_MESSAGES.server && (
            <button type="button" onClick={() => setRouteRefreshKey((k) => k + 1)} style={retryButtonStyle}>
              다시 시도
            </button>
          )}
          {/* 출발/도착 중 하나만 정했을 때의 취소 버튼 (둘 다 정하면 위쪽 "출발 → 도착" 바의 ✕를 쓴다) */}
          {(start || end) && !(start && end) && (
            <button type="button" onClick={resetRoute} style={closeButtonStyle} aria-label="경로 취소">
              ✕
            </button>
          )}
        </div>
      )}

      {/* 빠른 출발: 처음 상태(출발/도착 없음, 장소·주변 제보 카드 없음, 제보 모드 아님)에서만 아래 안내 바 자리에 띄운다.
          경로를 찾기 시작하면 위 안내 바·경로 카드가 같은 자리를 이어받는다 */}
      {idle && (
        <QuickStartSheet
          style={{ position: 'absolute', zIndex: 10, bottom: 16, left: 12, right: 84 }}
          destinations={quickDestinations.map((d) => ({ ...d, onClick: () => goToDestination(d.place) }))}
          error={error}
        />
      )}

      {/* 안전시설 필터 칩 줄: 검색창 바로 아래 (top 64, 높이 32). 장소 카드·경로 안내 중에도 유지하고,
          검색 결과 목록이 펼쳐지면 그 아래로 가려진다. 마지막 ⚠ 제보 칩이 예전 "주변 제보" 버튼을 대신한다 */}
      <SafetyChips
        style={{ position: 'absolute', zIndex: 9, top: 64, left: 12, right: 12 }}
        layers={safety.layers}
        onToggle={toggleLayer}
        reports={{
          count: nearbyReports.length,
          active: nearbyActive,
          onClick: nearbyActive ? closeNearby : openNearbyReports,
        }}
      />
      {mapHint && (
        <div
          role="status"
          className="map-hint-toast"
          style={{ position: 'absolute', zIndex: 9, top: 108, left: '50%', transform: 'translateX(-50%)' }}
        >
          {mapHint}
        </div>
      )}
      {loadErrorToast && (
        // 데이터 조회 실패 안내. 칩 안내(mapHint)가 떠 있으면 그 아래로 내린다
        <div
          role="alert"
          className="map-hint-toast"
          style={{ position: 'absolute', zIndex: 9, top: mapHint ? 148 : 108, left: '50%', transform: 'translateX(-50%)' }}
        >
          {loadErrorToast}
        </div>
      )}
      {routeNotice && (
        // 새 제보로 경로를 다시 찾았다는 안내. 위의 두 안내가 떠 있으면 그만큼 아래로 내린다
        <div
          role="status"
          className="map-hint-toast"
          style={{
            position: 'absolute',
            zIndex: 9,
            top: 108 + (mapHint ? 40 : 0) + (loadErrorToast ? 40 : 0),
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {routeNotice}
        </div>
      )}

      {/* 즐겨찾기 별 표시/숨기기. 칩 줄 바로 아래 오른쪽 (검색 결과 목록이 펼쳐지면 그 아래로 가려진다).
          제보 모드에서는 같은 자리에 안내 띠가 뜨므로 숨긴다 */}
      {!reportMode && (
        <button
          type="button"
          onClick={toggleFavorites}
          data-coach="favorites"
          // 즐겨찾기 별을 지도에 띄운 상태면 남색(켜짐), 아니면 반투명 (index.css .map-fab)
          className={`map-fab${showFavorites ? ' is-active' : ''}`}
          style={{
            position: 'absolute',
            zIndex: 9,
            top: 104, // 검색창 아래 칩 줄(top 64~96) 밑
            right: 16,
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
          }}
          aria-label={showFavorites ? '즐겨찾기 숨기기' : '즐겨찾기 표시'}
          aria-pressed={showFavorites}
        >
          <svg className="map-fab-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
            <path
              d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"
              fill={showFavorites ? colors.amber : 'none'}
              stroke={showFavorites ? colors.amber : 'currentColor'}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* 장소 정보 카드·주변 제보가 떠 있을 때는 자리를 내준다 */}
      {!bottomSheetOpen && (
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={!myLocation}
          data-coach="locate"
          // 계속 켜 두는 모드가 없는 버튼이라 누르는 순간(:active)만 남색 (index.css .map-fab)
          className="map-fab"
          style={{
            position: 'absolute',
            zIndex: 10,
            bottom: 84,
            right: 16,
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            cursor: myLocation ? 'pointer' : 'default',
            opacity: myLocation ? 1 : 0.5,
          }}
          aria-label="현재 위치로 이동"
        >
          <svg className="map-fab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="1" x2="12" y2="4" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="20" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
            <line x1="1" y1="12" x2="4" y2="12" stroke="currentColor" strokeWidth="2" />
            <line x1="20" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      )}

      {/* 장소 정보 카드·주변 제보가 떠 있을 때는 자리를 내준다 */}
      {!bottomSheetOpen && (
        <button
          type="button"
          onClick={handleReportButton}
          data-coach="report"
          aria-haspopup={myLocation && !reportMode ? 'menu' : undefined}
          aria-expanded={myLocation && !reportMode ? showReportMenu : undefined}
          // 제보 위치 고르는 중이거나 메뉴가 열려 있으면 남색(켜짐), 아니면 반투명 (index.css .map-fab)
          className={`map-fab${reportMode || showReportMenu ? ' is-active' : ''}`}
          style={{
            position: 'absolute',
            zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
            bottom: 16,
            right: 16,
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
          }}
          aria-label={reportMode ? '제보 취소' : '위험구간 제보'}
        >
          {/* 이모지(⚠️)는 글꼴 아래 여백 때문에 원 안에서 아래로 처져 보여서 SVG로 그려 정가운데에 맞춘다 */}
          {reportMode ? (
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ display: 'block' }}>
              <path d="M5 5l12 12M17 5L5 17" stroke={colors.white} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="map-fab-icon" width="28" height="26" viewBox="0 0 28 26" aria-hidden="true" style={{ display: 'block' }}>
              <path
                d="M12.27 2a2 2 0 0 1 3.46 0l11 19a2 2 0 0 1-1.73 3H3a2 2 0 0 1-1.73-3z"
                fill={colors.amber}
              />
              <rect x="12.6" y="8.5" width="2.8" height="8.5" rx="1.4" fill={colors.navy} />
              <circle cx="14" cy="20.3" r="1.6" fill={colors.navy} />
            </svg>
          )}
        </button>
      )}

      {showReportMenu && (
        <>
          {/* 바깥(지도·⚠ 버튼 포함)을 누르면 메뉴만 닫힌다 */}
          <div onClick={() => setReportMenuOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 11 }} />
          {/* ⚠ 버튼(bottom 16, 높이 52) 바로 위로 펼친다. 열려 있는 동안은 위쪽 내 위치 버튼을 잠시 덮는다 */}
          <div role="menu" aria-label="제보 방법" className="report-menu" style={{ position: 'absolute', zIndex: 12, bottom: 76, right: 16 }}>
            <button type="button" role="menuitem" onClick={reportAtMyLocation} className="report-menu-item">
              📍 지금 내 위치 제보
            </button>
            <button type="button" role="menuitem" onClick={reportOnMap} className="report-menu-item">
              🗺 지도에서 위치 고르기
            </button>
          </div>
        </>
      )}

      <PlaceSheet
        key={selectedPlace ? `${selectedPlace.lat},${selectedPlace.lng}` : 'none'} // 장소가 바뀌면 이름 입력 상태 초기화
        place={selectedPlace}
        favorite={selectedFavorite}
        onAddFavorite={addFavorite}
        onClose={() => search.reset()}
        onSetStart={() => setPlaceAs(setStart, 'place-start')}
        onSetEnd={() => setPlaceAs(setEnd, 'place-end')}
      />

      {nearbyOpen && (
        <NearbyReportsSheet
          reports={nearbyReports}
          basisLabel={`${myLocation ? '현재 위치' : '지도 가운데'} 기준 ${NEARBY_REPORT_RADIUS_LABEL}`}
          onClose={() => setNearbyOpen(false)}
          onSelect={showNearbyReport}
        />
      )}

      <ReportModal
        location={pendingLocation}
        onClose={() => setPendingLocation(null)}
        onSubmitted={handleSubmitted}
      />

      <ReportDetail
        reports={selectedReportGroup}
        overMap={detailFromNearby}
        closeLabel={detailFromNearby ? '주변 제보 목록으로' : '닫기'}
        onClose={closeReportDetail}
        onDeleted={(deletedId) => {
          const remaining = selectedReportGroup?.filter((r) => r.id !== deletedId) ?? []
          if (remaining.length > 0) setSelectedReportGroup(remaining)
          else closeReportDetail() // 이 위치 제보를 다 지우면 카드를 닫는다 (주변 제보에서 왔으면 목록으로)
          loadReports()
        }}
        onAddReport={(location) => {
          setSelectedReportGroup(null)
          setDetailFromNearby(false)
          setPendingLocation(location)
        }}
      />

      {showCoachMarks && <CoachMarks steps={COACH_STEPS} onClose={closeCoachMarks} />}
    </div>
  )
}

const LOAD_ERROR_TOAST_MS = 2500 // 데이터 조회 실패 토스트를 띄워 두는 시간
const ROUTE_NOTICE_MS = 4000 // 새 제보로 경로를 다시 찾았다는 안내를 띄워 두는 시간

// 경로 찾기 실패 문구 (getErrorKind 종류별, 나머지는 default)
const ROUTE_ERROR_MESSAGES = {
  server: '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.',
  notFound: '출발지와 도착지를 잇는 경로를 찾지 못했어요.',
  badRequest: '출발지나 도착지 정보가 올바르지 않아요.',
  default: '경로를 불러오지 못했어요.',
}

const retryButtonStyle = {
  flexShrink: 0,
  padding: '4px 10px',
  border: `1px solid ${colors.navy}`,
  borderRadius: 6,
  background: colors.white,
  color: colors.navy,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const closeButtonStyle = {
  flexShrink: 0,
  width: 24,
  height: 24,
  padding: 0,
  border: 'none',
  background: 'none',
  color: colors.gray,
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
}

// 상단 "출발 → 도착" 바의 한쪽 지점 (지도 위 출발/도착 표시와 같은 색 점 + 이름)
// 이름을 누르면 그 자리가 입력칸으로 바뀌고, 입력칸에서 Esc를 누르면 변경을 취소한다
function RoutePoint({ color, name, label, editing, search, onEdit, onCancel }) {
  const dot = <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />

  if (editing) {
    return (
      <span style={{ ...routePointStyle, boxShadow: `inset 0 -2px 0 ${color}` }}>
        {dot}
        <input
          autoFocus
          // 채워 둔 장소 이름 끝에 커서를 둔다 (이어서 고치거나 지울 수 있게)
          onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
          value={search.query}
          onChange={(e) => search.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          placeholder={`${label} 검색`}
          aria-label={`${label} 검색`}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            fontWeight: 400,
          }}
        />
      </span>
    )
  }

  return (
    <button type="button" onClick={onEdit} aria-label={`${label} 변경`} title={`${label} 변경`} style={routePointStyle}>
      {dot}
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    </button>
  )
}

const routePointStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: 1, // 출발지·도착지가 바를 반씩 나눠 갖고, 각 칸 안에서 이름을 가운데 정렬한다
  justifyContent: 'center',
  minWidth: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}

// 경로 한 개의 요약 카드. 테두리와 제목 글자 색(color)은 지도 위 경로선 색과 같다.
// 고른 카드(selected)는 진하게, 안 고른 카드는 흐리게 보여 지금 어느 경로를 안내 중인지 알 수 있게 한다
function RouteCard({ label, color, route, selected, onSelect }) {
  const crossings = route.crossings ?? []
  // 공공데이터(횡단보도 표준데이터)로 보행자 신호등이 확인된 곳만 센다
  const signalCount = crossings.filter((c) => c.hasSignal).length
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        flex: 1,
        minWidth: 0,
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        opacity: selected ? 1 : 0.6,
        transform: selected ? 'translateY(-4px)' : 'none',
        transition: 'opacity .15s, transform .15s',
        border: `3px solid ${color}`,
        borderRadius: 10,
        padding: '10px 12px',
        background: colors.white,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
        {route.estimatedMinutes}
        <span style={{ fontSize: 14, fontWeight: 600 }}>분</span>
      </div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{Math.round(route.totalDistanceMeters)}m</div>
      {(route.fromExit || route.toExit) && (
        // 지하철역에서 출발/도착하면 이 경로가 쓰는 출구 (최단·안심경로가 서로 다른 출구일 수 있다)
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginTop: 4 }}>
          {[route.fromExit && `${route.fromExit.label}로 나와서`, route.toExit && `${route.toExit.label}로 들어가기`]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
      <div style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>
        어두운 구간 {Math.round(route.darkDistanceMeters)}m
      </div>
      <div style={{ fontSize: 12, color: colors.gray }}>제보 구간 {Math.round(route.reportedDistanceMeters)}m</div>
      <div style={{ fontSize: 12, color: colors.gray }}>
        횡단보도 {crossings.length}회{signalCount > 0 && ` · 신호등 ${signalCount}곳`}
      </div>
    </button>
  )
}
