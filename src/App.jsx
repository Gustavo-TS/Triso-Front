import { useEffect, useMemo, useRef, useState } from 'react'
import { APP_CONFIG, CATALOG_OPTIONS, CATEGORY_LABELS } from './config/app.js'
import { analyticsService } from './services/analyticsService.js'
import { authService } from './services/authService.js'
import { catalogService } from './services/catalogService.js'

const categories = CATEGORY_LABELS
const emptyProduct = CATALOG_OPTIONS.productDefaults
const ADMIN_EMAIL = APP_CONFIG.adminAccountLabel
const money = value => Number(value).toLocaleString(APP_CONFIG.locale, { style: 'currency', currency: APP_CONFIG.currency })
const getMarketplaces = product => product.marketplaces?.length ? product.marketplaces : product.marketplaceUrl ? [{ name: product.marketplace || 'Marketplace', url: product.marketplaceUrl }] : []
const EMPTY_MARKETPLACE_OPTIONS = [{ id: 'missing-marketplace', name: 'Nenhum marketplace cadastrado', unavailable: true }]

function useSpaLocation() {
  const [location, setLocation] = useState(() => ({ pathname: window.location.pathname, search: window.location.search }))
  useEffect(() => {
    const update = () => setLocation({ pathname: window.location.pathname, search: window.location.search })
    const navigate = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target.closest?.('a[href]')
      if (!anchor || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) return
      const samePageAnchor = url.pathname === window.location.pathname && url.search === window.location.search && url.hash
      if (samePageAnchor) return
      event.preventDefault()
      const next = `${url.pathname}${url.search}${url.hash}`
      if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return
      window.history.pushState({}, '', next)
      update()
      if (!url.hash) window.scrollTo({ top: 0, behavior: 'instant' })
    }
    document.addEventListener('click', navigate)
    window.addEventListener('popstate', update)
    return () => { document.removeEventListener('click', navigate); window.removeEventListener('popstate', update) }
  }, [])
  useEffect(() => {
    const root = document.getElementById('root')
    root?.classList.remove('route-enter')
    const frame = requestAnimationFrame(() => root?.classList.add('route-enter'))
    const timer = setTimeout(() => root?.classList.remove('route-enter'), 420)
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [location.pathname, location.search])
  return location
}

function useProducts(mode) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = async () => {
    if (!mode) { setProducts([]); setLoading(false); return [] }
    setLoading(true); setError('')
    try { const items=await catalogService.list({admin:mode==='admin'});items.forEach(item=>{if(item.category&&item.categoryName)categories[item.category]=item.categoryName});setProducts(items);return items }
    catch (err) { setError(err.message); return [] }
    finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [mode])
  const saveProduct = async product => { await catalogService.save(product);const items=await reload();return items.find(item=>item.id===product.id)||items[0] }
  const toggleProduct = async id => { const current=products.find(item=>item.id===id);if(!current)return;await catalogService.save({...current,status:current.active?'draft':'published',active:!current.active});await reload() }
  const removeProduct = async id => { await catalogService.remove(id);setProducts(items=>items.filter(item=>item.id!==id)) }
  return { products, loading, error, reload, saveProduct, toggleProduct, removeProduct }
}

function useClicks() {
  const [clicks, setClicks] = useState([])
  useEffect(() => { analyticsService.listClicks().then(setClicks) }, [])
  const recordClick = (product, listing) => { analyticsService.trackMarketplaceClick(product,listing).then(event=>setClicks(current=>[...current,event])).catch(()=>{}) }
  return [clicks, recordClick]
}

function useCatalogOptions(enabled) {
  const [options, setOptions] = useState({ categories: [], marketplaces: [] })
  const reload = async () => {
    if (!enabled) return { categories: [], marketplaces: [] }
    const [categoryResult,marketplaceResult]=await Promise.allSettled([catalogService.listCategories({admin:true}),catalogService.listMarketplaces({admin:true})])
    const allCategories=categoryResult.status==='fulfilled'?categoryResult.value:[]
    const marketplaces=marketplaceResult.status==='fulfilled'?marketplaceResult.value.filter(marketplace=>marketplace.active!==false):[]
    const next={categories:allCategories.filter(category=>category.active!==false),marketplaces}
    setOptions(next)
    return next
  }
  useEffect(() => { reload() }, [enabled])
  return { ...options, reload }
}

const SearchIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
const ExternalIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>
const PlusIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
const EditIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4 4-.8L18.4 8 16 5.6 4 16Z"/><path d="m14.5 7.2 2.4 2.4"/></svg>
const TrashIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>

function Brand({ dark = false, large = false }) {
  return <a className={`brand ${dark ? 'brand-dark' : ''} ${large ? 'brand-large' : ''}`} href="/" aria-label="Triso, página inicial"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>TRISO<small>STUDIO</small></span></a>
}

function ProductShape({ type }) { return <div className={`product-shape shape-${type || 'vase'}`}><i/><i/><i/></div> }

function ProductVisual({ product, small = false, imageUrl }) {
  const displayImage=imageUrl||product.images?.[0]?.url||product.imageUrl
  return <div className={small ? 'admin-product-thumb' : 'product-art'}>
    {displayImage ? <img src={displayImage} alt={product.name}/> : <ProductShape type={product.art}/>} 
    {!small && product.badge && <span className="product-badge">{product.badge}</span>}
  </div>
}

function Header() {
  const [menu, setMenu] = useState(false)
  const [sticky, setSticky] = useState(false)
  useEffect(() => { const scroll = () => setSticky(window.scrollY > 70); window.addEventListener('scroll', scroll, { passive: true }); return () => window.removeEventListener('scroll', scroll) }, [])
  return <header className={`header ${sticky ? 'sticky' : ''}`}><div className="container header-inner"><Brand/><nav className="desktop-nav"><a href="#loja">Produtos</a><a href="#colecoes">Coleções</a><a href="#sobre">Sobre</a></nav><div className="header-actions"><a className="admin-entry" href="?admin=1">Área administrativa</a><button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Abrir menu" aria-expanded={menu}><i/><i/></button></div></div><div className={`mobile-menu ${menu ? 'open' : ''}`} aria-hidden={!menu}>{['Produtos','Coleções','Sobre'].map((item,i)=><a key={item} href={['#loja','#colecoes','#sobre'][i]} onClick={()=>setMenu(false)}>{item}</a>)}<a href="?admin=1">Área administrativa</a></div></header>
}

