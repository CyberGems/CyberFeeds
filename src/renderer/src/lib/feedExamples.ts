// Suggested feeds shared by the Add Feed modal and the onboarding wizard.
// Labels are translation keys resolved through useTranslation (addFeed.examples.*).

export type FeedExampleCategory = 'reddit' | 'youtube' | 'news' | 'rss' | 'cybergems'

export type FeedExampleLabelKey =
  | 'redditTechnology'
  | 'youtubeTed'
  | 'bbcNews'
  | 'githubBlog'
  | 'cybergemsReleases'

export interface FeedExample {
  id: string
  category: FeedExampleCategory
  labelKey: FeedExampleLabelKey
  url: string
}

export const FEED_EXAMPLES: FeedExample[] = [
  {
    id: 'cybergems-releases',
    category: 'cybergems',
    labelKey: 'cybergemsReleases',
    url: 'https://github.com/CyberGems/CyberFeeds/releases.atom'
  },
  {
    id: 'reddit-technology',
    category: 'reddit',
    labelKey: 'redditTechnology',
    url: 'https://www.reddit.com/r/technology'
  },
  {
    id: 'youtube-ted',
    category: 'youtube',
    labelKey: 'youtubeTed',
    url: 'https://www.youtube.com/@TED'
  },
  {
    id: 'bbc-news',
    category: 'news',
    labelKey: 'bbcNews',
    url: 'https://feeds.bbci.co.uk/news/rss.xml'
  },
  {
    id: 'github-blog',
    category: 'rss',
    labelKey: 'githubBlog',
    url: 'https://github.blog/feed/'
  }
]
