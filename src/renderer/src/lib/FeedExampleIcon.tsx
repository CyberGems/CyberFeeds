import { Github, MessageCircle, Newspaper, Rss, Youtube } from 'lucide-react'
import type { FeedExampleCategory } from './feedExamples'

export function FeedExampleIcon({ category }: { category: FeedExampleCategory }): JSX.Element {
  if (category === 'cybergems') return <Github size={14} />
  if (category === 'reddit') return <MessageCircle size={14} />
  if (category === 'youtube') return <Youtube size={14} />
  if (category === 'news') return <Newspaper size={14} />
  return <Rss size={14} />
}
