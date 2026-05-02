import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSchool } from './components/SchoolContext'
import { supabase } from './lib/supabaseClient'

function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    accessibleSchools,
    currentSchool,
    currentSchoolId,
    loading,
    selectSchool,
  } = useSchool()

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  if (!currentSchoolId) {
    return <Navigate to="/Welcome" replace />
  }

  const currentPageValue =
    location.pathname === '/Home' ? '/Home' :
    location.pathname === '/Students' ? '/Students' :
    location.pathname === '/Welcome' ? '/Welcome' :
    '/Home'

  async function handlePageChange(value) {
    if (value === 'logout') {
      await supabase.auth.signOut()
      localStorage.removeItem('currentSchoolId')
      navigate('/Login', { replace: true })
      return
    }

    navigate(value)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#eaf0f8' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #dbe3ef', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ marginRight: 'auto', minWidth: 220 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>
              Διαχείριση Πελατών
            </div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Χορευτική σεζόν 2025-2026
            </div>
          </div>

          <select
            value={currentSchoolId}
            onChange={(event) => selectSchool(event.target.value)}
            style={navSelectStyle('#4f46e5', '#eef2ff')}
            title={currentSchool?.name || 'School'}
          >
            {accessibleSchools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>

          <select value="2025-2026" onChange={() => {}} style={navSelectStyle('#7c3aed', '#f5f3ff')}>
            <option value="2025-2026">2025-2026</option>
          </select>

          <select
            value={currentPageValue}
            onChange={(event) => handlePageChange(event.target.value)}
            style={navSelectStyle('#334155', '#f8fafc')}
          >
            <option value="/Home">Account Μαθητών</option>
            <option value="/Students">Μαθητές</option>
            <option value="/Welcome">Welcome / αλλαγή σχολής</option>
            <option value="logout">Αποσύνδεση</option>
          </select>
        </div>
      </nav>

      <main>
        {children}
      </main>
    </div>
  )
}

function navSelectStyle(color, background) {
  return {
    height: 38,
    minWidth: 150,
    border: `1px solid ${color}33`,
    background,
    color,
    borderRadius: 8,
    padding: '0 12px',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

export default Layout
