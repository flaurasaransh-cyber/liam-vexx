import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { Member } from '@vexx/shared'

// An editable list of people: name and an optional role, in order. Up and down move a row.
export function Members({
  label,
  members,
  onChange,
  numbered,
  rolePlaceholder,
}: {
  label: string
  members: Member[]
  onChange: (next: Member[]) => void
  numbered: boolean
  rolePlaceholder: string
}) {
  const set = (i: number, patch: Partial<Member>) => onChange(members.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const move = (i: number, by: number) => {
    const next = [...members]
    const [m] = next.splice(i, 1)
    next.splice(i + by, 0, m)
    onChange(next)
  }

  return (
    <div className="members">
      {members.length === 0 ? <div className="empty-list">No one added yet. The roster shows “To be announced”.</div> : null}
      {members.map((m, i) => (
        <div className="member" key={i}>
          <span className="num">{numbered ? `${i + 1}.` : '🔸'}</span>
          <input className="input" aria-label={`${label} ${i + 1} name`} placeholder="Name" value={m.name} maxLength={60} onChange={(e) => set(i, { name: e.target.value })} />
          <input className="input role" aria-label={`${label} ${i + 1} role`} placeholder={rolePlaceholder} value={m.role} maxLength={60} onChange={(e) => set(i, { role: e.target.value })} />
          <div className="tools">
            <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${m.name || 'row'} up`}>
              <ArrowUp size={15} aria-hidden />
            </button>
            <button type="button" className="icon-btn" disabled={i === members.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${m.name || 'row'} down`}>
              <ArrowDown size={15} aria-hidden />
            </button>
            <button type="button" className="icon-btn danger" onClick={() => onChange(members.filter((_, j) => j !== i))} aria-label={`Remove ${m.name || 'row'}`}>
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn small" disabled={members.length >= 25} onClick={() => onChange([...members, { name: '', role: '' }])}>
          <Plus size={14} aria-hidden />
          Add to {label.toLowerCase()}
        </button>
      </div>
    </div>
  )
}
