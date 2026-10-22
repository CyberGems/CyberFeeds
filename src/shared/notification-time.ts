import type { NotificationHistoryItem } from './types'

/**
 * Receipt time of a notification (epoch ms).
 *
 * `receivedAt` is the moment the notification was actually raised, which may be
 * much later than the article publication time for backfilled feeds. Legacy rows
 * have no `receivedAt` value, so we fall back to `createdAt` (which historically
 * stored the publication time).
 */
export function getReceivedAt(
  item: Pick<NotificationHistoryItem, 'createdAt' | 'receivedAt'>
): number {
  return typeof item.receivedAt === 'number' && !isNaN(item.receivedAt)
    ? item.receivedAt
    : item.createdAt
}
