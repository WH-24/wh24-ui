import '@wowhaus/ui-tokens/tokens.css'
import '@wowhaus/ui-tokens/base.css'
import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@wowhaus/ui-react'

import { Styleguide } from './Styleguide'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider initOnMount={false}>
      <Styleguide />
    </ThemeProvider>
  </StrictMode>,
)
