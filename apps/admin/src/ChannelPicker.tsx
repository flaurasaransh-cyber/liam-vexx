import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Hash, Loader2, Search } from 'lucide-react'
import type { ChannelOption } from '@vexx/shared'

// A searchable channel list that opens under its button. Built by hand rather than a native select, so it looks
// the same in every browser and matches the rest of the panel.
export function ChannelPicker({
  value,
  channels,
  loading,
  onChange,
}: {
  value: string
  channels: ChannelOption[] | null
  loading: boolean
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)

  const selected = channels?.find((c) => c.id === value)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (channels ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || (c.category ?? '').toLowerCase().includes(q))
  }, [channels, query])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    search.current?.focus()
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const choose = (id: string) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="picker" ref={root}>
      <button
        type="button"
        className="input picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Hash size={15} aria-hidden className="muted" />
        <span className={selected ? '' : 'muted'}>{selected ? selected.name : value ? `Channel ${value}` : 'Pick a channel'}</span>
        {loading ? <Loader2 size={15} className="spin muted" aria-hidden /> : <ChevronDown size={15} aria-hidden className="muted" />}
      </button>
      {open ? (
        <div className="picker-pop">
          <div className="picker-search">
            <Search size={14} aria-hidden className="muted" />
            <input
              ref={search}
              value={query}
              placeholder="Search channels"
              aria-label="Search channels"
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, shown.length - 1)))
                if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
                if (e.key === 'Enter' && shown[active]) (e.preventDefault(), choose(shown[active].id))
                if (e.key === 'Escape') setOpen(false)
              }}
            />
          </div>
          <ul role="listbox" aria-label="Channels" className="picker-list">
            {shown.length === 0 ? <li className="picker-empty">{loading ? 'Loading channels' : 'No channel matches'}</li> : null}
            {shown.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={c.id === value}
                className={i === active ? 'active' : ''}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(c.id)}
              >
                <Hash size={14} aria-hidden className="muted" />
                <span className="picker-name">{c.name}</span>
                {c.category ? <span className="picker-cat">{c.category}</span> : null}
                {c.id === value ? <Check size={14} aria-hidden className="picker-check" /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
