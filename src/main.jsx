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
import './campaigns.css'
import './sales.css'
import { CartProvider } from './features/cart/CartContext.jsx'
import { AuthProvider } from './features/auth/AuthContext.jsx'
import { CampaignSealPage } from './features/campaigns/CampaignSealPage.jsx'
import { CAMPAIGNS } from './features/campaigns/campaigns.js'
import { PartySealPage } from './features/events/PartySealPage.jsx'
import { EVENTS } from './features/events/events.js'
import { SalesTemplatePage } from './features/sales/SalesTemplatePage.jsx'

const standaloneCampaigns = {
  '/dralfredo': CAMPAIGNS.dralfredo,
  '/marlonreis': CAMPAIGNS.marlonreis,
  '/nathanbarbearia': CAMPAIGNS.nathanbarbearia,
  '/portalnoticiasbahia': CAMPAIGNS.portalnoticiasbahia,
  '/inac': CAMPAIGNS.inac,
  '/modelo-selo': CAMPAIGNS.triso,
};
const path = window.location.pathname;
const standalonePage = standaloneCampaigns[path]
  ? <CampaignSealPage campaign={standaloneCampaigns[path]} />
  : path === EVENTS.isabella15.route
    ? <PartySealPage event={EVENTS.isabella15} />
    : path === '/apresentacao'
      ? <SalesTemplatePage />
      : null

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{standalonePage || <AuthProvider><CartProvider><App /></CartProvider></AuthProvider>}</React.StrictMode>,
)

