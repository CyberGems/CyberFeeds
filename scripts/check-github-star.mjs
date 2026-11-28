import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

let cliError = null
let browserError = null
let cliCalls = 0
let browserCalls = 0
const source = fs.readFileSync(new URL('../src/main/github-star.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const { createGitHubStarAction } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
)
const starRepository = createGitHubStarAction(
  async () => {
    browserCalls++
    if (browserError) throw browserError
  },
  (command, args, options, callback) => {
    cliCalls++
    assert.equal(command, 'gh')
    assert.deepEqual(args, [
      'api',
      '--hostname',
      'github.com',
      '--method',
      'PUT',
      'user/starred/CyberGems/CyberFeeds'
    ])
    assert.equal(options.windowsHide, true)
    assert.equal(options.timeout, 12000)
    assert.equal(options.env.GH_PROMPT_DISABLED, '1')
    queueMicrotask(() => callback(cliError))
  }
)
const first = starRepository()
assert.equal(starRepository(), first, 'Concurrent surfaces must share one request')
assert.equal(await first, 'starred')
assert.equal(cliCalls, 1)
assert.equal(browserCalls, 0)
for (const code of ['ENOENT', 'ETIMEDOUT', 'AUTHENTICATION_FAILED']) {
  cliError = Object.assign(new Error(code), { code })
  assert.equal(await starRepository(), 'opened')
}
assert.equal(browserCalls, 3)
browserError = new Error('Browser unavailable')
await assert.rejects(starRepository(), /Browser unavailable/)
cliError = null
browserError = null
assert.equal(await starRepository(), 'starred', 'A failed attempt must allow retry')
console.log('GitHub star smoke passed: success, shared request, browser fallback and retry')
