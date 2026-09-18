import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = resolve('src/shared')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['rss-parser'] })],
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'feed-fetcher.worker': resolve('src/main/workers/feed-fetcher.worker.ts'),
          'content-extractor.worker': resolve('src/main/workers/content-extractor.worker.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': shared
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          notifier: resolve('src/renderer/notifier/index.html'),
          pip: resolve('src/renderer/pip/index.html')
        }
      }
    }
  }
})
