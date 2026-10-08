import { useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImagePlus, Loader2, Plus, Send, Trash2 } from 'lucide-react'
import { PLACEHOLDERS, fillPlaceholders, type ChannelOption, type PanelState, type Welcome } from '@vexx/shared'
import { ChannelPicker } from './ChannelPicker'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      {children}
    </label>
  )
}

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <div
      className="toggle"
      role="switch"
      tabIndex={0}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), onChange(!checked))}
    >
      <span className="switch" aria-hidden />
      {children}
    </div>
  )
}

const SAMPLE = { username: 'NewPlayer', count: 128 }

// Everything for the welcome feature: on/off, channel, rotating texts, rotating banners and a preview.
export function WelcomeSection({
  welcome,
  setWelcome,
  state,
  channels,
  channelsLoading,
  busy,
  tagline,
  onUpload,
  onRemoveBanner,
  onTest,
}: {
  welcome: Welcome
  setWelcome: (patch: Partial<Welcome>) => void
  state: PanelState
  channels: ChannelOption[] | null
  channelsLoading: boolean
  busy: string | null
  tagline: string
  onUpload: (files: File[]) => void
  onRemoveBanner: (name: string) => void
  onTest: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [step, setStep] = useState(0)
  const urlOf = (name: string) => state.banners.find((b) => b.name === name)?.url ?? null

  const setText = (i: number, value: string) => setWelcome({ messages: welcome.messages.map((m, j) => (j === i ? value : m)) })
  const moveBanner = (i: number, by: number) => {
    const next = [...welcome.banners]
    const [b] = next.splice(i, 1)
    next.splice(i + by, 0, b)
    setWelcome({ banners: next })
  }

  // the preview walks through the rotation the way consecutive joins would
  const count = SAMPLE.count + step
  const text = welcome.messages.length ? welcome.messages[count % welcome.messages.length] : ''
  const banner = welcome.banners.length ? welcome.banners[count % welcome.banners.length] : null
  const values = { user: `@${SAMPLE.username}`, username: SAMPLE.username, server: 'VEXX', count }
  const savedChannel = state.panel.welcome.channelId
  const savedEnabled = state.panel.welcome.enabled

  return (
    <div className="grid">
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2 className="display">Welcome</h2>
            <span className={`pill ${savedEnabled && savedChannel ? 'good' : ''}`}>
              <span className="dot" aria-hidden />
              {savedEnabled && savedChannel ? 'On' : 'Off'}
            </span>
          </div>
          <div className="card-body">
            <Switch checked={welcome.enabled} onChange={(enabled) => setWelcome({ enabled })}>
              Welcome new members
            </Switch>
            <Field label="Welcome channel" hint="where the welcome is posted">
              <ChannelPicker value={welcome.channelId} channels={channels} loading={channelsLoading} onChange={(channelId) => setWelcome({ channelId })} />
            </Field>
            <div className="row">
              <Field label="Title" hint="optional">
                <input className="input" value={welcome.title} maxLength={256} onChange={(e) => setWelcome({ title: e.target.value })} />
              </Field>
              <Field label="Edge colour">
                <div className="colour">
                  <input type="color" aria-label="Pick the edge colour" value={/^#[0-9a-f]{6}$/i.test(welcome.color) ? welcome.color : '#ff5a1f'} onChange={(e) => setWelcome({ color: e.target.value.toUpperCase() })} />
                  <input className="input" value={welcome.color} maxLength={7} onChange={(e) => setWelcome({ color: e.target.value })} />
                </div>
              </Field>
            </div>
            <Switch checked={welcome.showAvatar} onChange={(showAvatar) => setWelcome({ showAvatar })}>
              Show the new member&apos;s profile picture
            </Switch>
            <Switch checked={welcome.mention} onChange={(mention) => setWelcome({ mention })}>
              Ping the new member
            </Switch>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="display">Welcome texts</h2>
            <span className="hint">One per new member, in turn</span>
          </div>
          <div className="card-body">
            <div className="chips" aria-label="Words you can use">
              {PLACEHOLDERS.map((p) => (
                <span key={p.key} className="chip" title={p.means}>
                  <code>{p.key}</code> {p.means}
                </span>
              ))}
            </div>
            {welcome.messages.map((m, i) => (
              <div className="text-variant" key={i}>
                <div className="text-variant-head">
                  <span>Text {i + 1}</span>
                  <button
                    type="button"
                    className="icon-btn danger"
                    disabled={welcome.messages.length <= 1}
                    onClick={() => setWelcome({ messages: welcome.messages.filter((_, j) => j !== i) })}
                    aria-label={`Remove text ${i + 1}`}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
                <textarea className="textarea short" value={m} maxLength={1500} aria-label={`Welcome text ${i + 1}`} onChange={(e) => setText(i, e.target.value)} />
              </div>
            ))}
            <div>
              <button type="button" className="btn small" disabled={welcome.messages.length >= 10} onClick={() => setWelcome({ messages: [...welcome.messages, 'Welcome {user} to **{server}**!'] })}>
                <Plus size={14} aria-hidden /> Add a text
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="display">Banners</h2>
            <span className="hint">One per new member, in turn</span>
          </div>
          <div className="card-body">
            {welcome.banners.length ? (
              <div className="banners">
                {welcome.banners.map((name, i) => (
                  <div className="banner" key={name}>
                    {urlOf(name) ? <img src={urlOf(name)!} alt={`Banner ${i + 1}`} /> : <div className="banner-missing">Saving…</div>}
                    <div className="banner-bar">
                      <span>{i + 1}</span>
                      <div className="tools">
                        <button type="button" className="icon-btn" disabled={i === 0} onClick={() => moveBanner(i, -1)} aria-label={`Move banner ${i + 1} earlier`}>
                          <ArrowUp size={15} aria-hidden />
                        </button>
                        <button type="button" className="icon-btn" disabled={i === welcome.banners.length - 1} onClick={() => moveBanner(i, 1)} aria-label={`Move banner ${i + 1} later`}>
                          <ArrowDown size={15} aria-hidden />
                        </button>
                        <button type="button" className="icon-btn danger" disabled={busy !== null} onClick={() => onRemoveBanner(name)} aria-label={`Remove banner ${i + 1}`}>
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div
              className={`upload-box${over ? ' over' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.current?.click())}
              onDragOver={(e) => (e.preventDefault(), setOver(true))}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(false)
                onUpload([...e.dataTransfer.files])
              }}
            >
              {busy === 'banner' ? <Loader2 className="spin" aria-hidden /> : <ImagePlus aria-hidden />}
              <div>{welcome.banners.length ? 'Add more banners' : 'Drop banners here, or click to choose'}</div>
              <small>Up to 8. PNG, JPG, WEBP or GIF, 4 MB each. Wide images (about 1600 × 600) look best.</small>
            </div>
            <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => onUpload([...(e.target.files ?? [])])} />
          </div>
        </section>
      </div>

      <div className="sticky">
        <section className="card" aria-label="Welcome preview">
          <div className="card-head">
            <h2 className="display">Preview</h2>
            <div className="stepper">
              <button type="button" className="icon-btn" onClick={() => setStep((s) => s - 1)} aria-label="Previous member">
                <ArrowLeft size={15} aria-hidden />
              </button>
              <span>Member #{count}</span>
              <button type="button" className="icon-btn" onClick={() => setStep((s) => s + 1)} aria-label="Next member">
                <ArrowRight size={15} aria-hidden />
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="discord">
              <div className="msg">
                <img className="msg-avatar" src={state.bot.avatarUrl ?? '/logo.png'} alt="" />
                <div style={{ minWidth: 0 }}>
                  <div className="msg-name">
                    {state.bot.name} <span className="app-tag">APP</span> <span className="msg-time">Today</span>
                  </div>
                  {welcome.mention ? <div className="mention">@{SAMPLE.username}</div> : null}
                  <div className="embed" style={{ ['--embed-colour' as string]: welcome.color }}>
                    <div style={{ minWidth: 0 }}>
                      {welcome.showAvatar ? (
                        <div className="embed-author">
                          <span className="sample-avatar" aria-hidden>
                            N
                          </span>
                          {SAMPLE.username}
                        </div>
                      ) : null}
                      {welcome.title ? <div className="embed-title">{fillPlaceholders(welcome.title, { ...values, user: SAMPLE.username })}</div> : null}
                      <div className="embed-body">{renderBold(fillPlaceholders(text, values))}</div>
                    </div>
                    {welcome.showAvatar ? <span className="sample-avatar big" aria-hidden>N</span> : null}
                    {banner ? urlOf(banner) ? <img className="embed-img" src={urlOf(banner)!} alt="Banner" /> : null : null}
                    {tagline ? <div className="embed-footer">{tagline}</div> : null}
                  </div>
                </div>
              </div>
            </div>
            <p className="hint-text">
              Text {welcome.messages.length ? (count % welcome.messages.length) + 1 : 0} of {welcome.messages.length}
              {welcome.banners.length ? `, banner ${(count % welcome.banners.length) + 1} of ${welcome.banners.length}` : ', no banner yet'}. The real
              welcome uses the member&apos;s own name and picture.
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="display">Try it</h2>
          </div>
          <div className="card-body">
            <p className="hint-text" style={{ margin: 0 }}>
              Sends a sample welcome to the saved channel, with the bot standing in for a new member. Press again to see the next text and banner.
            </p>
            <div>
              <button type="button" className="btn" onClick={onTest} disabled={busy !== null || !savedChannel}>
                {busy === 'test' ? <Loader2 size={15} className="spin" aria-hidden /> : <Send size={15} aria-hidden />}
                Send a test welcome
              </button>
            </div>
            {!savedChannel ? <p className="hint-text" style={{ margin: 0 }}>Pick a welcome channel and save first.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}

// **bold** in the preview, the way Discord shows it
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part))
}
