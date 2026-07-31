import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import './i18n'
import App from './App.tsx'
import { AppSkeleton } from './shared/ui/AppSkeleton'
import { initRiveRuntime } from './shared/ui/riveRuntime'
import { store } from './store'

// Before anything can mount an avatar: the Rive loader keeps whichever WASM URL
// it had when the first instance asked for a runtime.
initRiveRuntime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      {/* Every page calls useTranslation, so the whole tree suspends on the
          locale bundle. One boundary here covers all of them. */}
      <Suspense fallback={<AppSkeleton />}>
        <App />
      </Suspense>
    </Provider>
  </StrictMode>,
)
