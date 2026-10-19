import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import BottomNav, { BOTTOM_NAV_HEIGHT } from './components/BottomNav'
import MapPage from './pages/MapPage'
import RouteDetailPage from './pages/RouteDetailPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MyPage from './pages/MyPage'
import FavoritesPage from './pages/FavoritesPage'
import NotificationsPage from './pages/NotificationsPage'
import { AuthProvider } from './hooks/useAuth'
import { TutorialProvider } from './hooks/useTutorial'
import { NotificationsProvider } from './hooks/useNotifications'
import UsageTutorial from './components/UsageTutorial'
import ReportToast from './components/ReportToast'
import StartupLoginGate from './components/StartupLoginGate'
import { colors } from './styles/colors'
import { AUTH_PATHS } from './constants/authPaths'

// 로그인·회원가입 화면은 앱에 들어오기 전 화면이라, 하단 탭과 새 제보 팝업을 띄우지 않는다
function AppShell() {
  const { pathname } = useLocation()
  const authScreen = AUTH_PATHS.includes(pathname)

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: colors.background,
        }}
      >
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            paddingBottom: authScreen ? 0 : `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
          }}
        >
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/route-detail" element={<RouteDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/my" element={<MyPage />} />
          </Routes>
        </main>
        {!authScreen && <BottomNav />}
      </div>
      <UsageTutorial />
      {!authScreen && <ReportToast />}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <TutorialProvider>
          <BrowserRouter>
            <StartupLoginGate>
              <AppShell />
            </StartupLoginGate>
          </BrowserRouter>
        </TutorialProvider>
      </NotificationsProvider>
    </AuthProvider>
  )
}

export default App
