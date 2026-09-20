const apiBase = import.meta.env.VITE_API_BASE_URL || ''

async function loginUser(credentials) {
  try {
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Error al iniciar sesión')
    }

    const data = await response.json()
    return data
  } catch (error) {
    throw error
  }
}

async function registerUser(userData) {
  console.log('Sending request to API: /auth/register')
  try {
    const response = await fetch(`${apiBase}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Error al registrar el usuario')
    }

    const data = await response.json()
    return data
  } catch (error) {
    throw error
  }
}

const getAuthToken = () => {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
}

const getAuthUser = () => {
  const user = localStorage.getItem('authUser') || sessionStorage.getItem('authUser')
  return user ? JSON.parse(user) : null
}

const clearAuthSession = () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('authUser')
  localStorage.removeItem('userId')
  sessionStorage.removeItem('authToken')
  sessionStorage.removeItem('authUser')
  sessionStorage.removeItem('userId')
}

export { loginUser, registerUser, getAuthToken, getAuthUser, clearAuthSession }
