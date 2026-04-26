import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import OlusturPage from './pages/OlusturPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/olustur" element={<OlusturPage />} />
    </Routes>
  )
}

export default App
