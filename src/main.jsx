import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '../styles.css'
import './shapes.css'
import './admin.css'
import './loading.css'
import './logistics.css'
import './shipping-settings.css'
import './commerce.css'
import './checkout.css'
import './field-light.css'
import './dralfredo.css'
import { CartProvider } from './features/cart/CartContext.jsx'
import { AuthProvider } from './features/auth/AuthContext.jsx'
import { DrAlfredoPage } from './features/dralfredo/DrAlfredoPage.jsx'

const isDrAlfredoRoute = window.location.pathname === '/dralfredo'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isDrAlfredoRoute ? <DrAlfredoPage /> : <AuthProvider><CartProvider><App /></CartProvider></AuthProvider>}</React.StrictMode>,
)
