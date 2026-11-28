import { execFile } from 'node:child_process'

export type GitHubStarResult = 'starred' | 'opened'
/** One native action shared by all windows of this app. */
export function createGitHubStarAction(
  openRepository: () => Promise<void>,
  runCli: typeof execFile = execFile
) {
  let pending: Promise<GitHubStarResult> | undefined
  return function starRepository(): Promise<GitHubStarResult> {
    if (pending) return pending
    pending = new Promise<GitHubStarResult>((resolve, reject) => {
      runCli(
        'gh',
        ['api', '--hostname', 'github.com', '--method', 'PUT', 'user/starred/CyberGems/CyberFeeds'],
        {
          windowsHide: true,
          timeout: 12_000,
          maxBuffer: 64 * 1024,
          env: { ...process.env, GH_PROMPT_DISABLED: '1' }
        },
        (error) => {
          if (!error) {
            resolve('starred')
            return
          }
          openRepository().then(() => resolve('opened'), reject)
        }
      )
    }).finally(() => {
      pending = undefined
    })
    return pending
  }
}
