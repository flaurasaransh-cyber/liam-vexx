import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Member, Panel } from '@vexx/shared'

function List({ members }: { members: Member[] }) {
  const named = members.filter((m) => m.name.trim())
  if (named.length === 0)
    return (
      <div className="embed-body">
        <i>To be announced</i>
      </div>
    )
  return (
    <div className="embed-body">
      {named.map((m, i) => (
        <div key={i}>
          🔸 <b>{m.name}</b>
          {m.role ? ` — ${m.role}` : ''}
        </div>
      ))}
    </div>
  )
}

// A close copy of how Discord draws the panel and the roster reply, so changes can be checked before publishing.
export function Preview({ panel, botName, avatar, imageUrl }: { panel: Panel; botName: string; avatar: string; imageUrl: string | null }) {
  const [view, setView] = useState<'about' | 'roster'>('about')
  const { about, roster } = panel
  const style = { ['--embed-colour' as string]: about.color }

  return (
    <section className="card" aria-label="Preview">
      <div className="card-head">
        <h2 className="display">Preview</h2>
        <div className="tabs" role="tablist" aria-label="Which message">
          <button role="tab" aria-selected={view === 'about'} onClick={() => setView('about')}>
            Panel
          </button>
          <button role="tab" aria-selected={view === 'roster'} onClick={() => setView('roster')}>
            Roster reply
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="discord">
          <div className="msg">
            <img className="msg-avatar" src={avatar} alt="" />
            <div style={{ minWidth: 0 }}>
              <div className="msg-name">
                {botName} <span className="app-tag">APP</span> <span className="msg-time">Today</span>
              </div>
              {view === 'about' ? (
                <>
                  <div className="embed" style={style}>
                    <div style={{ minWidth: 0 }}>
                      <div className="embed-title">{about.title || 'Title'}</div>
                      <div className="embed-body">
                        {about.body}
                        {about.tagline ? (
                          <>
                            {'\n\n'}
                            <b>{about.tagline}</b>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {about.showLogo ? <img className="embed-thumb" src="/logo.png" alt="" /> : null}
                  </div>
                  <div className="d-buttons">
                    {about.mediaUrl ? (
                      <span className="d-btn">
                        {about.mediaLabel || 'VEXX Media'} <ExternalLink size={13} aria-hidden />
                      </span>
                    ) : null}
                    <span className="d-btn">{about.rosterLabel || 'Roster'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="embed" style={style}>
                    <div style={{ minWidth: 0 }}>
                      <div className="embed-title">{roster.title}</div>
                      <div className="embed-field-name">{roster.teamHeading}</div>
                      <List members={roster.team} />
                      <div className="embed-field-name">{roster.staffHeading}</div>
                      <List members={roster.staff} />
                    </div>
                    {about.showLogo ? <img className="embed-thumb" src="/logo.png" alt="" /> : null}
                    {imageUrl ? <img className="embed-img" src={imageUrl} alt="Roster" /> : null}
                    {about.tagline ? <div className="embed-footer">{about.tagline}</div> : null}
                  </div>
                  <div className="ephemeral">Only you can see this · Dismiss message</div>
                </>
              )}
            </div>
          </div>
        </div>
        {view === 'about' && !about.mediaUrl ? <p className="hint" style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>The media button is hidden until it has a link.</p> : null}
      </div>
    </section>
  )
}
