import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import { colors } from './styles/colors'

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <TutorialProvider>
          <BrowserRouter>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: colors.background,
              }}
            >
              <main style={{ flex: 1, overflow: 'auto', paddingBottom: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}>
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
              <BottomNav />
            </div>
            <UsageTutorial />
            <ReportToast />
          </BrowserRouter>
        </TutorialProvider>
      </NotificationsProvider>
    </AuthProvider>
  )
}

export default App
