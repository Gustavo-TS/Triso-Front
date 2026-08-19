export const MOCK_DATABASE = {
  users: [
    { id: 'usr_admin_01', name: 'Administrador', email: 'admin@triso.com', password: 'triso123', idPermission: 1, permission: 'admin', active: true },
  ],
  products: [
    { id: 1, name: 'Luminária Orbit', category: 'decoracao', price: 189, badge: 'Novo', description: 'Luz indireta com presença escultórica.', marketplaces: [{ name: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/' }, { name: 'Shopee', url: 'https://shopee.com.br/' }], imageUrl: '', art: 'orbit', active: true },
    { id: 2, name: 'Vaso Onda 02', category: 'decoracao', price: 119, badge: 'Mais vendido', description: 'Forma orgânica para arranjos secos.', marketplaces: [{ name: 'Shopee', url: 'https://shopee.com.br/' }, { name: 'Elo7', url: 'https://www.elo7.com.br/' }], imageUrl: '', art: 'vase', active: true },
    { id: 3, name: 'Dock Axis', category: 'setup', price: 89, badge: '', description: 'Suporte modular para celular e cabos.', marketplaces: [{ name: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/' }], imageUrl: '', art: 'dock', active: true },
    { id: 4, name: 'Bandeja Flow', category: 'organizacao', price: 79, badge: '', description: 'Chaves, carteira e pequenos essenciais.', marketplaces: [{ name: 'Shopee', url: 'https://shopee.com.br/' }], imageUrl: '', art: 'tray', active: true },
    { id: 5, name: 'Luminária Nami', category: 'decoracao', price: 169, badge: 'Edição 01', description: 'Textura suave e luz quente para relaxar.', marketplaces: [{ name: 'Elo7', url: 'https://www.elo7.com.br/' }], imageUrl: '', art: 'lamp', active: true },
    { id: 6, name: 'Stand Loop', category: 'setup', price: 69, badge: '', description: 'Apoio compacto para fones de ouvido.', marketplaces: [{ name: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/' }], imageUrl: '', art: 'stand', active: false },
  ],
  marketplaceClicks: [],
}
