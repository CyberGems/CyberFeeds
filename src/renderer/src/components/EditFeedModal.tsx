import { useState, useEffect } from 'react'
import { X, Edit2 } from 'lucide-react'
import { useFeedsStore } from '../store/feeds.store'
import { useUIStore } from '../store/ui.store'
import { useTranslation } from '../hooks/useTranslation'
import { useOverlayDismiss } from '../hooks/useOverlayDismiss'

export default function EditFeedModal(): JSX.Element | null {
  const { feeds, folders, updateFeed } = useFeedsStore()
  const { closePanel, editFeedId } = useUIStore()
  const { t } = useTranslation()
  const overlayDismiss = useOverlayDismiss(closePanel)
  
  const feed = feeds.find(f => f.id === editFeedId)
  
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [folderId, setFolderId] = useState('')
  const [loading, setLoading] = useState(false)

  // Initialize state when feed changes
  useEffect(() => {
    if (feed) {
      setTitle(feed.title)
      setUrl(feed.url)
      setFolderId(feed.folderId || '')
    }
  }, [feed])

  if (!feed) return null

  const handleSave = async (): Promise<void> => {
    if (!title.trim() || !url.trim()) return
    setLoading(true)
    await updateFeed(feed.id, { title: title.trim(), url: url.trim(), folderId: folderId || '' })
    setLoading(false)
    closePanel()
  }

  return (
    <div className="modal-overlay" {...overlayDismiss}>
      <div className="modal">
        <div className="modal-header">
          <Edit2 size={16} style={{ color: 'var(--accent)' }} />
          <h2>{t.editFeed.title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={closePanel}><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t.editFeed.titleLabel}</label>
            <input
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t.editFeed.urlLabel}</label>
            <input
              className="form-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="edit-feed-folder">{t.editFeed.folderLabel}</label>
            <select id="edit-feed-folder" className="form-select" value={folderId} onChange={e => setFolderId(e.target.value)}>
              <option value="">{t.addFeed.noFolder}</option>
              {[...folders].sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={closePanel}>{t.sidebar.cancel}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || !title.trim()}>
            {loading ? <div className="spinner" style={{ width: 13, height: 13 }} /> : t.editFeed.saveBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
