import { useState } from 'react'

export const githubStarLabels = {
  es: {
    idle: 'Dar una estrella en GitHub',
    busy: 'Enviando estrella…',
    starred: 'Estrella añadida, gracias',
    opened: 'Completa la estrella en GitHub',
    error: 'No se pudo abrir GitHub. Reintentar'
  },
  en: {
    idle: 'Star on GitHub',
    busy: 'Starring…',
    starred: 'Starred, thank you',
    opened: 'Complete your star on GitHub',
    error: 'Could not open GitHub. Retry'
  }
}
type StarState = keyof typeof githubStarLabels.en

export function useGitHubStar(
  request: () => Promise<string>,
  spanish: boolean
): {
  giveStar: () => Promise<void>
  starState: StarState
  starLabel: string
} {
  const [state, setState] = useState<StarState>('idle')
  const giveStar = async (): Promise<void> => {
    if (state === 'busy') return
    setState('busy')
    try {
      setState((await request()) === 'starred' ? 'starred' : 'opened')
    } catch (error) {
      console.error(error)
      setState('error')
    }
  }
  return { giveStar, starState: state, starLabel: githubStarLabels[spanish ? 'es' : 'en'][state] }
}
