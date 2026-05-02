import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const SchoolContext = createContext(null)

export function SchoolProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [accessibleSchools, setAccessibleSchools] = useState([])
  const [currentSchoolId, setCurrentSchoolId] = useState(() => localStorage.getItem('currentSchoolId') || '')
  const [loading, setLoading] = useState(true)

  const currentSchool = useMemo(
    () => accessibleSchools.find((school) => school.id === currentSchoolId) || null,
    [accessibleSchools, currentSchoolId],
  )

  useEffect(() => {
    loadSchoolContext()

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadSchoolContext()
    })

    return () => data.subscription.unsubscribe()
  }, [])

  async function loadSchoolContext() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const authUser = userData?.user || null
    setUser(authUser)

    if (!authUser) {
      setProfile(null)
      setAccessibleSchools([])
      setCurrentSchoolId('')
      localStorage.removeItem('currentSchoolId')
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()

    setProfile(profileData || null)

    let schools = []

    if (profileData?.role === 'admin') {
      const { data: allSchools } = await supabase
        .from('schools')
        .select('*')
        .order('name', { ascending: true })

      schools = allSchools || []
    } else {
      const { data: accessRows } = await supabase
        .from('user_school_access')
        .select('schools(*)')
        .eq('user_id', authUser.id)

      schools = (accessRows || [])
        .map((row) => row.schools)
        .filter(Boolean)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }

    setAccessibleSchools(schools)

    const storedSchoolId = localStorage.getItem('currentSchoolId') || ''
    const candidateSchoolId = storedSchoolId || profileData?.last_school_id || ''
    const hasCandidateAccess = schools.some((school) => school.id === candidateSchoolId)
    const nextSchoolId = hasCandidateAccess ? candidateSchoolId : schools[0]?.id || ''

    setCurrentSchoolId(nextSchoolId)

    if (nextSchoolId) {
      localStorage.setItem('currentSchoolId', nextSchoolId)
    } else {
      localStorage.removeItem('currentSchoolId')
    }

    setLoading(false)
  }

  async function selectSchool(schoolId) {
    const hasAccess = accessibleSchools.some((school) => school.id === schoolId)

    if (!hasAccess) return

    setCurrentSchoolId(schoolId)
    localStorage.setItem('currentSchoolId', schoolId)

    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ last_school_id: schoolId })
        .eq('id', user.id)
    }
  }

  return (
    <SchoolContext.Provider
      value={{
        user,
        profile,
        currentSchool,
        currentSchoolId,
        accessibleSchools,
        loading,
        selectSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  return useContext(SchoolContext)
}
