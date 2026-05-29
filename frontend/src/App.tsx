import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import ProblemList from './pages/ProblemList'
import ProblemDetail from './pages/ProblemDetail'
import AdminPanel from './pages/AdminPanel'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/problems" element={<ProblemList />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Route>
      <Route path="/problem/:id" element={<ProblemDetail />} />
    </Routes>
  )
}
