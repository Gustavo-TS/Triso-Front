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
import { CampaignSealPage } from './features/campaigns/CampaignSealPage.jsx'
import { CAMPAIGNS } from './features/campaigns/campaigns.js'

const campaignPage = window.location.pathname === '/dralfredo'
  ? <CampaignSealPage campaign={CAMPAIGNS.dralfredo} />
  : window.location.pathname === '/marlonreis'
    ? <CampaignSealPage campaign={CAMPAIGNS.marlonreis} />
    : null

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{campaignPage || <AuthProvider><CartProvider><App /></CartProvider></AuthProvider>}</React.StrictMode>,
)
