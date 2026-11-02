import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  FileUp,
  Languages,
  MailCheck,
  MousePointerClick,
  Plus,
  Settings2
} from 'lucide-react'
import { useFeedsStore } from '../store/feeds.store'
import { useSettingsStore } from '../store/settings.store'
import { useTranslation } from '../hooks/useTranslation'
import { FEED_EXAMPLES } from '../lib/feedExamples'
import { FeedExampleIcon } from '../lib/FeedExampleIcon'
import logoPng from '../../../../resources/icon.png'

interface OnboardingWizardProps {
  preview?: boolean
  onClose?: () => void
}

interface AddTally {
  added: number
  existed: number
  failed: number
}

const THEME_IDS = ['dark', 'grayscale', 'light'] as const

// First-run setup, shown only when the app has never been used (no feeds and
// onboardingDone is false). A full-window takeover in three steps: welcome
// (language + theme with live preview), first feeds (suggestions shared with
// the Add Feed modal) and a short summary. Esc skips, Enter advances.
export default function OnboardingWizard({ preview = false, onClose }: OnboardingWizardProps): JSX.Element {
  const { t } = useTranslation()
  const { settings, update, save } = useSettingsStore()
  const feedCount = useFeedsStore((s) => s.feeds.length)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [urlInput, setUrlInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [tally, setTally] = useState<AddTally>({ added: 0, existed: 0, failed: 0 })

  const selectedCount = FEED_EXAMPLES.filter((e) => selected[e.id]).length

  const applyTheme = (theme: (typeof THEME_IDS)[number]): void => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('cyberfeeds-theme', theme)
    } catch {
      /* ignore */
    }
    update({ theme })
  }

  const finish = async (): Promise<void> => {
    if (preview) {
      onClose?.()
      return
    }
    try {
      await save({ ...useSettingsStore.getState().settings, onboardingDone: true })
    } catch {
      /* the flag is cosmetic at this point; still leave the wizard */
    }
    window.location.reload()
  }

  const addUrls = async (urls: string[]): Promise<void> => {
    setAdding(true)
    const next: AddTally = { added: 0, existed: 0, failed: 0 }
    for (const url of urls) {
      try {
        const res = await useFeedsStore.getState().addFeed(url, '', undefined)
        if (res.feed) next.added += 1
        else if (res.error === 'Feed already exists') next.existed += 1
        else next.failed += 1
      } catch {
        next.failed += 1
      }
    }
    setTally(next)
    setAdding(false)
    setStep(3)
  }

  const handlePrimary = async (): Promise<void> => {
    if (step === 1) {
      setStep(2)
      return
    }
    if (step === 2) {
      // Preview mode promises not to touch the library: jump to the summary.
      if (preview) {
        setStep(3)
        return
      }
      const urls = FEED_EXAMPLES.filter((e) => selected[e.id]).map((e) => e.url)
      const typed = urlInput.trim()
      if (typed) urls.push(typed)
      if (urls.length === 0) {
        setStep(3)
        return
      }
      await addUrls(urls)
      return
    }
    void finish()
  }

  const handleImportOpml = async (): Promise<void> => {
    try {
      const res = await window.api.importOpml()
      if (!res || res.canceled) return
      await useFeedsStore.getState().loadAll()
      setStep(3)
    } catch {
      /* dialog failed; stay on the step */
    }
  }

  // Esc skips (keeping whatever language/theme the user previewed), Enter
  // advances. Enter is ignored while typing in the URL field so submitting a
  // URL never jumps steps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (e.key === 'Escape' && !adding) {
        void finish()
      } else if (e.key === 'Enter' && !typing && !adding) {
        void handlePrimary()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const themeLabels: Record<(typeof THEME_IDS)[number], string> = {
    dark: t.settings.general.themes.dark,
    grayscale: t.settings.general.themes.grayscale,
    light: t.settings.general.themes.light
  }

  const count = feedCount
  const primaryLabel =
    step === 1
      ? t.onboarding.next
      : step === 2
        ? selectedCount === 0 && !urlInput.trim()
          ? t.onboarding.next
          : selectedCount + (urlInput.trim() ? 1 : 0) === 1
            ? t.onboarding.addOne
            : t.onboarding.addMany.replace('{n}', String(selectedCount + (urlInput.trim() ? 1 : 0)))
        : t.onboarding.startReading

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label={t.onboarding.welcomeTitle}>
      <div className="onboarding-brand">
        <img src={logoPng} alt="" aria-hidden="true" />
        <span>CyberFeeds</span>
      </div>

      {preview && <div className="onboarding-preview-banner">{t.onboarding.previewBanner}</div>}

      <div className="onboarding-body">
        <div className="onboarding-dots" aria-hidden="true">
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className={`onboarding-dot${step === n ? ' active' : ''}${step > n ? ' done' : ''}`}>
              <i />
              <em>{n === 1 ? t.onboarding.dotWelcome : n === 2 ? t.onboarding.dotFeeds : t.onboarding.dotReady}</em>
            </div>
          ))}
        </div>

        {step === 1 && (
          <section className="onboarding-step">
            <div className="onboarding-hero">
              <img src={logoPng} alt="" aria-hidden="true" />
            </div>
            <h2>{t.onboarding.welcomeTitle}</h2>
            <p className="onboarding-sub">{t.onboarding.welcomeSub}</p>
            <div className="onboarding-fieldset">
              <div className="onboarding-legend">{t.onboarding.languageLegend}</div>
              <div className="onboarding-langrow">
                <button
                  type="button"
                  className="onboarding-lang"
                  aria-pressed={settings.language === 'es'}
                  onClick={() => update({ language: 'es' })}
                >
                  <Languages size={15} aria-hidden="true" />
                  Español
                </button>
                <button
                  type="button"
                  className="onboarding-lang"
                  aria-pressed={settings.language === 'en'}
                  onClick={() => update({ language: 'en' })}
                >
                  <Languages size={15} aria-hidden="true" />
                  English
                </button>
              </div>
            </div>
            <div className="onboarding-fieldset">
              <div className="onboarding-legend">{t.onboarding.themeLegend}</div>
              <div className="onboarding-themegrid">
                {THEME_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="onboarding-theme"
                    aria-pressed={settings.theme === id}
                    onClick={() => applyTheme(id)}
                  >
                    <span className={`onboarding-swatch onboarding-swatch-${id}`}>
                      <i />
                      <i />
                      <i />
                    </span>
                    <b>{themeLabels[id]}</b>
                    <small>
                      {id === 'dark'
                        ? t.onboarding.themeDarkHint
                        : id === 'grayscale'
                          ? t.onboarding.themeGrayHint
                          : t.onboarding.themeLightHint}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="onboarding-step">
            <div className="onboarding-hero">
              <Plus size={30} aria-hidden="true" />
            </div>
            <h2>{t.onboarding.feedsTitle}</h2>
            <p className="onboarding-sub">{t.onboarding.feedsSub}</p>
            <div className="onboarding-fieldset">
              <div className="onboarding-urlrow">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder={t.onboarding.urlPlaceholder}
                  aria-label={t.onboarding.urlLabel}
                />
              </div>
              <div className="onboarding-legend">{t.onboarding.suggestionsLegend}</div>
              <div className="onboarding-exgrid">
                {FEED_EXAMPLES.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    className="onboarding-ex"
                    aria-pressed={!!selected[ex.id]}
                    onClick={() => setSelected((s) => ({ ...s, [ex.id]: !s[ex.id] }))}
                  >
                    <span className="onboarding-exicon">
                      <FeedExampleIcon category={ex.category} />
                    </span>
                    <span className="onboarding-extext">
                      <b>{t.addFeed.examples[ex.labelKey]}</b>
                      <small>{t.addFeed.exampleCategories[ex.category]}</small>
                    </span>
                    <span className="onboarding-excheck">
                      <Check size={11} aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="onboarding-auxrow">
              <button type="button" className="onboarding-aux" onClick={() => void handleImportOpml()}>
                <FileUp size={14} aria-hidden="true" />
                <span>{t.onboarding.importOpml}</span>
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="onboarding-step">
            <div className="onboarding-donebig">
              <CheckCircle2 size={54} aria-hidden="true" />
            </div>
            <h2>{t.onboarding.readyTitle}</h2>
            <p className="onboarding-stat">
              {count === 0 ? (
                t.onboarding.readyNone
              ) : (
                <>
                  <b>{count}</b> {count === 1 ? t.onboarding.readyOne : t.onboarding.readyMany}
                </>
              )}
            </p>
            {tally.existed > 0 && (
              <p className="onboarding-note">{t.onboarding.existedNote.replace('{n}', String(tally.existed))}</p>
            )}
            {tally.failed > 0 && (
              <p className="onboarding-note onboarding-note-warn">
                {t.onboarding.failedNote.replace('{n}', String(tally.failed))}
              </p>
            )}
            <div className="onboarding-tips">
              <span className="onboarding-tip">
                <MousePointerClick size={13} aria-hidden="true" />
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> {t.onboarding.tipNav}
                </span>
              </span>
              <span className="onboarding-tip">
                <BookOpen size={13} aria-hidden="true" />
                <span>
                  <kbd>Enter</kbd> {t.onboarding.tipOpen}
                </span>
              </span>
              <span className="onboarding-tip">
                <MailCheck size={13} aria-hidden="true" />
                <span>
                  <kbd>M</kbd> {t.onboarding.tipRead}
                </span>
              </span>
            </div>
            <div className="onboarding-auxrow">
              <span className="onboarding-aux onboarding-aux-static">
                <Settings2 size={14} aria-hidden="true" />
                <span>{t.onboarding.tipSettings}</span>
              </span>
            </div>
          </section>
        )}

        {adding && (
          <div className="onboarding-scrim" role="status" aria-live="polite">
            <div className="onboarding-spinner" aria-hidden="true" />
            <span>{t.onboarding.adding}</span>
          </div>
        )}
      </div>

      <div className="onboarding-footer">
        <button
          type="button"
          className="onboarding-skip"
          onClick={() => void finish()}
          style={{ visibility: step === 3 ? 'hidden' : 'visible' }}
        >
          {t.onboarding.skip}
        </button>
        <div className="onboarding-navbtns">
          {step > 1 && (
            <button type="button" className="btn onboarding-back" onClick={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2)}>
              <ArrowLeft size={15} aria-hidden="true" />
              {t.onboarding.back}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => void handlePrimary()} disabled={adding}>
            {step === 2 && selectedCount + (urlInput.trim() ? 1 : 0) > 0 ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <ArrowRight size={15} aria-hidden="true" />
            )}
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
