import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createStompClient } from '../api/socket'
import { favoriteApi } from '../api/favoriteApi'
import { reportApi } from '../api/reportApi'
import { useAuth } from './useAuth'
import { haversineMeters } from '../utils/geo'

const STORAGE_KEY = 'safemate-notifications'
const MAX_NOTIFICATIONS = 50
// 즐겨찾기 장소에서 이 거리 안의 제보는 "즐겨찾기 근처"로 강조한다
const NEAR_FAVORITE_METERS = 300

const NotificationsContext = createContext(null)

// 사생활 보호 모드·저장 공간 부족 등으로 localStorage가 막혀도 알림 기능 자체는 동작해야 하므로 실패는 무시한다
function loadNotifications() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function saveNotifications(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
  } catch {
    // 저장 실패 시 이번 세션에서만 유지
  }
}

// 즐겨찾기 중 가장 가까운 곳이 반경 안이면 { label, distance }를 돌려준다
function findNearFavorite(report, favorites) {
  let nearest = null
  for (const fav of favorites) {
    const distance = haversineMeters(report.latitude, report.longitude, fav.latitude, fav.longitude)
    if (distance <= NEAR_FAVORITE_METERS && (!nearest || distance < nearest.distance)) {
      nearest = { label: fav.label, distance: Math.round(distance) }
    }
  }
  return nearest
}

// 새 제보 실시간 알림을 앱 전체에서 공유한다. STOMP 연결은 이 Provider에서 한 번만 맺는다.
// 서버 메시지(ReportResponse)에는 제보자 정보가 없어서, "내 제보"는 프론트가 아는 내 제보 id로 걸러낸다.
export function NotificationsProvider({ children }) {
  const { member } = useAuth()
  const [notifications, setNotifications] = useState(loadNotifications)
  const myReportIds = useRef(new Set())
  const deletedReportIds = useRef(new Set())
  // 화면 위에 잠깐 띄우는 팝업 하나. { kind: 'report', notification } | { kind: 'info', message }
  const [toast, setToast] = useState(null)
  // 제보가 새로 올라오거나 삭제될 때마다(내 것 포함) 1씩 오른다. 지도 화면이 이 값을 보고 제보 마커를 다시 불러온다.
  const [reportVersion, setReportVersion] = useState(0)

  useEffect(() => {
    saveNotifications(notifications)
  }, [notifications])

  // 서버가 로그인 회원 → deviceId 순으로 "내 것"을 판단하므로, 로그인/로그아웃하면 내 제보 id를 다시 받는다
  const memberEmail = member?.email
  useEffect(() => {
    reportApi
      .findMine()
      .then(({ data }) => {
        // 교체하지 않고 합친다: 이 요청이 나간 뒤 markMine으로 추가된 id가 응답에 없을 수 있다
        data.forEach((r) => myReportIds.current.add(r.id))
      })
      .catch((err) => console.error('[Notifications] 내 제보 조회 실패', err))
  }, [memberEmail])

  useEffect(() => {
    const handleReport = async (report) => {
      setReportVersion((v) => v + 1)
      if (myReportIds.current.has(report.id)) return

      // 제보는 자주 오지 않으므로 올 때마다 즐겨찾기를 새로 받아 최신 목록으로 비교한다
      let nearFavorite = null
      try {
        const { data } = await favoriteApi.findMine()
        nearFavorite = findNearFavorite(report, data)
      } catch (err) {
        console.error('[Notifications] 즐겨찾기 조회 실패', err)
      }
      // 즐겨찾기를 받는 사이에 내 제보로 확인됐거나 이미 삭제됐을 수 있다
      if (myReportIds.current.has(report.id) || deletedReportIds.current.has(report.id)) return

      const notification = {
        id: report.id,
        category: report.category,
        latitude: report.latitude,
        longitude: report.longitude,
        address: report.address,
        createdAt: report.createdAt,
        nearFavorite,
        read: false,
      }
      setNotifications((prev) =>
        [notification, ...prev.filter((n) => n.id !== report.id)].slice(0, MAX_NOTIFICATIONS),
      )
      setToast({ kind: 'report', notification })
    }

    // 누군가 제보를 지우면 팝업 없이 조용히 정리한다: 지도 마커 다시 불러오기 + 알림 목록·떠 있는 팝업에서 제거
    const handleDeleted = (reportId) => {
      deletedReportIds.current.add(reportId)
      setReportVersion((v) => v + 1)
      setNotifications((prev) => (prev.some((n) => n.id === reportId) ? prev.filter((n) => n.id !== reportId) : prev))
      setToast((prev) => (prev?.kind === 'report' && prev.notification.id === reportId ? null : prev))
    }

    const client = createStompClient(handleReport, handleDeleted)
    client.activate()
    return () => {
      client.deactivate()
    }
  }, [])

  // 제보를 등록하면 호출한다. 브로드캐스트가 등록 응답보다 먼저 도착해 이미 목록에 들어갔을 수 있어서 함께 지운다.
  const markMine = useCallback((reportId) => {
    myReportIds.current.add(reportId)
    setNotifications((prev) => (prev.some((n) => n.id === reportId) ? prev.filter((n) => n.id !== reportId) : prev))
    // 같은 이유로 "새 제보" 팝업이 먼저 떴을 수 있으니 등록 완료 안내로 바꿔 띄운다
    setToast({ kind: 'info', message: '제보가 등록됐어요. 다른 사용자에게도 알림이 갑니다.' })
  }, [])

  // 내 제보를 삭제하면 호출한다. 다른 사용자 화면은 서버의 삭제 브로드캐스트로 정리된다.
  const markMineDeleted = useCallback(() => {
    setToast({ kind: 'info', message: '제보를 삭제했어요.' })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  const markRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => (prev.some((n) => !n.read) ? prev.map((n) => ({ ...n, read: true })) : prev))
  }, [])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        markMine,
        markMineDeleted,
        markRead,
        markAllRead,
        toast,
        dismissToast,
        reportVersion,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