function Hero({ products, loading }) {
  const [layer, setLayer] = useState(1)
  const featuredProduct = useMemo(() => products.find(product => product.active) || null, [products])
  useEffect(() => { if (!featuredProduct || matchMedia('(prefers-reduced-motion: reduce)').matches) { setLayer(1); return }; const timer = setInterval(() => setLayer(value => value >= 240 ? 1 : value + 1), 180); return () => clearInterval(timer) }, [featuredProduct])
  const progress = `${layer / 240 * 100}%`
  const statusLabel=loading?'Carregando catálogo':featuredProduct?'Em impressão agora':'Catálogo em atualização'
  const productLabel=loading?'Preparando destaque':featuredProduct?.name||'Novidades em breve'
  return <section className="hero" id="inicio"><div className="hero-grid"/><div className="hero-glow hero-glow-a"/><div className="hero-glow hero-glow-b"/><div className="container hero-layout"><div className="hero-copy"><div className="kicker"><span>Nova coleção</span> Forma 01 — 2026</div><h1>Design que ganha<br/><em>forma.</em> Camada<br/>por camada.</h1><p>Objetos autorais para casa, setup e rotina. Escolha seu produto e compre com segurança no seu marketplace preferido.</p><div className="hero-actions"><a className="button button-primary" href="#loja">Ver produtos <span>↘</span></a></div><div className="hero-notes"><span><b>01</b> PLA premium</span><span><b>02</b> Feito no Brasil</span><span><b>03</b> Compra segura</span></div></div><div className={`hero-stage ${loading?'is-loading':''}`}><div className="stage-label"><i/> {statusLabel}</div><div className="orbit-art printing-art">{featuredProduct?.imageUrl ? <img src={featuredProduct.imageUrl} alt={featuredProduct.name} loading="eager" decoding="async" fetchPriority="high"/> : featuredProduct ? <ProductShape type={featuredProduct.art}/> : <div className="printing-placeholder"/>}<div className="orbit-shadow"/>{featuredProduct&&<div className="print-layer"/>}</div><div className="stage-meta"><div><small>PRODUTO / {featuredProduct ? String(featuredProduct.id).slice(-3).padStart(3, '0') : '---'}</small><strong>{productLabel}</strong></div><div className="stage-price"><small>{featuredProduct?'A partir de':'Catálogo'}</small><strong>{featuredProduct ? money(featuredProduct.price) : '—'}</strong></div></div><div className="stage-progress"><span style={{ width: featuredProduct ? progress : '0%' }}/></div><div className="stage-readout"><span>{featuredProduct?<>CAMADA <b>{layer}</b>/240</>:'AGUARDANDO PRODUTO'}</span><span>{featuredProduct?'0.20 MM · PLA':'TRISO STUDIO'}</span></div></div></div></section>
}

function Collections({ setFilter }) {
  const choose = category => () => setFilter(category)
  return <section className="collections section" id="colecoes"><div className="container"><div className="section-heading"><div><h2>Feito para o seu espaço.</h2></div><p>Peças funcionais com presença escultórica, criadas para transformar os pequenos rituais do dia.</p></div><div className="collection-grid"><a className="collection-card collection-card-large" href="#loja" onClick={choose('decoracao')}><div className="collection-visual visual-vase"><div className="vase-body"/><div className="vase-body vase-back"/></div><CollectionInfo code="01">Casa &<br/>Decoração</CollectionInfo></a><a className="collection-card" href="#loja" onClick={choose('setup')}><div className="collection-visual visual-stand"><div className="stand-top"/><div className="stand-leg"/><div className="stand-phone"/></div><CollectionInfo code="02">Setup &<br/>Office</CollectionInfo></a><a className="collection-card" href="#loja" onClick={choose('organizacao')}><div className="collection-visual visual-tray"><div/><div/><div/></div><CollectionInfo code="03">Organização</CollectionInfo></a></div></div></section>
}
function CollectionInfo({ code, children }) { return <div className="collection-info"><span>{code} — Coleção</span><h3>{children}</h3><b>Explorar <i>↗</i></b></div> }

function ProductCard({ product, onOpen }) {
  const listings = getMarketplaces(product)
  return <article className="product-card product-card-clickable" onClick={() => onOpen(product)}><ProductVisual product={product}/><div className="product-info"><span className="product-overline">{product.categoryName || categories[product.category] || 'Outros'} · {listings.length} {listings.length === 1 ? 'loja disponível' : 'lojas disponíveis'}</span><div className="product-title-row"><h3>{product.name}</h3><strong>{money(product.price)}</strong></div><p>{product.description}</p><button className="marketplace-button" type="button"><span>Ver anúncio do produto</span><span>→</span></button></div></article>
}

function Shop({ products, filter, setFilter, onOpen, error, loading, onRetry }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
  const visible = useMemo(() => { const q=query.trim().toLocaleLowerCase('pt-BR'); const list=products.filter(p=>p.active&&(filter==='todos'||p.category===filter)&&`${p.name} ${p.description} ${getMarketplaces(p).map(m=>m.name).join(' ')}`.toLocaleLowerCase('pt-BR').includes(q)); if(sort==='low')list.sort((a,b)=>a.price-b.price);if(sort==='high')list.sort((a,b)=>b.price-a.price);if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));return list },[products,filter,query,sort])
  const filterItems=useMemo(()=>[['todos','Todos'],...Array.from(new Map(products.filter(p=>p.category).map(p=>[p.category,p.categoryName||categories[p.category]||p.category])).entries())],[products])
  return <section className="shop section" id="loja"><div className="container"><div className="shop-top"><div><span className="eyebrow">Catálogo online</span><h2>Escolhas da Triso.</h2></div><div className="shop-actions"><label className="search-box"><SearchIcon/><input value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="Buscar no catálogo..."/></label><label className="sort-box"><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Em destaque</option><option value="low">Menor preço</option><option value="high">Maior preço</option><option value="name">Nome A–Z</option></select></label></div></div><div className="filter-row">{filterItems.map(([value,label])=><button key={value} className={`filter ${filter===value?'active':''}`} onClick={()=>setFilter(value)}>{label} <span>{products.filter(p=>p.active&&(value==='todos'||p.category===value)).length.toString().padStart(2,'0')}</span></button>)}</div>{error?<div className="empty-state"><p>Não foi possível carregar os produtos. {error}</p><button className="admin-primary" type="button" onClick={onRetry}>Tentar novamente</button></div>:loading?<p className="empty-state">Carregando produtos...</p>:visible.length?<div className="product-grid">{visible.map(product=><ProductCard key={product.id} product={product} onOpen={onOpen}/>)}</div>:<p className="empty-state">Nenhum produto encontrado nesta categoria.</p>}</div></section>
}

