import { useState } from 'react'
import { isLoggedIn, logout } from './auth/spotify-auth'
import Login from './components/Login'
import Experience from './components/Experience'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())

  if (!loggedIn) return <Login />

  return (
    <Experience
      onLogout={() => {
        logout()
        setLoggedIn(false)
      }}
    />
  )
}
