import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// KaTeX 自带样式（含字体，经 Vite 走资源管线）；放在应用样式之前，便于应用侧覆盖
import 'katex/dist/katex.min.css'
import './styles/theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
