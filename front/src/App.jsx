import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import MapPage from './pages/MapPage'
import RouteSearchPage from './pages/RouteSearchPage'
import ReportPage from './pages/ReportPage'
import RouteDetailPage from './pages/RouteDetailPage'
import LoginPage from './pages/LoginPage'
import PlaceholderPage from './pages/PlaceholderPage'
import { colors } from './styles/colors'

function App() {
  return (
    <BrowserRouter>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          background: colors.background,
        }}
      >
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/route-search" element={<RouteSearchPage />} />
            <Route path="/route-detail" element={<RouteDetailPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/favorites" element={<PlaceholderPage title="즐겨찾기" />} />
            <Route path="/notifications" element={<PlaceholderPage title="알림" />} />
            <Route path="/my" element={<PlaceholderPage title="마이페이지" />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App
