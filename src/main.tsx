import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryProvider } from '@/providers/query-provider'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <QueryProvider>
      <App />
    </QueryProvider>
  </BrowserRouter>,
)
