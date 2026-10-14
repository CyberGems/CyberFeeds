import React, { memo, useRef, useState, useEffect, useCallback } from 'react'
import { X, ExternalLink, Link2, XSquare } from 'lucide-react'
import { useTabsStore, type ArticleTab } from '../store/tabs.store'
import { FeedFavicon } from './ArticleList'
import Tooltip from './Tooltip'
import { useTranslation } from '../hooks/useTranslation'

interface TabContextMenuState {
  x: number
  y: number
  tab: ArticleTab
}

export const ArticleTabBar = memo(function ArticleTabBar(): JSX.Element | null {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeTabsToTheRight,
    closeAllTabs,
    reorderTabs
  } = useTabsStore()
  const { t } = useTranslation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<TabContextMenuState | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Close context menu on outside click or global close event
  useEffect(() => {
    const handleUp = (): void => setCtxMenu(null)
    const handleOtherMenu = (e: Event): void => {
      if ((e as CustomEvent<string>).detail !== 'articleTabBar') {
        setCtxMenu(null)
      }
    }
    window.addEventListener('click', handleUp)
    window.addEventListener('cyberfeeds:close-context-menus', handleOtherMenu)
    return () => {
      window.removeEventListener('click', handleUp)
      window.removeEventListener('cyberfeeds:close-context-menus', handleOtherMenu)
    }
  }, [])

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!activeTabId || !scrollContainerRef.current) return
    const activeEl = scrollContainerRef.current.querySelector<HTMLElement>(
      `[data-tab-id="${activeTabId}"]`
    )
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [activeTabId])

  // Mouse wheel horizontal scroll handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft += e.deltaY
    }
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: ArticleTab) => {
    e.preventDefault()
    e.stopPropagation()
    window.dispatchEvent(
      new CustomEvent('cyberfeeds:close-context-menus', { detail: 'articleTabBar' })
    )
    const x = Math.min(e.clientX, window.innerWidth - 200)
    const y = Math.min(e.clientY, window.innerHeight - 200)
    setCtxMenu({ x, y, tab })
  }, [])

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number): void => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e: React.DragEvent, index: number): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number): void => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      reorderTabs(draggedIndex, targetIndex)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = (): void => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="article-tab-bar" onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={scrollContainerRef}
        className="article-tab-bar-scroll"
        onWheel={handleWheel}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId
          const isDragOver = dragOverIndex === idx && draggedIndex !== idx

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              className={`article-tab ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => setActiveTab(tab.id)}
              onAuxClick={(e) => {
                // Middle-click closes tab
                if (e.button === 1) {
                  e.preventDefault()
                  closeTab(tab.id)
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, tab)}
              title={tab.title}
            >
              <div className="article-tab-favicon">
                <FeedFavicon icon={tab.feedIcon} title={tab.feedTitle || tab.title} size={14} />
              </div>
              <span className="article-tab-title">{tab.title}</span>
              <button
                type="button"
                className="article-tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                aria-label={t.articleTabs.closeTab}
              >
                <X size={11} strokeWidth={2.4} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="article-tab-bar-actions">
        <Tooltip label={t.articleTabs.closeAllTabs} placement="bottom">
          <button
            type="button"
            className="article-tab-bar-action-btn"
            onClick={closeAllTabs}
            aria-label={t.articleTabs.closeAllTabs}
          >
            <XSquare size={14} />
          </button>
        </Tooltip>
      </div>

      {ctxMenu && (
        <div
          className="ctx-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="ctx-item"
            onClick={() => {
              closeTab(ctxMenu.tab.id)
              setCtxMenu(null)
            }}
          >
            <X size={14} />
            {t.articleTabs.closeTab}
          </div>
          {tabs.length > 1 && (
            <div
              className="ctx-item"
              onClick={() => {
                closeOtherTabs(ctxMenu.tab.id)
                setCtxMenu(null)
              }}
            >
              {t.articleTabs.closeOtherTabs}
            </div>
          )}
          {tabs.findIndex((t) => t.id === ctxMenu.tab.id) < tabs.length - 1 && (
            <div
              className="ctx-item"
              onClick={() => {
                closeTabsToTheRight(ctxMenu.tab.id)
                setCtxMenu(null)
              }}
            >
              {t.articleTabs.closeTabsToTheRight}
            </div>
          )}
          <div
            className="ctx-item danger"
            onClick={() => {
              closeAllTabs()
              setCtxMenu(null)
            }}
          >
            {t.articleTabs.closeAllTabs}
          </div>
          {ctxMenu.tab.url && (
            <>
              <div className="ctx-divider" />
              <div
                className="ctx-item"
                onClick={() => {
                  navigator.clipboard.writeText(ctxMenu.tab.url!)
                  setCtxMenu(null)
                }}
              >
                <Link2 size={14} />
                {t.articleTabs.copyLink}
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  window.api.openExternal(ctxMenu.tab.url!)
                  setCtxMenu(null)
                }}
              >
                <ExternalLink size={14} />
                {t.articleTabs.openInBrowser}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
})

export default ArticleTabBar