function ProductDetail({ product, onClose, onMarketplaceClick }) {
  const listings = getMarketplaces(product)
  const images=(product.images||[]).filter(image=>image.url)
  const [selectedIndex,setSelectedIndex]=useState(0)
  const touchStart=useRef(null)
  const selectedImage=images[selectedIndex]?.url||product.imageUrl||''
  const go=direction=>setSelectedIndex(current=>images.length?(current+direction+images.length)%images.length:0)
  useEffect(()=>setSelectedIndex(0),[product.id])
  useEffect(() => { document.body.classList.add('locked'); const navigate = e => { if(e.key==='Escape')onClose();if(images.length>1&&e.key==='ArrowLeft')go(-1);if(images.length>1&&e.key==='ArrowRight')go(1) }; document.addEventListener('keydown', navigate); return () => { document.body.classList.remove('locked'); document.removeEventListener('keydown', navigate) } }, [onClose,images.length])
  const beginSwipe=event=>{touchStart.current=event.changedTouches[0].clientX}
  const endSwipe=event=>{if(touchStart.current===null||images.length<2)return;const distance=touchStart.current-event.changedTouches[0].clientX;touchStart.current=null;if(Math.abs(distance)>45)go(distance>0?1:-1)}
  return <div className="product-detail-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><article className="product-detail"><button className="product-detail-close" onClick={onClose} aria-label="Fechar anúncio">×</button><div className="detail-gallery" onTouchStart={beginSwipe} onTouchEnd={endSwipe}><div className="detail-slide" key={selectedImage}><ProductVisual product={product} imageUrl={selectedImage}/></div>{images.length>1&&<><div className="detail-carousel-controls"><button type="button" onClick={()=>go(-1)} aria-label="Imagem anterior">←</button><span aria-live="polite">{selectedIndex+1} / {images.length}</span><button type="button" onClick={()=>go(1)} aria-label="Próxima imagem">→</button></div><div className="detail-thumbnails">{images.map((image,index)=><button type="button" className={selectedIndex===index?'active':''} key={image.id||image.url||index} onClick={()=>setSelectedIndex(index)} aria-label={`Ver imagem ${index+1}`}><img src={image.url} alt={image.altText||`${product.name} — imagem ${index+1}`}/></button>)}</div></>}<div className="detail-index"><span>TRISO / PRODUTO</span><b>#{String(product.id).slice(-5)}</b></div></div><div className="detail-copy"><span className="eyebrow">{categories[product.category] || 'Outros'}</span><h1>{product.name}</h1><p className="detail-description">{product.description}</p><div className="detail-price"><small>A partir de</small><strong>{money(product.price)}</strong></div><div className="detail-specs"><div><span>Material</span><b>PLA Premium</b></div><div><span>Produção</span><b>Sob demanda</b></div><div><span>Origem</span><b>São Paulo, BR</b></div></div><div className="detail-marketplaces"><div><span>ONDE COMPRAR</span><small>Você será direcionado para o anúncio oficial</small></div>{listings.length ? listings.map((listing,index)=><a key={`${listing.name}-${index}`} className={`marketplace-link detail-market-${listing.name.toLowerCase().replaceAll(' ','-')}`} href={listing.url} target="_blank" rel="noopener noreferrer" onClick={() => onMarketplaceClick(product, listing)}><span><i>{listing.name.slice(0,2).toUpperCase()}</i><b>Comprar no {listing.name}</b></span><ExternalIcon/></a>) : <p className="no-listings">Este produto ainda não está disponível em marketplaces.</p>}</div><div className="detail-safe"><span>✓</span><p><b>Compra externa e segura</b><small>Pagamento, entrega e garantia são processados pelo marketplace escolhido.</small></p></div></div></article></div>
}

function Manifesto() { return <section className="manifesto"><div className="container manifesto-grid"><div className="manifesto-art"><div className="wire-sphere"><i/><i/><i/><i/></div><span className="axis axis-x">X</span><span className="axis axis-y">Y</span><span className="axis axis-z">Z</span><span className="dimension dim-a">Ø 180 MM</span><span className="dimension dim-b">240 CAMADAS</span></div><div className="manifesto-copy" id="sobre"><span className="eyebrow">Por que a Triso?</span><h2>Menos estoque.<br/>Mais intenção.</h2><p>Não fazemos objetos para preencher prateleiras. Criamos peças que resolvem, organizam e expressam — produzidas apenas quando você escolhe.</p><div className="manifesto-points"><div><b>98%</b><span>do material pode ser reaproveitado</span></div><div><b>0</b><span>estoque produzido sem necessidade</span></div><div><b>1:1</b><span>cuidado em cada peça impressa</span></div></div></div></div></section> }
function Footer() { return <footer className="footer"><div className="container"><div className="footer-main"><Brand large/><p>Objetos autorais produzidos<br/>camada por camada em São Paulo.</p><div className="footer-links"><div><b>Loja</b><a href="#loja">Todos os produtos</a><a href="#colecoes">Coleções</a></div><div><b>Ajuda</b><a href="mailto:contato@trisostudio.com.br">Contato</a><a href="#inicio">Envios e prazos</a></div><div><b>Gestão</b><a href="?admin=1">Área administrativa →</a></div></div></div><div className="footer-bottom"><span>© 2026 Triso Studio</span><span>Design local · Produção consciente</span></div></div></footer> }

function PublicStore({ products, recordClick, productError, productsLoading, onRetryProducts }) {
  const [filter,setFilter]=useState('todos')
  const [selected,setSelected]=useState(null)
  return <><Header/><main><Hero products={products} loading={productsLoading}/><Collections setFilter={setFilter}/><Shop products={products} filter={filter} setFilter={setFilter} onOpen={setSelected} error={productError} loading={productsLoading} onRetry={onRetryProducts}/><Manifesto/></main><Footer/>{selected&&<ProductDetail product={selected} onClose={()=>setSelected(null)} onMarketplaceClick={recordClick}/>}</>
}

function Login({ onLogin }) {
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState('')
  const submit=async e=>{e.preventDefault();setError('');try{const session=await authService.login({email,password});onLogin(session)}catch(err){setError(err.message)}}
  return <main className="auth-page"><div className="auth-side"><Brand/><div><span className="eyebrow">Painel Triso</span><h1>Sua vitrine,<br/>sob controle.</h1><p>Cadastre produtos e mantenha os links dos marketplaces sempre atualizados.</p></div><small>ACESSO RESTRITO · ADMINISTRAÇÃO</small></div><div className="auth-form-wrap"><a className="back-store" href="/">← Voltar para a loja</a><form className="auth-form" onSubmit={submit}><span className="admin-kicker">LOGIN / ADMIN</span><h2>Bem-vindo de volta.</h2><p>Entre com suas credenciais para gerenciar o catálogo.</p><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="username" required/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required/></label>{error&&<div className="form-error">{error}</div>}<button className="admin-primary" type="submit">Entrar no painel <span>→</span></button>{APP_CONFIG.dataSource==='mock'&&<div className="demo-login"><b>Ambiente de demonstração</b><span>Credenciais definidas no banco mockado.</span></div>}</form></div></main>
}

