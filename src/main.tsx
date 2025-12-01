import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RepoContext } from '@automerge/automerge-repo-react-hooks'
import './index.css'
import App from './App.tsx'
import { repo } from './collab/repo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RepoContext.Provider value={repo}>
      <App />
    </RepoContext.Provider>
  </StrictMode>,
)
