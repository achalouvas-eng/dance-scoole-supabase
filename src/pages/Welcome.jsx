import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSchool } from '../components/SchoolContext'

function Welcome() {
  const { accessibleSchools, currentSchoolId, loading, selectSchool } = useSchool()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && currentSchoolId) {
      navigate('/Home')
    }
  }, [currentSchoolId, loading, navigate])

  async function handleSelectSchool(schoolId) {
    await selectSchool(schoolId)
    navigate('/Home')
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome</h1>
      <h2>Select School</h2>

      {accessibleSchools.length === 0 ? (
        <p>No schools available.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
          {accessibleSchools.map((school) => (
            <button
              key={school.id}
              onClick={() => handleSelectSchool(school.id)}
              style={{
                padding: 16,
                textAlign: 'left',
                border: '1px solid #ccc',
                borderRadius: 8,
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 6,
                  borderRadius: 999,
                  background: school.color || '#6366f1',
                  marginBottom: 8,
                }}
              />
              <strong>{school.name}</strong>
              {school.address && <div>{school.address}</div>}
              {school.phone && <div>{school.phone}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default Welcome
