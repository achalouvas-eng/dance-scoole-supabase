import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SchoolProvider, useSchool } from './components/SchoolContext'
import { supabase } from './lib/supabaseClient'
import Layout from './Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Students from './pages/Students'
import Welcome from './pages/Welcome'

function RootRedirect() {
  const { currentSchoolId, loading } = useSchool()

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  return <Navigate to={currentSchoolId ? '/Home' : '/Welcome'} replace />
}

function RequireSession({ children }) {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setCheckingSession(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  if (checkingSession) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  if (!session) {
    return <Navigate to="/Login" replace />
  }

  return children
}

function ProtectedRoutes() {
  return (
    <SchoolProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/Welcome" element={<Welcome />} />
        <Route
          path="/Home"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />
        <Route
          path="/Students"
          element={
            <Layout>
              <Students />
            </Layout>
          }
        />
      </Routes>
    </SchoolProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/Login" element={<Login />} />
        <Route
          path="/*"
          element={
            <RequireSession>
              <ProtectedRoutes />
            </RequireSession>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
