import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import OlusturPage from './pages/OlusturPage'
import DilekcePage from './pages/DilekcePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/olustur" element={<OlusturPage />} />
      <Route path="/dilekce" element={<DilekcePage />} />
    </Routes>
  )
}

export default App
