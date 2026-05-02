import { useEffect, useMemo, useState } from 'react'
import { useSchool } from '../components/SchoolContext'
import { supabase } from '../lib/supabaseClient'

function getCustomerName(customer) {
  const surname = customer?.surname?.trim() || ''
  const firstName = customer?.first_name?.trim() || ''

  if (surname || firstName) {
    return `${surname} ${firstName}`.trim()
  }

  return customer?.full_name || ''
}

function getDanceAgeCategory(dateOfBirth, referenceDate = new Date()) {
  if (!dateOfBirth) return null

  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null

  const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }

  if (age >= 4 && age <= 5) return { label: 'MINI KIDS', range: '4-5' }
  if (age >= 6 && age <= 7) return { label: 'KIDS', range: '6-7' }
  if (age >= 8 && age <= 9) return { label: 'JUVENILE 1', range: '8-9' }
  if (age >= 10 && age <= 11) return { label: 'JUVENILE 2', range: '10-11' }
  if (age >= 12 && age <= 13) return { label: 'JUNIOR 1', range: '12-13' }
  if (age >= 14 && age <= 15) return { label: 'JUNIOR 2', range: '14-15' }
  if (age >= 16 && age <= 20) return { label: 'YOUTH', range: '16-20' }
  if (age >= 21 && age <= 34) return { label: 'ADULT', range: '21-34' }
  if (age >= 35 && age <= 44) return { label: 'MASTERS', range: '35-44' }
  if (age >= 45) return { label: 'GRAND MASTERS', range: '45+' }

  return null
}

function calculateCustomerFinancials(charges, payments) {
  const activeCharges = charges
    .filter((charge) => charge.status !== 'cancelled')
    .sort((a, b) => new Date(a.charge_date || a.created_at || 0) - new Date(b.charge_date || b.created_at || 0))

  const validPayments = payments
    .filter((payment) => payment.status === 'completed')
    .sort((a, b) => new Date(a.payment_date || a.created_at || 0) - new Date(b.payment_date || b.created_at || 0))

  const remainingPayments = validPayments.map((payment) => ({
    ...payment,
    remaining: Number(payment.amount),
  }))

  let allocated = 0

  for (const charge of activeCharges) {
    let remainingCharge = Number(charge.amount)

    for (const payment of remainingPayments) {
      if (payment.remaining <= 0) continue
      if (remainingCharge <= 0) break

      const amountToAllocate = Math.min(payment.remaining, remainingCharge)

      payment.remaining -= amountToAllocate
      remainingCharge -= amountToAllocate
      allocated += amountToAllocate
    }
  }

  const totalCharges = activeCharges.reduce((sum, charge) => sum + Number(charge.amount), 0)
  const totalPayments = validPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const openBalance = Math.max(0, totalCharges - allocated)
  const creditBalance = Math.max(0, totalPayments - allocated)

  return {
    totalCharges,
    totalPayments,
    allocated,
    openBalance,
    creditBalance,
  }
}

