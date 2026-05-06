import '@wowhaus-24/ui-tokens/tokens.css'
import '@wowhaus-24/ui-tokens/base.css'
import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@wowhaus-24/ui-react'

import { Styleguide } from './Styleguide'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider initOnMount={false}>
      <Styleguide />
    </ThemeProvider>
  </StrictMode>,
)
