import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TRAY_TOOLTIP_MAX_LEN, formatTrayTooltip } from '../src/main/tray-tooltip.ts'

test('the tray tooltip uses the suite format with a single segment', () => {
  assert.equal(formatTrayTooltip('Alt+Shift+F'), 'CyberFeeds · Alt+Shift+F')
  assert.equal(formatTrayTooltip('Refreshing feeds...'), 'CyberFeeds · Refreshing feeds...')
})

test('the tray tooltip falls back to the bare app name without a segment', () => {
  assert.equal(formatTrayTooltip(undefined), 'CyberFeeds')
  assert.equal(formatTrayTooltip(null), 'CyberFeeds')
  assert.equal(formatTrayTooltip(''), 'CyberFeeds')
  assert.equal(formatTrayTooltip('   '), 'CyberFeeds')
})

test('the tray tooltip is capped at 63 characters with an ellipsis', () => {
  const tooltip = formatTrayTooltip('X'.repeat(80))
  assert.equal(tooltip.length, TRAY_TOOLTIP_MAX_LEN)
  assert.ok(tooltip.endsWith('…'))
  assert.ok(tooltip.startsWith('CyberFeeds · '))
})