function Home() {
  const { currentSchoolId } = useSchool()
  const [customers, setCustomers] = useState([])
  const [students, setStudents] = useState([])
  const [charges, setCharges] = useState([])
  const [payments, setPayments] = useState([])
  const [status, setStatus] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeDescription, setChargeDescription] = useState('')

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLetter, setSelectedLetter] = useState('all')
  const [financialFilter, setFinancialFilter] = useState('all')
  const [ageCategoryFilter, setAgeCategoryFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const [openCustomerMenuId, setOpenCustomerMenuId] = useState(null)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editSurname, setEditSurname] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const studentsByCustomerId = useMemo(() => {
    const map = {}

    for (const student of students) {
      if (student.customer_id) {
        map[student.customer_id] = student
      }
    }

    return map
  }, [students])

  const [editPaymentStatus, setEditPaymentStatus] = useState('pending')
  const [editStartDate, setEditStartDate] = useState('')
  const [editNextPaymentDate, setEditNextPaymentDate] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [creditPaymentMethod, setCreditPaymentMethod] = useState('cash')
  const [creditSubtractAmount, setCreditSubtractAmount] = useState('')
  const [modalChargeAmount, setModalChargeAmount] = useState('')
  const [modalChargeDescription, setModalChargeDescription] = useState('')
  const [modalChargeCategory, setModalChargeCategory] = useState('other')
  const [modalChargeDate, setModalChargeDate] = useState('')
  const [modalPaymentAmount, setModalPaymentAmount] = useState('')
  const [modalPaymentMethod, setModalPaymentMethod] = useState('cash')
  const [modalPaymentDate, setModalPaymentDate] = useState('')
  const [monthlyMonth, setMonthlyMonth] = useState('')
  const [monthlyTotalCost, setMonthlyTotalCost] = useState('')
  const [monthlyAmountPaid, setMonthlyAmountPaid] = useState('')
  const [monthlyPaidWithPos, setMonthlyPaidWithPos] = useState(false)
  const [monthlyPaymentDate, setMonthlyPaymentDate] = useState('')
  const [selectedMonthlyChargeId, setSelectedMonthlyChargeId] = useState(null)
  const [editingMonthlyMonth, setEditingMonthlyMonth] = useState('')
  const [editingMonthlyCost, setEditingMonthlyCost] = useState('')
  const [editingMonthlyPaid, setEditingMonthlyPaid] = useState('')
  const [editingMonthlyPaymentDate, setEditingMonthlyPaymentDate] = useState('')
  const [editingMonthlyPaidWithPos, setEditingMonthlyPaidWithPos] = useState(false)
  const [privateDate, setPrivateDate] = useState('')
  const [privateTotalCost, setPrivateTotalCost] = useState('')
  const [privateAmountPaid, setPrivateAmountPaid] = useState('')
  const [privatePaidWithPos, setPrivatePaidWithPos] = useState(false)
  const [privatePaymentDate, setPrivatePaymentDate] = useState('')
  const [selectedPrivateChargeId, setSelectedPrivateChargeId] = useState(null)
  const [editingPrivateDate, setEditingPrivateDate] = useState('')
  const [editingPrivateCost, setEditingPrivateCost] = useState('')
  const [editingPrivatePaid, setEditingPrivatePaid] = useState('')
  const [editingPrivatePaymentDate, setEditingPrivatePaymentDate] = useState('')
  const [editingPrivatePaidWithPos, setEditingPrivatePaidWithPos] = useState(false)
  const [competitionDate, setCompetitionDate] = useState('')
  const [competitionDescription, setCompetitionDescription] = useState('')
  const [competitionAmount, setCompetitionAmount] = useState('')
  const [competitionAmountPaid, setCompetitionAmountPaid] = useState('')
  const [competitionPaidWithPos, setCompetitionPaidWithPos] = useState(false)
  const [competitionPaymentDate, setCompetitionPaymentDate] = useState('')
  const [selectedCompetitionChargeId, setSelectedCompetitionChargeId] = useState(null)
  const [editingCompetitionDate, setEditingCompetitionDate] = useState('')
  const [editingCompetitionDescription, setEditingCompetitionDescription] = useState('')
  const [editingCompetitionCost, setEditingCompetitionCost] = useState('')
  const [editingCompetitionPaid, setEditingCompetitionPaid] = useState('')
  const [editingCompetitionPaymentDate, setEditingCompetitionPaymentDate] = useState('')
  const [editingCompetitionPaidWithPos, setEditingCompetitionPaidWithPos] = useState(false)

  async function fetchCustomers() {
    if (!currentSchoolId) {
      setCustomers([])
      return
    }

    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('school_id', currentSchoolId)
      .order('created_at', { ascending: false })

    setCustomers(data || [])
  }

  async function fetchStudents() {
    if (!currentSchoolId) {
      setStudents([])
      return
    }

    const { data } = await supabase
      .from('students')
      .select('id, customer_id, full_name, date_of_birth, status')
      .eq('school_id', currentSchoolId)
      .not('customer_id', 'is', null)

    setStudents(data || [])
  }

  async function fetchCharges() {
    if (!currentSchoolId) {
      setCharges([])
      return
    }

    const { data } = await supabase
      .from('charges')
      .select('*, customers(full_name, surname, first_name)')
      .eq('school_id', currentSchoolId)
      .order('created_at', { ascending: false })

    setCharges(data || [])
  }

  async function fetchPayments() {
    if (!currentSchoolId) {
      setPayments([])
      return
    }

    const { data } = await supabase
      .from('payments')
      .select('*, customers(full_name, surname, first_name)')
      .eq('school_id', currentSchoolId)
      .order('created_at', { ascending: false })

    setPayments(data || [])
  }

  async function createCustomer() {
    if (!name.trim()) {
      setStatus('❌ Customer name is required')
      return
    }

    const { error } = await supabase
      .from('customers')
      .insert([{ full_name: name, phone, email, school_id: currentSchoolId }])

    if (error) {
      setStatus('❌ ' + error.message)
    } else {
      setStatus('✅ Customer added')
      setName('')
      setPhone('')
      setEmail('')
      fetchCustomers()
    }
  }

  async function createCharge() {
    if (!selectedCustomer) {
      setStatus('❌ Select a customer for the charge')
      return
    }

    if (Number(chargeAmount) <= 0) {
      setStatus('❌ Charge amount must be greater than 0')
      return
    }

    const { error } = await supabase
      .from('charges')
      .insert([
        {
          customer_id: selectedCustomer,
          school_id: currentSchoolId,
          amount: Number(chargeAmount),
          description: chargeDescription,
          charge_date: new Date().toISOString().slice(0, 10),
          status: 'open',
          source_type: 'manual',
        },
      ])

    if (error) {
      setStatus('❌ ' + error.message)
    } else {
      setStatus('💰 Charge added')
      setChargeAmount('')
      setChargeDescription('')
      fetchCharges()
    }
  }

  async function createPayment() {
    if (!selectedCustomer) {
      setStatus('❌ Select a customer for the payment')
      return
    }

    if (Number(paymentAmount) <= 0) {
      setStatus('❌ Payment amount must be greater than 0')
      return
    }

    const { error } = await supabase
      .from('payments')
      .insert([
        {
          customer_id: selectedCustomer,
          school_id: currentSchoolId,
          amount: Number(paymentAmount),
          method: paymentMethod || 'cash',
          payment_date: new Date().toISOString().slice(0, 10),
          status: 'completed',
          source_type: 'manual',
        },
      ])

    if (error) {
      setStatus('❌ ' + error.message)
    } else {
      setStatus('💵 Payment added')
      setPaymentAmount('')
      setPaymentMethod('cash')
      fetchPayments()
    }
  }

  function openEditCustomer(customer) {
    let surname = customer.surname || ''
    let firstName = customer.first_name || ''

    if (!surname && !firstName && customer.full_name) {
      const parts = customer.full_name.trim().split(/\s+/)
      surname = parts[0] || ''
      firstName = parts.slice(1).join(' ')
    }

    setEditingCustomer(customer)
    setEditSurname(surname)
    setEditFirstName(firstName)
    setEditEmail(customer.email || '')
    setEditPhone(customer.phone || '')
    setEditAddress(customer.address || '')
    setEditNotes(customer.notes || '')
    setEditPaymentStatus(customer.payment_status || 'pending')
    setEditStartDate(customer.start_date || '')
    setEditNextPaymentDate(customer.next_payment_date || '')
    setCreditAmount('')
    setCreditPaymentMethod('cash')
    setCreditSubtractAmount('')
    setModalChargeAmount('')
    setModalChargeDescription('')
    setModalChargeCategory('other')
    setModalChargeDate('')
    setModalPaymentAmount('')
    setModalPaymentMethod('cash')
    setModalPaymentDate('')
    setMonthlyMonth('')
    setMonthlyTotalCost('')
    setMonthlyAmountPaid('')
    setMonthlyPaidWithPos(false)
    setMonthlyPaymentDate('')
    setSelectedMonthlyChargeId(null)
    setEditingMonthlyMonth('')
    setEditingMonthlyCost('')
    setEditingMonthlyPaid('')
    setEditingMonthlyPaymentDate('')
    setEditingMonthlyPaidWithPos(false)
    setPrivateDate('')
    setPrivateTotalCost('')
    setPrivateAmountPaid('')
    setPrivatePaidWithPos(false)
    setPrivatePaymentDate('')
    setSelectedPrivateChargeId(null)
    setEditingPrivateDate('')
    setEditingPrivateCost('')
    setEditingPrivatePaid('')
    setEditingPrivatePaymentDate('')
    setEditingPrivatePaidWithPos(false)
    setCompetitionDate('')
    setCompetitionDescription('')
    setCompetitionAmount('')
    setCompetitionAmountPaid('')
    setCompetitionPaidWithPos(false)
    setCompetitionPaymentDate('')
    setSelectedCompetitionChargeId(null)
    setEditingCompetitionDate('')
    setEditingCompetitionDescription('')
    setEditingCompetitionCost('')
    setEditingCompetitionPaid('')
    setEditingCompetitionPaymentDate('')
    setEditingCompetitionPaidWithPos(false)
  }

  function closeEditCustomer() {
    setEditingCustomer(null)
    setEditSurname('')
    setEditFirstName('')
    setEditEmail('')
    setEditPhone('')
    setEditAddress('')
    setEditNotes('')
    setEditPaymentStatus('pending')
    setEditStartDate('')
    setEditNextPaymentDate('')
    setCreditAmount('')
    setCreditPaymentMethod('cash')
    setCreditSubtractAmount('')
    setModalChargeAmount('')
    setModalChargeDescription('')
    setModalChargeCategory('other')
    setModalChargeDate('')
    setModalPaymentAmount('')
    setModalPaymentMethod('cash')
    setModalPaymentDate('')
    setMonthlyMonth('')
    setMonthlyTotalCost('')
    setMonthlyAmountPaid('')
    setMonthlyPaidWithPos(false)
    setMonthlyPaymentDate('')
    setSelectedMonthlyChargeId(null)
    setEditingMonthlyMonth('')
    setEditingMonthlyCost('')
    setEditingMonthlyPaid('')
    setEditingMonthlyPaymentDate('')
    setEditingMonthlyPaidWithPos(false)
    setPrivateDate('')
    setPrivateTotalCost('')
    setPrivateAmountPaid('')
    setPrivatePaidWithPos(false)
    setPrivatePaymentDate('')
    setSelectedPrivateChargeId(null)
    setEditingPrivateDate('')
    setEditingPrivateCost('')
    setEditingPrivatePaid('')
    setEditingPrivatePaymentDate('')
    setEditingPrivatePaidWithPos(false)
    setCompetitionDate('')
    setCompetitionDescription('')
    setCompetitionAmount('')
    setCompetitionAmountPaid('')
    setCompetitionPaidWithPos(false)
    setCompetitionPaymentDate('')
    setSelectedCompetitionChargeId(null)
    setEditingCompetitionDate('')
    setEditingCompetitionDescription('')
    setEditingCompetitionCost('')
    setEditingCompetitionPaid('')
    setEditingCompetitionPaymentDate('')
    setEditingCompetitionPaidWithPos(false)
  }

  async function createModalCharge() {
    if (!editingCustomer) return

    if (Number(modalChargeAmount) <= 0) {
      setStatus('❌ Το ποσό χρέωσης πρέπει να είναι μεγαλύτερο από 0')
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('charges')
      .insert([
        {
          customer_id: editingCustomer.id,
          school_id: currentSchoolId,
          amount: Number(modalChargeAmount),
          description: modalChargeDescription,
          category: modalChargeCategory,
          charge_date: modalChargeDate || today,
          status: 'open',
          source_type: 'manual',
        },
      ])

    if (error) {
      setStatus('❌ ' + error.message)
      return
    }

    setModalChargeAmount('')
    setModalChargeDescription('')
    setModalChargeCategory('other')
    setModalChargeDate('')
    await fetchCharges()
    setStatus('Η χρέωση καταχωρήθηκε')
  }

  async function createModalPayment() {
    if (!editingCustomer) return

    if (Number(modalPaymentAmount) <= 0) {
      setStatus('❌ Το ποσό πληρωμής πρέπει να είναι μεγαλύτερο από 0')
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('payments')
      .insert([
        {
          customer_id: editingCustomer.id,
          school_id: currentSchoolId,
          amount: Number(modalPaymentAmount),
          method: modalPaymentMethod,
          payment_date: modalPaymentDate || today,
          status: 'completed',
          source_type: 'manual',
        },
      ])

    if (error) {
      setStatus('❌ ' + error.message)
      return
    }

    setModalPaymentAmount('')
    setModalPaymentMethod('cash')
    setModalPaymentDate('')
    await fetchPayments()
    setStatus('Η πληρωμή καταχωρήθηκε')
  }

  async function createMonthlyEntry() {
    if (!editingCustomer) return

    if (!monthlyMonth) {
      setStatus('❌ Επιλέξτε μήνα')
      return
    }

    const totalCost = Number(monthlyTotalCost)
    const amountPaid = Number(monthlyAmountPaid)

    if (totalCost <= 0 && amountPaid <= 0) {
      setStatus('❌ Συμπληρώστε κόστος ή πληρωμένο ποσό')
      return
    }

    const monthOption = monthlyMonthOptions.find((option) => option.value === monthlyMonth)
    const monthLabel = monthOption?.label || monthlyMonth
    const today = new Date().toISOString().slice(0, 10)

    if (totalCost > 0) {
      const { error: chargeError } = await supabase
        .from('charges')
        .insert([
          {
            customer_id: editingCustomer.id,
            school_id: currentSchoolId,
            amount: totalCost,
            description: 'Ομαδικά/Διαγωνιστικά - ' + monthLabel,
            category: 'group',
            period_month: monthlyMonth,
            charge_date: monthlyMonth + '-01',
            status: 'open',
            source_type: 'monthly',
          },
        ])

      if (chargeError) {
        setStatus('❌ ' + chargeError.message)
        return
      }
    }

    if (amountPaid > 0) {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([
          {
            customer_id: editingCustomer.id,
            school_id: currentSchoolId,
            amount: amountPaid,
            method: monthlyPaidWithPos ? 'pos' : 'cash',
            payment_date: monthlyPaymentDate || today,
            status: 'completed',
            source_type: 'monthly',
            source_id: editingCustomer.id + '_' + monthlyMonth,
            notes: 'Πληρωμή μήνα ' + monthLabel,
          },
        ])

      if (paymentError) {
        setStatus('❌ ' + paymentError.message)
        return
      }
    }

    setMonthlyTotalCost('')
    setMonthlyAmountPaid('')
    setMonthlyPaidWithPos(false)
    setMonthlyPaymentDate('')
    await fetchCharges()
    await fetchPayments()
    setStatus('Ο μήνας προστέθηκε')
  }

  function clearSelectedMonthlyEntry() {
    setSelectedMonthlyChargeId(null)
    setEditingMonthlyMonth('')
    setEditingMonthlyCost('')
    setEditingMonthlyPaid('')
    setEditingMonthlyPaymentDate('')
    setEditingMonthlyPaidWithPos(false)
  }

  function selectMonthlyEntry(charge) {
    const monthlyPayment = getMonthlyPayment(editingCustomer.id, charge.period_month)

    setSelectedMonthlyChargeId(charge.id)
    setEditingMonthlyMonth(charge.period_month || '')
    setEditingMonthlyCost(String(charge.amount || ''))
    setEditingMonthlyPaid(monthlyPayment ? String(monthlyPayment.amount || '') : '')
    setEditingMonthlyPaymentDate(monthlyPayment?.payment_date || '')
    setEditingMonthlyPaidWithPos(monthlyPayment?.method === 'pos')
  }

  async function saveSelectedMonthlyEntry() {
    if (!editingCustomer || !selectedMonthlyChargeId) return

    if (!editingMonthlyMonth) {
      setStatus('❌ Επιλέξτε μήνα')
      return
    }

    const selectedCharge = charges.find((charge) => charge.id === selectedMonthlyChargeId)
    const existingPayment = selectedCharge
      ? getMonthlyPayment(editingCustomer.id, selectedCharge.period_month)
      : null
    const cost = Number(editingMonthlyCost)
    const paid = Number(editingMonthlyPaid)
    const monthLabel = formatMonthLabel(editingMonthlyMonth, monthlyMonthOptions)

    if (cost <= 0 && paid <= 0) {
      setStatus('❌ Συμπληρώστε κόστος ή πληρωμένο ποσό')
      return
    }

    const { error: chargeError } = await supabase
      .from('charges')
      .update({
        amount: cost,
        period_month: editingMonthlyMonth,
        charge_date: editingMonthlyMonth + '-01',
        description: 'Ομαδικά/Διαγωνιστικά - ' + monthLabel,
        category: 'group',
        status: 'open',
        source_type: 'monthly',
      })
      .eq('id', selectedMonthlyChargeId)

    if (chargeError) {
      setStatus('❌ ' + chargeError.message)
      return
    }

    if (paid > 0) {
      const paymentPayload = {
        customer_id: editingCustomer.id,
        school_id: currentSchoolId,
        amount: paid,
        method: editingMonthlyPaidWithPos ? 'pos' : 'cash',
        payment_date: editingMonthlyPaymentDate || new Date().toISOString().slice(0, 10),
        status: 'completed',
        source_type: 'monthly',
        source_id: editingCustomer.id + '_' + editingMonthlyMonth,
        notes: 'Πληρωμή μήνα ' + monthLabel,
      }

      const paymentResult = existingPayment
        ? await supabase.from('payments').update(paymentPayload).eq('id', existingPayment.id)
        : await supabase.from('payments').insert([paymentPayload])

      if (paymentResult.error) {
        setStatus('❌ ' + paymentResult.error.message)
        return
      }
    } else if (existingPayment) {
      const { error: paymentCancelError } = await supabase
        .from('payments')
        .update({ status: 'cancelled' })
        .eq('id', existingPayment.id)

      if (paymentCancelError) {
        setStatus('❌ ' + paymentCancelError.message)
        return
      }
    }

    await fetchCharges()
    await fetchPayments()
    clearSelectedMonthlyEntry()
    setStatus('Ο μήνας ενημερώθηκε')
  }

  async function deleteMonthlyEntry(charge) {
    if (!window.confirm('Ακύρωση μήνα ' + formatMonthLabel(charge.period_month, monthlyMonthOptions) + ';')) return

    const monthlyPayment = getMonthlyPayment(editingCustomer.id, charge.period_month)
    const { error: chargeError } = await supabase
      .from('charges')
      .update({ status: 'cancelled' })
      .eq('id', charge.id)

    if (chargeError) {
      setStatus('❌ ' + chargeError.message)
      return
    }

    if (monthlyPayment) {
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'cancelled' })
        .eq('id', monthlyPayment.id)

      if (paymentError) {
        setStatus('❌ ' + paymentError.message)
        return
      }
    }

    await fetchCharges()
    await fetchPayments()
    clearSelectedMonthlyEntry()
    setStatus('Ο μήνας ακυρώθηκε')
  }

  async function createPrivateLessonEntry() {
    if (!editingCustomer) return

    if (!privateDate) {
      setStatus('❌ Επιλέξτε ημερομηνία χρέωσης')
      return
    }

    const totalCost = Number(privateTotalCost)
    const amountPaid = Number(privateAmountPaid)

    if (totalCost <= 0 && amountPaid <= 0) {
      setStatus('❌ Συμπληρώστε κόστος ή πληρωμένο ποσό')
      return
    }

    if (totalCost > 0) {
      const { error: chargeError } = await supabase
        .from('charges')
        .insert([
          {
            customer_id: editingCustomer.id,
            school_id: currentSchoolId,
            amount: totalCost,
            description: 'Ιδιαίτερο μάθημα - ' + privateDate,
            category: 'private',
            charge_date: privateDate,
            period_month: privateDate.slice(0, 7),
            status: 'open',
            source_type: 'private',
          },
        ])

      if (chargeError) {
        setStatus('❌ ' + chargeError.message)
        return
      }
    }

    if (amountPaid > 0) {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([
          {
            customer_id: editingCustomer.id,
            school_id: currentSchoolId,
            amount: amountPaid,
            method: privatePaidWithPos ? 'pos' : 'cash',
            payment_date: privatePaymentDate || privateDate,
            status: 'completed',
            source_type: 'private',
            source_id: editingCustomer.id + '_' + privateDate,
            notes: 'Πληρωμή ιδιαίτερου ' + privateDate,
          },
        ])

      if (paymentError) {
        setStatus('❌ ' + paymentError.message)
        return
      }
    }

    setPrivateDate('')
    setPrivateTotalCost('')
    setPrivateAmountPaid('')
    setPrivatePaidWithPos(false)
    setPrivatePaymentDate('')
    await fetchCharges()
    await fetchPayments()
    setStatus('Το ιδιαίτερο καταχωρήθηκε')
  }

  function clearSelectedPrivateEntry() {
    setSelectedPrivateChargeId(null)
    setEditingPrivateDate('')
    setEditingPrivateCost('')
    setEditingPrivatePaid('')
    setEditingPrivatePaymentDate('')
    setEditingPrivatePaidWithPos(false)
  }

  function selectPrivateEntry(charge) {
    const payment = getPrivateLessonPayment(editingCustomer.id, charge.charge_date)

    setSelectedPrivateChargeId(charge.id)
    setEditingPrivateDate(charge.charge_date || '')
    setEditingPrivateCost(String(charge.amount || ''))
    setEditingPrivatePaid(payment ? String(payment.amount || '') : '')
    setEditingPrivatePaymentDate(payment?.payment_date || charge.charge_date || '')
    setEditingPrivatePaidWithPos(payment?.method === 'pos')
  }

  async function saveSelectedPrivateEntry() {
    if (!editingCustomer || !selectedPrivateChargeId) return

    if (!editingPrivateDate) {
      setStatus('❌ Επιλέξτε ημερομηνία χρέωσης')
      return
    }

    const charge = charges.find((item) => item.id === selectedPrivateChargeId)
    if (!charge) return

    const cost = Number(editingPrivateCost)
    const paid = Number(editingPrivatePaid)

    if (cost <= 0 && paid <= 0) {
      setStatus('❌ Συμπληρώστε κόστος ή πληρωμένο ποσό')
      return
    }

    const previousSourceId = editingCustomer.id + '_' + charge.charge_date
    const sourceId = editingCustomer.id + '_' + editingPrivateDate
    const existingPayment = payments.find((payment) =>
      payment.source_type === 'private' &&
      (payment.source_id === sourceId || payment.source_id === previousSourceId)
    )

    const { error: chargeError } = await supabase
      .from('charges')
      .update({
        amount: cost,
        description: 'Ιδιαίτερο μάθημα - ' + editingPrivateDate,
        charge_date: editingPrivateDate,
        period_month: editingPrivateDate.slice(0, 7),
        category: 'private',
        source_type: 'private',
        status: 'open',
      })
      .eq('id', charge.id)

    if (chargeError) {
      setStatus('❌ ' + chargeError.message)
      return
    }

    if (paid > 0) {
      const paymentPayload = {
        customer_id: editingCustomer.id,
        school_id: currentSchoolId,
        amount: paid,
        method: editingPrivatePaidWithPos ? 'pos' : 'cash',
        payment_date: editingPrivatePaymentDate || editingPrivateDate,
        status: 'completed',
        source_type: 'private',
        source_id: sourceId,
        notes: 'Πληρωμή ιδιαίτερου ' + editingPrivateDate,
      }

      const paymentResult = existingPayment
        ? await supabase.from('payments').update(paymentPayload).eq('id', existingPayment.id)
        : await supabase.from('payments').insert([paymentPayload])

      if (paymentResult.error) {
        setStatus('❌ ' + paymentResult.error.message)
        return
      }
    } else if (existingPayment) {
      const { error: paymentCancelError } = await supabase
        .from('payments')
        .update({ status: 'cancelled' })
        .eq('id', existingPayment.id)

      if (paymentCancelError) {
        setStatus('❌ ' + paymentCancelError.message)
        return
      }
    }

    await fetchCharges()
    await fetchPayments()
    clearSelectedPrivateEntry()
    setStatus('Το ιδιαίτερο ενημερώθηκε')
  }

  async function deletePrivateEntry(charge) {
    if (!window.confirm('Διαγραφή ιδιαίτερου;')) return

    const payment = getPrivateLessonPayment(editingCustomer.id, charge.charge_date)
    const { error: chargeError } = await supabase
      .from('charges')
      .update({ status: 'cancelled' })
      .eq('id', charge.id)

    if (chargeError) {
      setStatus('❌ ' + chargeError.message)
      return
    }

    if (payment) {
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'cancelled' })
        .eq('id', payment.id)

      if (paymentError) {
        setStatus('❌ ' + paymentError.message)
        return
      }
    }

    await fetchCharges()
    await fetchPayments()
    clearSelectedPrivateEntry()
    setStatus('Το ιδιαίτερο ακυρώθηκε')
  }

  async function createCompetitionEntry() {
    if (!editingCustomer) return

    if (!competitionDate) {
      setStatus('❌ Επιλέξτε ημερομηνία διαγωνισμού')
      return
    }

    if (!competitionDescription.trim()) {
      setStatus('❌ Συμπληρώστε περιγραφή διαγωνισμού')
      return
    }

    const amount = Number(competitionAmount)
    const amountPaid = Number(competitionAmountPaid)
    const description = competitionDescription.trim()

    if (amount <= 0 && amountPaid <= 0) {
      setStatus('❌ Συμπληρώστε κόστος ή πληρωμένο ποσό')
      return
    }

    if (amount > 0) {
      const { error: chargeError } = await supabase
        .from('charges')
        .insert([
          {
            customer_id: editingCustomer.id,
            school_id: currentSchoolId,
            amount,
            description: 'Διαγωνισμός - ' + description,
            category: 'competition',
            charge_date: competitionDate,
            period_month: competitionDate.slice(0, 7),
            status: 'open',
            source_type: 'competition',
          },
        ])

      if (chargeError) {
        setStatus('❌ ' + chargeError.message)
        return
      }
    }

    if (amountPaid > 0) {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([
          {
            customer_id: editingCustomer.id,
            school_id: currentSchoolId,
            amount: amountPaid,
            method: competitionPaidWithPos ? 'pos' : 'cash',
            payment_date: competitionPaymentDate || competitionDate,
            status: 'completed',
            source_type: 'competition',
            source_id: editingCustomer.id + '_' + competitionDate,
            notes: 'Πληρωμή διαγωνισμού ' + description,
          },
        ])

      if (paymentError) {
        setStatus('❌ ' + paymentError.message)
        return
      }
    }

    setCompetitionDate('')
    setCompetitionDescription('')
    setCompetitionAmount('')
    setCompetitionAmountPaid('')
    setCompetitionPaidWithPos(false)
    setCompetitionPaymentDate('')
    await fetchCharges()
    await fetchPayments()
    setStatus('Ο διαγωνισμός καταχωρήθηκε')
  }

  function clearSelectedCompetitionEntry() {
    setSelectedCompetitionChargeId(null)
    setEditingCompetitionDate('')
    setEditingCompetitionDescription('')
    setEditingCompetitionCost('')
    setEditingCompetitionPaid('')
    setEditingCompetitionPaymentDate('')
    setEditingCompetitionPaidWithPos(false)
  }

  function selectCompetitionEntry(charge) {
    const payment = getCompetitionPayment(editingCustomer.id, charge.charge_date)

    setSelectedCompetitionChargeId(charge.id)
    setEditingCompetitionDate(charge.charge_date || '')
    setEditingCompetitionDescription(charge.description?.replace('Διαγωνισμός - ', '') || '')
    setEditingCompetitionCost(String(charge.amount || ''))
    setEditingCompetitionPaid(payment ? String(payment.amount || '') : '')
    setEditingCompetitionPaymentDate(payment?.payment_date || charge.charge_date || '')
    setEditingCompetitionPaidWithPos(payment?.method === 'pos')
  }

  async function saveSelectedCompetitionEntry() {
    if (!editingCustomer || !selectedCompetitionChargeId) return

    if (!editingCompetitionDate) {
      setStatus('❌ Επιλέξτε ημερομηνία διαγωνισμού')
      return
    }

    if (!editingCompetitionDescription.trim()) {
      setStatus('❌ Συμπληρώστε περιγραφή διαγωνισμού')
      return
    }

    const charge = charges.find((item) => item.id === selectedCompetitionChargeId)
    if (!charge) return

    const cost = Number(editingCompetitionCost)
    const paid = Number(editingCompetitionPaid)
    const description = editingCompetitionDescription.trim()

    if (cost <= 0 && paid <= 0) {
      setStatus('❌ Συμπληρώστε κόστος ή πληρωμένο ποσό')
      return
    }

    const previousSourceId = editingCustomer.id + '_' + charge.charge_date
    const sourceId = editingCustomer.id + '_' + editingCompetitionDate
    const existingPayment = payments.find((payment) =>
      payment.source_type === 'competition' &&
      (payment.source_id === sourceId || payment.source_id === previousSourceId)
    )

    const { error: chargeError } = await supabase
      .from('charges')
      .update({
        amount: cost,
        description: 'Διαγωνισμός - ' + description,
        charge_date: editingCompetitionDate,
        period_month: editingCompetitionDate.slice(0, 7),
        category: 'competition',
        source_type: 'competition',
        status: 'open',
      })
      .eq('id', charge.id)

    if (chargeError) {
      setStatus('❌ ' + chargeError.message)
      return
    }

    if (paid > 0) {
      const paymentPayload = {
        customer_id: editingCustomer.id,
        school_id: currentSchoolId,
        amount: paid,
        method: editingCompetitionPaidWithPos ? 'pos' : 'cash',
        payment_date: editingCompetitionPaymentDate || editingCompetitionDate,
        status: 'completed',
        source_type: 'competition',
        source_id,
        notes: 'Πληρωμή διαγωνισμού ' + description,
      }

      const paymentResult = existingPayment
        ? await supabase.from('payments').update(paymentPayload).eq('id', existingPayment.id)
        : await supabase.from('payments').insert([paymentPayload])

      if (paymentResult.error) {
        setStatus('❌ ' + paymentResult.error.message)
        return
      }
    } else if (existingPayment) {
      const { error: paymentCancelError } = await supabase
        .from('payments')
        .update({ status: 'cancelled' })
        .eq('id', existingPayment.id)

      if (paymentCancelError) {
        setStatus('❌ ' + paymentCancelError.message)
        return
      }
    }

    await fetchCharges()
    await fetchPayments()
    clearSelectedCompetitionEntry()
    setStatus('Ο διαγωνισμός ενημερώθηκε')
  }

  async function deleteCompetitionEntry(charge) {
    if (!window.confirm('Διαγραφή διαγωνισμού;')) return

    const payment = getCompetitionPayment(editingCustomer.id, charge.charge_date)
    const { error: chargeError } = await supabase
      .from('charges')
      .update({ status: 'cancelled' })
      .eq('id', charge.id)

    if (chargeError) {
      setStatus('❌ ' + chargeError.message)
      return
    }

    if (payment) {
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'cancelled' })
        .eq('id', payment.id)

      if (paymentError) {
        setStatus('❌ ' + paymentError.message)
        return
      }
    }

    await fetchCharges()
    await fetchPayments()
    clearSelectedCompetitionEntry()
    setStatus('Ο διαγωνισμός ακυρώθηκε')
  }

  async function saveEditCustomer() {
    if (!editingCustomer) return

    const trimmedSurname = editSurname.trim()
    const trimmedFirstName = editFirstName.trim()
    const finalFullName = `${trimmedSurname} ${trimmedFirstName}`.trim()
    const updatePayload = {
      surname: trimmedSurname || null,
      first_name: trimmedFirstName || null,
      full_name: finalFullName || null,
      email: editEmail.trim() || null,
      phone: editPhone.trim() || null,
      address: editAddress.trim() || null,
      notes: editNotes.trim() || null,
      payment_status: editPaymentStatus || null,
      next_payment_date: editNextPaymentDate || null,
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', editingCustomer.id)
      .select('id, school_id, surname, first_name, full_name, email, phone, address, notes, payment_status, next_payment_date, created_at, updated_at')
      .maybeSingle()

    if (error) {
      setStatus('❌ ' + error.message)
      return
    }

    if (!data) {
      setStatus('❌ Δεν ενημερώθηκε καμία εγγραφή. Πιθανό RLS/permission issue.')
      console.log('Customer update returned no row', {
        editingCustomer,
        updatePayload,
      })
      return
    }

    setCustomers((previous) =>
      previous.map((customer) =>
        customer.id === data.id ? data : customer
      )
    )

    const linkedStudent = getLinkedStudent(data.id)
    const studentUpdates = {}

    if (data.email) studentUpdates.email = data.email
    if (data.phone) studentUpdates.phone = data.phone

    if (linkedStudent && Object.keys(studentUpdates).length > 0) {
      const { error: studentSyncError } = await supabase
        .from('students')
        .update(studentUpdates)
        .eq('id', linkedStudent.id)

      if (studentSyncError) {
        console.log('Linked student contact sync failed:', studentSyncError.message)
      }
    }

    closeEditCustomer()
    await fetchCustomers()
    await fetchStudents()
    setStatus('Ο πελάτης ενημερώθηκε')
  }

  async function deleteCustomer(customer) {
    if (!window.confirm(`Διαγραφή πελάτη ${getCustomerName(customer)};`)) return

    const { data: relatedCharges, error: chargesError } = await supabase
      .from('charges')
      .select('id')
      .eq('customer_id', customer.id)
      .limit(1)

    if (chargesError) {
      setStatus('❌ ' + chargesError.message)
      return
    }

    const { data: relatedPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('id')
      .eq('customer_id', customer.id)
      .limit(1)

    if (paymentsError) {
      setStatus('❌ ' + paymentsError.message)
      return
    }

    if ((relatedCharges || []).length > 0 || (relatedPayments || []).length > 0) {
      setStatus('Δεν μπορεί να διαγραφεί πελάτης με χρεώσεις ή πληρωμές.')
      return
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customer.id)

    if (error) {
      setStatus('❌ ' + error.message)
      return
    }

    setCustomers((previous) => previous.filter((item) => item.id !== customer.id))
    await fetchStudents()
    setStatus('Ο πελάτης διαγράφηκε')
  }

  function getLinkedStudent(customerId) {
    return studentsByCustomerId[customerId]
  }

  function getCustomerCharges(customerId) {
    return charges.filter((charge) => charge.customer_id === customerId)
  }

  function getCustomerChargesTotal(customerId) {
    return getCustomerCharges(customerId)
      .filter((c) => c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount), 0)
  }

  function getCustomerPayments(customerId) {
    return payments.filter((payment) => payment.customer_id === customerId)
  }

  function getCustomerPaymentsTotal(customerId) {
    return getCustomerPayments(customerId)
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount), 0)
  }

  function getMonthlyEntries(customerId) {
    return getCustomerCharges(customerId)
      .filter((charge) => charge.category === 'group' || charge.source_type === 'monthly')
      .filter((charge) => charge.status !== 'cancelled')
  }

  function getMonthlyPayment(customerId, periodMonth) {
    if (!periodMonth) return null

    return getCustomerPayments(customerId).find((payment) =>
      payment.source_id === customerId + '_' + periodMonth &&
      payment.source_type === 'monthly' &&
      payment.status === 'completed'
    )
  }

  function getPrivateLessonEntries(customerId) {
    return getCustomerCharges(customerId)
      .filter((charge) => charge.category === 'private')
      .filter((charge) => charge.status !== 'cancelled')
  }

  function getPrivateLessonPayment(customerId, chargeDate) {
    if (!chargeDate) return null

    return getCustomerPayments(customerId).find((payment) =>
      payment.source_id === customerId + '_' + chargeDate &&
      payment.source_type === 'private' &&
      payment.status === 'completed'
    )
  }

  function getCompetitionEntries(customerId) {
    return getCustomerCharges(customerId)
      .filter((charge) => charge.category === 'competition')
      .filter((charge) => charge.status !== 'cancelled')
  }

  function getCompetitionPayment(customerId, chargeDate) {
    if (!chargeDate) return null

    return getCustomerPayments(customerId).find((payment) =>
      payment.source_id === customerId + '_' + chargeDate &&
      payment.source_type === 'competition' &&
      payment.status === 'completed'
    )
  }

  function getCustomerFinancials(customerId) {
    return calculateCustomerFinancials(getCustomerCharges(customerId), getCustomerPayments(customerId))
  }

  function calculateAllocationsPerCharge(customerId) {
    const customerCharges = charges
      .filter((charge) => charge.customer_id === customerId && charge.status !== 'cancelled')
      .sort((a, b) => new Date(a.charge_date || a.created_at) - new Date(b.charge_date || b.created_at))

    const customerPayments = payments
      .filter((payment) => payment.customer_id === customerId && payment.status === 'completed')
      .sort((a, b) => new Date(a.payment_date || a.created_at) - new Date(b.payment_date || b.created_at))

    const paymentPool = customerPayments.map((payment) => ({
      ...payment,
      remaining: Number(payment.amount),
    }))

    const result = {}

    for (const charge of customerCharges) {
      let remainingCharge = Number(charge.amount)
      let allocated = 0

      for (const payment of paymentPool) {
        if (payment.remaining <= 0) continue
        if (remainingCharge <= 0) break

        const used = Math.min(payment.remaining, remainingCharge)

        payment.remaining -= used
        remainingCharge -= used
        allocated += used
      }

      result[charge.id] = {
        allocated,
        remaining: Math.max(0, remainingCharge),
      }
    }

    return result
  }

  function getBalance(customerId) {
    const financials = getCustomerFinancials(customerId)
    return financials.openBalance > 0 ? financials.openBalance : -financials.creditBalance
  }

  function getFinancialStatus(financials) {
    if (financials.totalCharges === 0) return 'none'
    if (financials.creditBalance > 0) return 'credit'
    if (financials.openBalance === 0) return 'paid'
    if (financials.allocated > 0 && financials.openBalance > 0) return 'partial'
    if (financials.openBalance > 0) return 'open'
    return 'none'
  }

  function getBalanceColor(financials) {
    if (financials.creditBalance > 0) return '#2563eb'
    if (financials.openBalance > 0) return '#dc2626'
    return '#16a34a'
  }

  function getCustomerStatus(financials) {
    return getFinancialStatus(financials)
  }

  function getStatusLabel(status) {
    if (status === 'credit') return 'Πίστωση'
    if (status === 'paid') return 'Πληρωμένο'
    if (status === 'partial') return 'Μερική'
    if (status === 'open') return 'Ανοιχτό'
    return 'Χωρίς εγγραφές'
  }

  function getStatusStyle(status) {
    if (status === 'open') {
      return { color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa' }
    }

    if (status === 'partial') {
      return { color: '#a16207', background: '#fefce8', border: '1px solid #fde68a' }
    }

    if (status === 'credit') {
      return { color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe' }
    }

    if (status === 'paid') {
      return { color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0' }
    }

    return { color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0' }
  }

  function formatMoney(value) {
    return `€${Number(value || 0).toFixed(2)}`
  }

  function isNewCustomer(customer) {
    const linkedStudent = getLinkedStudent(customer.id)
    const customerActiveCharges = charges.filter(
      (charge) => charge.customer_id === customer.id && charge.status !== 'cancelled'
    )

    return !linkedStudent || customerActiveCharges.length === 0
  }

  const totalChargesSum = charges
    .filter((c) => c.status !== 'cancelled')
    .reduce((sum, c) => sum + Number(c.amount), 0)

  const totalPaymentsSum = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const paidCount = customers.filter((customer) => getCustomerStatus(getCustomerFinancials(customer.id)) === 'paid').length
  const partialCount = customers.filter((customer) => getCustomerStatus(getCustomerFinancials(customer.id)) === 'partial').length
  const pendingCount = customers.filter((customer) => getCustomerStatus(getCustomerFinancials(customer.id)) === 'open').length
  const creditCount = customers.filter((customer) => getCustomerStatus(getCustomerFinancials(customer.id)) === 'credit').length
  const overdueCount = 0
  const newCustomersCount = customers.filter((customer) => isNewCustomer(customer)).length

  const greekLetters = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω']
  const danceAgeCategoryLabels = ['MINI KIDS', 'KIDS', 'JUVENILE 1', 'JUVENILE 2', 'JUNIOR 1', 'JUNIOR 2', 'YOUTH', 'ADULT', 'MASTERS', 'GRAND MASTERS']
  const monthlyMonthOptions = useMemo(() => generateMonthlyMonthOptions(), [])

  const filteredCustomers = customers.filter((customer) => {
    const displayName = getCustomerName(customer)
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const financials = getCustomerFinancials(customer.id)
    const customerStatus = getCustomerStatus(financials)
    const linkedStudent = getLinkedStudent(customer.id)
    const danceCategory = getDanceAgeCategory(linkedStudent?.date_of_birth)

    const matchesSearch = !normalizedSearch ||
      displayName.toLowerCase().includes(normalizedSearch) ||
      (customer.email || '').toLowerCase().includes(normalizedSearch) ||
      (customer.phone || '').toLowerCase().includes(normalizedSearch)

    const matchesLetter = selectedLetter === 'all' ||
      displayName.trim().toUpperCase().startsWith(selectedLetter)

    const matchesFinancialFilter =
      financialFilter === 'all' ||
      (['paid', 'partial', 'open', 'credit'].includes(financialFilter) && customerStatus === financialFilter) ||
      (financialFilter === 'new' && isNewCustomer(customer)) ||
      (financialFilter === 'overdue' && false)

    const matchesAgeCategoryFilter =
      ageCategoryFilter === 'all' ||
      (ageCategoryFilter === 'no_category' && !danceCategory) ||
      danceCategory?.label === ageCategoryFilter

    return matchesSearch && matchesLetter && matchesFinancialFilter && matchesAgeCategoryFilter
  })

  useEffect(() => {
    fetchCustomers()
    fetchStudents()
    fetchCharges()
    fetchPayments()
  }, [currentSchoolId])

  return (
    <div style={{ minHeight: '100vh', width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', boxSizing: 'border-box', background: '#eaf0f8', color: '#1f2937', padding: '34px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 800, color: '#111827' }}>Λογαριασμοί Πελατών</h1>
            <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 16 }}>Διαχειριστείτε τους πελάτες σας</p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={() => setStatus('Έλεγχος ονομάτων: δεν έχει υλοποιηθεί ακόμα')} style={actionButtonStyle('#7c3aed', '#f5f3ff')}>Έλεγχος Ονομάτων</button>
            <button onClick={() => setStatus('Έλεγχος διπλοτύπων: δεν έχει υλοποιηθεί ακόμα')} style={actionButtonStyle('#c2410c', '#fff7ed')}>Διπλότυπα</button>
            <button onClick={() => setStatus('Εξαγωγή XLSX: δεν έχει υλοποιηθεί ακόμα')} style={actionButtonStyle('#15803d', '#f0fdf4')}>Εξαγωγή XLSX</button>
            <button onClick={() => setStatus('Προσθήκη πελάτη: θα γίνει σε modal σε επόμενο βήμα')} style={{ ...actionButtonStyle('#ffffff', '#4f46e5'), color: '#fff', borderColor: '#4f46e5' }}>+ Προσθήκη Πελάτη</button>
          </div>
        </div>

        {status && (
          <div style={{ marginBottom: 16, background: '#fff', border: '1px solid #dbeafe', color: '#334155', borderRadius: 10, padding: '10px 14px' }}>
            {status}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(130px, 1fr))', gap: 14, marginBottom: 24 }}>
          <StatCard label="Πληρωμένο" value={paidCount} color="#059669" background="#eafaf1" active={financialFilter === 'paid'} onClick={() => setFinancialFilter(financialFilter === 'paid' ? 'all' : 'paid')} />
          <StatCard label="Μερική Πληρωμή" value={partialCount} color="#a16207" background="#fefce8" active={financialFilter === 'partial'} onClick={() => setFinancialFilter(financialFilter === 'partial' ? 'all' : 'partial')} />
          <StatCard label="Εκκρεμεί" value={pendingCount} color="#c2410c" background="#fff7ed" active={financialFilter === 'open'} onClick={() => setFinancialFilter(financialFilter === 'open' ? 'all' : 'open')} />
          <StatCard label="Πίστωση" value={creditCount} color="#2563eb" background="#eff6ff" active={financialFilter === 'credit'} onClick={() => setFinancialFilter(financialFilter === 'credit' ? 'all' : 'credit')} />
          <StatCard label="Καθυστερημένη" value={overdueCount} color="#dc2626" background="#fef2f2" active={financialFilter === 'overdue'} onClick={() => setFinancialFilter(financialFilter === 'overdue' ? 'all' : 'overdue')} />
          <StatCard label="Νέοι Πελάτες" value={newCustomersCount} color="#2563eb" background="#eff6ff" active={financialFilter === 'new'} onClick={() => setFinancialFilter(financialFilter === 'new' ? 'all' : 'new')} />
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
            <span style={{ color: '#64748b', fontWeight: 700 }}>Α-Ω:</span>
            <button onClick={() => setSelectedLetter('all')} style={letterButtonStyle(selectedLetter === 'all')}>Όλα</button>
            {greekLetters.map((letter) => (
              <button key={letter} onClick={() => setSelectedLetter(letter)} style={letterButtonStyle(selectedLetter === letter)}>
                {letter}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: '#e5e7eb', marginBottom: 18 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(170px, 210px) minmax(190px, 240px) 116px', gap: 14, alignItems: 'center' }}>
            <input
              placeholder="Αναζήτηση πελατών..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              style={{ height: 44, border: '1px solid #dbe3ef', borderRadius: 10, padding: '0 14px', fontSize: 15, background: '#f8fafc', color: '#111827', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.03)' }}
            />

            <select
              value={financialFilter}
              onChange={(event) => setFinancialFilter(event.target.value)}
              style={{ height: 44, border: '1px solid #dbe3ef', borderRadius: 10, padding: '0 12px', fontSize: 15, background: '#f8fafc', color: '#111827', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.03)' }}
            >
              <option value="all">Όλοι</option>
              <option value="paid">Πληρωμένο</option>
              <option value="partial">Μερική Πληρωμή</option>
              <option value="open">Εκκρεμεί</option>
              <option value="credit">Πίστωση</option>
              <option value="overdue">Καθυστερημένη</option>
              <option value="new">Νέοι Πελάτες</option>
            </select>

            <select
              value={ageCategoryFilter}
              onChange={(event) => setAgeCategoryFilter(event.target.value)}
              style={{ height: 44, border: '1px solid #dbe3ef', borderRadius: 10, padding: '0 12px', fontSize: 15, background: '#f8fafc', color: '#111827', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.03)' }}
            >
              <option value="all">Όλες οι Ηλικίες</option>
              {danceAgeCategoryLabels.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
              <option value="no_category">Χωρίς Κατηγορία</option>
            </select>

            <div style={{ display: 'flex', border: '1px solid #dbe3ef', borderRadius: 10, overflow: 'hidden', height: 44, background: '#f8fafc', justifySelf: 'end', width: 116 }}>
              <button onClick={() => setViewMode('grid')} style={toggleButtonStyle(viewMode === 'grid')}>grid</button>
              <button onClick={() => setViewMode('list')} style={toggleButtonStyle(viewMode === 'list')}>list</button>
            </div>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '70px 20px', background: '#fff', borderRadius: 16, color: '#64748b', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)' }}>
            Δεν βρέθηκαν πελάτες
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr', gap: 20 }}>
            {filteredCustomers.map((customer) => {
              const customerName = getCustomerName(customer)
              const financials = getCustomerFinancials(customer.id)
              const financialStatus = getCustomerStatus(financials)
              const statusStyle = getStatusStyle(financialStatus)
              const firstLetter = customerName.trim().charAt(0).toUpperCase() || '?'
              const linkedStudent = getLinkedStudent(customer.id)
              const danceCategory = getDanceAgeCategory(linkedStudent?.date_of_birth)

              return (
                <div key={customer.id} style={{ background: '#ffffff', borderRadius: 16, boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <div style={{ height: 4, background: 'linear-gradient(90deg, #7c3aed, #ec4899)' }} />
                  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) auto', alignItems: 'flex-start', gap: 12, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 12, padding: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ede9fe', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {firstLetter}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', wordBreak: 'normal', overflowWrap: 'normal', whiteSpace: 'normal', lineHeight: 1.25 }}>{customerName || 'Χωρίς όνομα'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, position: 'relative' }}>
                        <span style={{ ...statusStyle, borderRadius: 8, padding: '4px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {getStatusLabel(financialStatus)}
                        </span>
                        <button onClick={() => setOpenCustomerMenuId(openCustomerMenuId === customer.id ? null : customer.id)} style={{ border: '1px solid #dbe3ef', background: '#ffffff', color: '#475569', borderRadius: 8, width: 30, height: 28, cursor: 'pointer', fontWeight: 800, lineHeight: 1, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
                          ⋮
                        </button>
                        {openCustomerMenuId === customer.id && (
                          <div style={{ position: 'absolute', right: 0, top: 34, background: '#fff', border: '1px solid #dbe3ef', borderRadius: 10, boxShadow: '0 12px 26px rgba(15, 23, 42, 0.16)', minWidth: 140, overflow: 'hidden', zIndex: 5 }}>
                            <button onClick={() => { setOpenCustomerMenuId(null); openEditCustomer(customer) }} style={menuItemStyle()}>
                              Επεξεργασία
                            </button>
                            <button onClick={() => { setOpenCustomerMenuId(null); deleteCustomer(customer) }} style={{ ...menuItemStyle(), color: '#dc2626' }}>
                              Διαγραφή
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ color: '#475569', minHeight: 50, lineHeight: 1.75, padding: '0 2px' }}>
                      {customer.email && <div>Email: {customer.email}</div>}
                      {customer.phone && <div>Τηλέφωνο: {customer.phone}</div>}
                      {!customer.email && !customer.phone && <div>Δεν υπάρχουν στοιχεία επικοινωνίας</div>}
                    </div>

                    <div style={{ background: '#ffffff', border: '1px solid #c7d2fe', borderRadius: 14, padding: 16, boxShadow: '0 3px 10px rgba(79, 70, 229, 0.05)' }}>
                      <div style={{ color: '#4f46e5', fontSize: 12, letterSpacing: 1.5, fontWeight: 800, marginBottom: 14 }}>ΟΙΚΟΝΟΜΙΚΟ ΥΠΟΛΟΙΠΟ ΣΕΖΟΝ</div>
                      <MoneyRow label="Σύνολο Χρεώσεων" value={formatMoney(financials.totalCharges)} />
                      <MoneyRow label="Σύνολο Πληρωμών" value={formatMoney(financials.totalPayments)} valueColor="#059669" />
                      <MoneyRow label="Κατανεμημένα" value={formatMoney(financials.allocated)} />
                      <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 10, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, color: '#334155' }}>{financials.creditBalance > 0 ? 'Πίστωση' : 'Υπόλοιπο'}</span>
                        <strong style={{ color: getBalanceColor(financials), fontSize: 20 }}>{formatMoney(financials.creditBalance > 0 ? financials.creditBalance : financials.openBalance)}</strong>
                      </div>
                      <div style={{ marginTop: 14 }}>
                        {linkedStudent ? (
                          <div style={{ background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1px solid #c4b5fd', color: '#3730a3', borderRadius: 11, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, fontWeight: 800 }}>
                            <span>🎓 Μαθητής: {linkedStudent.full_name}</span>
                            {linkedStudent.date_of_birth && (
                              <span style={{ color: '#64748b', fontWeight: 700 }}>Γεν. {linkedStudent.date_of_birth}</span>
                            )}
                            {danceCategory && (
                              <span style={{ background: '#4f46e5', color: '#ffffff', borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 900, letterSpacing: 0 }}>{danceCategory.label}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ background: '#f8fafc', border: '1px solid #dbe3ef', color: '#64748b', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>Χωρίς εγγραφές</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {editingCustomer && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
            <div style={{ background: '#fff', borderRadius: 14, width: 'min(620px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 70px rgba(15, 23, 42, 0.35)', padding: 20, position: 'relative' }}>
              <button onClick={closeEditCustomer} style={{ position: 'absolute', top: 14, right: 14, border: 'none', background: 'transparent', color: '#64748b', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
              <h2 style={{ margin: '0 0 18px', color: '#111827', fontSize: 21, fontWeight: 800 }}>Επεξεργασία Πελάτη</h2>

              <section style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, color: '#047857', fontWeight: 800, fontSize: 13 }}>
                  <span>Πίστωση Πελάτη</span>
                  <span>Υπόλοιπο: {formatMoney(getCustomerFinancials(editingCustomer.id).creditBalance)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <MiniField label="Ποσό Πίστωσης" value={creditAmount} onChange={setCreditAmount} placeholder="0.00" />
                  <label style={{ color: '#065f46', fontSize: 11, fontWeight: 700 }}>
                    Τρόπος Πληρωμής
                    <select value={creditPaymentMethod} onChange={(event) => setCreditPaymentMethod(event.target.value)} style={miniInputStyle()}>
                      <option value="cash">Μετρητά</option>
                      <option value="pos">POS</option>
                      <option value="bank_transfer">Τράπεζα</option>
                      <option value="iris">IRIS</option>
                    </select>
                  </label>
                  <button onClick={() => setStatus('Δεν έχει υλοποιηθεί ακόμα')} style={{ height: 34, border: 'none', background: '#059669', color: '#fff', borderRadius: 7, padding: '0 10px', fontWeight: 800, cursor: 'pointer' }}>Καταχώρηση Πίστωσης</button>
                </div>
                <div style={{ borderTop: '1px solid #a7f3d0', margin: '12px 0' }} />
                <div style={{ color: '#dc2626', fontWeight: 800, fontSize: 12, marginBottom: 8 }}>Διόρθωση Πίστωσης</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input value={creditSubtractAmount} onChange={(event) => setCreditSubtractAmount(event.target.value)} placeholder="Ποσό αφαίρεσης" style={miniInputStyle()} />
                  <button onClick={() => setStatus('Δεν έχει υλοποιηθεί ακόμα')} style={{ border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', borderRadius: 7, padding: '0 10px', fontWeight: 800, cursor: 'pointer' }}>Αφαίρεση Πίστωσης</button>
                </div>
                <button onClick={() => setStatus('Δεν έχει υλοποιηθεί ακόμα')} style={{ width: '100%', marginTop: 8, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', borderRadius: 7, height: 32, fontWeight: 800, cursor: 'pointer' }}>Μηδενισμός Πίστωσης</button>
              </section>

              <section style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: 12, marginBottom: 16, color: '#3730a3', fontWeight: 800, fontSize: 13 }}>
                Συνδεδεμένος Μαθητής: <span style={{ fontWeight: 600 }}>Χωρίς σύνδεση</span>
              </section>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
                <EditField label="Επώνυμο *" value={editSurname} onChange={setEditSurname} />
                <EditField label="Όνομα" value={editFirstName} onChange={setEditFirstName} />
                <EditField label="Email" value={editEmail} onChange={setEditEmail} />
                <EditField label="Τηλέφωνο" value={editPhone} onChange={setEditPhone} />
              </div>

              <EditSection title="Ομαδικά/Διαγωνιστικά Μαθήματα">
                <SeasonStrip text={`Σεζόν 2025-2026 · ${getMonthlyEntries(editingCustomer.id).length} εγγραφές`} />
                {getMonthlyEntries(editingCustomer.id).length === 0 ? (
                  <EmptyLine text="Δεν υπάρχουν εγγραφές" />
                ) : (
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {getMonthlyEntries(editingCustomer.id).map((charge) => {
                      const monthlyPayment = getMonthlyPayment(editingCustomer.id, charge.period_month)
                      const allocation = calculateAllocationsPerCharge(editingCustomer.id)[charge.id]
                      const directPaid = Number(monthlyPayment?.amount || 0)
                      const allocatedPaid = allocation?.allocated || 0
                      const remaining = allocation?.remaining ?? Number(charge.amount)
                      const isSelected = selectedMonthlyChargeId === charge.id

                      return (
                        <div key={charge.id}>
                          <div
                            onClick={() => selectMonthlyEntry(charge)}
                            style={{ border: isSelected ? '1px solid #8b5cf6' : '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: isSelected ? '#faf5ff' : '#fff', fontSize: 12, color: '#475569', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto 28px', gap: 8, alignItems: 'center' }}>
                              <strong style={{ color: '#111827' }}>{formatMonthLabel(charge.period_month, monthlyMonthOptions)}</strong>
                              <span>Κόστος: <strong style={{ color: '#111827' }}>{formatMoney(charge.amount)}</strong></span>
                              <span style={{ borderRadius: 999, background: '#f1f5f9', color: '#64748b', padding: '2px 7px', fontWeight: 800 }}>{charge.status || 'open'}</span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  deleteMonthlyEntry(charge)
                                }}
                                style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
                                title="Διαγραφή"
                              >
                                🗑
                              </button>
                            </div>
                            <ChargeAllocationLine directPaid={directPaid} allocatedPaid={allocatedPaid} remaining={remaining} />
                          </div>

                          {isSelected && (
                            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginTop: 8, background: '#fff' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                <select value={editingMonthlyMonth} onChange={(event) => setEditingMonthlyMonth(event.target.value)} style={miniInputStyle()}>
                                  <option value="">Μήνας</option>
                                  {monthlyMonthOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                                <input type="number" step="0.01" value={editingMonthlyCost} onChange={(event) => setEditingMonthlyCost(event.target.value)} placeholder="Κόστος" style={miniInputStyle()} />
                                <input type="number" step="0.01" value={editingMonthlyPaid} onChange={(event) => setEditingMonthlyPaid(event.target.value)} placeholder="Πληρωμένο" style={miniInputStyle()} />
                                <input type="date" value={editingMonthlyPaymentDate} onChange={(event) => setEditingMonthlyPaymentDate(event.target.value)} style={miniInputStyle()} />
                              </div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#334155' }}>
                                <input type="checkbox" checked={editingMonthlyPaidWithPos} onChange={(event) => setEditingMonthlyPaidWithPos(event.target.checked)} /> Πληρωμή με POS
                              </label>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                                <button type="button" onClick={clearSelectedMonthlyEntry} style={{ border: '1px solid #dbe3ef', background: '#fff', color: '#334155', borderRadius: 7, padding: '7px 10px', fontWeight: 700, cursor: 'pointer' }}>Ακύρωση</button>
                                <button type="button" onClick={saveSelectedMonthlyEntry} style={{ border: '1px solid #111827', background: '#111827', color: '#fff', borderRadius: 7, padding: '7px 12px', fontWeight: 800, cursor: 'pointer' }}>Αποθήκευση</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginTop: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    <select value={monthlyMonth} onChange={(event) => setMonthlyMonth(event.target.value)} style={miniInputStyle()}>
                      <option value="">Μήνας</option>
                      {monthlyMonthOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <input type="number" step="0.01" value={monthlyTotalCost} onChange={(event) => setMonthlyTotalCost(event.target.value)} placeholder="Κόστος" style={miniInputStyle()} />
                    <input type="number" step="0.01" value={monthlyAmountPaid} onChange={(event) => setMonthlyAmountPaid(event.target.value)} placeholder="Πληρωμένο" style={miniInputStyle()} />
                    <input type="date" value={monthlyPaymentDate} onChange={(event) => setMonthlyPaymentDate(event.target.value)} style={miniInputStyle()} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#334155' }}>
                    <input type="checkbox" checked={monthlyPaidWithPos} onChange={(event) => setMonthlyPaidWithPos(event.target.checked)} /> Πληρωμή με POS
                  </label>
                  <button onClick={createMonthlyEntry} style={skeletonButtonStyle()}>+ Προσθήκη Μήνα</button>
                </div>
              </EditSection>

              <EditSection title="Ιδιαίτερα Μαθήματα">
                <SeasonStrip text={`Σεζόν 2025-2026 · ${getPrivateLessonEntries(editingCustomer.id).length} εγγραφές`} />
                {getPrivateLessonEntries(editingCustomer.id).length === 0 ? (
                  <EmptyLine text="Δεν υπάρχουν εγγραφές" />
                ) : (
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {getPrivateLessonEntries(editingCustomer.id).map((charge) => {
                      const privatePayment = getPrivateLessonPayment(editingCustomer.id, charge.charge_date)
                      const allocation = calculateAllocationsPerCharge(editingCustomer.id)[charge.id]
                      const directPaid = Number(privatePayment?.amount || 0)
                      const allocatedPaid = allocation?.allocated || 0
                      const remaining = allocation?.remaining ?? Number(charge.amount)
                      const isSelected = selectedPrivateChargeId === charge.id

                      return (
                        <div key={charge.id}>
                          <div
                            onClick={() => selectPrivateEntry(charge)}
                            style={{ border: isSelected ? '1px solid #8b5cf6' : '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: isSelected ? '#faf5ff' : '#fff', fontSize: 12, color: '#475569', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto 28px', gap: 8, alignItems: 'center' }}>
                              <strong style={{ color: '#111827' }}>{charge.charge_date || '-'}</strong>
                              <span>Κόστος: <strong style={{ color: '#111827' }}>{formatMoney(charge.amount)}</strong></span>
                              <span style={{ borderRadius: 999, background: '#f1f5f9', color: '#64748b', padding: '2px 7px', fontWeight: 800 }}>{charge.status || 'open'}</span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  deletePrivateEntry(charge)
                                }}
                                style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
                                title="Διαγραφή"
                              >
                                🗑
                              </button>
                            </div>
                            <ChargeAllocationLine directPaid={directPaid} allocatedPaid={allocatedPaid} remaining={remaining} />
                          </div>

                          {isSelected && (
                            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginTop: 8, background: '#fff' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                <input type="date" value={editingPrivateDate} onChange={(event) => setEditingPrivateDate(event.target.value)} style={miniInputStyle()} />
                                <input type="number" step="0.01" value={editingPrivateCost} onChange={(event) => setEditingPrivateCost(event.target.value)} placeholder="Κόστος" style={miniInputStyle()} />
                                <input type="number" step="0.01" value={editingPrivatePaid} onChange={(event) => setEditingPrivatePaid(event.target.value)} placeholder="Πληρωμένο" style={miniInputStyle()} />
                                <input type="date" value={editingPrivatePaymentDate} onChange={(event) => setEditingPrivatePaymentDate(event.target.value)} style={miniInputStyle()} />
                              </div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#334155' }}>
                                <input type="checkbox" checked={editingPrivatePaidWithPos} onChange={(event) => setEditingPrivatePaidWithPos(event.target.checked)} /> Πληρωμή με POS
                              </label>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                                <button type="button" onClick={clearSelectedPrivateEntry} style={{ border: '1px solid #dbe3ef', background: '#fff', color: '#334155', borderRadius: 7, padding: '7px 10px', fontWeight: 700, cursor: 'pointer' }}>Ακύρωση</button>
                                <button type="button" onClick={saveSelectedPrivateEntry} style={{ border: '1px solid #111827', background: '#111827', color: '#fff', borderRadius: 7, padding: '7px 12px', fontWeight: 800, cursor: 'pointer' }}>Αποθήκευση</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginTop: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    <input type="date" value={privateDate} onChange={(event) => setPrivateDate(event.target.value)} style={miniInputStyle()} />
                    <input type="number" step="0.01" value={privateTotalCost} onChange={(event) => setPrivateTotalCost(event.target.value)} placeholder="Κόστος" style={miniInputStyle()} />
                    <input type="number" step="0.01" value={privateAmountPaid} onChange={(event) => setPrivateAmountPaid(event.target.value)} placeholder="Πληρωμένο" style={miniInputStyle()} />
                    <input type="date" value={privatePaymentDate} onChange={(event) => setPrivatePaymentDate(event.target.value)} style={miniInputStyle()} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#334155' }}>
                    <input type="checkbox" checked={privatePaidWithPos} onChange={(event) => setPrivatePaidWithPos(event.target.checked)} /> Πληρωμή με POS
                  </label>
                  <button onClick={createPrivateLessonEntry} style={skeletonButtonStyle()}>+ Προσθήκη Ιδιαίτερου</button>
                </div>
              </EditSection>

              <EditSection title="Συμμετοχές Διαγωνισμών">
                <SeasonStrip text={`Σεζόν 2025-2026 · ${getCompetitionEntries(editingCustomer.id).length} εγγραφές`} />
                {getCompetitionEntries(editingCustomer.id).length === 0 ? (
                  <EmptyLine text="Δεν υπάρχουν εγγραφές" />
                ) : (
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {getCompetitionEntries(editingCustomer.id).map((charge) => {
                      const competitionPayment = getCompetitionPayment(editingCustomer.id, charge.charge_date)
                      const allocation = calculateAllocationsPerCharge(editingCustomer.id)[charge.id]
                      const directPaid = Number(competitionPayment?.amount || 0)
                      const allocatedPaid = allocation?.allocated || 0
                      const remaining = allocation?.remaining ?? Number(charge.amount)
                      const isSelected = selectedCompetitionChargeId === charge.id

                      return (
                        <div key={charge.id}>
                          <div
                            onClick={() => selectCompetitionEntry(charge)}
                            style={{ border: isSelected ? '1px solid #8b5cf6' : '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: isSelected ? '#faf5ff' : '#fff', fontSize: 12, color: '#475569', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto 28px', gap: 8, alignItems: 'center' }}>
                              <strong style={{ color: '#111827' }}>{charge.charge_date || '-'}</strong>
                              <span>Κόστος: <strong style={{ color: '#111827' }}>{formatMoney(charge.amount)}</strong></span>
                              <span style={{ borderRadius: 999, background: '#f1f5f9', color: '#64748b', padding: '2px 7px', fontWeight: 800 }}>{charge.status || 'open'}</span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  deleteCompetitionEntry(charge)
                                }}
                                style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
                                title="Διαγραφή"
                              >
                                🗑
                              </button>
                            </div>
                            <div style={{ marginTop: 5, overflowWrap: 'break-word' }}>{charge.description || '-'}</div>
                            <ChargeAllocationLine directPaid={directPaid} allocatedPaid={allocatedPaid} remaining={remaining} />
                          </div>

                          {isSelected && (
                            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginTop: 8, background: '#fff' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                <input type="date" value={editingCompetitionDate} onChange={(event) => setEditingCompetitionDate(event.target.value)} style={miniInputStyle()} />
                                <input value={editingCompetitionDescription} onChange={(event) => setEditingCompetitionDescription(event.target.value)} placeholder="Διαγωνισμός" style={miniInputStyle()} />
                                <input type="number" step="0.01" value={editingCompetitionCost} onChange={(event) => setEditingCompetitionCost(event.target.value)} placeholder="Κόστος" style={miniInputStyle()} />
                                <input type="number" step="0.01" value={editingCompetitionPaid} onChange={(event) => setEditingCompetitionPaid(event.target.value)} placeholder="Πληρωμένο" style={miniInputStyle()} />
                                <input type="date" value={editingCompetitionPaymentDate} onChange={(event) => setEditingCompetitionPaymentDate(event.target.value)} style={miniInputStyle()} />
                              </div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#334155' }}>
                                <input type="checkbox" checked={editingCompetitionPaidWithPos} onChange={(event) => setEditingCompetitionPaidWithPos(event.target.checked)} /> Πληρωμή με POS
                              </label>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                                <button type="button" onClick={clearSelectedCompetitionEntry} style={{ border: '1px solid #dbe3ef', background: '#fff', color: '#334155', borderRadius: 7, padding: '7px 10px', fontWeight: 700, cursor: 'pointer' }}>Ακύρωση</button>
                                <button type="button" onClick={saveSelectedCompetitionEntry} style={{ border: '1px solid #111827', background: '#111827', color: '#fff', borderRadius: 7, padding: '7px 12px', fontWeight: 800, cursor: 'pointer' }}>Αποθήκευση</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginTop: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <input type="date" value={competitionDate} onChange={(event) => setCompetitionDate(event.target.value)} style={miniInputStyle()} />
                    <input value={competitionDescription} onChange={(event) => setCompetitionDescription(event.target.value)} placeholder="Διαγωνισμός" style={miniInputStyle()} />
                    <input type="number" step="0.01" value={competitionAmount} onChange={(event) => setCompetitionAmount(event.target.value)} placeholder="Κόστος" style={miniInputStyle()} />
                    <input type="number" step="0.01" value={competitionAmountPaid} onChange={(event) => setCompetitionAmountPaid(event.target.value)} placeholder="Πληρωμένο" style={miniInputStyle()} />
                    <input type="date" value={competitionPaymentDate} onChange={(event) => setCompetitionPaymentDate(event.target.value)} style={miniInputStyle()} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#334155' }}>
                    <input type="checkbox" checked={competitionPaidWithPos} onChange={(event) => setCompetitionPaidWithPos(event.target.checked)} /> Πληρωμή με POS
                  </label>
                  <button onClick={createCompetitionEntry} style={skeletonButtonStyle()}>+ Προσθήκη Διαγωνισμού</button>
                </div>
              </EditSection>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                <label style={fieldLabelStyle()}>Κατάσταση<select value={editPaymentStatus} onChange={(event) => setEditPaymentStatus(event.target.value)} style={editInputStyle()}><option value="pending">Εκκρεμεί</option><option value="paid">Πληρωμένο</option><option value="partial">Μερική Πληρωμή</option></select></label>
                <label style={fieldLabelStyle()}>Ημερομηνία Έναρξης<input type="date" value={editStartDate} onChange={(event) => setEditStartDate(event.target.value)} style={editInputStyle()} /></label>
                <label style={fieldLabelStyle()}>Επόμενη Πληρωμή<input type="date" value={editNextPaymentDate} onChange={(event) => setEditNextPaymentDate(event.target.value)} style={editInputStyle()} /></label>
              </div>

              <label style={{ display: 'block', marginTop: 14, color: '#475569', fontWeight: 700 }}>
                Σημειώσεις
                <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} style={{ display: 'block', width: '100%', minHeight: 86, marginTop: 6, border: '1px solid #dbe3ef', borderRadius: 10, padding: 10, boxSizing: 'border-box', fontSize: 14, color: '#111827', background: '#f8fafc' }} />
              </label>

              <EditSection title="Ιστορικό Χρεώσεων / Πληρωμών">
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#f8fafc' }}>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Χρεώσεις</div>
                  {getCustomerCharges(editingCustomer.id).length === 0 ? (
                    <EmptyLine text="Δεν υπάρχουν χρεώσεις" />
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {getCustomerCharges(editingCustomer.id).map((charge) => (
                        <FinanceHistoryRow key={charge.id} left={charge.charge_date || charge.created_at?.slice(0, 10) || '-'} middle={charge.description || charge.category || '-'} right={formatMoney(charge.amount)} status={charge.status || 'open'} />
                      ))}
                    </div>
                  )}

                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, margin: '12px 0 8px' }}>Πληρωμές</div>
                  {getCustomerPayments(editingCustomer.id).length === 0 ? (
                    <EmptyLine text="Δεν υπάρχουν πληρωμές" />
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {getCustomerPayments(editingCustomer.id).map((payment) => (
                        <FinanceHistoryRow key={payment.id} left={payment.payment_date || payment.created_at?.slice(0, 10) || '-'} middle={payment.method || '-'} right={formatMoney(payment.amount)} status={payment.status || 'completed'} />
                      ))}
                    </div>
                  )}
                </div>
              </EditSection>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid #e5e7eb' }}>
                <button onClick={closeEditCustomer} style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 9, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>Ακύρωση</button>
                <button onClick={saveEditCustomer} style={{ border: '1px solid #4f46e5', background: '#4f46e5', color: '#fff', borderRadius: 9, padding: '10px 16px', fontWeight: 800, cursor: 'pointer' }}>Ενημέρωση Πελάτη</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function generateMonthlyMonthOptions() {
  const options = []
  const now = new Date()

  for (let index = -6; index <= 18; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1)
    const value = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
    const label = date.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }

  return options
}

function formatMonthLabel(periodMonth, options) {
  if (!periodMonth) return '-'
  return options.find((option) => option.value === periodMonth)?.label || periodMonth
}

function ChargeAllocationLine({ directPaid, allocatedPaid, remaining }) {
  const money = (value) => `€${Number(value || 0).toFixed(2)}`

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 12, fontWeight: 800 }}>
      <span style={{ color: '#047857' }}>Πληρωμένο: {money(directPaid)}</span>
      {allocatedPaid > directPaid && (
        <span style={{ color: '#4f46e5' }}>Καλυμμένο: {money(allocatedPaid)}</span>
      )}
      {remaining > 0 ? (
        <span style={{ color: '#dc2626' }}>Υπόλοιπο: {money(remaining)}</span>
      ) : (
        <span style={{ background: '#dcfce7', color: '#047857', border: '1px solid #86efac', borderRadius: 999, padding: '2px 8px' }}>✔ Εξοφλημένο</span>
      )}
    </div>
  )
}

function MiniField({ label, value, onChange, placeholder }) {
  return (
    <label style={{ color: '#065f46', fontSize: 11, fontWeight: 700 }}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={miniInputStyle()} />
    </label>
  )
}

function FinanceHistoryRow({ left, middle, right, status }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr) auto auto', gap: 8, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 9, padding: '8px 10px', fontSize: 12, color: '#475569', background: '#fff' }}>
      <span>{left}</span>
      <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{middle}</span>
      <strong style={{ color: '#111827' }}>{right}</strong>
      <span style={{ borderRadius: 999, background: '#f1f5f9', color: '#64748b', padding: '2px 7px', fontWeight: 800 }}>{status}</span>
    </div>
  )
}

function EditSection({ title, action, children }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#334155' }}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function SeasonStrip({ text }) {
  return <div style={{ background: '#faf5ff', color: '#7c3aed', padding: '7px 9px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{text}</div>
}

function EmptyLine({ text }) {
  return <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13, padding: '10px 2px' }}>{text}</div>
}

function fieldLabelStyle() {
  return { display: 'block', color: '#475569', fontWeight: 700, fontSize: 13 }
}

function editInputStyle() {
  return {
    display: 'block',
    width: '100%',
    marginTop: 6,
    border: '1px solid #dbe3ef',
    borderRadius: 10,
    padding: '10px 11px',
    fontSize: 14,
    color: '#111827',
    background: '#f8fafc',
  }
}

function miniInputStyle() {
  return {
    display: 'block',
    width: '100%',
    height: 32,
    marginTop: 4,
    border: '1px solid #dbe3ef',
    borderRadius: 7,
    padding: '0 8px',
    fontSize: 12,
    color: '#111827',
    background: '#fff',
  }
}

function skeletonButtonStyle() {
  return {
    width: '100%',
    marginTop: 8,
    border: '1px solid #dbe3ef',
    background: '#fff',
    color: '#475569',
    borderRadius: 7,
    height: 32,
    fontWeight: 700,
    cursor: 'pointer',
  }
}
function EditField({ label, value, onChange }) {
  return (
    <label style={{ display: 'block', color: '#475569', fontWeight: 700 }}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #dbe3ef', borderRadius: 10, padding: '10px 11px', boxSizing: 'border-box', fontSize: 15, color: '#111827', background: '#f8fafc' }} />
    </label>
  )
}

function StatCard({ label, value, color, background, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background,
        borderRadius: 12,
        padding: '18px 14px',
        textAlign: 'center',
        minHeight: 86,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        border: active ? '2px solid ' + color : '1px solid transparent',
        boxShadow: active ? '0 0 0 3px rgba(79, 70, 229, 0.12)' : 'none',
        cursor: 'pointer',
      }}
    >
      <div style={{ color, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <strong style={{ color, fontSize: 28, lineHeight: 1 }}>{value}</strong>
    </button>
  )
}

function MoneyRow({ label, value, valueColor = '#334155' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 9, color: '#64748b' }}>
      <span>{label}</span>
      <strong style={{ color: valueColor }}>{value}</strong>
    </div>
  )
}

function actionButtonStyle(color, background) {
  return {
    height: 38,
    border: `1px solid ${color}`,
    color,
    background,
    borderRadius: 7,
    padding: '0 14px',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

function letterButtonStyle(active) {
  return {
    border: 'none',
    background: active ? '#111827' : '#f8fafc',
    color: active ? '#fff' : '#334155',
    borderRadius: 8,
    padding: '7px 10px',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

function menuItemStyle() {
  return {
    display: 'block',
    width: '100%',
    border: 'none',
    background: '#fff',
    color: '#334155',
    textAlign: 'left',
    padding: '10px 12px',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

function toggleButtonStyle(active) {
  return {
    border: 'none',
    background: active ? '#e0e7ff' : '#ffffff',
    color: active ? '#3730a3' : '#64748b',
    padding: '0 11px',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

export default Home
