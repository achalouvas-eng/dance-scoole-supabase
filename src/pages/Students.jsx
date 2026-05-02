import { useEffect, useMemo, useState } from 'react'
import { useSchool } from '../components/SchoolContext'
import { supabase } from '../lib/supabaseClient'

const greekLetters = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω']
const danceAgeCategories = ['MINI KIDS', 'KIDS', 'JUVENILE 1', 'JUVENILE 2', 'JUNIOR 1', 'JUNIOR 2', 'YOUTH', 'ADULT', 'MASTERS', 'GRAND MASTERS']

function getDanceAgeCategory(dateOfBirth, referenceDate = new Date()) {
  if (!dateOfBirth) return null

  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null

  const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)
  let age = today.getFullYear() - dob.getFullYear()
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate())

  if (!hasHadBirthdayThisYear) {
    age -= 1
  }

  if (age >= 4 && age <= 5) return { label: 'MINI KIDS', range: '4-5 ετών', age }
  if (age >= 6 && age <= 7) return { label: 'KIDS', range: '6-7 ετών', age }
  if (age >= 8 && age <= 9) return { label: 'JUVENILE 1', range: '8-9 ετών', age }
  if (age >= 10 && age <= 11) return { label: 'JUVENILE 2', range: '10-11 ετών', age }
  if (age >= 12 && age <= 13) return { label: 'JUNIOR 1', range: '12-13 ετών', age }
  if (age >= 14 && age <= 15) return { label: 'JUNIOR 2', range: '14-15 ετών', age }
  if (age >= 16 && age <= 20) return { label: 'YOUTH', range: '16-20 ετών', age }
  if (age >= 21 && age <= 34) return { label: 'ADULT', range: '21-34 ετών', age }
  if (age >= 35 && age <= 44) return { label: 'MASTERS', range: '35-44 ετών', age }
  if (age >= 45) return { label: 'GRAND MASTERS', range: '45+ ετών', age }

  return null
}

function getCustomerName(customer) {
  const surname = customer?.surname?.trim() || ''
  const firstName = customer?.first_name?.trim() || ''

  if (surname || firstName) {
    return `${surname} ${firstName}`.trim()
  }

  return customer?.full_name || ''
}

