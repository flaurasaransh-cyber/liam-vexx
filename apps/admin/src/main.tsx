import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { getToken } from './api'
import { Login } from './Login'
import { Editor } from './Editor'

function App() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getToken()))
  return signedIn ? <Editor onSignOut={() => setSignedIn(false)} /> : <Login onSignedIn={() => setSignedIn(true)} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
