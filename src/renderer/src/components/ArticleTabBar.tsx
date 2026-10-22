import React, { memo, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { X, ExternalLink, Link2, XSquare, ChevronLeft, ChevronRight, ChevronDown, Search } from 'lucide-react'
import { useTabsStore, type ArticleTab } from '../store/tabs.store'
import { useSettingsStore } from '../store/settings.store'
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
  const openArticlesInTabs = useSettingsStore((s) => s.settings.openArticlesInTabs !== false)
  const { t } = useTranslation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const counterBtnRef = useRef<HTMLButtonElement>(null)
  const [ctxMenu, setCtxMenu] = useState<TabContextMenuState | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [showTabList, setShowTabList] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null)
  const [filterQuery, setFilterQuery] = useState('')

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const overflow = scrollWidth > clientWidth + 2
    setHasOverflow(overflow)
    setCanScrollLeft(overflow && scrollLeft > 2)
    setCanScrollRight(overflow && scrollLeft + clientWidth < scrollWidth - 2)
  }, [])

  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    const el = scrollContainerRef.current
    if (!el) return
    const distance = Math.max(el.clientWidth * 0.65, 160)
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth'
    })
  }, [])

  // Check overflow on tabs count change or container resize
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    updateScrollState()
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    window.addEventListener('resize', updateScrollState)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateScrollState)
    }
  }, [updateScrollState, tabs])

  // Close menus on outside click, escape or global close event
  useEffect(() => {
    const handleUp = (): void => {
      setCtxMenu(null)
      setShowTabList(false)
    }
    const handleOtherMenu = (e: Event): void => {
      if ((e as CustomEvent<string>).detail !== 'articleTabBar') {
        setCtxMenu(null)
        setShowTabList(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setCtxMenu(null)
        setShowTabList(false)
      }
    }
    const handleResize = (): void => {
      setShowTabList(false)
    }
    window.addEventListener('click', handleUp)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    window.addEventListener('cyberfeeds:close-context-menus', handleOtherMenu)
    return () => {
      window.removeEventListener('click', handleUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
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
    const timer = setTimeout(updateScrollState, 250)
    return () => clearTimeout(timer)
  }, [activeTabId, updateScrollState])

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
    setShowTabList(false)
    const x = Math.min(e.clientX, window.innerWidth - 200)
    const y = Math.min(e.clientY, window.innerHeight - 200)
    setCtxMenu({ x, y, tab })
  }, [])

  const toggleTabList = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation()
    if (showTabList) {
      setShowTabList(false)
      return
    }
    window.dispatchEvent(
      new CustomEvent('cyberfeeds:close-context-menus', { detail: 'articleTabBar' })
    )
    setCtxMenu(null)
    if (counterBtnRef.current) {
      const rect = counterBtnRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 5,
        right: Math.max(8, window.innerWidth - rect.right)
      })
    }
    setFilterQuery('')
    setShowTabList(true)
  }, [showTabList])

  const filteredTabs = useMemo(() => {
    if (!filterQuery.trim()) return tabs
    const q = filterQuery.toLowerCase()
    return tabs.filter(
      (t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.feedTitle || '').toLowerCase().includes(q)
    )
  }, [tabs, filterQuery])

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

  if (tabs.length === 0 || !openArticlesInTabs) {
    return null
  }

  return (
    <div className="article-tab-bar" onContextMenu={(e) => e.preventDefault()}>
      {hasOverflow && (
        <Tooltip label={canScrollLeft ? t.articleTabs.scrollLeft : ''} placement="bottom">
          <button
            type="button"
            disabled={!canScrollLeft}
            onClick={() => scrollTabs('left')}
            aria-label={t.articleTabs.scrollLeft}
            className={`article-tab-bar-nav-btn ${canScrollLeft ? '' : 'disabled'}`}
          >
            <ChevronLeft size={13} strokeWidth={2.2} />
          </button>
        </Tooltip>
      )}

      <div
        ref={scrollContainerRef}
        className="article-tab-bar-scroll"
        onScroll={updateScrollState}
        onWheel={handleWheel}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId
          const isDragOver = dragOverIndex === idx && draggedIndex !== idx

          return (
            <Tooltip
              key={tab.id}
              label={
                <div style={{ maxWidth: 360, whiteSpace: 'normal', lineHeight: 1.35, textAlign: 'center', wordBreak: 'break-word' }}>
                  {tab.title}
                </div>
              }
              placement="bottom"
            >
              <div
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
              >
                <div className="article-tab-favicon">
                  <FeedFavicon icon={tab.feedIcon} title={tab.feedTitle || tab.title} size={14} />
                </div>
                <span className="article-tab-title">{tab.title}</span>
                <Tooltip label={t.articleTabs.closeTab} placement="bottom">
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
                </Tooltip>
              </div>
            </Tooltip>
          )
        })}
      </div>

      {hasOverflow && (
        <Tooltip label={canScrollRight ? t.articleTabs.scrollRight : ''} placement="bottom">
          <button
            type="button"
            disabled={!canScrollRight}
            onClick={() => scrollTabs('right')}
            aria-label={t.articleTabs.scrollRight}
            className={`article-tab-bar-nav-btn ${canScrollRight ? '' : 'disabled'}`}
          >
            <ChevronRight size={13} strokeWidth={2.2} />
          </button>
        </Tooltip>
      )}

      <div className="article-tab-bar-actions">
        <Tooltip
          label={t.articleTabs.tabCountTooltip.replace('{count}', String(tabs.length))}
          placement="bottom"
        >
          <button
            ref={counterBtnRef}
            type="button"
            className={`article-tab-counter-btn ${showTabList ? 'active' : ''}`}
            onClick={toggleTabList}
            aria-label={t.articleTabs.tabCountTooltip.replace('{count}', String(tabs.length))}
          >
            <span className="article-tab-counter-num">{tabs.length}</span>
            <ChevronDown size={11} className="article-tab-counter-arrow" />
          </button>
        </Tooltip>
      </div>

      {showTabList && dropdownPos && (
        <div
          className="article-tabs-dropdown"
          style={{ top: dropdownPos.top, right: dropdownPos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="article-tabs-dropdown-header">
            <span>{t.articleTabs.tabsListTitle}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.75 }}>
              {filterQuery.trim() ? `${filteredTabs.length} / ${tabs.length}` : tabs.length}
            </span>
          </div>

          {tabs.length > 4 && (
            <div className="article-tabs-dropdown-filter">
              <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                autoFocus
                placeholder={t.articleTabs.filterTabsPlaceholder}
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowTabList(false)
                  }
                }}
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )}

          <div className="article-tabs-dropdown-list">
            {filteredTabs.length === 0 ? (
              <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>
                {t.articleTabs.noTabsFound}
              </div>
            ) : (
              filteredTabs.map((tab) => {
                const isActive = tab.id === activeTabId
                return (
                  <div
                    key={tab.id}
                    className={`article-tabs-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setShowTabList(false)
                    }}
                  >
                    <FeedFavicon icon={tab.feedIcon} title={tab.feedTitle || tab.title} size={14} />
                    <span className="article-tabs-dropdown-item-title">{tab.title}</span>
                    <button
                      type="button"
                      className="article-tabs-dropdown-item-close"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.id)
                        if (tabs.length <= 1) {
                          setShowTabList(false)
                        }
                      }}
                      aria-label={t.articleTabs.closeTab}
                    >
                      <X size={11} strokeWidth={2.4} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <div className="article-tabs-dropdown-footer">
            <button
              type="button"
              className="article-tabs-dropdown-footer-btn"
              onClick={() => {
                closeAllTabs()
                setShowTabList(false)
              }}
            >
              <XSquare size={12} />
              <span>{t.articleTabs.closeAllTabs}</span>
            </button>
          </div>
        </div>
      )}

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
