import { useEffect, useState } from 'react'

function Versions(): React.JSX.Element {
  const [versions, setVersions] = useState<{ electron?: string; chrome?: string; node?: string }>({})

  useEffect(() => {
    void window.api?.getVersions?.().then((next) => {
      if (next) setVersions(next)
    })
  }, [])

  return (
    <ul className="versions">
      <li className="electron-version">Electron v{versions.electron ?? ''}</li>
      <li className="chrome-version">Chromium v{versions.chrome ?? ''}</li>
      <li className="node-version">Node v{versions.node ?? ''}</li>
    </ul>
  )
}

export default Versions