function Students() {
  const { currentSchoolId } = useSchool()
  const [students, setStudents] = useState([])
  const [customers, setCustomers] = useState([])
  const [statusMessage, setStatusMessage] = useState('')
  const [convertPreview, setConvertPreview] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLetter, setSelectedLetter] = useState('Όλα')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [openActionMenuId, setOpenActionMenuId] = useState(null)

  const [fullName, setFullName] = useState('')
  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [studentStatus, setStudentStatus] = useState('active')
  const [customerId, setCustomerId] = useState('')

  async function fetchStudents() {
    if (!currentSchoolId) {
      setStudents([])
      return
    }

    const { data, error } = await supabase
      .from('students')
      .select('*, customers(full_name, surname, first_name)')
      .eq('school_id', currentSchoolId)
      .order('full_name', { ascending: true })

    if (error) {
      setStatusMessage('Error loading students: ' + error.message)
      return
    }

    setStudents(data || [])
  }

  async function fetchCustomers() {
    if (!currentSchoolId) {
      setCustomers([])
      return
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('school_id', currentSchoolId)
      .order('created_at', { ascending: false })

    if (error) {
      setStatusMessage('Error loading customers: ' + error.message)
      return
    }

    setCustomers(data || [])
  }

  async function createStudent() {
    if (!fullName.trim()) {
      setStatusMessage('Student full name is required')
      return
    }

    const payload = {
      school_id: currentSchoolId,
      full_name: fullName.trim(),
      parent_name: parentName,
      email,
      phone,
      date_of_birth: dateOfBirth || null,
      grade_level: gradeLevel || null,
      address: address || null,
      notes: notes || null,
      status: studentStatus,
      customer_id: customerId || null,
    }

    const { error } = await supabase.from('students').insert([payload])

    if (error) {
      setStatusMessage('Error creating student: ' + error.message)
      return
    }

    if (payload.customer_id) {
      try {
        const { error: fetchError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single()

        if (fetchError) {
          console.log('Customer fetch for student sync failed:', fetchError.message)
        } else {
          const updates = {}

          if (email) updates.email = email
          if (phone) updates.phone = phone

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from('customers')
              .update(updates)
              .eq('id', customerId)

            if (updateError) {
              console.log('Customer sync failed:', updateError.message)
            }
          }
        }
      } catch (syncError) {
        console.log('Customer sync failed:', syncError)
      }
    }

    setStatusMessage('Student added')
    setFullName('')
    setParentName('')
    setEmail('')
    setPhone('')
    setDateOfBirth('')
    setGradeLevel('')
    setAddress('')
    setNotes('')
    setStudentStatus('active')
    setCustomerId('')
    setShowCreateForm(false)
    fetchStudents()
  }

  async function deleteStudent(student) {
    if (!window.confirm(`Διαγραφή μαθητή ${student.full_name};`)) return

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', student.id)

    if (error) {
      setStatusMessage('Error deleting student: ' + error.message)
      return
    }

    setStudents((previous) => previous.filter((item) => item.id !== student.id))
    setStatusMessage('Ο μαθητής διαγράφηκε')
  }

  async function previewConvertStudentsToCustomers() {
    if (!currentSchoolId) {
      setConvertPreview(null)
      setStatusMessage('Select a school first')
      return
    }

    const { data: activeStudents, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', currentSchoolId)
      .eq('status', 'active')

    if (studentsError) {
      setStatusMessage('Error loading active students: ' + studentsError.message)
      return
    }

    const { data: schoolCustomers, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .eq('school_id', currentSchoolId)

    if (customersError) {
      setStatusMessage('Error loading customers: ' + customersError.message)
      return
    }

    const customersBySourceStudentId = {}
    const customersBySourceLegacyStudentId = {}
    const warnings = []

    ;(schoolCustomers || []).forEach((customer) => {
      if (customer.source_student_id) {
        if (customersBySourceStudentId[customer.source_student_id]) {
          warnings.push('Duplicate source_student_id among customers: ' + customer.source_student_id)
        }
        customersBySourceStudentId[customer.source_student_id] = customer
      }

      if (customer.source_legacy_student_id) {
        if (customersBySourceLegacyStudentId[customer.source_legacy_student_id]) {
          warnings.push('Duplicate source_legacy_student_id among customers: ' + customer.source_legacy_student_id)
        }
        customersBySourceLegacyStudentId[customer.source_legacy_student_id] = customer
      }
    })

    const preview = {
      activeStudentsFound: activeStudents?.length || 0,
      alreadyLinked: 0,
      wouldLinkExisting: 0,
      wouldCreateCustomers: 0,
      warnings,
    }

    ;(activeStudents || []).forEach((student) => {
      if (!student.full_name?.trim()) {
        preview.warnings.push('Missing full_name for student ' + student.id)
      }

      if (student.customer_id) {
        preview.alreadyLinked += 1
        return
      }

      const existingCustomer =
        customersBySourceStudentId[student.id] ||
        (student.legacy_student_id
          ? customersBySourceLegacyStudentId[student.legacy_student_id]
          : null)

      if (existingCustomer) {
        preview.wouldLinkExisting += 1
      } else {
        preview.wouldCreateCustomers += 1
      }
    })

    setConvertPreview(preview)
    setStatusMessage('Convert preview ready')
  }

  async function executeConvertStudentsToCustomers() {
    if (!window.confirm('Are you sure? This will create customers and link students.')) return

    let created = 0
    let linkedExisting = 0
    let skipped = 0
    const errors = []

    const { data: activeStudents, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', currentSchoolId)
      .eq('status', 'active')

    if (studentsError) {
      setStatusMessage('Error loading active students: ' + studentsError.message)
      return
    }

    const { data: schoolCustomers, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .eq('school_id', currentSchoolId)

    if (customersError) {
      setStatusMessage('Error loading customers: ' + customersError.message)
      return
    }

    const customersBySourceStudentId = {}
    const customersBySourceLegacyStudentId = {}

    ;(schoolCustomers || []).forEach((customer) => {
      if (customer.source_student_id) {
        customersBySourceStudentId[customer.source_student_id] = customer
      }

      if (customer.source_legacy_student_id) {
        customersBySourceLegacyStudentId[customer.source_legacy_student_id] = customer
      }
    })

    for (const student of activeStudents || []) {
      if (student.customer_id) {
        skipped += 1
        continue
      }

      const existingCustomer =
        customersBySourceStudentId[student.id] ||
        (student.legacy_student_id
          ? customersBySourceLegacyStudentId[student.legacy_student_id]
          : null)

      if (existingCustomer) {
        const { error: linkError } = await supabase
          .from('students')
          .update({ customer_id: existingCustomer.id })
          .eq('id', student.id)

        if (linkError) {
          errors.push(`Failed linking student ${student.full_name}: ${linkError.message}`)
          continue
        }

        linkedExisting += 1
        continue
      }

      const studentName = student.full_name?.trim() || ''
      const parts = studentName.split(/\s+/)
      const surname = parts[0] || ''
      const firstName = parts.slice(1).join(' ')
      const fullName = `${surname} ${firstName}`.trim()

      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert([
          {
            school_id: currentSchoolId,
            surname: surname || null,
            first_name: firstName || null,
            full_name: fullName,
            email: student.email || null,
            phone: student.phone || null,
            address: student.address,
            notes: student.notes || `Created from Student: ${student.full_name}`,
            source_student_id: student.id,
            source_legacy_student_id: student.legacy_student_id,
            total_cost: 0,
            amount_paid: 0,
            payment_status: 'pending',
          },
        ])
        .select()
        .maybeSingle()

      if (createError || !newCustomer) {
        errors.push(`Failed creating customer for ${student.full_name}: ${createError?.message || 'No customer returned'}`)
        continue
      }

      created += 1

      const { error: createdLinkError } = await supabase
        .from('students')
        .update({ customer_id: newCustomer.id })
        .eq('id', student.id)

      if (createdLinkError) {
        errors.push(`Created customer but failed linking student ${student.full_name}: ${createdLinkError.message}`)
        continue
      }
    }

    await fetchStudents()
    await fetchCustomers()
    setConvertPreview(null)

    if (errors.length > 0) {
      setStatusMessage(`Conversion finished with errors: ${errors.join(' | ')}`)
      console.log('convert errors', errors)
      return
    }

    setStatusMessage(`Conversion completed. Created: ${created}, linked existing: ${linkedExisting}, skipped: ${skipped}`)
  }

  useEffect(() => {
    fetchStudents()
    fetchCustomers()
  }, [currentSchoolId])

  const activeStudentsCount = students.filter((student) => (student.status || 'active') === 'active').length
  const inactiveStudentsCount = students.filter((student) => student.status === 'inactive').length

  const filteredStudents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return students.filter((student) => {
      const name = student.full_name || ''
      const searchableText = [student.full_name, student.parent_name, student.email, student.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (normalizedSearch && !searchableText.includes(normalizedSearch)) {
        return false
      }

      if (selectedLetter !== 'Όλα' && !name.trim().toUpperCase().startsWith(selectedLetter)) {
        return false
      }

      if (categoryFilter === 'active' && (student.status || 'active') !== 'active') {
        return false
      }

      if (categoryFilter === 'inactive' && student.status !== 'inactive') {
        return false
      }

      if (categoryFilter === 'linked' && !student.customer_id) {
        return false
      }

      if (categoryFilter === 'unlinked' && student.customer_id) {
        return false
      }

      const danceCategory = getDanceAgeCategory(student.date_of_birth)

      if (danceAgeCategories.includes(categoryFilter) && danceCategory?.label !== categoryFilter) {
        return false
      }

      if (categoryFilter === 'no_age_category' && danceCategory) {
        return false
      }

      return true
    })
  }, [students, searchTerm, selectedLetter, categoryFilter])

  function toggleSelectedStudent(studentId) {
    setSelectedStudentIds((previous) =>
      previous.includes(studentId)
        ? previous.filter((id) => id !== studentId)
        : [...previous, studentId]
    )
  }

  function toggleAllVisibleStudents() {
    if (filteredStudents.length > 0 && filteredStudents.every((student) => selectedStudentIds.includes(student.id))) {
      setSelectedStudentIds((previous) => previous.filter((id) => !filteredStudents.some((student) => student.id === id)))
      return
    }

    setSelectedStudentIds((previous) => Array.from(new Set([...previous, ...filteredStudents.map((student) => student.id)])))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#eaf0f8', width: '100%', padding: '34px 20px 48px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, color: '#111827', letterSpacing: 0 }}>Μαθητές</h1>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 16 }}>Διαχείριση μαθητών</p>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setStatusMessage('Δεν έχει υλοποιηθεί ακόμα')} style={actionButtonStyle('#2563eb', '#eff6ff')}>
              Πρότυπο Excel
            </button>
            <button type="button" onClick={() => setStatusMessage('Δεν έχει υλοποιηθεί ακόμα')} style={actionButtonStyle('#059669', '#ecfdf5')}>
              Εισαγωγή Excel
            </button>
            <button type="button" onClick={previewConvertStudentsToCustomers} style={actionButtonStyle('#7c3aed', '#f5f3ff')}>
              Μετατροπή σε Πελάτες
            </button>
            <button type="button" onClick={() => setShowCreateForm(true)} style={{ ...actionButtonStyle('#ffffff', '#4f46e5'), borderColor: '#4f46e5', color: '#ffffff' }}>
              + Νέος Μαθητής
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard label="Σύνολο" value={students.length} color="#4f46e5" background="#ffffff" />
          <StatCard label="Ενεργοί" value={activeStudentsCount} color="#059669" background="#ffffff" />
          <StatCard label="Ανενεργοί" value={inactiveStudentsCount} color="#e11d48" background="#ffffff" />
        </div>

        <div style={{ background: '#ffffff', borderRadius: 14, padding: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', marginBottom: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 190px', gap: 12, marginBottom: 14 }}>
            <input
              placeholder="Αναζήτηση μαθητή..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              style={{ height: 42, border: '1px solid #dbe3ef', borderRadius: 8, padding: '0 14px', fontSize: 15, background: '#f8fafc', color: '#1f2937' }}
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              style={{ height: 42, border: '1px solid #dbe3ef', borderRadius: 8, padding: '0 12px', fontSize: 15, background: '#ffffff', color: '#1f2937' }}
            >
              <option value="all">Όλες οι Κατηγορίες</option>
              <option value="active">Ενεργοί</option>
              <option value="inactive">Ανενεργοί</option>
              <option value="linked">Συνδεδεμένοι με Πελάτη</option>
              <option value="unlinked">Χωρίς σύνδεση</option>
              {danceAgeCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
              <option value="no_age_category">Χωρίς Κατηγορία</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => setSelectedLetter('Όλα')} style={letterButtonStyle(selectedLetter === 'Όλα')}>
              Όλα
            </button>
            {greekLetters.map((letter) => (
              <button key={letter} type="button" onClick={() => setSelectedLetter(letter)} style={letterButtonStyle(selectedLetter === letter)}>
                {letter}
              </button>
            ))}
          </div>
        </div>

        {statusMessage && (
          <div style={{ background: '#ffffff', border: '1px solid #dbe3ef', borderRadius: 10, padding: '10px 14px', color: '#475569', marginBottom: 16 }}>
            {statusMessage}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 14, margin: '0 4px 10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={filteredStudents.length > 0 && filteredStudents.every((student) => selectedStudentIds.includes(student.id))}
              onChange={toggleAllVisibleStudents}
            />
            Επιλογή όλων
          </label>
          <span>{filteredStudents.length} μαθητές</span>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 12, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', overflow: 'visible', marginBottom: 22 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: 13, textAlign: 'left' }}>
                <th style={{ width: 48, padding: '12px 14px' }}></th>
                <th style={{ padding: '12px 14px' }}>Όνομα</th>
                <th style={{ width: 150, padding: '12px 14px' }}>Κατάσταση</th>
                <th style={{ width: 180, padding: '12px 14px' }}>Σύνδεση Πελάτη</th>
                <th style={{ width: 86, padding: '12px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const danceCategory = getDanceAgeCategory(student.date_of_birth)

                return (
                <tr key={student.id} style={{ borderTop: '1px solid #edf2f7', color: '#1f2937', position: 'relative' }}>
                  <td style={{ padding: '13px 14px' }}>
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={() => toggleSelectedStudent(student.id)}
                    />
                  </td>
                  <td style={{ padding: '13px 14px' }}>
                    <div style={{ fontWeight: 800, letterSpacing: 0, wordBreak: 'normal', overflowWrap: 'break-word' }}>{student.full_name}</div>
                    {student.parent_name && (
                      <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>· {student.parent_name}</div>
                    )}
                  </td>
                  <td style={{ padding: '13px 14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span style={statusBadgeStyle(student.status)}>{student.status === 'inactive' ? 'Ανενεργός' : 'Ενεργός'}</span>
                      {danceCategory && <span style={ageCategoryBadgeStyle}>{danceCategory.label}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '13px 14px' }}>
                    <span style={linkBadgeStyle(Boolean(student.customers))}>
                      {student.customers ? '↔ Πελάτης' : 'Χωρίς σύνδεση'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 14px', textAlign: 'right', position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setOpenActionMenuId(openActionMenuId === student.id ? null : student.id)}
                      style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}
                    >
                      ⋮
                    </button>
                    {openActionMenuId === student.id && (
                      <div style={{ position: 'absolute', right: 12, top: 40, width: 150, background: '#ffffff', border: '1px solid #dbe3ef', borderRadius: 10, boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)', zIndex: 20, padding: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionMenuId(null)
                            setStatusMessage('Επεξεργασία μαθητή: δεν έχει υλοποιηθεί ακόμα')
                          }}
                          style={menuItemStyle}
                        >
                          Επεξεργασία
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionMenuId(null)
                            deleteStudent(student)
                          }}
                          style={{ ...menuItemStyle, color: '#dc2626' }}
                        >
                          Διαγραφή
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>Δεν βρέθηκαν μαθητές</div>
          )}
        </div>

        {convertPreview && (
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', marginBottom: 22 }}>
            <h2 style={{ margin: '0 0 14px', color: '#111827', fontSize: 22 }}>Προεπισκόπηση Μετατροπής</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
              <PreviewStat label="Active students found" value={convertPreview.activeStudentsFound} />
              <PreviewStat label="Already linked" value={convertPreview.alreadyLinked} />
              <PreviewStat label="Would link existing" value={convertPreview.wouldLinkExisting} />
              <PreviewStat label="Would create customers" value={convertPreview.wouldCreateCustomers} />
            </div>
            <p style={{ margin: '0 0 10px', color: convertPreview.warnings.length > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>
              Warnings: {convertPreview.warnings.length}
            </p>
            {convertPreview.warnings.length > 0 && (
              <ul style={{ margin: '0 0 14px', color: '#dc2626' }}>
                {convertPreview.warnings.map((warning, index) => (
                  <li key={warning + '-' + index}>{warning}</li>
                ))}
              </ul>
            )}
            {convertPreview.warnings.length === 0 && (
              <button type="button" onClick={executeConvertStudentsToCustomers} style={{ ...actionButtonStyle('#ffffff', '#4f46e5'), borderColor: '#4f46e5', color: '#ffffff' }}>
                Execute Convert Students to Customers
              </button>
            )}
          </div>
        )}
      </div>

      {showCreateForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.62)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 'min(620px, 100%)', maxHeight: '92vh', overflow: 'auto', background: '#ffffff', borderRadius: 14, padding: 24, boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: '#111827' }}>Νέος Μαθητής</h2>
              <button type="button" onClick={() => setShowCreateForm(false)} style={{ border: 0, background: 'transparent', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <StudentField label="Επώνυμο Όνομα *" value={fullName} onChange={setFullName} placeholder="π.χ. Παπαδόπουλος Γιάννης" />
              <StudentField label="Όνομα Γονέα" value={parentName} onChange={setParentName} />
              <StudentField label="Email" value={email} onChange={setEmail} />
              <StudentField label="Τηλέφωνο" value={phone} onChange={setPhone} />
              <StudentField label="Ημερομηνία Γέννησης" type="date" value={dateOfBirth} onChange={setDateOfBirth} />
              <StudentField label="Τάξη / Επίπεδο" value={gradeLevel} onChange={setGradeLevel} />
              <label style={{ ...fieldLabelStyle, gridColumn: '1 / -1' }}>
                Διεύθυνση
                <input value={address} onChange={(event) => setAddress(event.target.value)} style={fieldInputStyle} />
              </label>
              <label style={fieldLabelStyle}>
                Κατάσταση
                <select value={studentStatus} onChange={(event) => setStudentStatus(event.target.value)} style={fieldInputStyle}>
                  <option value="active">Ενεργός</option>
                  <option value="inactive">Ανενεργός</option>
                </select>
              </label>
              <label style={fieldLabelStyle}>
                Σύνδεση με Πελάτη
                <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} style={fieldInputStyle}>
                  <option value="">Χωρίς σύνδεση</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {getCustomerName(customer)}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ ...fieldLabelStyle, gridColumn: '1 / -1' }}>
                Σημειώσεις
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...fieldInputStyle, minHeight: 92, padding: 11, resize: 'vertical' }} />
              </label>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, color: '#b45309', padding: '10px 12px', fontSize: 13, marginTop: 16 }}>
              Κατά την αποθήκευση, το email και το τηλέφωνο θα συγχρονιστούν με τον συνδεδεμένο πελάτη.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setShowCreateForm(false)} style={actionButtonStyle('#334155', '#ffffff')}>
                Ακύρωση
              </button>
              <button type="button" onClick={createStudent} style={{ ...actionButtonStyle('#ffffff', '#4f46e5'), borderColor: '#4f46e5', color: '#ffffff' }}>
                Δημιουργία Μαθητή
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, background }) {
  const softBackground = color + '12'

  return (
    <div style={{ background, borderRadius: 12, padding: '18px 20px', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: softBackground, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
        {label.slice(0, 1)}
      </div>
      <div>
        <div style={{ color: '#64748b', fontSize: 14 }}>{label}</div>
        <div style={{ color, fontWeight: 900, fontSize: 22 }}>{value}</div>
      </div>
    </div>
  )
}

function PreviewStat({ label, value }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc' }}>
      <div style={{ color: '#64748b', fontSize: 13 }}>{label}</div>
      <div style={{ color: '#111827', fontSize: 22, fontWeight: 900 }}>{value}</div>
    </div>
  )
}

function StudentField({ label, type = 'text', value, onChange, placeholder = '' }) {
  return (
    <label style={fieldLabelStyle}>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={fieldInputStyle} />
    </label>
  )
}

function actionButtonStyle(color, background) {
  return {
    minHeight: 38,
    border: '1px solid #dbe3ef',
    borderRadius: 8,
    padding: '0 15px',
    background,
    color,
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: 0,
  }
}

function letterButtonStyle(active) {
  return {
    border: 0,
    borderRadius: 6,
    background: active ? '#4f46e5' : '#f1f5f9',
    color: active ? '#ffffff' : '#334155',
    minWidth: 28,
    height: 28,
    padding: '0 8px',
    fontWeight: 800,
    cursor: 'pointer',
  }
}

function statusBadgeStyle(status) {
  const inactive = status === 'inactive'

  return {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 800,
    color: inactive ? '#475569' : '#047857',
    background: inactive ? '#e2e8f0' : '#d1fae5',
  }
}

const ageCategoryBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
  fontWeight: 800,
  color: '#4f46e5',
  background: '#eef2ff',
}

function linkBadgeStyle(linked) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 800,
    color: linked ? '#047857' : '#64748b',
    background: linked ? '#ecfdf5' : '#f1f5f9',
  }
}

const menuItemStyle = {
  width: '100%',
  border: 0,
  background: 'transparent',
  textAlign: 'left',
  padding: '9px 10px',
  borderRadius: 8,
  cursor: 'pointer',
  color: '#1f2937',
  fontWeight: 700,
}

const fieldLabelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: '#334155',
  fontWeight: 800,
  fontSize: 14,
}

const fieldInputStyle = {
  height: 40,
  border: '1px solid #dbe3ef',
  borderRadius: 8,
  padding: '0 11px',
  color: '#1f2937',
  background: '#ffffff',
  fontSize: 14,
}

export default Students
