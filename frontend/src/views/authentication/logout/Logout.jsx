import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CCard, CCardBody, CCol, CRow } from '@coreui/react'
import { clearAuthSession } from 'src/services/authServices'

const Logout = () => {
  const navigate = useNavigate()
  useEffect(() => {
    clearAuthSession()
    navigate('/authentication/login', { replace: true })
  }, [navigate])
  return null
}

export default Logout
