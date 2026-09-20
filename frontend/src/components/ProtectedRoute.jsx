import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getAuthToken } from '../services/authServices'

const ProtectedRoute = ({ children }) => {
  const token = getAuthToken()
  const location = useLocation()

  if (!token) {
    return <Navigate to="/authentication/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
