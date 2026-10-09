import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav, { BOTTOM_NAV_HEIGHT } from './components/BottomNav'
import MapPage from './pages/MapPage'
import RouteDetailPage from './pages/RouteDetailPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MyPage from './pages/MyPage'
import FavoritesPage from './pages/FavoritesPage'
import PlaceholderPage from './pages/PlaceholderPage'
import { AuthProvider } from './hooks/useAuth'
import { TutorialProvider } from './hooks/useTutorial'
import UsageTutorial from './components/UsageTutorial'
import { colors } from './styles/colors'

function App() {
  return (
    <AuthProvider>
      <TutorialProvider>
        <BrowserRouter>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',
              background: colors.background,
            }}
          >
            <main style={{ flex: 1, overflow: 'auto', paddingBottom: BOTTOM_NAV_HEIGHT }}>
              <Routes>
                <Route path="/" element={<MapPage />} />
                <Route path="/route-detail" element={<RouteDetailPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/notifications" element={<PlaceholderPage title="알림" />} />
                <Route path="/my" element={<MyPage />} />
              </Routes>
            </main>
            <BottomNav />
          </div>
          <UsageTutorial />
        </BrowserRouter>
      </TutorialProvider>
    </AuthProvider>
  )
}

export default App
