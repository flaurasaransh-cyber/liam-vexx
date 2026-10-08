import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, ExternalLink, ImagePlus, Loader2, LogOut, RefreshCw, Send, Trash2 } from 'lucide-react'
import { LIMITS, panelSchema, type ChannelOption, type Panel, type PanelState, type Welcome } from '@vexx/shared'
import { ApiError, api } from './api'
import { TopBar } from './TopBar'
import { Members } from './Members'
import { WelcomeSection } from './Welcome'
import { Preview } from './Preview'

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

const clean = (panel: Panel): Panel => ({
  ...panel,
  roster: {
    ...panel.roster,
    team: panel.roster.team.filter((m) => m.name.trim()),
    staff: panel.roster.staff.filter((m) => m.name.trim()),
  },
})

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : 'Never'

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

export function Editor({ onSignOut }: { onSignOut: () => void }) {
  const [state, setState] = useState<PanelState | null>(null)
  const [draft, setDraft] = useState<Panel | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'image' | 'load' | 'banner' | 'test'>('load')
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string; link?: string } | null>(null)
  const [over, setOver] = useState(false)
  const [view, setView] = useState<'about' | 'welcome'>(() => (location.hash === '#welcome' ? 'welcome' : 'about'))
  const [channels, setChannels] = useState<ChannelOption[] | null>(null)
  const [channelsLoading, setChannelsLoading] = useState(false)

  useEffect(() => {
    history.replaceState(null, '', view === 'welcome' ? '#welcome' : '#')
    if (view !== 'welcome' || channels || channelsLoading) return
    setChannelsLoading(true)
    api
      .channels()
      .then((r) => setChannels(r.channels))
      .catch(() => setChannels([]))
      .finally(() => setChannelsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])
  const fileInput = useRef<HTMLInputElement>(null)

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return onSignOut()
    setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'Something went wrong.' })
  }

  async function load() {
    setBusy('load')
    setLoadError(null)
    try {
      const s = await api.state()
      setState(s)
      setDraft(s.panel)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onSignOut()
      setLoadError(err instanceof Error ? err.message : 'Could not load.')
    } finally {
      setBusy(null)
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [])

  const dirty = useMemo(() => Boolean(state && draft && JSON.stringify(clean(draft)) !== JSON.stringify(clean(state.panel))), [state, draft])
  const problem = useMemo(() => {
    if (!draft) return null
    const r = panelSchema.safeParse(clean(draft))
    if (r.success) return null
    const issue = r.error.issues[0]
    return `${issue.path.join(' › ')}: ${issue.message}`
  }, [draft])

  async function save(): Promise<boolean> {
    if (!draft) return false
    if (problem) {
      setNotice({ tone: 'bad', text: problem })
      return false
    }
    setBusy('save')
    try {
      const s = await api.savePanel(clean(draft))
      setState(s)
      setDraft(s.panel)
      setNotice({ tone: 'good', text: view === 'welcome' ? 'Saved. New members get the new welcome straight away.' : 'Saved. Publish to update the message in Discord.' })
      return true
    } catch (err) {
      fail(err)
      return false
    } finally {
      setBusy(null)
    }
  }

  async function publish() {
    if (dirty && !(await save())) return
    setBusy('publish')
    try {
      const s = await api.publish()
      setState(s)
      setDraft(s.panel)
      setNotice({ tone: 'good', text: s.result.edited ? 'The panel in Discord is updated.' : 'The panel is posted in Discord.', link: s.result.url })
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setNotice({ tone: 'bad', text: 'Use a PNG, JPG, WEBP or GIF image.' })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setNotice({ tone: 'bad', text: 'That image is over 8 MB. Use a smaller one.' })
      return
    }
    setBusy('image')
    try {
      const s = await api.uploadImage({ name: file.name, type: file.type, data: await readFile(file) })
      setState(s)
      setNotice({ tone: 'good', text: 'Roster image saved. The Roster button shows it straight away.' })
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  async function removeImage() {
    setBusy('image')
    try {
      setState(await api.removeImage())
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  // banners upload one after another; the saved order follows the order they were chosen in
  async function uploadBanners(files: File[]) {
    const images = files.filter((f) => ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(f.type))
    if (images.length === 0) return setNotice({ tone: 'bad', text: 'Use PNG, JPG, WEBP or GIF images.' })
    setBusy('banner')
    let added = 0
    try {
      for (const file of images) {
        if (file.size > 4 * 1024 * 1024) throw new Error(`${file.name} is over 4 MB. Save it smaller.`)
        const s = await api.uploadBanner({ name: file.name, type: file.type, data: await readFile(file) })
        setState(s)
        // keep unsaved edits, take only the new banner list from the server
        setDraft((d) => (d ? { ...d, welcome: { ...d.welcome, banners: s.panel.welcome.banners } } : d))
        added++
      }
      setNotice({ tone: 'good', text: added === 1 ? 'Banner added.' : `${added} banners added.` })
    } catch (err) {
      if (added) setNotice({ tone: 'bad', text: `${added} added, then: ${err instanceof Error ? err.message : 'an upload failed'}` })
      else fail(err)
    } finally {
      setBusy(null)
    }
  }

  async function removeBanner(name: string) {
    setBusy('banner')
    try {
      const s = await api.removeBanner(name)
      setState(s)
      setDraft((d) => (d ? { ...d, welcome: { ...d.welcome, banners: s.panel.welcome.banners } } : d))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  async function testWelcome() {
    if (dirty && !(await save())) return
    setBusy('test')
    try {
      const r = await api.testWelcome()
      setNotice({ tone: 'good', text: 'Test welcome sent.', link: r.url })
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const signOut = () => {
    api.logout()
    onSignOut()
  }

  const bar = (
    <button className="btn ghost small" onClick={signOut}>
      <LogOut size={15} aria-hidden />
      Sign out
    </button>
  )

  if (!state || !draft) {
    return (
      <>
        <TopBar>{bar}</TopBar>
        <main className="page">
          <div className="center">
            {loadError ? (
              <>
                <div className="notice bad">{loadError}</div>
                <button className="btn" onClick={load}>
                  <RefreshCw size={15} aria-hidden /> Try again
                </button>
              </>
            ) : (
              <>
                <Loader2 className="spin" aria-hidden />
                Loading the panel
              </>
            )}
          </div>
        </main>
      </>
    )
  }

  const about = draft.about
  const roster = draft.roster
  const setAbout = (patch: Partial<Panel['about']>) => setDraft({ ...draft, about: { ...about, ...patch } })
  const setRoster = (patch: Partial<Panel['roster']>) => setDraft({ ...draft, roster: { ...roster, ...patch } })
  const setWelcome = (patch: Partial<Welcome>) => setDraft({ ...draft, welcome: { ...draft.welcome, ...patch } })
  const serverName = state.bot.guilds[0]?.name

  return (
    <>
      <TopBar>{bar}</TopBar>
      <main className="page">
        <div className="views tabs" role="tablist" aria-label="Section">
          <button role="tab" aria-selected={view === 'about'} onClick={() => setView('about')}>
            About panel
          </button>
          <button role="tab" aria-selected={view === 'welcome'} onClick={() => setView('welcome')}>
            Welcome
          </button>
        </div>
        <div className="head">
          {view === 'about' ? (
            <>
              <div>
                <h1 className="display">About panel</h1>
                <p>Edit the welcome message and roster, check the preview, then publish. Publishing again updates the same message.</p>
              </div>
              <button className="btn primary" onClick={publish} disabled={busy !== null}>
                {busy === 'publish' ? <Loader2 size={16} className="spin" aria-hidden /> : <Send size={16} aria-hidden />}
                {state.messageId ? 'Publish changes' : 'Publish to Discord'}
              </button>
            </>
          ) : (
            <div>
              <h1 className="display">Welcome</h1>
              <p>Greets each new member in the channel you pick, with the next text and banner in turn. Changes apply as soon as you save.</p>
            </div>
          )}
        </div>

        {notice ? (
          <div className={`notice ${notice.tone}`} role={notice.tone === 'bad' ? 'alert' : 'status'} style={{ marginBottom: 22 }}>
            {notice.text}{' '}
            {notice.link ? (
              <a href={notice.link} target="_blank" rel="noreferrer">
                Open in Discord
              </a>
            ) : null}
          </div>
        ) : null}

        {view === 'welcome' ? (
          <WelcomeSection
            welcome={draft.welcome}
            setWelcome={setWelcome}
            state={state}
            channels={channels}
            channelsLoading={channelsLoading}
            busy={busy}
            tagline={about.tagline}
            onUpload={uploadBanners}
            onRemoveBanner={removeBanner}
            onTest={testWelcome}
          />
        ) : (
        <div className="grid">
          <div className="stack">
            <section className="card">
              <div className="card-head">
                <h2 className="display">Welcome message</h2>
              </div>
              <div className="card-body">
                <Field label="Title" hint={`${about.title.length}/${LIMITS.embedTitle}`}>
                  <input className="input" value={about.title} maxLength={256} onChange={(e) => setAbout({ title: e.target.value })} />
                </Field>
                <Field label="Message" hint={`${about.body.length}/3500`}>
                  <textarea className="textarea" value={about.body} maxLength={3500} onChange={(e) => setAbout({ body: e.target.value })} />
                </Field>
                <div className="row">
                  <Field label="Tagline" hint="shown in bold at the end">
                    <input className="input" value={about.tagline} maxLength={200} onChange={(e) => setAbout({ tagline: e.target.value })} />
                  </Field>
                  <Field label="Edge colour">
                    <div className="colour">
                      <input type="color" aria-label="Pick the edge colour" value={/^#[0-9a-f]{6}$/i.test(about.color) ? about.color : '#ff5a1f'} onChange={(e) => setAbout({ color: e.target.value.toUpperCase() })} />
                      <input className="input" value={about.color} maxLength={7} onChange={(e) => setAbout({ color: e.target.value })} />
                    </div>
                  </Field>
                </div>
                <div
                  className="toggle"
                  role="switch"
                  tabIndex={0}
                  aria-checked={about.showLogo}
                  onClick={() => setAbout({ showLogo: !about.showLogo })}
                  onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), setAbout({ showLogo: !about.showLogo }))}
                >
                  <span className="switch" aria-hidden />
                  Show the VEXX logo in the corner
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h2 className="display">Buttons</h2>
              </div>
              <div className="card-body">
                <div className="row emoji-row">
                  <Field label="Emoji">
                    <input className="input" value={about.mediaEmoji} maxLength={32} placeholder="☑️" onChange={(e) => setAbout({ mediaEmoji: e.target.value.trim() })} />
                  </Field>
                  <Field label="Media button label">
                    <input className="input" value={about.mediaLabel} maxLength={80} onChange={(e) => setAbout({ mediaLabel: e.target.value })} />
                  </Field>
                </div>
                <Field label="Media link" hint="leave empty to hide the button">
                  <input className="input" type="url" placeholder="https://" value={about.mediaUrl} onChange={(e) => setAbout({ mediaUrl: e.target.value.trim() })} />
                </Field>
                <div className="row emoji-row">
                  <Field label="Emoji">
                    <input className="input" value={about.rosterEmoji} maxLength={32} placeholder="🏆" onChange={(e) => setAbout({ rosterEmoji: e.target.value.trim() })} />
                  </Field>
                  <Field label="Roster button label">
                    <input className="input" value={about.rosterLabel} maxLength={80} onChange={(e) => setAbout({ rosterLabel: e.target.value })} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h2 className="display">Roster</h2>
                <span className="hint">Shown only to whoever presses the button</span>
              </div>
              <div className="card-body">
                <Field label="Roster title">
                  <input className="input" value={roster.title} maxLength={256} onChange={(e) => setRoster({ title: e.target.value })} />
                </Field>
                <Field label="Team heading">
                  <input className="input" value={roster.teamHeading} maxLength={80} onChange={(e) => setRoster({ teamHeading: e.target.value })} />
                </Field>
                <Members label="Team" members={roster.team} numbered={false} rolePlaceholder="Role (optional)" onChange={(team) => setRoster({ team })} />
                <Field label="Staff heading">
                  <input className="input" value={roster.staffHeading} maxLength={80} onChange={(e) => setRoster({ staffHeading: e.target.value })} />
                </Field>
                <Members label="Staff" members={roster.staff} numbered={false} rolePlaceholder="Role, e.g. Coach" onChange={(staff) => setRoster({ staff })} />

                <div className="field">
                  <span>Roster image</span>
                  <div className="upload">
                    {state.rosterImageUrl ? <img className="upload-img" src={state.rosterImageUrl} alt="Current roster image" /> : null}
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
                        void upload(e.dataTransfer.files[0])
                      }}
                    >
                      {busy === 'image' ? <Loader2 className="spin" aria-hidden /> : <ImagePlus aria-hidden />}
                      <div>{state.rosterImageUrl ? 'Replace the image' : 'Drop an image here, or click to choose'}</div>
                      <small>PNG, JPG, WEBP or GIF, up to 8 MB</small>
                    </div>
                    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => void upload(e.target.files?.[0])} />
                    {state.rosterImageUrl ? (
                      <div>
                        <button type="button" className="btn small" onClick={removeImage} disabled={busy !== null}>
                          <Trash2 size={14} aria-hidden /> Remove image
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="sticky">
            <Preview panel={draft} botName={state.bot.name} avatar={state.bot.avatarUrl ?? '/logo.png'} imageUrl={state.rosterImageUrl} />

            <section className="card">
              <div className="card-head">
                <h2 className="display">Bot</h2>
                <span className={`pill ${state.bot.online ? 'good' : 'bad'}`}>
                  <span className="dot" aria-hidden />
                  {state.bot.online ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="card-body">
                <div className="status">
                  <div className="status-row">
                    Server <b>{serverName ?? 'Not in a server yet'}</b>
                  </div>
                  <div className="status-row">
                    Last published <b>{when(state.publishedAt)}</b>
                  </div>
                  {state.messageUrl ? (
                    <div className="status-row">
                      Message
                      <b>
                        <a href={state.messageUrl} target="_blank" rel="noreferrer">
                          Open in Discord <ExternalLink size={12} aria-hidden />
                        </a>
                      </b>
                    </div>
                  ) : null}
                </div>
                <Field label="Channel ID" hint="where the panel is posted">
                  <input className="input" inputMode="numeric" value={draft.channelId} onChange={(e) => setDraft({ ...draft, channelId: e.target.value.trim() })} />
                </Field>
              </div>
            </section>
          </div>
        </div>
        )}
      </main>

      {dirty ? (
        <div className="savebar" role="status">
          <p>{problem ? problem : 'You have changes that are not saved.'}</p>
          <button className="btn ghost small" onClick={() => setDraft(state.panel)} disabled={busy !== null}>
            Discard
          </button>
          <button className="btn small" onClick={() => void save()} disabled={busy !== null || Boolean(problem)}>
            {busy === 'save' ? <Loader2 size={14} className="spin" aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
            Save
          </button>
        </div>
      ) : null}
    </>
  )
}
