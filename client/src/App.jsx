import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import LobbyPage from './pages/LobbyPage'
import BattlePage from './pages/BattlePage'
import { getSession } from './lib/session'
import { LanguageProvider } from './context/LanguageContext'

function RequireAuth({ children }) {
  return getSession() ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/lobby" element={<RequireAuth><LobbyPage /></RequireAuth>} />
          <Route path="/battle" element={<RequireAuth><BattlePage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}
