import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

type Mode = 'light' | 'dark' | 'system'
const KEY = 'vexx-theme'

function read(): Mode {
  try {
    const m = localStorage.getItem(KEY)
    return m === 'light' || m === 'dark' ? m : 'system'
  } catch {
    return 'system'
  }
}

// Light / Dark / System, on every page including sign-in.
export function ThemeSwitch() {
  const [mode, setMode] = useState<Mode>(read)
  useEffect(() => {
    const root = document.documentElement
    if (mode === 'system') delete root.dataset.theme
    else root.dataset.theme = mode
    try {
      if (mode === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, mode)
    } catch {
      // not saved; the choice still applies for this visit
    }
  }, [mode])

  const options: { key: Mode; label: string; Icon: typeof Sun }[] = [
    { key: 'light', label: 'Light', Icon: Sun },
    { key: 'dark', label: 'Dark', Icon: Moon },
    { key: 'system', label: 'Match system', Icon: Monitor },
  ]
  return (
    <div className="theme" role="group" aria-label="Colour mode">
      {options.map(({ key, label, Icon }) => (
        <button key={key} type="button" aria-pressed={mode === key} aria-label={label} title={label} onClick={() => setMode(key)}>
          <Icon size={15} aria-hidden />
        </button>
      ))}
    </div>
  )
}
