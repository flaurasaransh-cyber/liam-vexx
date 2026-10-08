import type { ReactNode } from 'react'
import { ThemeSwitch } from './theme'

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/logo.png" alt="" />
        <b className="display">VEXX</b>
        <span>Discord admin</span>
      </div>
      <div className="bar-actions">
        {children}
        <ThemeSwitch />
      </div>
    </header>
  )
}