function ProductImagesEditor({ images, art, onImagesChange, onArtChange }) {
  const update=(index,field,value)=>onImagesChange(images.map((image,i)=>i===index?{...image,[field]:value}:image))
  const normalizeCover=list=>list.map((image,index)=>({...image,isCover:index===0}))
  const add=()=>{if(images.length<10)onImagesChange(normalizeCover([...images,{clientId:crypto.randomUUID(),url:'',altText:'',isCover:false}]))}
  const remove=index=>onImagesChange(normalizeCover(images.filter((_,i)=>i!==index)))
  const move=(index,direction)=>{const target=index+direction;if(target<0||target>=images.length)return;const next=[...images];[next[index],next[target]]=[next[target],next[index]];onImagesChange(normalizeCover(next))}
  if(!images.length)return <><label>Visual padrão<select value={art||'vase'} onChange={event=>onArtChange(event.target.value)}>{CATALOG_OPTIONS.visuals.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label><div className="image-fields field-wide"><div className="image-fields-head"><span><b>Imagens do produto</b><small>Ao adicionar uma imagem, ela substitui o visual padrão</small></span><button type="button" onClick={add}>+ Adicionar imagem</button></div></div></>
  return <div className="image-fields field-wide"><div className="image-fields-head"><span><b>Imagens do produto</b><small>Até 10 imagens em URL HTTPS; a primeira imagem é sempre a capa</small></span><button type="button" onClick={add} disabled={images.length>=10}>+ Adicionar imagem</button></div>{images.map((image,index)=><div className="image-field-row" key={image.id||image.clientId||index}><div className="image-order-controls"><span>{index+1}</span><button type="button" onClick={()=>move(index,-1)} disabled={index===0} aria-label={`Mover imagem ${index+1} para cima`}>↑</button><button type="button" onClick={()=>move(index,1)} disabled={index===images.length-1} aria-label={`Mover imagem ${index+1} para baixo`}>↓</button></div><div className={`image-cover-choice ${index===0?'is-cover':''}`}><span>{index===0?'Capa':'Galeria'}</span></div><input type="url" pattern="https://.*" value={image.url} onChange={event=>update(index,'url',event.target.value)} placeholder="https://.../produto.jpg" required/><input value={image.altText||''} onChange={event=>update(index,'altText',event.target.value)} placeholder="Texto alternativo" maxLength="200"/><button className="image-remove" type="button" onClick={()=>remove(index)} aria-label="Remover imagem">×</button></div>)}</div>
}

function ProductForm({ product, onSave, onClose, categoryOptions, marketplaceOptions }) {
  const remoteOptions=useCatalogOptions(true)
  const [categoryModalOpen,setCategoryModalOpen]=useState(false)
  const [marketplaceModalOpen,setMarketplaceModalOpen]=useState(false)
  const [saving,setSaving]=useState(false)
  categoryOptions=categoryOptions||remoteOptions.categories
  marketplaceOptions=marketplaceOptions||remoteOptions.marketplaces
  if(!marketplaceOptions.length)marketplaceOptions=EMPTY_MARKETPLACE_OPTIONS
  const [form,setForm]=useState(() => {
    const source = product || emptyProduct
    const firstMarketplace=marketplaceOptions.find(item=>!item.unavailable)
    const images=source.images?.length?source.images.map((image,index)=>({...image,clientId:image.id||crypto.randomUUID(),isCover:index===0})):source.imageUrl?[{clientId:crypto.randomUUID(),url:source.imageUrl,altText:source.name||'',isCover:true}]:[]
    return { ...source, images, imageUrl:(images.find(image=>image.isCover)||images[0])?.url||'', categoryId:source.categoryId||categoryOptions[0]?.id||'', marketplaces: getMarketplaces(source).length ? getMarketplaces(source) : firstMarketplace ? [{ marketplaceId:firstMarketplace.id, name:firstMarketplace.name, url:'' }] : [] }
  })
  useEffect(()=>{const firstMarketplace=marketplaceOptions.find(item=>!item.unavailable);setForm(current=>{const categoryId=current.categoryId||categoryOptions[0]?.id||'';const marketplaces=current.marketplaces.length||!firstMarketplace?current.marketplaces:[{marketplaceId:firstMarketplace.id,name:firstMarketplace.name,url:''}];if(categoryId===current.categoryId&&marketplaces===current.marketplaces)return current;return {...current,categoryId,marketplaces}})},[categoryOptions,marketplaceOptions])
  const set=(field,value)=>setForm(current=>({...current,[field]:value}))
  const setImages=images=>setForm(current=>{const normalized=images.map((image,index)=>({...image,isCover:index===0}));return {...current,images:normalized,imageUrl:normalized[0]?.url||'',art:normalized.length?'':current.art||'vase'}})
  const categoriesChanged=async preferred=>{const refreshed=await remoteOptions.reload();setForm(current=>{const preferredId=preferred?.active!==false&&refreshed.categories.some(item=>item.id===preferred?.id)?preferred.id:null;const currentId=refreshed.categories.some(item=>item.id===current.categoryId)?current.categoryId:null;return {...current,categoryId:preferredId||currentId||refreshed.categories[0]?.id||''}})}
  const marketplacesChanged=async preferred=>{const refreshed=await remoteOptions.reload();setForm(current=>{const available=refreshed.marketplaces;return {...current,marketplaces:current.marketplaces.map(listing=>{const selected=available.find(item=>item.id===listing.marketplaceId)||(listing.marketplaceId==='missing-marketplace'?available.find(item=>item.id===preferred?.id):null)||available[0];return selected?{...listing,marketplaceId:selected.id,name:selected.name}:listing}).filter(listing=>listing.marketplaceId)}})}
  const setListing=(index,field,value)=>setForm(current=>({...current,marketplaces:current.marketplaces.map((item,i)=>i===index?{...item,[field]:value}:item)}))
  const setListingMarketplace=(index,id)=>{const marketplace=marketplaceOptions.find(item=>item.id===id);setForm(current=>({...current,marketplaces:current.marketplaces.map((item,i)=>i===index?{...item,marketplaceId:id,name:marketplace?.name||''}:item)}))}
  const addListing=()=>setForm(current=>{const used=new Set(current.marketplaces.map(item=>item.marketplaceId));const marketplace=marketplaceOptions.find(item=>!item.unavailable&&!used.has(item.id));return marketplace?{...current,marketplaces:[...current.marketplaces,{marketplaceId:marketplace.id,name:marketplace.name,url:''}]}:current})
  const removeListing=index=>setForm(current=>({...current,marketplaces:current.marketplaces.filter((_,i)=>i!==index)}))
  const submit=async e=>{e.preventDefault();if(saving)return;const valid=form.marketplaces.filter(item=>item.marketplaceId&&item.url&&marketplaceOptions.some(option=>option.id===item.marketplaceId&&!option.unavailable));if(new Set(valid.map(item=>item.marketplaceId)).size!==valid.length){window.alert('Selecione cada marketplace apenas uma vez.');return}setSaving(true);try{await onSave({...form,price:Number(form.price),status:form.active?'published':'draft',marketplaces:valid,marketplace:valid[0]?.name||'',marketplaceUrl:valid[0]?.url||''})}catch(error){window.alert(error.message);setSaving(false)}}
  return <><div className="admin-modal-backdrop"><div className="product-modal"><div className="modal-head"><div><span className="admin-kicker">PRODUTO / {product?'EDIÇÃO':'NOVO'}</span><h2>{product?'Editar produto':'Cadastrar produto'}</h2></div><button onClick={onClose}>×</button></div><form className="product-form" onSubmit={submit}><div className="form-grid"><label className="field-wide">Nome do produto<input minLength="2" maxLength="120" value={form.name} onChange={e=>set('name',e.target.value)} required/></label><label>Preço inicial (R$)<input type="number" min="0" step="0.01" value={form.price} onChange={e=>set('price',e.target.value)} required/></label><label>Categoria<select value={form.categoryId} onChange={e=>set('categoryId',e.target.value)} required><option value="" disabled>Selecione</option>{categoryOptions.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="category-create-inline" type="button" onClick={()=>setCategoryModalOpen(true)}>Gerenciar categorias</button></label><label className="field-wide">Descrição<textarea maxLength="2000" value={form.description} onChange={e=>set('description',e.target.value)} rows="3"/></label><label>Selo do produto<input value={form.badge||''} onChange={e=>set('badge',e.target.value)} placeholder="Novo, Destaque..."/></label><ProductImagesEditor images={form.images||[]} art={form.art} onImagesChange={setImages} onArtChange={value=>set('art',value)}/><div className="marketplace-fields field-wide"><div className="marketplace-fields-head"><span><b>Anúncios nos marketplaces</b><small>Selecione o marketplace e informe apenas o link do anúncio</small></span><div><button type="button" onClick={()=>setMarketplaceModalOpen(true)}>Gerenciar marketplaces</button><button type="button" onClick={addListing} disabled={form.marketplaces.length>=10}>+ Adicionar canal</button></div></div>{form.marketplaces.map((listing,index)=><div className="marketplace-field-row" key={listing.id||index}><select value={listing.marketplaceId||''} onChange={e=>setListingMarketplace(index,e.target.value)} required><option value="" disabled>Marketplace</option>{marketplaceOptions.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><input type="url" pattern="https://.*" value={listing.url} onChange={e=>setListing(index,'url',e.target.value)} placeholder="Link HTTPS do anúncio" required/><button type="button" onClick={()=>removeListing(index)} aria-label="Remover canal">×</button></div>)}</div><label className="status-toggle field-wide"><input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/><i/><span><b>Produto publicado</b><small>Aparece na vitrine pública</small></span></label></div><div className="form-preview"><span>PRÉ-VISUALIZAÇÃO</span><ProductVisual product={form}/><h3>{form.name||'Nome do produto'}</h3><p>{form.marketplaces.length} canais · {form.price?money(form.price):'R$ 0,00'}</p></div><div className="modal-actions"><button type="button" className="admin-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="admin-primary">Salvar produto <span>→</span></button></div></form></div></div>{categoryModalOpen&&<CategoryModal onClose={()=>setCategoryModalOpen(false)} onChanged={categoriesChanged}/>} {marketplaceModalOpen&&<MarketplaceModal onClose={()=>setMarketplaceModalOpen(false)} onChanged={marketplacesChanged}/>}</>
}

function AnalyticsPanel({ clicks }) {
  const today = new Date().toISOString().slice(0,10)
  const dateBefore = days => { const date=new Date();date.setDate(date.getDate()-(days-1));return date.toISOString().slice(0,10) }
  const [from,setFrom]=useState(dateBefore(30)),[to,setTo]=useState(today),[preset,setPreset]=useState(30)
  const choosePreset=days=>{setPreset(days);setTo(today);setFrom(days==='all'?'2020-01-01':dateBefore(days))}
  const filtered=useMemo(()=>clicks.filter(click=>{const date=click.timestamp.slice(0,10);return date>=from&&date<=to}),[clicks,from,to])
  const groupBy=key=>Object.entries(filtered.reduce((acc,item)=>{const value=typeof key==='function'?key(item):item[key];acc[value]=(acc[value]||0)+1;return acc},{})).sort((a,b)=>b[1]-a[1])
  const products=groupBy('productName'),markets=groupBy('marketplace'),links=groupBy(item=>`${item.productName}|||${item.marketplace}|||${item.url}`)
  const daily=Object.entries(filtered.reduce((acc,item)=>{const day=item.timestamp.slice(0,10);acc[day]=(acc[day]||0)+1;return acc},{})).sort((a,b)=>a[0].localeCompare(b[0]))
  const chartData=daily.slice(-30),chartMax=Math.max(...chartData.map(([,value])=>value),1),marketMax=Math.max(...markets.map(([,value])=>value),1)
  return <section className="analytics-panel"><div className="analytics-head"><div><span className="admin-kicker">ANALYTICS / CLIQUES</span><h2>Desempenho dos anúncios</h2><p>Acompanhe quais produtos e canais mais levam visitantes para a compra.</p></div><div className="date-controls"><div>{[[7,'7 dias'],[30,'30 dias'],[90,'90 dias'],['all','Tudo']].map(([value,label])=><button key={value} className={preset===value?'active':''} onClick={()=>choosePreset(value)}>{label}</button>)}</div><label>De<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPreset('custom')}}/></label><span>→</span><label>Até<input type="date" value={to} max={today} onChange={e=>{setTo(e.target.value);setPreset('custom')}}/></label></div></div><div className="analytics-metrics"><div><span>Cliques no período</span><b>{filtered.length}</b><small>{clicks.length} cliques no total</small></div><div><span>Produto mais clicado</span><b>{products[0]?.[0]||'—'}</b><small>{products[0]?`${products[0][1]} cliques`:'Sem dados no período'}</small></div><div><span>Marketplace líder</span><b>{markets[0]?.[0]||'—'}</b><small>{markets[0]?`${markets[0][1]} cliques`:'Sem dados no período'}</small></div></div><div className="analytics-grid"><article className="click-chart-card"><div className="analytics-card-head"><div><h3>Cliques ao longo do tempo</h3><span>Últimos {chartData.length||0} dias com atividade</span></div><b>{filtered.length}</b></div>{chartData.length?<div className="click-chart">{chartData.map(([date,value])=><div className="chart-column" key={date} title={`${new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')}: ${value} cliques`}><span>{value}</span><i style={{height:`${Math.max(8,value/chartMax*100)}%`}}/><small>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</small></div>)}</div>:<EmptyAnalytics/>}</article><article className="market-ranking"><div className="analytics-card-head"><div><h3>Marketplaces</h3><span>Distribuição de cliques</span></div></div>{markets.length?<div className="market-bars">{markets.map(([name,value])=><div key={name}><span><b>{name}</b><strong>{value}</strong></span><i><b style={{width:`${value/marketMax*100}%`}}/></i></div>)}</div>:<EmptyAnalytics/>}</article></div><article className="link-ranking"><div className="analytics-card-head"><div><h3>Cliques por produto e link</h3><span>Ranking detalhado de cada anúncio publicado</span></div></div>{links.length?<div className="link-ranking-table"><div className="link-ranking-row link-ranking-header"><span>Posição</span><span>Produto</span><span>Marketplace</span><span>Cliques</span><span>Participação</span></div>{links.map(([key,value],index)=>{const [product,market]=key.split('|||');return <div className="link-ranking-row" key={key}><span>#{String(index+1).padStart(2,'0')}</span><span><b>{product}</b></span><span><i>{market.slice(0,2).toUpperCase()}</i>{market}</span><strong>{value}</strong><span>{filtered.length?Math.round(value/filtered.length*100):0}%</span></div>})}</div>:<EmptyAnalytics/>}</article></section>
}

function EmptyAnalytics(){return <div className="analytics-empty"><span>↗</span><b>Aguardando os primeiros cliques</b><small>Os acessos aos marketplaces aparecerão aqui.</small></div>}

function CleanAnalytics({ clicks }) {
  const today=new Date().toISOString().slice(0,10)
  const before=days=>{const d=new Date();d.setDate(d.getDate()-(days-1));return d.toISOString().slice(0,10)}
  const [period,setPeriod]=useState(30),[from,setFrom]=useState(before(30)),[to,setTo]=useState(today),[dashboard,setDashboard]=useState(null),[dashboardError,setDashboardError]=useState('')
  const selectPeriod=days=>{setPeriod(days);setFrom(before(days==='all'?366:days));setTo(today)}
  useEffect(()=>{if(APP_CONFIG.dataSource!=='api')return;const earliest=before(366);if(from<earliest){setFrom(earliest);return}if(from>to){setFrom(to);return}let current=true;setDashboardError('');analyticsService.getDashboard(from,to).then(value=>current&&setDashboard(value)).catch(error=>current&&setDashboardError(error.message));return()=>{current=false}},[from,to])
  const localData=useMemo(()=>clicks.filter(c=>c.timestamp.slice(0,10)>=from&&c.timestamp.slice(0,10)<=to),[clicks,from,to])
  const rank=key=>Object.entries(localData.reduce((acc,item)=>{const value=key(item);acc[value]=(acc[value]||0)+1;return acc},{})).sort((a,b)=>b[1]-a[1])
  const apiRank=items=>(items||[]).map(item=>[item.name||item.productName||item.marketplaceName||'Sem nome',Number(item.clicks||0)]).sort((a,b)=>b[1]-a[1])
  const productRank=dashboard?apiRank(dashboard.products?.length?dashboard.products:dashboard.summary?.topProduct?[dashboard.summary.topProduct]:[]):rank(c=>c.productName),marketRank=dashboard?apiRank(dashboard.marketplaces?.length?dashboard.marketplaces:dashboard.summary?.topMarketplace?[dashboard.summary.topMarketplace]:[]):rank(c=>c.marketplace),linkRank=dashboard?[]:rank(c=>`${c.productName}|||${c.marketplace}|||${c.url}`)
  const daily=dashboard?(dashboard.timeseries||[]).map(item=>[item.date.slice(0,10),Number(item.clicks||0)]):Object.entries(localData.reduce((acc,item)=>{const day=item.timestamp.slice(0,10);acc[day]=(acc[day]||0)+1;return acc},{})).sort((a,b)=>a[0].localeCompare(b[0])).slice(-30)
  const totalClicks=dashboard?.summary?.totalClicks??localData.length
  const data={length:totalClicks}
  const maxDay=Math.max(...daily.map(([,v])=>v),1),maxMarket=Math.max(...marketRank.map(([,v])=>v),1)
  if(APP_CONFIG.dataSource==='api'&&!dashboard&&!dashboardError)return <div className="app-loading"><span/><p>Carregando indicadores...</p></div>
  if(dashboardError)return <div className="analytics-empty"><b>Não foi possível carregar os indicadores</b><small>{dashboardError}</small></div>
  return <><div className="clean-filter"><div className="period-tabs">{[[7,'7 dias'],[30,'30 dias'],[90,'90 dias'],['all','Todo período']].map(([value,label])=><button key={value} className={period===value?'active':''} onClick={()=>selectPeriod(value)}>{label}</button>)}</div><div className="custom-dates"><label>De<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPeriod('custom')}}/></label><span>até</span><label>Até<input type="date" value={to} max={today} onChange={e=>{setTo(e.target.value);setPeriod('custom')}}/></label></div></div><div className="clean-kpis"><article><span>Cliques no período</span><b>{data.length}</b><small>saídas para marketplaces</small></article><article><span>Produto líder</span><b>{productRank[0]?.[0]||'Sem dados'}</b><small>{productRank[0]?`${productRank[0][1]} cliques no período`:'Aguardando cliques'}</small></article><article><span>Canal líder</span><b>{marketRank[0]?.[0]||'Sem dados'}</b><small>{marketRank[0]?`${Math.round(marketRank[0][1]/data.length*100)}% dos cliques`:'Aguardando cliques'}</small></article><article><span>Produtos acessados</span><b>{productRank.length}</b><small>produtos diferentes</small></article></div><section className="clean-chart-card"><div className="clean-section-head"><div><h2>Evolução dos cliques</h2><p>Quantidade de acessos enviados aos marketplaces por dia.</p></div><strong>{data.length}<small>total no período</small></strong></div>{daily.length?<div className="clean-chart">{daily.map(([date,value])=><div key={date} className="clean-bar" title={`${date}: ${value} cliques`}><span>{value}</span><i style={{height:`${Math.max(7,value/maxDay*100)}%`}}/><small>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</small></div>)}</div>:<EmptyAnalytics/>}</section><div className="clean-rank-grid"><section className="clean-rank-card"><div className="clean-section-head"><div><h2>Produtos mais clicados</h2><p>Interesse total, somando todos os canais.</p></div></div>{productRank.length?<ol>{productRank.slice(0,5).map(([name,value],index)=><li key={name}><span><i>{index+1}</i><b>{name}</b></span><strong>{value}<small>cliques</small></strong><em><i style={{width:`${value/productRank[0][1]*100}%`}}/></em></li>)}</ol>:<EmptyAnalytics/>}</section><section className="clean-rank-card"><div className="clean-section-head"><div><h2>Marketplaces</h2><p>Distribuição dos acessos por canal.</p></div></div>{marketRank.length?<div className="clean-markets">{marketRank.map(([name,value])=><div key={name}><span><i>{name.slice(0,2).toUpperCase()}</i><b>{name}</b></span><strong>{value}<small>{Math.round(value/data.length*100)}%</small></strong><em><i style={{width:`${value/maxMarket*100}%`}}/></em></div>)}</div>:<EmptyAnalytics/>}</section></div><section className="clean-links"><div className="clean-section-head"><div><h2>Desempenho por anúncio</h2><p>Cada linha representa um link específico publicado em um marketplace.</p></div><span>{linkRank.length} links com atividade</span></div>{linkRank.length?<div className="clean-links-table"><div className="clean-link-row clean-link-head"><span>Produto</span><span>Marketplace</span><span>Cliques</span><span>% do total</span></div>{linkRank.map(([key,value])=>{const [product,market,url]=key.split('|||');return <div className="clean-link-row" key={key}><span><b>{product}</b><small title={url}>{url}</small></span><span><i>{market.slice(0,2).toUpperCase()}</i>{market}</span><strong>{value}</strong><span>{Math.round(value/data.length*100)}%</span></div>})}</div>:<EmptyAnalytics/>}</section></>
}

function AnalyticsPage({ clicks,onLogout }) {
  const logout=async()=>{await authService.logout();onLogout()}
  return <main className="clean-admin"><aside className="admin-sidebar"><Brand/><nav><span>MENU PRINCIPAL</span><a className="active" href="?admin=1"><i>⌁</i> Dashboard</a><a href="?admin=1&view=products"><i>▦</i> Produtos</a><a href="/" target="_blank"><i>↗</i> Ver loja</a></nav><div className="admin-user"><div>AD</div><span><b>Administrador</b><small>{ADMIN_EMAIL}</small></span><button onClick={logout} title="Sair">↪</button></div></aside><section className="clean-analytics-content"><header className="clean-page-head"><div><span className="admin-kicker">ANALYTICS / VISÃO GERAL</span><h1>Desempenho</h1><p>Veja o que desperta mais interesse na sua vitrine.</p></div><a href="/" target="_blank">Abrir loja <span>↗</span></a></header><CleanAnalytics clicks={clicks}/></section></main>
}

function CategoryModal({ onClose, onChanged }) {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('')
  const [editing,setEditing]=useState(null),[name,setName]=useState(''),[active,setActive]=useState(true)
  const load=async()=>{setLoading(true);setError('');try{setItems(await catalogService.listCategories({admin:true}))}catch(err){setError(err.message)}finally{setLoading(false)}}
  useEffect(()=>{load();const close=event=>event.key==='Escape'&&onClose();document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[])
  const reset=()=>{setEditing(null);setName('');setActive(true);setError('')}
  const submit=async event=>{event.preventDefault();setSaving(true);setError('');try{const category=editing?await catalogService.updateCategory({id:editing.id,name:name.trim(),active}):await catalogService.createCategory(name.trim(),active);await load();await onChanged(category);reset()}catch(err){setError(err.status===404?'As rotas administrativas de categorias ainda não estão disponíveis na API.':err.message)}finally{setSaving(false)}}
  const startEdit=category=>{setEditing(category);setName(category.name);setActive(category.active!==false);setError('')}
  const remove=async category=>{if(!window.confirm(`Excluir a categoria “${category.name}”?`))return;setError('');try{await catalogService.deleteCategory(category.id);if(editing?.id===category.id)reset();await load();await onChanged()}catch(err){setError(err.message)}}
  return <div className="admin-modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><div className="category-manager-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><div className="modal-head"><div><span className="admin-kicker">CATÁLOGO / CATEGORIAS</span><h2 id="category-modal-title">Gerenciar categorias</h2></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></div><div className="category-manager-body"><form className="category-form" onSubmit={submit}><span className="admin-kicker">{editing?'EDITAR CATEGORIA':'NOVA CATEGORIA'}</span><label>Nome<input autoFocus minLength="2" maxLength="80" value={name} onChange={event=>setName(event.target.value)} placeholder="Ex.: Iluminação" required/></label><label className="status-toggle"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/><i/><span><b>Categoria ativa</b><small>Disponível no cadastro de produtos</small></span></label>{error&&<div className="form-error">{error}</div>}<div className="category-form-actions">{editing&&<button type="button" className="admin-secondary" onClick={reset}>Cancelar edição</button>}<button type="submit" className="admin-primary" disabled={saving}>{saving?'Salvando...':editing?'Salvar alterações':'Criar categoria'}</button></div></form><section className="category-manager-list"><div><b>Categorias cadastradas</b><small>{items.length} itens</small></div>{loading?<p className="admin-empty">Carregando...</p>:items.length?items.map(category=><article key={category.id}><span><b>{category.name}</b><small>{category.slug}</small></span><em className={category.active===false?'inactive':''}>{category.active===false?'Inativa':'Ativa'}</em><button type="button" onClick={()=>startEdit(category)}>Editar</button><button type="button" className="danger" onClick={()=>remove(category)}>Excluir</button></article>):<p className="admin-empty">Nenhuma categoria cadastrada.</p>}</section></div><div className="modal-actions"><button type="button" className="admin-secondary" onClick={onClose}>Concluir</button></div></div></div>
}

function MarketplaceModal({ onClose, onChanged }) {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('')
  const [editing,setEditing]=useState(null),[name,setName]=useState(''),[active,setActive]=useState(true)
  const load=async()=>{setLoading(true);setError('');try{setItems(await catalogService.listMarketplaces({admin:true}))}catch(err){setError(err.message)}finally{setLoading(false)}}
  useEffect(()=>{load();const close=event=>event.key==='Escape'&&onClose();document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[])
  const reset=()=>{setEditing(null);setName('');setActive(true);setError('')}
  const submit=async event=>{event.preventDefault();setSaving(true);setError('');try{const marketplace=editing?await catalogService.updateMarketplace({id:editing.id,name:name.trim(),active}):await catalogService.createMarketplace({name:name.trim(),active});await load();await onChanged(marketplace);reset()}catch(err){setError(err.status===404?'Marketplace não encontrado.':err.message)}finally{setSaving(false)}}
  const startEdit=marketplace=>{setEditing(marketplace);setName(marketplace.name);setActive(marketplace.active!==false);setError('')}
  const remove=async marketplace=>{if(!window.confirm(`Excluir o marketplace “${marketplace.name}”?`))return;setError('');try{await catalogService.deleteMarketplace(marketplace.id);if(editing?.id===marketplace.id)reset();await load();await onChanged()}catch(err){setError(err.message)}}
  return <div className="admin-modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><div className="category-manager-modal" role="dialog" aria-modal="true" aria-labelledby="marketplace-modal-title"><div className="modal-head"><div><span className="admin-kicker">CATÁLOGO / MARKETPLACES</span><h2 id="marketplace-modal-title">Gerenciar marketplaces</h2></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></div><div className="category-manager-body"><form className="category-form" onSubmit={submit}><span className="admin-kicker">{editing?'EDITAR MARKETPLACE':'NOVO MARKETPLACE'}</span><label>Nome<input autoFocus minLength="2" maxLength="80" value={name} onChange={event=>setName(event.target.value)} placeholder="Ex.: Amazon" required/></label><label className="status-toggle"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/><i/><span><b>Marketplace ativo</b><small>Disponível nos anúncios de produtos</small></span></label>{error&&<div className="form-error">{error}</div>}<div className="category-form-actions">{editing&&<button type="button" className="admin-secondary" onClick={reset}>Cancelar edição</button>}<button type="submit" className="admin-primary" disabled={saving}>{saving?'Salvando...':editing?'Salvar alterações':'Criar marketplace'}</button></div></form><section className="category-manager-list"><div><b>Marketplaces cadastrados</b><small>{items.length} itens</small></div>{loading?<p className="admin-empty">Carregando...</p>:items.length?items.map(marketplace=><article key={marketplace.id}><span><b>{marketplace.name}</b></span><em className={marketplace.active===false?'inactive':''}>{marketplace.active===false?'Inativo':'Ativo'}</em><button type="button" onClick={()=>startEdit(marketplace)}>Editar</button><button type="button" className="danger" onClick={()=>remove(marketplace)}>Excluir</button></article>):<p className="admin-empty">Nenhum marketplace cadastrado.</p>}</section></div><div className="modal-actions"><button type="button" className="admin-secondary" onClick={onClose}>Concluir</button></div></div></div>
}

function AdminDashboard({ products,saveProduct,toggleProduct,removeProduct,clicks,onLogout,productError,onRetryProducts }) {
  const [query,setQuery]=useState(''),[editing,setEditing]=useState(null),[formOpen,setFormOpen]=useState(false),[confirmDelete,setConfirmDelete]=useState(null)
  const visible=products.filter(p=>`${p.name} ${p.marketplace}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
  const save=async data=>{await saveProduct(data);setFormOpen(false);setEditing(null)}
  const toggle=async id=>{try{await toggleProduct(id)}catch(error){window.alert(error.message)}}
  const remove=async id=>{try{await removeProduct(id);setConfirmDelete(null)}catch(error){window.alert(error.message)}}
  const logout=async()=>{await authService.logout();onLogout()}
  if(productError)return <main className="admin-shell"><aside className="admin-sidebar"><Brand/><nav><span>MENU PRINCIPAL</span><a href="?admin=1"><i>⌁</i> Dashboard</a><a className="active" href="?admin=1&view=products"><i>▦</i> Produtos</a><a href="/" target="_blank"><i>↗</i> Ver loja</a></nav><div className="admin-user"><div>AD</div><span><b>Administrador</b><small>{ADMIN_EMAIL}</small></span><button onClick={logout} title="Sair">↪</button></div></aside><section className="admin-content"><header className="admin-top"><div><span className="admin-kicker">PAINEL / CATÁLOGO</span><h1>Produtos</h1><p>Gerencie tudo o que aparece na vitrine da Triso.</p></div></header><div className="admin-table-card"><div className="admin-empty"><p>Não foi possível carregar os produtos. {productError}</p><button className="admin-primary" type="button" onClick={onRetryProducts}>Tentar novamente</button></div></div></section></main>
  return <main className="admin-shell"><aside className="admin-sidebar"><Brand/><nav><span>MENU PRINCIPAL</span><a href="?admin=1"><i>⌁</i> Dashboard</a><a className="active" href="?admin=1&view=products"><i>▦</i> Produtos</a><a href="/" target="_blank"><i>↗</i> Ver loja</a></nav><div className="admin-user"><div>AD</div><span><b>Administrador</b><small>{ADMIN_EMAIL}</small></span><button onClick={logout} title="Sair">↪</button></div></aside><section className="admin-content"><header className="admin-top"><div><span className="admin-kicker">PAINEL / CATÁLOGO</span><h1>Produtos</h1><p>Gerencie tudo o que aparece na vitrine da Triso.</p></div><button className="admin-primary" onClick={()=>{setEditing(null);setFormOpen(true)}}><PlusIcon/> Novo produto</button></header><div className="admin-stats"><div><span>Total de produtos</span><b>{products.length}</b><small>itens cadastrados</small></div><div><span>Produtos ativos</span><b>{products.filter(p=>p.active).length}</b><small>visíveis na loja</small></div><div><span>Marketplaces</span><b>{new Set(products.map(p=>p.marketplace)).size}</b><small>canais conectados</small></div></div><div className="admin-table-card"><div className="table-toolbar"><div><h2>Catálogo</h2><span>{visible.length} produtos</span></div><label><SearchIcon/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto..."/></label></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Canal de venda</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visible.map(product=><tr key={product.id}><td><div className="table-product"><ProductVisual product={product} small/><span><b>{product.name}</b><small>#{String(product.id).slice(-5)}</small></span></div></td><td>{categories[product.category]}</td><td><b>{money(product.price)}</b></td><td><span className="market-chip-admin">{product.marketplace}</span></td><td><button className={`status-pill ${product.active?'active':''}`} onClick={()=>toggle(product.id)}><i/>{product.active?'Ativo':'Inativo'}</button></td><td><div className="table-actions"><a href={product.marketplaceUrl} target="_blank" rel="noreferrer" title="Abrir anúncio"><ExternalIcon/></a><button title="Editar" onClick={()=>{setEditing(product);setFormOpen(true)}}><EditIcon/></button><button className="danger" title="Excluir" onClick={()=>setConfirmDelete(product)}><TrashIcon/></button></div></td></tr>)}</tbody></table>{!visible.length&&<div className="admin-empty">Nenhum produto encontrado.</div>}</div></div></section>{formOpen&&<ProductForm product={editing} onSave={save} onClose={()=>{setFormOpen(false);setEditing(null)}}/>}{confirmDelete&&<div className="admin-modal-backdrop"><div className="confirm-modal"><div className="confirm-icon"><TrashIcon/></div><h2>Excluir produto?</h2><p>“{confirmDelete.name}” será removido do catálogo. Esta ação não pode ser desfeita.</p><div><button className="admin-secondary" onClick={()=>setConfirmDelete(null)}>Cancelar</button><button className="admin-danger" onClick={()=>remove(confirmDelete.id)}>Sim, excluir</button></div></div></div>}</main>
}

export default function App() {
  const location=useSpaLocation()
  const routeParams=new URLSearchParams(location.search)
  const isAdminRoute=routeParams.has('admin')
  const [session,setSession]=useState(isAdminRoute?undefined:null)
  useEffect(()=>{if(isAdminRoute)authService.getSession().then(value=>setSession(value||null)).catch(()=>setSession(null))},[isAdminRoute])
  const {products,loading,error,reload,saveProduct,toggleProduct,removeProduct}=useProducts(!isAdminRoute?'public':session?'admin':null)
  const [clicks,recordClick]=useClicks()
  if(session===undefined)return <div className="app-loading"><span/><p>Carregando Triso...</p></div>
  if(!isAdminRoute)return <PublicStore products={products} recordClick={recordClick} productError={error} productsLoading={loading} onRetryProducts={reload}/>
  if(!session)return <Login onLogin={setSession}/>
  const adminView=routeParams.get('view')
  if(adminView==='products')return <AdminDashboard products={products} saveProduct={saveProduct} toggleProduct={toggleProduct} removeProduct={removeProduct} clicks={clicks} onLogout={()=>setSession(null)} productError={error} onRetryProducts={reload}/>
  return <AnalyticsPage clicks={clicks} onLogout={()=>setSession(null)}/>
}
