import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import anime from "animejs/lib/anime.es.js";
import { APP_CONFIG, CATALOG_OPTIONS, CATEGORY_LABELS } from "./config/app.js";
import { analyticsService } from "./services/analyticsService.js";
import { authService } from "./services/authService.js";
import { catalogService } from "./services/catalogService.js";
import { userService } from "./services/userService.js";
import { useCart } from "./features/cart/CartContext.jsx";
import {
  AccountPage,
  CartPage,
  CheckoutPage,
  ConfirmationPage,
  LoginPage as CustomerLoginPage,
  PaymentReturnPage,
  RegisterPage,
} from "./features/commerce/CommercePages.jsx";
import { accountService } from "./services/accountService.js";
import { shippingSettingsService } from "./services/shippingSettingsService.js";
import { orderService } from "./services/orderService.js";
import { taskService } from "./services/taskService.js";
import {
  getAuthenticatedHome,
  hasAdminAccess,
  isCustomer,
  useAuth,
} from "./features/auth/AuthContext.jsx";
import { SiteHeader } from "./components/SiteHeader.jsx";
import { TrisoLogo } from "./components/TrisoLogo.jsx";
import { SalesTemplatePage } from "./features/sales/SalesTemplatePage.jsx";
import { CampaignSealPage } from "./features/campaigns/CampaignSealPage.jsx";
import { CAMPAIGNS } from "./features/campaigns/campaigns.js";
import { PartySealPage } from "./features/events/PartySealPage.jsx";
import { EVENTS } from "./features/events/events.js";

const categories = CATEGORY_LABELS;
const emptyProduct = CATALOG_OPTIONS.productDefaults;
const ADMIN_EMAIL = APP_CONFIG.adminAccountLabel;
const money = (value) =>
  Number(value).toLocaleString(APP_CONFIG.locale, {
    style: "currency",
    currency: APP_CONFIG.currency,
  });
const getMarketplaces = (product) =>
  product.marketplaces?.length
    ? product.marketplaces
    : product.marketplaceUrl
      ? [
          {
            name: product.marketplace || "Marketplace",
            url: product.marketplaceUrl,
          },
        ]
      : [];
const EMPTY_MARKETPLACE_OPTIONS = [
  {
    id: "missing-marketplace",
    name: "Nenhum marketplace cadastrado",
    unavailable: true,
  },
];
const permissionName = (session) =>
  session?.permission?.trim().toLocaleLowerCase("pt-BR") || "";
const permissionAccess = (session) => {
  const permission = permissionName(session);
  return {
    manageProducts: permission === "admin" || permission === "gestor",
    manageCatalogOptions: permission === "admin",
    viewUsers: permission === "admin" || permission === "gestor",
    manageUsers: permission === "admin",
  };
};

function useSpaLocation() {
  const [location, setLocation] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));
  useEffect(() => {
    const update = () =>
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    const updateWithTransition = () => {
      if (!document.startViewTransition) {
        update();
        return;
      }
      document.startViewTransition(() => flushSync(update));
    };
    const navigate = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        !["http:", "https:"].includes(url.protocol)
      )
        return;
      if (url.searchParams.has("admin")) return;
      const samePageAnchor =
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash;
      if (samePageAnchor) return;
      event.preventDefault();
      const next = `${url.pathname}${url.search}${url.hash}`;
      if (
        next ===
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      )
        return;
      const commit = () => {
        window.history.pushState({}, "", next);
        flushSync(update);
        if (!url.hash) window.scrollTo({ top: 0, behavior: "instant" });
      };
      if (document.startViewTransition) document.startViewTransition(commit);
      else commit();
    };
    document.addEventListener("click", navigate);
    window.addEventListener("popstate", updateWithTransition);
    return () => {
      document.removeEventListener("click", navigate);
      window.removeEventListener("popstate", updateWithTransition);
    };
  }, []);
  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.remove("route-enter");
    const frame = requestAnimationFrame(() =>
      root?.classList.add("route-enter"),
    );
    const timer = setTimeout(() => root?.classList.remove("route-enter"), 420);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [location.pathname, location.search]);
  return location;
}

function useProducts(mode) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = async () => {
    if (!mode) {
      setProducts([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    setError("");
    try {
      const items = await catalogService.list({ admin: mode === "admin" });
      items.forEach((item) => {
        if (item.category && item.categoryName)
          categories[item.category] = item.categoryName;
      });
      setProducts(items);
      return items;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
  }, [mode]);
  const saveProduct = async (product) => {
    await catalogService.save(product);
    const items = await reload();
    return items.find((item) => item.id === product.id) || items[0];
  };
  const toggleProduct = async (id) => {
    const current = products.find((item) => item.id === id);
    if (!current) return;
    await catalogService.save({
      ...current,
      status: current.active ? "draft" : "published",
      active: !current.active,
    });
    await reload();
  };
  const removeProduct = async (id) => {
    await catalogService.remove(id);
    setProducts((items) => items.filter((item) => item.id !== id));
  };
  return {
    products,
    loading,
    error,
    reload,
    saveProduct,
    toggleProduct,
    removeProduct,
  };
}

function useClicks() {
  const [clicks, setClicks] = useState([]);
  useEffect(() => {
    analyticsService.listClicks().then(setClicks);
  }, []);
  const recordClick = (product, listing) => {
    analyticsService
      .trackMarketplaceClick(product, listing)
      .then((event) => setClicks((current) => [...current, event]))
      .catch(() => {});
  };
  return [clicks, recordClick];
}

function useCatalogOptions(enabled) {
  const [options, setOptions] = useState({ categories: [] });
  const reload = async () => {
    if (!enabled) return { categories: [] };
    const [categoryResult] = await Promise.allSettled([
      catalogService.listCategories({ admin: true }),
    ]);
    const allCategories =
      categoryResult.status === "fulfilled" ? categoryResult.value : [];
    const next = {
      categories: allCategories.filter((category) => category.active !== false),
    };
    setOptions(next);
    return next;
  };
  useEffect(() => {
    reload();
  }, [enabled]);
  return { ...options, reload };
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);
const ExternalIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m4 16-.8 4 4-.8L18.4 8 16 5.6 4 16Z" />
    <path d="m14.5 7.2 2.4 2.4" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
  </svg>
);

const Brand = TrisoLogo;

function AdminSidebar({ active, session, onLoggedOut }) {
  const [leaving, setLeaving] = useState(false);
  const navigateAdmin = (event, href) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (window.location.pathname === href) return;
    window.history.pushState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const logout = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await authService.logout();
    } finally {
      onLoggedOut();
    }
  };
  const access = permissionAccess(session);
  const links = [
    { id: "dashboard", href: "/admin", icon: "⌁", label: "Dashboard" },
    { id: "orders", href: "/admin/pedidos", icon: "→", label: "Pedidos" },
    { id: "tasks", href: "/admin/tarefas", icon: "✓", label: "Tarefas" },
    { id: "products", href: "/admin/produtos", icon: "▦", label: "Produtos" },
    {
      id: "users",
      href: "/admin/usuarios",
      icon: "◎",
      label: "Usuários",
      visible: access.viewUsers,
    },
  ].filter((link) => link.visible !== false);
  const initials = (session?.name || "Administrador")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <aside className="admin-sidebar">
      <Brand />
      <nav>
        <span>MENU PRINCIPAL</span>
        {links.map((link) => (
          <a
            key={link.id}
            className={active === link.id ? "active" : ""}
            href={link.href}
            onClick={(event) => navigateAdmin(event, link.href)}
            aria-current={active === link.id ? "page" : undefined}
          >
            <i>{link.icon}</i>
            {link.label}
          </a>
        ))}
        <a href="/" onClick={(event) => navigateAdmin(event, "/")}>
          <i>↗</i> Voltar à loja
        </a>
      </nav>
      <div className="admin-user">
        <div>{initials}</div>
        <span>
          <b>{session?.name || "Administrador"}</b>
          <small>{session?.email || ADMIN_EMAIL}</small>
        </span>
        <button onClick={logout} disabled={leaving} title="Sair">
          ↪
        </button>
      </div>
    </aside>
  );
}

function ProductShape({ type }) {
  return (
    <div className={`product-shape shape-${type || "vase"}`}>
      <i />
      <i />
      <i />
    </div>
  );
}

function ProductVisual({ product, small = false, imageUrl }) {
  const displayImage = imageUrl || product.images?.[0]?.url || product.imageUrl;
  return (
    <div className={small ? "admin-product-thumb" : "product-art"}>
      {displayImage ? (
        <img src={displayImage} alt={product.name} />
      ) : (
        <ProductShape type={product.art} />
      )}
      {!small && product.badge && (
        <span className="product-badge">{product.badge}</span>
      )}
    </div>
  );
}

function Hero({ products, loading }) {
  const [layer, setLayer] = useState(1);
  const featuredProduct = useMemo(
    () => products.find((product) => product.active) || null,
    [products],
  );
  const printedItemRef = useRef(null),
    scanRef = useRef(null),
    shadowRef = useRef(null);
  const featuredImage =
    featuredProduct?.images?.[0]?.url || featuredProduct?.imageUrl || "";
  useEffect(() => {
    if (!featuredProduct) {
      setLayer(1);
      return;
    }
    let frame,
      lastFrame = performance.now();
    const updateLayer = (now) => {
      const elapsed = now - lastFrame;
      if (elapsed >= 180) {
        const steps = Math.floor(elapsed / 180);
        setLayer((value) => ((value - 1 + steps) % 240) + 1);
        lastFrame += steps * 180;
      }
      frame = requestAnimationFrame(updateLayer);
    };
    frame = requestAnimationFrame(updateLayer);
    return () => cancelAnimationFrame(frame);
  }, [featuredProduct?.id]);
  useEffect(() => {
    const item = printedItemRef.current,
      scan = scanRef.current,
      shadow = shadowRef.current;
    if (!featuredProduct || !item || !scan || !shadow) return;
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const distance = reduceMotion ? 2 : 10;
    const printTimeline = anime
      .timeline({ loop: true, direction: "alternate", easing: "easeInOutSine" })
      .add(
        {
          targets: item,
          translateY: [-distance, distance * 0.7],
          rotate: [reduceMotion ? 0 : -0.65, reduceMotion ? 0 : 0.65],
          scale: [1, reduceMotion ? 1.004 : 1.018],
          duration: reduceMotion ? 3200 : 2100,
        },
        0,
      )
      .add(
        {
          targets: shadow,
          scaleX: [1.08, 0.88],
          opacity: [0.7, 0.46],
          duration: reduceMotion ? 3200 : 2100,
        },
        0,
      );
    const scanAnimation = anime({
      targets: scan,
      keyframes: [
        { translateY: -155, opacity: 0, duration: 0 },
        { opacity: 1, duration: 450 },
        { translateY: 155, duration: 3000 },
        { opacity: 0, duration: 650 },
      ],
      duration: 4100,
      easing: "cubicBezier(.45,.05,.2,1)",
      loop: true,
    });
    return () => {
      printTimeline.pause();
      scanAnimation.pause();
      anime.remove([item, scan, shadow]);
    };
  }, [featuredProduct?.id, featuredImage]);
  const progress = `${(layer / 240) * 100}%`;
  const statusLabel = loading
    ? "Carregando catálogo"
    : featuredProduct
      ? "Em impressão agora"
      : "Catálogo em atualização";
  const productLabel = loading
    ? "Preparando destaque"
    : featuredProduct?.name || "Novidades em breve";
  return (
    <section className="hero" id="inicio">
      <div className="hero-grid" />
      <div className="hero-glow hero-glow-a" />
      <div className="hero-glow hero-glow-b" />
      <div className="container hero-layout">
        <div className="hero-copy">
          <div className="kicker">
            <span>Nova coleção</span> Forma 01 — 2026
          </div>
          <h1>
            Design que ganha
            <br />
            <em>forma.</em> Camada
            <br />
            por camada.
          </h1>
          <p>
            Objetos autorais para casa, setup e rotina. Escolha seu produto e
            compre com segurança diretamente pela Triso.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#loja">
              Ver produtos <span>↘</span>
            </a>
          </div>
          <div className="hero-notes">
            <span>
              <b>01</b> PLA premium
            </span>
            <span>
              <b>02</b> Feito no Brasil
            </span>
            <span>
              <b>03</b> Compra segura
            </span>
          </div>
        </div>
        <div className={`hero-stage ${loading ? "is-loading" : ""}`}>
          <div className="stage-label">
            <i /> {statusLabel}
          </div>
          <div className="orbit-art printing-art">
            {featuredProduct ? (
              <div className="printed-item" ref={printedItemRef}>
                {featuredImage ? (
                  <img
                    src={featuredImage}
                    alt={featuredProduct.name}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
                ) : (
                  <ProductShape type={featuredProduct.art} />
                )}
              </div>
            ) : (
              <div className="printing-placeholder" />
            )}
            <div className="orbit-shadow" ref={shadowRef} />
            {featuredProduct && <div className="print-layer" ref={scanRef} />}
          </div>
          <div className="stage-meta">
            <div>
              <small>
                PRODUTO /{" "}
                {featuredProduct
                  ? String(featuredProduct.id).slice(-3).padStart(3, "0")
                  : "---"}
              </small>
              <strong>{productLabel}</strong>
            </div>
            <div className="stage-price">
              <small>{featuredProduct ? "A partir de" : "Catálogo"}</small>
              <strong>
                {featuredProduct ? money(featuredProduct.price) : "—"}
              </strong>
            </div>
          </div>
          <div className="stage-progress">
            <span style={{ width: featuredProduct ? progress : "0%" }} />
          </div>
          <div className="stage-readout">
            <span>
              {featuredProduct ? (
                <>
                  CAMADA <b>{layer}</b>/240
                </>
              ) : (
                "AGUARDANDO PRODUTO"
              )}
            </span>
            <span>{featuredProduct ? "0.20 MM · PLA" : "TRISO STUDIO"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Collections({ setFilter }) {
  const choose = (category) => () => setFilter(category);
  return (
    <section className="collections section" id="colecoes">
      <div className="container">
        <div className="section-heading">
          <div>
            <h2>Feito para o seu espaço.</h2>
          </div>
          <p>
            Peças funcionais com presença escultórica, criadas para transformar
            os pequenos rituais do dia.
          </p>
        </div>
        <div className="collection-grid">
          <a
            className="collection-card collection-card-large"
            href="#loja"
            onClick={choose("decoracao")}
          >
            <div className="collection-visual visual-vase">
              <div className="vase-body" />
              <div className="vase-body vase-back" />
            </div>
            <CollectionInfo code="01">
              Casa &<br />
              Decoração
            </CollectionInfo>
          </a>
          <a className="collection-card" href="#loja" onClick={choose("setup")}>
            <div className="collection-visual visual-stand">
              <div className="stand-top" />
              <div className="stand-leg" />
              <div className="stand-phone" />
            </div>
            <CollectionInfo code="02">
              Setup &<br />
              Office
            </CollectionInfo>
          </a>
          <a
            className="collection-card"
            href="#loja"
            onClick={choose("organizacao")}
          >
            <div className="collection-visual visual-tray">
              <div />
              <div />
              <div />
            </div>
            <CollectionInfo code="03">Organização</CollectionInfo>
          </a>
        </div>
      </div>
    </section>
  );
}
function CollectionInfo({ code, children }) {
  return (
    <div className="collection-info">
      <span>{code} — Coleção</span>
      <h3>{children}</h3>
      <b>
        Explorar <i>↗</i>
      </b>
    </div>
  );
}

function ProductCard({ product, onOpen, onAdd }) {
  const { add } = useCart();
  return (
    <article
      className="product-card product-card-clickable"
      onClick={() => onOpen(product)}
    >
      <ProductVisual product={product} />
      <div className="product-info">
        <span className="product-overline">
          {product.categoryName || categories[product.category] || "Outros"}
        </span>
        <div className="product-title-row">
          <h3>{product.name}</h3>
          <strong>{money(product.price)}</strong>
        </div>
        <p>{product.description}</p>
      </div>
    </article>
  );
}

function Shop({
  products,
  filter,
  setFilter,
  onOpen,
  onAdd,
  error,
  loading,
  onRetry,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    const list = products.filter(
      (p) =>
        p.active &&
        (filter === "todos" || p.category === filter) &&
        `${p.name} ${p.description}`
          .toLocaleLowerCase("pt-BR")
          .includes(q),
    );
    if (sort === "low") list.sort((a, b) => a.price - b.price);
    if (sort === "high") list.sort((a, b) => b.price - a.price);
    if (sort === "name")
      list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return list;
  }, [products, filter, query, sort]);
  const filterItems = useMemo(
    () => [
      ["todos", "Todos"],
      ...Array.from(
        new Map(
          products
            .filter((p) => p.category)
            .map((p) => [
              p.category,
              p.categoryName || categories[p.category] || p.category,
            ]),
        ).entries(),
      ),
    ],
    [products],
  );
  return (
    <section className="shop section" id="loja">
      <div className="container">
        <div className="shop-top">
          <div>
            <span className="eyebrow">Catálogo online</span>
            <h2>Escolhas da Triso.</h2>
          </div>
          <div className="shop-actions">
            <label className="search-box">
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="Buscar no catálogo..."
              />
            </label>
            <label className="sort-box">
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="featured">Em destaque</option>
                <option value="low">Menor preço</option>
                <option value="high">Maior preço</option>
                <option value="name">Nome A–Z</option>
              </select>
            </label>
          </div>
        </div>
        <div className="filter-row">
          {filterItems.map(([value, label]) => (
            <button
              key={value}
              className={`filter ${filter === value ? "active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}{" "}
              <span>
                {products
                  .filter(
                    (p) =>
                      p.active && (value === "todos" || p.category === value),
                  )
                  .length.toString()
                  .padStart(2, "0")}
              </span>
            </button>
          ))}
        </div>
        {error ? (
          <div className="empty-state">
            <p>Não foi possível carregar os produtos. {error}</p>
            <button className="admin-primary" type="button" onClick={onRetry}>
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <p className="empty-state">Carregando produtos...</p>
        ) : visible.length ? (
          <div className="product-grid">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            Nenhum produto encontrado nesta categoria.
          </p>
        )}
      </div>
    </section>
  );
}

function ProductDetail({ product, onClose, onAdded }) {
  const { add } = useCart();
  const images = (product.images || []).filter((image) => image.url);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const touchStart = useRef(null);
  const selectedImage = images[selectedIndex]?.url || product.imageUrl || "";
  const go = (direction) =>
    setSelectedIndex((current) =>
      images.length ? (current + direction + images.length) % images.length : 0,
    );
  useEffect(() => setSelectedIndex(0), [product.id]);
  useEffect(() => {
    document.body.classList.add("locked");
    const navigate = (e) => {
      if (e.key === "Escape") onClose();
      if (images.length > 1 && e.key === "ArrowLeft") go(-1);
      if (images.length > 1 && e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", navigate);
    return () => {
      document.body.classList.remove("locked");
      document.removeEventListener("keydown", navigate);
    };
  }, [onClose, images.length]);
  const beginSwipe = (event) => {
    touchStart.current = event.changedTouches[0].clientX;
  };
  const endSwipe = (event) => {
    if (touchStart.current === null || images.length < 2) return;
    const distance = touchStart.current - event.changedTouches[0].clientX;
    touchStart.current = null;
    if (Math.abs(distance) > 45) go(distance > 0 ? 1 : -1);
  };
  const addToCart = () => {
    add(product.id);
    onAdded(product);
  };
  return (
    <div
      className="product-detail-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <article className="product-detail">
        <button
          className="product-detail-close"
          onClick={onClose}
          aria-label="Fechar produto"
        >
          ×
        </button>
        <div
          className="detail-gallery"
          onTouchStart={beginSwipe}
          onTouchEnd={endSwipe}
        >
          <div className="detail-slide" key={selectedImage}>
            <ProductVisual product={product} imageUrl={selectedImage} />
          </div>
          {images.length > 1 && (
            <>
              <div className="detail-carousel-controls">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Imagem anterior"
                >
                  ←
                </button>
                <span aria-live="polite">
                  {selectedIndex + 1} / {images.length}
                </span>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Próxima imagem"
                >
                  →
                </button>
              </div>
              <div className="detail-thumbnails">
                {images.map((image, index) => (
                  <button
                    type="button"
                    className={selectedIndex === index ? "active" : ""}
                    key={image.id || image.url || index}
                    onClick={() => setSelectedIndex(index)}
                    aria-label={`Ver imagem ${index + 1}`}
                  >
                    <img
                      src={image.url}
                      alt={
                        image.altText || `${product.name} — imagem ${index + 1}`
                      }
                    />
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="detail-index">
            <span>TRISO / PRODUTO</span>
            <b>#{String(product.id).slice(-5)}</b>
          </div>
        </div>
        <div className="detail-copy">
          <span className="eyebrow">
            {categories[product.category] || "Outros"}
          </span>
          <h1>{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <div className="detail-price">
            <small>A partir de</small>
            <strong>{money(product.price)}</strong>
          </div>
          <div className="detail-specs">
            <div>
              <span>Material</span>
              <b>PLA Premium</b>
            </div>
            <div>
              <span>Produção</span>
              <b>Sob demanda</b>
            </div>
            <div>
              <span>Origem</span>
              <b>São Paulo, BR</b>
            </div>
          </div>
          <div className="detail-buy-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={addToCart}
            >
              Adicionar ao carrinho
            </button>
            <button
              type="button"
              className="button button-light"
              onClick={() => {
                add(product.id);
                window.history.pushState({}, "", "/carrinho");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
            >
              Comprar agora
            </button>
          </div>
          <div className="detail-safe">
            <span>✓</span>
            <p>
              <b>Compra segura pela Triso</b>
              <small>
                Pagamento e acompanhamento do pedido acontecem diretamente aqui.
              </small>
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

function Manifesto() {
  return (
    <section className="manifesto">
      <div className="container manifesto-grid">
        <div className="manifesto-art">
          <div className="wire-sphere">
            <i />
            <i />
            <i />
            <i />
          </div>
          <span className="axis axis-x">X</span>
          <span className="axis axis-y">Y</span>
          <span className="axis axis-z">Z</span>
          <span className="dimension dim-a">Ø 180 MM</span>
          <span className="dimension dim-b">240 CAMADAS</span>
        </div>
        <div className="manifesto-copy" id="sobre">
          <span className="eyebrow">Por que a Triso?</span>
          <h2>
            Menos estoque.
            <br />
            Mais intenção.
          </h2>
          <p>
            Não fazemos objetos para preencher prateleiras. Criamos peças que
            resolvem, organizam e expressam — produzidas apenas quando você
            escolhe.
          </p>
          <div className="manifesto-points">
            <div>
              <b>98%</b>
              <span>do material pode ser reaproveitado</span>
            </div>
            <div>
              <b>0</b>
              <span>estoque produzido sem necessidade</span>
            </div>
            <div>
              <b>1:1</b>
              <span>cuidado em cada peça impressa</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-main">
          <Brand large />
          <p>
            Objetos autorais produzidos
            <br />
            camada por camada em São Paulo.
          </p>
          <div className="footer-links">
            <div>
              <b>Loja</b>
              <a href="#loja">Todos os produtos</a>
              <a href="#colecoes">Coleções</a>
            </div>
            <div>
              <b>Ajuda</b>
              <a href="mailto:contato@trisostudio.com.br">Contato</a>
              <a href="#inicio">Envios e prazos</a>
            </div>
            <div>
              <b>Conta</b>
              <a href="/minha-conta">Minha conta →</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Triso Studio</span>
          <span>Design local · Produção consciente</span>
        </div>
      </div>
    </footer>
  );
}

function PublicStore({
  products,
  recordClick,
  productError,
  productsLoading,
  onRetryProducts,
}) {
  const { add } = useCart();
  const [filter, setFilter] = useState("todos");
  const [selected, setSelected] = useState(null);
  const [cartNotice, setCartNotice] = useState(null);
  const openProduct = async (product) => {
    setSelected(product);
    if (!product.slug) return;
    try {
      const detail = await catalogService.getBySlug(product.slug);
      setSelected((current) =>
        current?.slug === product.slug ? detail : current,
      );
    } catch {
      /* mantém os dados da listagem caso o detalhe não esteja disponível */
    }
  };
  useEffect(() => {
    const elements = document.querySelectorAll(
      ".hero-copy > *, .hero-stage, .section-heading > *, .collection-card, .shop-top > *, .filter-row, .product-card, .manifesto-art, .manifesto-copy > *, .footer-main > *",
    );
    elements.forEach((element, index) => {
      element.classList.add("reveal");
      element.style.setProperty(
        "--reveal-delay",
        `${Math.min(index % 6, 5) * 55}ms`,
      );
    });
    let observer, firstFrame, secondFrame;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (!("IntersectionObserver" in window)) {
          elements.forEach((element) => element.classList.add("in-view"));
          return;
        }
        observer = new IntersectionObserver(
          (entries) =>
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("in-view");
                observer.unobserve(entry.target);
              }
            }),
          { threshold: 0.08, rootMargin: "0px 0px -20px" },
        );
        elements.forEach((element) => observer.observe(element));
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      observer?.disconnect();
    };
  }, [products.length]);
  useEffect(() => {
    if (!cartNotice) return undefined;
    const timer = window.setTimeout(() => setCartNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [cartNotice]);
  return (
    <>
      <SiteHeader />
      <main>
        <Hero products={products} loading={productsLoading} />
        <Collections setFilter={setFilter} />
        <Shop
          products={products}
          filter={filter}
          setFilter={setFilter}
          onOpen={openProduct}
          onAdd={add}
          error={productError}
          loading={productsLoading}
          onRetry={onRetryProducts}
        />
        <Manifesto />
      </main>
      <Footer />
      {selected && (
        <ProductDetail
          product={selected}
          onClose={() => setSelected(null)}
          onAdded={(product) => {
            setSelected(null);
            setCartNotice(product);
          }}
        />
      )}
      {cartNotice && (
        <aside className="cart-add-toast" role="status">
          <div>
            <span>✓ ADICIONADO AO CARRINHO</span>
            <b>{cartNotice.name}</b>
          </div>
          <a href="/carrinho">
            Ver carrinho <i>→</i>
          </a>
          <button
            type="button"
            onClick={() => setCartNotice(null)}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </aside>
      )}
    </>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const session = await authService.login({ email, password });
      onLogin(session);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-side">
        <Brand />
        <div>
          <span className="eyebrow">Painel Triso</span>
          <h1>
            Sua vitrine,
            <br />
            sob controle.
          </h1>
          <p>
            Cadastre e mantenha os produtos da loja atualizados.
          </p>
        </div>
        <small>ACESSO RESTRITO · ADMINISTRAÇÃO</small>
      </div>
      <div className="auth-form-wrap">
        <a className="back-store" href="/">
          ← Voltar para a loja
        </a>
        <form className="auth-form" onSubmit={submit}>
          <span className="admin-kicker">LOGIN / ADMIN</span>
          <h2>Bem-vindo de volta.</h2>
          <p>Entre com suas credenciais para gerenciar o catálogo.</p>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="admin-primary" type="submit">
            Entrar no painel <span>→</span>
          </button>
          {APP_CONFIG.dataSource === "mock" && (
            <div className="demo-login">
              <b>Ambiente de demonstração</b>
              <span>Credenciais definidas no banco mockado.</span>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}

function UniversalAuthPage({ register = false }) {
  const { login, register: createAccount, logout } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmation: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (register && form.password !== form.confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = register ? await createAccount(form) : await login(form);
      if (!isCustomer(user) && !hasAdminAccess(user)) {
        await logout();
        throw new Error("Esta conta não possui uma permissão autorizada.");
      }
      const returnTo = sessionStorage.getItem("triso_return_to");
      sessionStorage.removeItem("triso_return_to");
      const target =
        isCustomer(user) &&
        returnTo?.startsWith("/") &&
        !returnTo.startsWith("/admin")
          ? returnTo
          : getAuthenticatedHome(user);
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err) {
      setError(err.message || "Não foi possível entrar.");
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-side">
        <Brand />
        <div>
          <span className="eyebrow">Triso Studio</span>
          <h1>
            {register ? "Crie sua conta," : "Bem-vindo de"}
            <br />
            {register ? "compre direto." : "volta."}
          </h1>
          <p>
            Entre para acompanhar pedidos, finalizar sua compra e acessar sua
            conta.
          </p>
        </div>
        <small>COMPRA DIRETA · PAGAMENTO SEGURO</small>
      </div>
      <div className="auth-form-wrap">
        <a className="back-store" href="/">
          ← Voltar para a loja
        </a>
        <form className="auth-form" onSubmit={submit}>
          <span className="admin-kicker">
            {register ? "CADASTRO" : "ENTRAR"} / TRISO
          </span>
          <h2>{register ? "Crie sua conta." : "Acesse sua conta."}</h2>
          <p>
            {register
              ? "Seus dados permitem acompanhar pedidos e finalizar compras."
              : "Use suas credenciais para continuar."}
          </p>
          {register && (
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                minLength="2"
                autoComplete="name"
                required
              />
            </label>
          )}
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              autoComplete="email"
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              minLength="8"
              autoComplete={register ? "new-password" : "current-password"}
              required
            />
          </label>
          {register && (
            <label>
              Confirme a senha
              <input
                type="password"
                value={form.confirmation}
                onChange={(event) =>
                  setForm({ ...form, confirmation: event.target.value })
                }
                minLength="8"
                autoComplete="new-password"
                required
              />
            </label>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="admin-primary" type="submit" disabled={busy}>
            {busy
              ? register
                ? "Criando conta..."
                : "Entrando..."
              : register
                ? "Criar conta"
                : "Entrar"}{" "}
            <span>→</span>
          </button>
          <p className="auth-switch">
            {register ? (
              <>
                Já possui conta? <a href="/entrar">Entrar</a>
              </>
            ) : (
              <>
                Ainda não tem conta? <a href="/cadastro">Criar conta</a>
              </>
            )}
          </p>
        </form>
      </div>
    </main>
  );
}

function ProductImagesEditor({ images, art, onImagesChange, onArtChange }) {
  const update = (index, field, value) =>
    onImagesChange(
      images.map((image, i) =>
        i === index ? { ...image, [field]: value } : image,
      ),
    );
  const normalizeCover = (list) =>
    list.map((image, index) => ({ ...image, isCover: index === 0 }));
  const add = () => {
    if (images.length < 8)
      onImagesChange(
        normalizeCover([
          ...images,
          {
            clientId: crypto.randomUUID(),
            url: "",
            altText: "",
            isCover: false,
          },
        ]),
      );
  };
  const remove = (index) =>
    onImagesChange(normalizeCover(images.filter((_, i) => i !== index)));
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onImagesChange(normalizeCover(next));
  };
  if (!images.length)
    return (
      <>
        <label>
          Visual padrão
          <select
            value={art || "vase"}
            onChange={(event) => onArtChange(event.target.value)}
          >
            {CATALOG_OPTIONS.visuals.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="image-fields field-wide">
          <div className="image-fields-head">
            <span>
              <b>Imagens do produto</b>
              <small>
                Ao adicionar uma imagem, ela substitui o visual padrão
              </small>
            </span>
            <button type="button" onClick={add}>
              + Adicionar imagem
            </button>
          </div>
        </div>
      </>
    );
  return (
    <div className="image-fields field-wide">
      <div className="image-fields-head">
        <span>
          <b>Imagens do produto</b>
          <small>
            Até 8 imagens em URL HTTPS; a primeira imagem é sempre a capa
          </small>
        </span>
        <button type="button" onClick={add} disabled={images.length >= 8}>
          + Adicionar imagem
        </button>
      </div>
      <div
        className="image-preview-gallery"
        aria-label="Pré-visualização das imagens"
      >
        {images.map((image, index) => (
          <figure
            className={index === 0 ? "is-cover" : ""}
            key={`preview-${image.id || image.clientId || index}`}
          >
            <div>
              <span>
                {image.url ? "Imagem indisponível" : "Informe uma URL"}
              </span>
              {image.url && (
                <img
                  src={image.url}
                  alt={image.altText || `Pré-visualização ${index + 1}`}
                  onLoad={(event) =>
                    event.currentTarget.classList.add("is-loaded")
                  }
                  onError={(event) =>
                    event.currentTarget.classList.remove("is-loaded")
                  }
                />
              )}
            </div>
            <figcaption>
              <b>{index === 0 ? "Capa" : `Imagem ${index + 1}`}</b>
              <small>
                {index + 1} de {images.length}
              </small>
            </figcaption>
          </figure>
        ))}
      </div>
      {images.map((image, index) => (
        <div
          className="image-field-row"
          key={image.id || image.clientId || index}
        >
          <div className="image-order-controls">
            <span>{index + 1}</span>
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Mover imagem ${index + 1} para cima`}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === images.length - 1}
              aria-label={`Mover imagem ${index + 1} para baixo`}
            >
              ↓
            </button>
          </div>
          <div
            className={`image-cover-choice ${index === 0 ? "is-cover" : ""}`}
          >
            <span>{index === 0 ? "Capa" : "Galeria"}</span>
          </div>
          <input
            type="url"
            pattern="https://.*"
            value={image.url}
            onChange={(event) => update(index, "url", event.target.value)}
            placeholder="https://.../produto.jpg"
            required
          />
          <input
            value={image.altText || ""}
            onChange={(event) => update(index, "altText", event.target.value)}
            placeholder="Texto alternativo"
            maxLength="200"
          />
          <button
            className="image-remove"
            type="button"
            onClick={() => remove(index)}
            aria-label="Remover imagem"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ProductForm({
  product,
  onSave,
  onClose,
  categoryOptions,
  marketplaceOptions,
  canManageCatalogOptions = false,
}) {
  const remoteOptions = useCatalogOptions(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [marketplaceModalOpen, setMarketplaceModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  categoryOptions = categoryOptions || remoteOptions.categories;
  marketplaceOptions = marketplaceOptions || remoteOptions.marketplaces || [];
  if (!marketplaceOptions.length)
    marketplaceOptions = EMPTY_MARKETPLACE_OPTIONS;
  const [form, setForm] = useState(() => {
    const source = product || emptyProduct;
    const firstMarketplace = marketplaceOptions.find(
      (item) => !item.unavailable,
    );
    const images = source.images?.length
      ? source.images.map((image, index) => ({
          ...image,
          clientId: image.id || crypto.randomUUID(),
          isCover: index === 0,
        }))
      : source.imageUrl
        ? [
            {
              clientId: crypto.randomUUID(),
              url: source.imageUrl,
              altText: source.name || "",
              isCover: true,
            },
          ]
        : [];
    return {
      ...source,
      images,
      imageUrl: (images.find((image) => image.isCover) || images[0])?.url || "",
      categoryId: source.categoryId || categoryOptions[0]?.id || "",
      marketplaces: getMarketplaces(source).length
        ? getMarketplaces(source)
        : firstMarketplace
          ? [
              {
                marketplaceId: firstMarketplace.id,
                name: firstMarketplace.name,
                url: "",
                externalProductId: "",
              },
            ]
          : [],
    };
  });
  useEffect(() => {
    const firstMarketplace = marketplaceOptions.find(
      (item) => !item.unavailable,
    );
    setForm((current) => {
      const categoryId = current.categoryId || categoryOptions[0]?.id || "";
      const marketplaces =
        current.marketplaces.length || !firstMarketplace
          ? current.marketplaces
          : [
              {
                marketplaceId: firstMarketplace.id,
                name: firstMarketplace.name,
                url: "",
                externalProductId: "",
              },
            ];
      if (
        categoryId === current.categoryId &&
        marketplaces === current.marketplaces
      )
        return current;
      return { ...current, categoryId, marketplaces };
    });
  }, [categoryOptions, marketplaceOptions]);
  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const setImages = (images) =>
    setForm((current) => {
      const normalized = images.map((image, index) => ({
        ...image,
        isCover: index === 0,
      }));
      return {
        ...current,
        images: normalized,
        imageUrl: normalized[0]?.url || "",
        art: normalized.length ? "" : current.art || "vase",
      };
    });
  const categoriesChanged = async (preferred) => {
    const refreshed = await remoteOptions.reload();
    setForm((current) => {
      const preferredId =
        preferred?.active !== false &&
        refreshed.categories.some((item) => item.id === preferred?.id)
          ? preferred.id
          : null;
      const currentId = refreshed.categories.some(
        (item) => item.id === current.categoryId,
      )
        ? current.categoryId
        : null;
      return {
        ...current,
        categoryId:
          preferredId || currentId || refreshed.categories[0]?.id || "",
      };
    });
  };
  const marketplacesChanged = async (preferred) => {
    const refreshed = await remoteOptions.reload();
    setForm((current) => {
      const available = refreshed.marketplaces;
      return {
        ...current,
        marketplaces: current.marketplaces
          .map((listing) => {
            const selected =
              available.find((item) => item.id === listing.marketplaceId) ||
              (listing.marketplaceId === "missing-marketplace"
                ? available.find((item) => item.id === preferred?.id)
                : null) ||
              available[0];
            return selected
              ? { ...listing, marketplaceId: selected.id, name: selected.name }
              : listing;
          })
          .filter((listing) => listing.marketplaceId),
      };
    });
  };
  const setListing = (index, field, value) =>
    setForm((current) => ({
      ...current,
      marketplaces: current.marketplaces.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  const setListingMarketplace = (index, id) => {
    const marketplace = marketplaceOptions.find((item) => item.id === id);
    setForm((current) => ({
      ...current,
      marketplaces: current.marketplaces.map((item, i) =>
        i === index
          ? { ...item, marketplaceId: id, name: marketplace?.name || "" }
          : item,
      ),
    }));
  };
  const addListing = () =>
    setForm((current) => {
      const used = new Set(
        current.marketplaces.map((item) => item.marketplaceId),
      );
      const marketplace = marketplaceOptions.find(
        (item) => !item.unavailable && !used.has(item.id),
      );
      return marketplace
        ? {
            ...current,
            marketplaces: [
              ...current.marketplaces,
              {
                marketplaceId: marketplace.id,
                name: marketplace.name,
                url: "",
                externalProductId: "",
              },
            ],
          }
        : current;
    });
  const removeListing = (index) =>
    setForm((current) => ({
      ...current,
      marketplaces: current.marketplaces.filter((_, i) => i !== index),
    }));
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (form.images.length > 8) {
      window.alert("O produto pode ter no máximo 8 imagens.");
      return;
    }
    setSaving(true);
    try {
      const { marketplaces, marketplace, marketplaceUrl, ...productPayload } = form;
      await onSave({
        ...productPayload,
        price: Number(form.price),
        status: form.active ? "published" : "draft",
      });
    } catch (error) {
      window.alert(error.message);
      setSaving(false);
    }
  };
  return (
    <>
      <div className="admin-modal-backdrop">
        <div className="product-modal">
          <div className="modal-head">
            <div>
              <span className="admin-kicker">
                PRODUTO / {product ? "EDIÇÃO" : "NOVO"}
              </span>
              <h2>{product ? "Editar produto" : "Cadastrar produto"}</h2>
            </div>
            <button onClick={onClose}>×</button>
          </div>
          <form className="product-form" onSubmit={submit}>
            <div className="product-form-top">
              <div className="form-grid">
                <label className="field-wide">
                  Nome do produto
                  <input
                    minLength="2"
                    maxLength="120"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Preço inicial (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Categoria
                  <select
                    value={form.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {categoryOptions.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {canManageCatalogOptions && (
                    <button
                      className="category-create-inline"
                      type="button"
                      onClick={() => setCategoryModalOpen(true)}
                    >
                      Gerenciar categorias
                    </button>
                  )}
                </label>
                <label className="field-wide">
                  Descrição
                  <textarea
                    maxLength="2000"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows="3"
                  />
                </label>
                <label className="field-wide">
                  Selo do produto
                  <input
                    value={form.badge || ""}
                    onChange={(e) => set("badge", e.target.value)}
                    placeholder="Novo, Destaque..."
                  />
                </label>
                <label className="status-toggle field-wide">
                  <input
                    type="checkbox"
                    checked={form.requiresShipping !== false}
                    onChange={(e) => set("requiresShipping", e.target.checked)}
                  />
                  <i />
                  <span>
                    <b>Produto requer envio</b>
                    <small>
                      Ative para informar dados usados na cotação de frete.
                    </small>
                  </span>
                </label>
                {form.requiresShipping !== false && (
                  <div className="field-wide logistics-fields">
                    <label>
                      Peso (g)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={form.weightGrams ?? ""}
                        onChange={(e) => set("weightGrams", e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Largura (cm)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.widthCm ?? ""}
                        onChange={(e) => set("widthCm", e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Altura (cm)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.heightCm ?? ""}
                        onChange={(e) => set("heightCm", e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Comprimento (cm)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.lengthCm ?? ""}
                        onChange={(e) => set("lengthCm", e.target.value)}
                        required
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="form-preview">
                <span>PRÉ-VISUALIZAÇÃO</span>
                <ProductVisual product={form} />
                <h3>{form.name || "Nome do produto"}</h3>
                <p>
                  {form.price ? money(form.price) : "R$ 0,00"}
                </p>
              </div>
            </div>
            <div className="product-form-lower">
              <ProductImagesEditor
                images={form.images || []}
                art={form.art}
                onImagesChange={setImages}
                onArtChange={(value) => set("art", value)}
              />
              <div className="marketplace-fields field-wide">
                <div className="marketplace-fields-head">
                  <span>
                    <b>Anúncios nos marketplaces</b>
                    <small>
                      Informe o marketplace, o link e o identificador externo do
                      anúncio
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={addListing}
                    disabled={form.marketplaces.length >= 10}
                  >
                    + Adicionar canal
                  </button>
                </div>
                <div className="marketplace-fields-box">
                  {form.marketplaces.map((listing, index) => (
                    <div
                      className="marketplace-field-row"
                      key={listing.id || index}
                    >
                      <select
                        value={listing.marketplaceId || ""}
                        onChange={(e) =>
                          setListingMarketplace(index, e.target.value)
                        }
                        required
                      >
                        <option value="" disabled>
                          Marketplace
                        </option>
                        {marketplaceOptions.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="url"
                        pattern="https://.*"
                        value={listing.url}
                        onChange={(e) =>
                          setListing(index, "url", e.target.value)
                        }
                        placeholder="Link HTTPS do anúncio"
                        required
                      />
                      <input
                        maxLength="120"
                        value={listing.externalProductId || ""}
                        onChange={(e) =>
                          setListing(index, "externalProductId", e.target.value)
                        }
                        placeholder="ID externo (ex.: MLB123456)"
                      />
                      <button
                        type="button"
                        onClick={() => removeListing(index)}
                        aria-label="Remover canal"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {canManageCatalogOptions && (
                  <button
                    className="marketplace-manage-button"
                    type="button"
                    onClick={() => setMarketplaceModalOpen(true)}
                  >
                    Gerenciar marketplaces
                  </button>
                )}
              </div>
              <label className="status-toggle field-wide">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => set("active", e.target.checked)}
                />
                <i />
                <span>
                  <b>Produto publicado</b>
                  <small>Aparece na vitrine pública</small>
                </span>
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button type="submit" className="admin-primary" disabled={saving}>
                {saving ? (
                  "Salvando..."
                ) : (
                  <>
                    Salvar produto <span>→</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      {canManageCatalogOptions && categoryModalOpen && (
        <CategoryModal
          onClose={() => setCategoryModalOpen(false)}
          onChanged={categoriesChanged}
        />
      )}
      {canManageCatalogOptions && marketplaceModalOpen && (
        <MarketplaceModal
          onClose={() => setMarketplaceModalOpen(false)}
          onChanged={marketplacesChanged}
        />
      )}
    </>
  );
}

function AnalyticsPanel({ clicks }) {
  const today = new Date().toISOString().slice(0, 10);
  const dateBefore = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1));
    return date.toISOString().slice(0, 10);
  };
  const [from, setFrom] = useState(dateBefore(30)),
    [to, setTo] = useState(today),
    [preset, setPreset] = useState(30);
  const choosePreset = (days) => {
    setPreset(days);
    setTo(today);
    setFrom(days === "all" ? "2020-01-01" : dateBefore(days));
  };
  const filtered = useMemo(
    () =>
      clicks.filter((click) => {
        const date = click.timestamp.slice(0, 10);
        return date >= from && date <= to;
      }),
    [clicks, from, to],
  );
  const groupBy = (key) =>
    Object.entries(
      filtered.reduce((acc, item) => {
        const value = typeof key === "function" ? key(item) : item[key];
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
  const products = groupBy("productName"),
    markets = groupBy("marketplace"),
    links = groupBy(
      (item) => `${item.productName}|||${item.marketplace}|||${item.url}`,
    );
  const daily = Object.entries(
    filtered.reduce((acc, item) => {
      const day = item.timestamp.slice(0, 10);
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => a[0].localeCompare(b[0]));
  const chartData = daily.slice(-30),
    chartMax = Math.max(...chartData.map(([, value]) => value), 1),
    marketMax = Math.max(...markets.map(([, value]) => value), 1);
  return (
    <section className="analytics-panel">
      <div className="analytics-head">
        <div>
          <span className="admin-kicker">ANALYTICS / CLIQUES</span>
          <h2>Desempenho dos anúncios</h2>
          <p>
            Acompanhe quais produtos e canais mais levam visitantes para a
            compra.
          </p>
        </div>
        <div className="date-controls">
          <div>
            {[
              [7, "7 dias"],
              [30, "30 dias"],
              [90, "90 dias"],
              ["all", "Tudo"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={preset === value ? "active" : ""}
                onClick={() => choosePreset(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            De
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset("custom");
              }}
            />
          </label>
          <span>→</span>
          <label>
            Até
            <input
              type="date"
              value={to}
              max={today}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset("custom");
              }}
            />
          </label>
        </div>
      </div>
      <div className="analytics-metrics">
        <div>
          <span>Cliques no período</span>
          <b>{filtered.length}</b>
          <small>{clicks.length} cliques no total</small>
        </div>
        <div>
          <span>Produto mais clicado</span>
          <b>{products[0]?.[0] || "—"}</b>
          <small>
            {products[0] ? `${products[0][1]} cliques` : "Sem dados no período"}
          </small>
        </div>
        <div>
          <span>Marketplace líder</span>
          <b>{markets[0]?.[0] || "—"}</b>
          <small>
            {markets[0] ? `${markets[0][1]} cliques` : "Sem dados no período"}
          </small>
        </div>
      </div>
      <div className="analytics-grid">
        <article className="click-chart-card">
          <div className="analytics-card-head">
            <div>
              <h3>Cliques ao longo do tempo</h3>
              <span>Últimos {chartData.length || 0} dias com atividade</span>
            </div>
            <b>{filtered.length}</b>
          </div>
          {chartData.length ? (
            <div className="click-chart">
              {chartData.map(([date, value]) => (
                <div
                  className="chart-column"
                  key={date}
                  title={`${new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")}: ${value} cliques`}
                >
                  <span>{value}</span>
                  <i
                    style={{
                      height: `${Math.max(8, (value / chartMax) * 100)}%`,
                    }}
                  />
                  <small>
                    {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <EmptyAnalytics />
          )}
        </article>
        <article className="market-ranking">
          <div className="analytics-card-head">
            <div>
              <h3>Marketplaces</h3>
              <span>Distribuição de cliques</span>
            </div>
          </div>
          {markets.length ? (
            <div className="market-bars">
              {markets.map(([name, value]) => (
                <div key={name}>
                  <span>
                    <b>{name}</b>
                    <strong>{value}</strong>
                  </span>
                  <i>
                    <b style={{ width: `${(value / marketMax) * 100}%` }} />
                  </i>
                </div>
              ))}
            </div>
          ) : (
            <EmptyAnalytics />
          )}
        </article>
      </div>
      <article className="link-ranking">
        <div className="analytics-card-head">
          <div>
            <h3>Cliques por produto e link</h3>
            <span>Ranking detalhado de cada anúncio publicado</span>
          </div>
        </div>
        {links.length ? (
          <div className="link-ranking-table">
            <div className="link-ranking-row link-ranking-header">
              <span>Posição</span>
              <span>Produto</span>
              <span>Marketplace</span>
              <span>Cliques</span>
              <span>Participação</span>
            </div>
            {links.map(([key, value], index) => {
              const [product, market] = key.split("|||");
              return (
                <div className="link-ranking-row" key={key}>
                  <span>#{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <b>{product}</b>
                  </span>
                  <span>
                    <i>{market.slice(0, 2).toUpperCase()}</i>
                    {market}
                  </span>
                  <strong>{value}</strong>
                  <span>
                    {filtered.length
                      ? Math.round((value / filtered.length) * 100)
                      : 0}
                    %
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyAnalytics />
        )}
      </article>
    </section>
  );
}

function EmptyAnalytics() {
  return (
    <div className="analytics-empty">
      <span>↗</span>
      <b>Aguardando os primeiros cliques</b>
      <small>Os acessos aos marketplaces aparecerão aqui.</small>
    </div>
  );
}

function CleanAnalytics({ clicks }) {
  const today = new Date().toISOString().slice(0, 10);
  const before = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return d.toISOString().slice(0, 10);
  };
  const [period, setPeriod] = useState(30),
    [from, setFrom] = useState(before(30)),
    [to, setTo] = useState(today),
    [dashboard, setDashboard] = useState(null),
    [dashboardError, setDashboardError] = useState("");
  const selectPeriod = (days) => {
    setPeriod(days);
    setFrom(before(days === "all" ? 366 : days));
    setTo(today);
  };
  useEffect(() => {
    if (APP_CONFIG.dataSource !== "api") return;
    const earliest = before(366);
    if (from < earliest) {
      setFrom(earliest);
      return;
    }
    if (from > to) {
      setFrom(to);
      return;
    }
    let current = true;
    setDashboardError("");
    analyticsService
      .getDashboard(from, to)
      .then((value) => current && setDashboard(value))
      .catch((error) => current && setDashboardError(error.message));
    return () => {
      current = false;
    };
  }, [from, to]);
  const localData = useMemo(
    () =>
      clicks.filter(
        (c) =>
          c.timestamp.slice(0, 10) >= from && c.timestamp.slice(0, 10) <= to,
      ),
    [clicks, from, to],
  );
  const rank = (key) =>
    Object.entries(
      localData.reduce((acc, item) => {
        const value = key(item);
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
  const apiRank = (items) =>
    (items || [])
      .map((item) => [
        item.name || item.productName || item.marketplaceName || "Sem nome",
        Number(item.clicks || 0),
      ])
      .sort((a, b) => b[1] - a[1]);
  const productRank = dashboard
      ? apiRank(
          dashboard.products?.length
            ? dashboard.products
            : dashboard.summary?.topProduct
              ? [dashboard.summary.topProduct]
              : [],
        )
      : rank((c) => c.productName),
    marketRank = dashboard
      ? apiRank(
          dashboard.marketplaces?.length
            ? dashboard.marketplaces
            : dashboard.summary?.topMarketplace
              ? [dashboard.summary.topMarketplace]
              : [],
        )
      : rank((c) => c.marketplace),
    linkRank = dashboard
      ? []
      : rank((c) => `${c.productName}|||${c.marketplace}|||${c.url}`);
  const daily = dashboard
    ? (dashboard.timeseries || []).map((item) => [
        item.date.slice(0, 10),
        Number(item.clicks || 0),
      ])
    : Object.entries(
        localData.reduce((acc, item) => {
          const day = item.timestamp.slice(0, 10);
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        }, {}),
      )
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-30);
  const totalClicks = dashboard?.summary?.totalClicks ?? localData.length;
  const data = { length: totalClicks };
  const maxDay = Math.max(...daily.map(([, v]) => v), 1),
    maxMarket = Math.max(...marketRank.map(([, v]) => v), 1);
  if (APP_CONFIG.dataSource === "api" && !dashboard && !dashboardError)
    return (
      <div className="app-loading">
        <span />
        <p>Carregando indicadores...</p>
      </div>
    );
  if (dashboardError)
    return (
      <div className="analytics-empty">
        <b>Não foi possível carregar os indicadores</b>
        <small>{dashboardError}</small>
      </div>
    );
  return (
    <>
      <div className="clean-filter">
        <div className="period-tabs">
          {[
            [7, "7 dias"],
            [30, "30 dias"],
            [90, "90 dias"],
            ["all", "Todo período"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={period === value ? "active" : ""}
              onClick={() => selectPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="custom-dates">
          <label>
            De
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPeriod("custom");
              }}
            />
          </label>
          <span>até</span>
          <label>
            Até
            <input
              type="date"
              value={to}
              max={today}
              onChange={(e) => {
                setTo(e.target.value);
                setPeriod("custom");
              }}
            />
          </label>
        </div>
      </div>
      <div className="clean-kpis">
        <article>
          <span>Cliques no período</span>
          <b>{data.length}</b>
          <small>saídas para marketplaces</small>
        </article>
        <article>
          <span>Produto líder</span>
          <b>{productRank[0]?.[0] || "Sem dados"}</b>
          <small>
            {productRank[0]
              ? `${productRank[0][1]} cliques no período`
              : "Aguardando cliques"}
          </small>
        </article>
        <article>
          <span>Canal líder</span>
          <b>{marketRank[0]?.[0] || "Sem dados"}</b>
          <small>
            {marketRank[0]
              ? `${Math.round((marketRank[0][1] / data.length) * 100)}% dos cliques`
              : "Aguardando cliques"}
          </small>
        </article>
        <article>
          <span>Produtos acessados</span>
          <b>{productRank.length}</b>
          <small>produtos diferentes</small>
        </article>
      </div>
      <section className="clean-chart-card">
        <div className="clean-section-head">
          <div>
            <h2>Evolução dos cliques</h2>
            <p>Quantidade de acessos enviados aos marketplaces por dia.</p>
          </div>
          <strong>
            {data.length}
            <small>total no período</small>
          </strong>
        </div>
        {daily.length ? (
          <div className="clean-chart">
            {daily.map(([date, value]) => (
              <div
                key={date}
                className="clean-bar"
                title={`${date}: ${value} cliques`}
              >
                <span>{value}</span>
                <i
                  style={{ height: `${Math.max(7, (value / maxDay) * 100)}%` }}
                />
                <small>
                  {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyAnalytics />
        )}
      </section>
      <div className="clean-rank-grid">
        <section className="clean-rank-card">
          <div className="clean-section-head">
            <div>
              <h2>Produtos mais clicados</h2>
              <p>Interesse total, somando todos os canais.</p>
            </div>
          </div>
          {productRank.length ? (
            <ol>
              {productRank.slice(0, 5).map(([name, value], index) => (
                <li key={name}>
                  <span>
                    <i>{index + 1}</i>
                    <b>{name}</b>
                  </span>
                  <strong>
                    {value}
                    <small>cliques</small>
                  </strong>
                  <em>
                    <i
                      style={{ width: `${(value / productRank[0][1]) * 100}%` }}
                    />
                  </em>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyAnalytics />
          )}
        </section>
        <section className="clean-rank-card">
          <div className="clean-section-head">
            <div>
              <h2>Marketplaces</h2>
              <p>Distribuição dos acessos por canal.</p>
            </div>
          </div>
          {marketRank.length ? (
            <div className="clean-markets">
              {marketRank.map(([name, value]) => (
                <div key={name}>
                  <span>
                    <i>{name.slice(0, 2).toUpperCase()}</i>
                    <b>{name}</b>
                  </span>
                  <strong>
                    {value}
                    <small>{Math.round((value / data.length) * 100)}%</small>
                  </strong>
                  <em>
                    <i style={{ width: `${(value / maxMarket) * 100}%` }} />
                  </em>
                </div>
              ))}
            </div>
          ) : (
            <EmptyAnalytics />
          )}
        </section>
      </div>
      <section className="clean-links">
        <div className="clean-section-head">
          <div>
            <h2>Desempenho por anúncio</h2>
            <p>
              Cada linha representa um link específico publicado em um
              marketplace.
            </p>
          </div>
          <span>{linkRank.length} links com atividade</span>
        </div>
        {linkRank.length ? (
          <div className="clean-links-table">
            <div className="clean-link-row clean-link-head">
              <span>Produto</span>
              <span>Marketplace</span>
              <span>Cliques</span>
              <span>% do total</span>
            </div>
            {linkRank.map(([key, value]) => {
              const [product, market, url] = key.split("|||");
              return (
                <div className="clean-link-row" key={key}>
                  <span>
                    <b>{product}</b>
                    <small title={url}>{url}</small>
                  </span>
                  <span>
                    <i>{market.slice(0, 2).toUpperCase()}</i>
                    {market}
                  </span>
                  <strong>{value}</strong>
                  <span>{Math.round((value / data.length) * 100)}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyAnalytics />
        )}
      </section>
    </>
  );
}

function AdminRevenueDashboard() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [selectedRegion, setSelectedRegion] = useState(""),
    [hoveredChartIndex, setHoveredChartIndex] = useState(null);
  const dashboardRequest = useRef(0);
  const now = new Date();
  const [periodType, setPeriodType] = useState("month"),
    [year, setYear] = useState(String(now.getFullYear())),
    [month, setMonth] = useState(String(now.getMonth()));
  const dateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const selectedYear = Number(year),
    selectedMonth = Number(month);
  const from = dateKey(
    periodType === "year"
      ? new Date(selectedYear, 0, 1)
      : new Date(selectedYear, selectedMonth, 1),
  );
  const rangeEnd =
    periodType === "year"
      ? new Date(selectedYear, 11, 31)
      : new Date(selectedYear, selectedMonth + 1, 0);
  const to = dateKey(rangeEnd);
  const load = (clearPrevious = false) => {
    const request = ++dashboardRequest.current;
    setError("");
    if (clearPrevious) setData(null);
    orderService
      .adminDashboard(from, to, selectedRegion)
      .then((result) => {
        if (request === dashboardRequest.current) setData(result);
      })
      .catch((err) => {
        if (request === dashboardRequest.current) setError(err.message);
      });
  };
  useEffect(() => {
    load(true);
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [from, to, selectedRegion]);
  const dashboard = data?.data || data || {};
  const summary = dashboard.summary || dashboard;
  const reportedRevenue = Number(
    summary.grossRevenueCents ||
      summary.revenueCents ||
      summary.totalRevenueCents ||
      0,
  );
  const reportedOrders = Number(
    summary.paidOrdersCount || summary.paidOrders || summary.ordersCount || 0,
  );
  const revenue = reportedRevenue;
  const orders = reportedOrders;
  const statusCounts = (dashboard.ordersByStatus || []).reduce(
    (counts, item) => ({
      ...counts,
      [Number(item.status)]: Number(item.count || 0),
    }),
    Object.fromEntries(Array.from({ length: 7 }, (_, status) => [status, 0])),
  );
  const totalOrders = Number(
    summary.totalOrdersCount ||
      Object.values(statusCounts).reduce((total, count) => total + count, 0),
  );
  const cancelledOrders = statusCounts[6];
  const ordersUrl = (filter = "") =>
    filter ? `/admin/pedidos?filter=${filter}` : "/admin/pedidos";
  const rawDaily =
    dashboard.totalRevenueByDay ||
    dashboard.revenueByDay ||
    dashboard.revenuesByDay ||
    [];
  const rawRegionalDaily = selectedRegion
    ? dashboard.regionalRevenueByDay ||
      dashboard.selectedRegionRevenueByDay ||
      []
    : [];
  const rawRevenueByRegionDay =
    dashboard.revenueByRegionDay || dashboard.regionalRevenueByRegion || [];
  const chartSlots = [];
  if (periodType === "year") {
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      chartSlots.push(
        `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}-01`,
      );
    }
  } else {
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day += 1) {
      chartSlots.push(
        `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      );
    }
  }
  const slotKey = (date) =>
    periodType === "year"
      ? String(date).slice(0, 7)
      : String(date).slice(0, 10);
  const normaliseSeries = (series) => {
    const values = series.reduce((map, item) => {
      const key = slotKey(item.date);
      map.set(key, (map.get(key) || 0) + Number(item.revenueCents || 0));
      return map;
    }, new Map());
    return chartSlots.map((date) => ({
      date,
      revenueCents: values.get(slotKey(date)) || 0,
    }));
  };
  const daily = normaliseSeries(rawDaily);
  const regionalDaily = normaliseSeries(rawRegionalDaily);
  const revenueByRegionDay = rawRevenueByRegionDay;
  const max = Math.max(
    ...daily.map((item) => Number(item.revenueCents || 0)),
    ...regionalDaily.map((item) => Number(item.revenueCents || 0)),
    ...revenueByRegionDay.map((item) => Number(item.revenueCents || 0)),
    1,
  );
  const linePoints = daily
    .map((item, index) => {
      const x = daily.length === 1 ? 50 : 5 + (index / (daily.length - 1)) * 90;
      const y = 92 - (Number(item.revenueCents || 0) / max) * 82;
      return `${x},${y}`;
    })
    .join(" ");
  const totalBars = daily.map((item, index) => {
    const slotWidth = 90 / Math.max(daily.length, 1);
    const height = (Number(item.revenueCents || 0) / max) * 82;
    return {
      date: item.date,
      x: 5 + index * slotWidth + Math.min(slotWidth * 0.16, 0.8),
      width: Math.max(slotWidth * 0.68, 0.45),
      y: 92 - height,
      height,
    };
  });
  const revenueByDateForRegion = (region) =>
    new Map(
      (selectedRegion === region && rawRegionalDaily.length
        ? regionalDaily
        : normaliseSeries(
            revenueByRegionDay.filter(
              (item) => (item.region || item.name) === region,
            ),
          )
      ).map((item) => [item.date, Number(item.revenueCents || 0)]),
    );
  const linePointsForRegion = (region) => {
    const values = revenueByDateForRegion(region);
    return daily
      .map((item, index) => {
        const x =
          daily.length === 1 ? 50 : 5 + (index / (daily.length - 1)) * 90;
        const y = 92 - ((values.get(item.date) || 0) / max) * 82;
        return `${x},${y}`;
      })
      .join(" ");
  };
  const lineLabelIndexes = Array.from(
    new Set(
      [
        0,
        Math.round((daily.length - 1) / 3),
        Math.round(((daily.length - 1) * 2) / 3),
        daily.length - 1,
      ].filter((index) => index >= 0),
    ),
  );
  const formatChartDate = (date) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(
      "pt-BR",
      periodType === "year"
        ? { month: "short" }
        : { day: "2-digit", month: "2-digit" },
    );
  const hoveredChart =
    hoveredChartIndex === null ? null : daily[hoveredChartIndex];
  const topProducts = dashboard.topProducts || [];
  const topCategories = dashboard.topCategories || [];
  const regionalSales =
    dashboard.salesByRegion || dashboard.ordersByRegion || [];
  const brazilRegions = [
    ["Norte", "M8 7 L48 3 L62 24 L49 46 L16 40 Z"],
    ["Nordeste", "M62 10 L95 18 L92 49 L69 54 L49 46 L62 24 Z"],
    ["Centro-Oeste", "M36 47 L69 54 L67 78 L39 82 L22 63 Z"],
    ["Sudeste", "M67 57 L94 51 L97 75 L74 82 L67 78 Z"],
    ["Sul", "M55 82 L74 82 L68 98 L57 96 Z"],
  ];
  const regionPalette = {
    Norte: "#2688c9",
    Nordeste: "#e07930",
    "Centro-Oeste": "#b88710",
    Sudeste: "#d45378",
    Sul: "#2e9b6c",
  };
  const regionColor = (name) => regionPalette[name] || "#6047cf";
  const chartRegions = selectedRegion
    ? [selectedRegion]
    : brazilRegions
        .map(([name]) => name)
        .filter((region) =>
          Array.from(revenueByDateForRegion(region).values()).some(
            (value) => value > 0,
          ),
        );
  const regionalMax = Math.max(
    ...regionalSales.map((region) =>
      Number(region.revenueCents || region.ordersCount || 0),
    ),
    1,
  );
  const regionalData = (name) =>
    regionalSales.find((region) => (region.region || region.name) === name) ||
    {};
  const operations = dashboard.operations || {};
  const liveOrders = operations.priorityOrders || [];
  const liveInProgress = Number(operations.inProgressCount || 0);
  const livePendingPayment = Number(operations.pendingPaymentCount || 0);
  const liveAwaitingShipment = Number(operations.awaitingShipmentCount || 0);
  const liveShipped = Number(operations.shippedCount || 0);
  return (
    <>
      <section className="dashboard-live-operations">
        <div className="dashboard-live-head">
          <div>
            <span className="admin-kicker">OPERAÇÃO / AO VIVO</span>
            <h2>Pedidos em andamento</h2>
            <p>
              Fila atualizada automaticamente a cada 15 segundos, sem depender
              do filtro abaixo.
            </p>
          </div>
          <span className="live-indicator">Atualização automática</span>
        </div>
        <div className="dashboard-live-kpis">
          <a href={ordersUrl()}>
            <span>Em andamento</span>
            <b>{liveInProgress}</b>
            <small>Pedidos ainda não concluídos</small>
          </a>
          <a href={ordersUrl(0)}>
            <span>Aguardando pagamento</span>
            <b>{livePendingPayment}</b>
            <small>Precisam de confirmação</small>
          </a>
          <a href={ordersUrl(1)}>
            <span>Em produção e envio</span>
            <b>{liveAwaitingShipment}</b>
            <small>Pagos, em produção ou prontos</small>
          </a>
          <a href={ordersUrl(4)}>
            <span>Em trânsito</span>
            <b>{liveShipped}</b>
            <small>Já enviados ao cliente</small>
          </a>
        </div>
        <div className="dashboard-live-list">
          <div className="dashboard-live-list-head">
            <b>Prioridade operacional</b>
            <a href={ordersUrl()}>Abrir fila completa →</a>
          </div>
          {liveOrders.length ? (
            liveOrders.slice(0, 5).map((order) => (
              <a
                className="dashboard-live-order"
                key={order.id || order.orderId}
                href={ordersUrl(order.status)}
              >
                <span>
                  <b>{order.orderNumber}</b>
                  <small>
                    {order.customerEmail ||
                      order.user?.email ||
                      "E-mail não informado"}
                  </small>
                </span>
                <span>
                  {adminOrderStatus[Number(order.status)] || "Pedido"}
                </span>
                <strong>{money(Number(order.totalCents || 0) / 100)}</strong>
              </a>
            ))
          ) : (
            <p className="dashboard-live-empty">
              Não há pedidos em andamento neste momento.
            </p>
          )}
        </div>
      </section>
      <div className="dashboard-analysis-head">
        <div>
          <span className="admin-kicker">ANÁLISE / PERÍODO</span>
          <h2>Receita e desempenho</h2>
          <p>Os dados abaixo respondem ao mês ou ano escolhido.</p>
        </div>
      </div>
      <div className="dashboard-period">
        <div>
          <button
            className={periodType === "month" ? "active" : ""}
            onClick={() => setPeriodType("month")}
          >
            Mês
          </button>
          <button
            className={periodType === "year" ? "active" : ""}
            onClick={() => setPeriodType("year")}
          >
            Ano
          </button>
        </div>
        {periodType === "month" && (
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            {[
              "Janeiro",
              "Fevereiro",
              "Março",
              "Abril",
              "Maio",
              "Junho",
              "Julho",
              "Agosto",
              "Setembro",
              "Outubro",
              "Novembro",
              "Dezembro",
            ].map((label, value) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        <select value={year} onChange={(event) => setYear(event.target.value)}>
          {Array.from(
            { length: 5 },
            (_, index) => now.getFullYear() - index,
          ).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <>
        <div className="dashboard-kpis">
          <article>
            <span>Total de pedidos</span>
            <b>{totalOrders}</b>
            <small>criados no período selecionado</small>
          </article>
          <article>
            <span>Pedidos cancelados</span>
            <b>{cancelledOrders}</b>
            <small>cancelados no período selecionado</small>
          </article>
          <article>
            <span>Receita de produtos</span>
            <b>{money(revenue / 100)}</b>
            <small>frete não incluído</small>
          </article>
          <article>
            <span>Ticket médio</span>
            <b>
              {money(
                Number(
                  summary.averageTicketCents ||
                    summary.averageOrderCents ||
                    (orders ? Math.round(revenue / orders) : 0),
                ) / 100,
              )}
            </b>
            <small>por pedido pago</small>
          </article>
          <article className="dashboard-product-leader">
            <span>Produto líder</span>
            {topProducts.length ? (
              <>
                <b>{topProducts[0].name}</b>
                <small>{topProducts[0].quantity} un. vendidas</small>
              </>
            ) : (
              <small>Aguardando vendas no período.</small>
            )}
          </article>
        </div>
        <section className="dashboard-report-card">
          <div>
            <span className="admin-kicker">RECEITA / PERÍODO SELECIONADO</span>
            <h2>Vendas ao longo do tempo</h2>
            <p>
              {rawDaily.length
                ? selectedRegion
                  ? `Comparativo entre o total Brasil e ${selectedRegion}.`
                  : "Receita de produtos pagos por dia."
                : "As vendas confirmadas aparecerão aqui assim que os primeiros pedidos forem pagos."}
            </p>
          </div>
          <strong>
            {money(revenue / 100)}
            <small>receita total</small>
          </strong>
          {rawDaily.length ? (
            <div className="dashboard-revenue-line-wrap">
              <div className="dashboard-line-axis" aria-hidden="true">
                <small>{money(max / 100)}</small>
                <small>{money(Math.round(max / 2) / 100)}</small>
                <small>R$ 0,00</small>
              </div>
              <div
                className="dashboard-line-canvas"
                style={{
                  "--selected-region-color": regionColor(selectedRegion),
                }}
              >
                <div className="dashboard-line-legend">
                  <span>
                    <i className="total-bar" />
                    Total Brasil
                  </span>
                  {chartRegions.map((region) => (
                    <span key={region}>
                      <i
                        className="region-line"
                        style={{ background: regionColor(region) }}
                      />
                      {region}
                    </span>
                  ))}
                </div>
                <svg
                  className="dashboard-revenue-line"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Receita por dia"
                  onMouseLeave={() => setHoveredChartIndex(null)}
                >
                  <line
                    className="revenue-line-grid"
                    x1="5"
                    x2="95"
                    y1="10"
                    y2="10"
                  />
                  <line
                    className="revenue-line-grid"
                    x1="5"
                    x2="95"
                    y1="51"
                    y2="51"
                  />
                  <line
                    className="revenue-line-grid"
                    x1="5"
                    x2="95"
                    y1="92"
                    y2="92"
                  />
                  {totalBars.map((bar) => (
                    <rect
                      key={bar.date}
                      className="revenue-total-bar"
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      rx="0.7"
                    />
                  ))}
                  {chartRegions.map((region) => (
                    <polyline
                      key={region}
                      className="revenue-region-stroke"
                      points={linePointsForRegion(region)}
                      style={{ stroke: regionColor(region) }}
                    />
                  ))}
                  <line
                    className="revenue-line-baseline"
                    x1="5"
                    x2="95"
                    y1="92"
                    y2="92"
                  />
                  {daily.map((item, index) => {
                    const width = 90 / Math.max(daily.length, 1);
                    const x = Math.max(
                      5,
                      5 +
                        (index / Math.max(daily.length - 1, 1)) * 90 -
                        width / 2,
                    );
                    return (
                      <rect
                        key={`hit-${item.date}`}
                        className="dashboard-line-hit"
                        x={x}
                        y="8"
                        width={width}
                        height="86"
                        onMouseEnter={() => setHoveredChartIndex(index)}
                      />
                    );
                  })}
                </svg>
                {hoveredChart && (
                  <div
                    className="dashboard-line-tooltip"
                    style={{
                      left: `${daily.length === 1 ? 50 : 5 + (hoveredChartIndex / (daily.length - 1)) * 90}%`,
                    }}
                  >
                    <b>{formatChartDate(hoveredChart.date)}</b>
                    <span>
                      Total Brasil{" "}
                      <strong>
                        {money(Number(hoveredChart.revenueCents || 0) / 100)}
                      </strong>
                    </span>
                    {chartRegions.map((region) => (
                      <span key={region}>
                        <i style={{ background: regionColor(region) }} />
                        {region}{" "}
                        <strong>
                          {money(
                            (revenueByDateForRegion(region).get(
                              hoveredChart.date,
                            ) || 0) / 100,
                          )}
                        </strong>
                      </span>
                    ))}
                  </div>
                )}
                <div className="dashboard-line-labels">
                  {lineLabelIndexes.map((index) => (
                    <small
                      key={daily[index].date}
                      style={{
                        left: `${daily.length === 1 ? 50 : 5 + (index / (daily.length - 1)) * 90}%`,
                      }}
                    >
                      {formatChartDate(daily[index].date)}
                    </small>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="dashboard-no-data">
              Ainda não há vendas confirmadas neste período.
            </div>
          )}
        </section>
        <div className="dashboard-report-grid">
          <section>
            <span>Categoria líder</span>
            {topCategories.length ? (
              <>
                <b>{topCategories[0].name}</b>
                <small>
                  {topCategories[0].quantity} un. ·{" "}
                  {money(Number(topCategories[0].revenueCents || 0) / 100)} em
                  receita
                </small>
              </>
            ) : (
              <small>Aguardando dados de categoria.</small>
            )}
          </section>
          <section>
            <span>Produtos mais vendidos</span>
            {topProducts.length ? (
              <ol>
                {topProducts.slice(0, 3).map((product) => (
                  <li key={product.productId}>
                    <b>{product.name}</b>
                    <span>{product.quantity} un.</span>
                  </li>
                ))}
              </ol>
            ) : (
              <small>Aguardando vendas para gerar ranking.</small>
            )}
          </section>
        </div>
        <section className="dashboard-regional-report">
          <div>
            <span className="admin-kicker">MERCADO / REGIÕES</span>
            <h2>Vendas por região do Brasil</h2>
            <p>
              Receita de produtos pagos por região de entrega no período
              selecionado.
            </p>
          </div>
          <div className="brazil-region-chart">
            <svg
              viewBox="0 0 105 102"
              role="img"
              aria-label="Mapa de vendas por região do Brasil"
            >
              {brazilRegions.map(([name, path]) => {
                const region = regionalData(name);
                const value = Number(
                  region.revenueCents || region.ordersCount || 0,
                );
                const opacity = value
                  ? 0.28 + (value / regionalMax) * 0.72
                  : 0.12;
                return (
                  <path
                    key={name}
                    d={path}
                    className={selectedRegion === name ? "active" : ""}
                    style={{
                      fill: regionColor(name),
                      fillOpacity: opacity,
                      "--region-color": regionColor(name),
                    }}
                    onClick={() =>
                      setSelectedRegion((current) =>
                        current === name ? "" : name,
                      )
                    }
                    role="button"
                    tabIndex="0"
                    onKeyDown={(event) =>
                      event.key === "Enter" &&
                      setSelectedRegion((current) =>
                        current === name ? "" : name,
                      )
                    }
                  >
                    <title>{`${name}: ${money(Number(region.revenueCents || 0) / 100)}`}</title>
                  </path>
                );
              })}
            </svg>
            <div className="brazil-region-legend">
              {brazilRegions.map(([name]) => {
                const region = regionalData(name);
                return (
                  <button
                    key={name}
                    className={selectedRegion === name ? "active" : ""}
                    style={{ "--region-color": regionColor(name) }}
                    onClick={() =>
                      setSelectedRegion((current) =>
                        current === name ? "" : name,
                      )
                    }
                  >
                    <span>{name}</span>
                    <b>{money(Number(region.revenueCents || 0) / 100)}</b>
                    <small>{Number(region.ordersCount || 0)} pedidos</small>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </>
      {error && (
        <p className="dashboard-data-note">
          Indicadores ainda indisponíveis: {error}
        </p>
      )}
    </>
  );
}

function AnalyticsPage({ clicks, session, onLogout }) {
  return (
    <main className="clean-admin">
      <AdminSidebar
        active="dashboard"
        session={session}
        onLoggedOut={onLogout}
      />
      <section className="clean-analytics-content">
        <header className="clean-page-head">
          <div>
            <span className="admin-kicker">ANALYTICS / VISÃO GERAL</span>
            <h1>Desempenho</h1>
            <p>Veja o que desperta mais interesse na sua vitrine.</p>
          </div>
          <a href="/" target="_blank">
            Abrir loja <span>↗</span>
          </a>
        </header>
        <AdminRevenueDashboard />
      </section>
    </main>
  );
}

function CategoryModal({ onClose, onChanged }) {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [editing, setEditing] = useState(null),
    [name, setName] = useState(""),
    [active, setActive] = useState(true);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await catalogService.listCategories({ admin: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const close = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const reset = () => {
    setEditing(null);
    setName("");
    setActive(true);
    setError("");
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const category = editing
        ? await catalogService.updateCategory({
            id: editing.id,
            name: name.trim(),
            active,
          })
        : await catalogService.createCategory(name.trim(), active);
      await load();
      await onChanged(category);
      reset();
    } catch (err) {
      setError(
        err.status === 404
          ? "As rotas administrativas de categorias ainda não estão disponíveis na API."
          : err.message,
      );
    } finally {
      setSaving(false);
    }
  };
  const startEdit = (category) => {
    setEditing(category);
    setName(category.name);
    setActive(category.active !== false);
    setError("");
  };
  const remove = async (category) => {
    if (!window.confirm(`Excluir a categoria “${category.name}”?`)) return;
    setError("");
    try {
      await catalogService.deleteCategory(category.id);
      if (editing?.id === category.id) reset();
      await load();
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="category-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
      >
        <div className="modal-head">
          <div>
            <span className="admin-kicker">CATÁLOGO / CATEGORIAS</span>
            <h2 id="category-modal-title">Gerenciar categorias</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="category-manager-body">
          <form className="category-form" onSubmit={submit}>
            <span className="admin-kicker">
              {editing ? "EDITAR CATEGORIA" : "NOVA CATEGORIA"}
            </span>
            <label>
              Nome
              <input
                autoFocus
                minLength="2"
                maxLength="80"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Iluminação"
                required
              />
            </label>
            <label className="status-toggle">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              <i />
              <span>
                <b>Categoria ativa</b>
                <small>Disponível no cadastro de produtos</small>
              </span>
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className="category-form-actions">
              {editing && (
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={reset}
                >
                  Cancelar edição
                </button>
              )}
              <button type="submit" className="admin-primary" disabled={saving}>
                {saving
                  ? "Salvando..."
                  : editing
                    ? "Salvar alterações"
                    : "Criar categoria"}
              </button>
            </div>
          </form>
          <section className="category-manager-list">
            <div>
              <b>Categorias cadastradas</b>
              <small>{items.length} itens</small>
            </div>
            {loading ? (
              <p className="admin-empty">Carregando...</p>
            ) : items.length ? (
              items.map((category) => (
                <article key={category.id}>
                  <span>
                    <b>{category.name}</b>
                    <small>{category.slug}</small>
                  </span>
                  <em className={category.active === false ? "inactive" : ""}>
                    {category.active === false ? "Inativa" : "Ativa"}
                  </em>
                  <button type="button" onClick={() => startEdit(category)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => remove(category)}
                  >
                    Excluir
                  </button>
                </article>
              ))
            ) : (
              <p className="admin-empty">Nenhuma categoria cadastrada.</p>
            )}
          </section>
        </div>
        <div className="modal-actions">
          <button type="button" className="admin-secondary" onClick={onClose}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketplaceModal({ onClose, onChanged }) {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [editing, setEditing] = useState(null),
    [name, setName] = useState(""),
    [active, setActive] = useState(true);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await catalogService.listMarketplaces({ admin: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const close = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const reset = () => {
    setEditing(null);
    setName("");
    setActive(true);
    setError("");
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const marketplace = editing
        ? await catalogService.updateMarketplace({
            id: editing.id,
            name: name.trim(),
            active,
          })
        : await catalogService.createMarketplace({ name: name.trim(), active });
      await load();
      await onChanged(marketplace);
      reset();
    } catch (err) {
      setError(
        err.status === 404 ? "Marketplace não encontrado." : err.message,
      );
    } finally {
      setSaving(false);
    }
  };
  const startEdit = (marketplace) => {
    setEditing(marketplace);
    setName(marketplace.name);
    setActive(marketplace.active !== false);
    setError("");
  };
  const remove = async (marketplace) => {
    if (!window.confirm(`Excluir o marketplace “${marketplace.name}”?`)) return;
    setError("");
    try {
      await catalogService.deleteMarketplace(marketplace.id);
      if (editing?.id === marketplace.id) reset();
      await load();
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="category-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketplace-modal-title"
      >
        <div className="modal-head">
          <div>
            <span className="admin-kicker">CATÁLOGO / MARKETPLACES</span>
            <h2 id="marketplace-modal-title">Gerenciar marketplaces</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="category-manager-body">
          <form className="category-form" onSubmit={submit}>
            <span className="admin-kicker">
              {editing ? "EDITAR MARKETPLACE" : "NOVO MARKETPLACE"}
            </span>
            <label>
              Nome
              <input
                autoFocus
                minLength="2"
                maxLength="80"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Amazon"
                required
              />
            </label>
            <label className="status-toggle">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              <i />
              <span>
                <b>Marketplace ativo</b>
                <small>Disponível nos anúncios de produtos</small>
              </span>
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className="category-form-actions">
              {editing && (
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={reset}
                >
                  Cancelar edição
                </button>
              )}
              <button type="submit" className="admin-primary" disabled={saving}>
                {saving
                  ? "Salvando..."
                  : editing
                    ? "Salvar alterações"
                    : "Criar marketplace"}
              </button>
            </div>
          </form>
          <section className="category-manager-list">
            <div>
              <b>Marketplaces cadastrados</b>
              <small>{items.length} itens</small>
            </div>
            {loading ? (
              <p className="admin-empty">Carregando...</p>
            ) : items.length ? (
              items.map((marketplace) => (
                <article key={marketplace.id}>
                  <span>
                    <b>{marketplace.name}</b>
                  </span>
                  <em
                    className={marketplace.active === false ? "inactive" : ""}
                  >
                    {marketplace.active === false ? "Inativo" : "Ativo"}
                  </em>
                  <button type="button" onClick={() => startEdit(marketplace)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => remove(marketplace)}
                  >
                    Excluir
                  </button>
                </article>
              ))
            ) : (
              <p className="admin-empty">Nenhum marketplace cadastrado.</p>
            )}
          </section>
        </div>
        <div className="modal-actions">
          <button type="button" className="admin-secondary" onClick={onClose}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

function UserFormModal({
  user,
  permissions,
  currentUserId,
  protectAdmin,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => ({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    idPermission: String(
      user?.idPermission ?? permissions[0]?.idPermission ?? "",
    ),
    active: user?.active !== false,
  }));
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const submittingRef = useRef(false);
  const locksAdministrativeAccess = Boolean(
    user && (user.id === currentUserId || protectAdmin),
  );
  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        idPermission: Number(form.idPermission),
        active: user ? form.active : true,
      };
      if (form.password) payload.password = form.password;
      if (user) await userService.update(user.id, payload);
      else await userService.create(payload);
      await onSaved(
        user
          ? "Usuário atualizado com sucesso."
          : "Usuário criado com sucesso.",
      );
    } catch (err) {
      submittingRef.current = false;
      setError(err.message);
      setSaving(false);
    }
  };
  return (
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="user-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
      >
        <div className="modal-head">
          <div>
            <span className="admin-kicker">
              ACESSOS / {user ? "EDIÇÃO" : "NOVO"}
            </span>
            <h2 id="user-form-title">
              {user ? "Editar usuário" : "Criar usuário"}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <form className="user-form" onSubmit={submit}>
          <div className="user-form-grid">
            <label>
              Nome
              <input
                autoFocus
                minLength="2"
                maxLength="120"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                required
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                maxLength="254"
                value={form.email}
                onChange={(event) => set("email", event.target.value)}
                required
              />
            </label>
            <label className={!user ? "field-wide" : undefined}>
              Permissão
              <select
                value={form.idPermission}
                onChange={(event) => set("idPermission", event.target.value)}
                disabled={locksAdministrativeAccess}
                required
              >
                <option value="" disabled>
                  Selecione uma permissão
                </option>
                {permissions.map((item) => (
                  <option key={item.idPermission} value={item.idPermission}>
                    {item.permission}
                  </option>
                ))}
              </select>
              {locksAdministrativeAccess && (
                <small>
                  A permissão administrativa desta conta está protegida.
                </small>
              )}
            </label>
            {user && (
              <label className="status-toggle user-active-toggle">
                <input
                  type="checkbox"
                  checked={form.active}
                  disabled={locksAdministrativeAccess}
                  onChange={(event) => set("active", event.target.checked)}
                />
                <i />
                <span>
                  <b>Usuário ativo</b>
                  <small>
                    {locksAdministrativeAccess
                      ? "Esta conta administrativa não pode ser desativada"
                      : form.active
                        ? "Acesso liberado"
                        : "Acesso bloqueado"}
                  </small>
                </span>
              </label>
            )}
            <label className="field-wide">
              {user ? "Nova senha (opcional)" : "Senha"}
              <input
                type="password"
                minLength="12"
                maxLength="128"
                value={form.password}
                onChange={(event) => set("password", event.target.value)}
                required={!user}
                autoComplete="new-password"
                placeholder={
                  user
                    ? "Deixe vazio para manter a senha atual"
                    : "Mínimo de 12 caracteres"
                }
              />
            </label>
          </div>
          {error && <div className="form-error user-form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="admin-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="admin-primary"
              disabled={saving || !form.idPermission}
            >
              {saving
                ? "Salvando..."
                : user
                  ? "Salvar alterações"
                  : "Criar usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UsersPage({ session, onLogout }) {
  const canManageUsers = permissionAccess(session).manageUsers;
  const [users, setUsers] = useState([]),
    [permissions, setPermissions] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [accountFilter, setAccountFilter] = useState("administrators"),
    [editing, setEditing] = useState(null),
    [formOpen, setFormOpen] = useState(false),
    [blocking, setBlocking] = useState(null);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const nextUsers = await userService.list({
        accountType:
          accountFilter === "administrators" ? "administrative" : "customer",
      });
      setUsers(nextUsers);
      if (canManageUsers) setPermissions(await userService.listPermissions());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [accountFilter]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  const saved = async (message) => {
    setFormOpen(false);
    setEditing(null);
    setNotice(message);
    await load();
  };
  const block = async () => {
    if (!blocking) return;
    const name = blocking.name;
    try {
      await userService.block(blocking.id);
      setBlocking(null);
      setNotice(`${name} foi bloqueado com sucesso.`);
      await load();
    } catch (err) {
      setError(err.message);
      setBlocking(null);
    }
  };
  const activate = async (user) => {
    try {
      await userService.update(user.id, { active: true });
      setNotice(`${user.name} foi reativado com sucesso.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const activeAdminCount = users.filter(
    (user) =>
      user.permission?.toLocaleLowerCase("pt-BR") === "admin" && user.active,
  ).length;
  const isLastActiveAdmin = (user) =>
    user.permission?.toLocaleLowerCase("pt-BR") === "admin" &&
    user.active &&
    activeAdminCount === 1;
  const searchedUsers = users.filter((user) =>
    `${user.name} ${user.email} ${user.permission} ${user.active ? "ativo" : "bloqueado"}`
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedQuery),
  );
  const isCustomerAccount = (user) => permissionName(user) === "cliente";
  const administrators = searchedUsers.filter(
    (user) => !isCustomerAccount(user),
  );
  const customers = searchedUsers.filter(isCustomerAccount);
  const visible =
    accountFilter === "administrators" ? administrators : customers;
  return (
    <main className="admin-shell users-admin">
      <AdminSidebar active="users" session={session} onLoggedOut={onLogout} />
      <section className="admin-content">
        <header className="admin-top">
          <div>
            <span className="admin-kicker">PAINEL / ACESSOS</span>
            <h1>Usuários</h1>
            <p>
              {canManageUsers
                ? "Gerencie contas, permissões e acessos administrativos."
                : "Consulte as contas e permissões cadastradas."}
            </p>
          </div>
          {canManageUsers && (
            <button
              className="admin-primary"
              disabled={!permissions.length}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <PlusIcon /> Novo usuário
            </button>
          )}
        </header>
        <div className="admin-stats">
          <div>
            <span>Total de usuários</span>
            <b>{users.length}</b>
            <small>contas cadastradas</small>
          </div>
          <div>
            <span>Administradores ativos</span>
            <b>{activeAdminCount}</b>
            <small>com acesso ao painel</small>
          </div>
          <div>
            <span>Contas bloqueadas</span>
            <b>{users.filter((user) => !user.active).length}</b>
            <small>sem acesso à conta</small>
          </div>
        </div>
        <div className="admin-table-card">
          <div className="table-toolbar">
            <div>
              <h2>Contas cadastradas</h2>
              <span>
                {visible.length}{" "}
                {accountFilter === "administrators"
                  ? "contas administrativas"
                  : "contas clientes"}
              </span>
            </div>
            <div className="users-toolbar-actions">
              <div
                className="users-filter-tabs"
                role="group"
                aria-label="Filtrar contas"
              >
                <button
                  type="button"
                  className={accountFilter === "administrators" ? "active" : ""}
                  onClick={() => setAccountFilter("administrators")}
                >
                  Contas administrativas
                </button>
                <button
                  type="button"
                  className={accountFilter === "customers" ? "active" : ""}
                  onClick={() => setAccountFilter("customers")}
                >
                  Contas clientes
                </button>
              </div>
              <label>
                <SearchIcon />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar usuário..."
                />
              </label>
            </div>
          </div>
          {error && (
            <div className="users-error">
              <span>{error}</span>
              <button type="button" onClick={load}>
                Tentar novamente
              </button>
            </div>
          )}
          <div className="admin-table-wrap">
            <table className="admin-table users-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Permissão</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  {canManageUsers && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-identity">
                        <i>{user.name.slice(0, 2).toUpperCase()}</i>
                        <span>
                          <b>{user.name}</b>
                          <small>{user.email}</small>
                        </span>
                        {user.id === session?.id && <em>Você</em>}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`permission-badge ${permissionName(user) === "admin" ? "admin" : ""}`}
                      >
                        {user.permission}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${user.active ? "active" : ""}`}
                      >
                        <i />
                        {user.active ? "Ativo" : "Bloqueado"}
                      </span>
                    </td>
                    <td>
                      {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    {canManageUsers && (
                      <td>
                        <div className="user-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(user);
                              setFormOpen(true);
                            }}
                          >
                            Editar
                          </button>
                          {!user.active ? (
                            <button
                              type="button"
                              onClick={() => activate(user)}
                            >
                              Reativar
                            </button>
                          ) : (
                            user.id !== session?.id &&
                            !isLastActiveAdmin(user) && (
                              <button
                                type="button"
                                className="danger"
                                onClick={() => setBlocking(user)}
                              >
                                Bloquear
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {loading ? (
              <div className="admin-empty">Carregando usuários...</div>
            ) : (
              !visible.length && (
                <div className="admin-empty">Nenhum usuário encontrado.</div>
              )
            )}
          </div>
        </div>
      </section>
      {notice && (
        <div className="admin-success-toast" role="status" aria-live="polite">
          <span>✓</span>
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      )}
      {canManageUsers && formOpen && (
        <UserFormModal
          user={editing}
          permissions={permissions}
          currentUserId={session?.id}
          protectAdmin={editing && isLastActiveAdmin(editing)}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={saved}
        />
      )}
      {canManageUsers && blocking && (
        <div className="admin-modal-backdrop">
          <div className="confirm-modal">
            <div className="confirm-icon">
              <TrashIcon />
            </div>
            <h2>Bloquear usuário?</h2>
            <p>
              “{blocking.name}” perderá o acesso, mas seus dados serão
              preservados.
            </p>
            <div>
              <button
                className="admin-secondary"
                onClick={() => setBlocking(null)}
              >
                Cancelar
              </button>
              <button className="admin-danger" onClick={block}>
                Sim, bloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function AnnouncementButton({ product, onChoose }) {
  const listings = getMarketplaces(product).filter((listing) => listing.url);
  if (!listings.length)
    return (
      <button type="button" disabled title="Produto sem anúncio">
        <ExternalIcon />
      </button>
    );
  if (listings.length === 1)
    return (
      <a
        href={listings[0].url}
        target="_blank"
        rel="noreferrer"
        title={`Abrir anúncio no ${listings[0].name}`}
      >
        <ExternalIcon />
      </a>
    );
  return (
    <button
      type="button"
      onClick={() => onChoose(product)}
      title={`Escolher entre ${listings.length} anúncios`}
      aria-label={`Escolher anúncio de ${product.name}`}
    >
      <ExternalIcon />
    </button>
  );
}

function AnnouncementChooserModal({ product, onClose }) {
  const listings = getMarketplaces(product).filter((listing) => listing.url);
  useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="announcement-chooser-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-chooser-title"
      >
        <div className="modal-head">
          <div>
            <span className="admin-kicker">PRODUTO / ANÚNCIOS</span>
            <h2 id="announcement-chooser-title">Escolha onde abrir</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="announcement-chooser-body">
          <p>Este produto possui {listings.length} canais de venda.</p>
          {listings.map((listing, index) => (
            <a
              href={listing.url}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              key={listing.id || `${listing.marketplaceId}-${index}`}
            >
              <span>
                <i>{listing.name.slice(0, 2).toUpperCase()}</i>
                <b>{listing.name}</b>
              </span>
              <small>
                {listing.externalProductId || "Abrir anúncio"} <ExternalIcon />
              </small>
            </a>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="admin-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ShippingOriginSettings({ onClose }) {
  const [form, setForm] = useState({
    originPostalCode: "",
    originStreet: "",
    originNumber: "",
    originComplement: "",
    originNeighborhood: "",
    originCity: "",
    originState: "",
  });
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    shippingSettingsService
      .get(controller.signal)
      .then((value) => {
        if (value) setForm((current) => ({ ...current, ...value }));
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  const submit = async (event) => {
    event.preventDefault();
    const originPostalCode = form.originPostalCode.replace(/\D/g, "");
    const originState = form.originState.trim().toUpperCase();
    if (
      !/^\d{8}$/.test(originPostalCode) ||
      !/^([A-Z]{2})$/.test(originState)
    ) {
      setError("Informe CEP com 8 dígitos e UF com 2 letras.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await shippingSettingsService.save({
        ...form,
        originPostalCode,
        originState,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="shipping-origin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shipping-origin-title"
      >
        <div className="modal-head">
          <div>
            <span className="admin-kicker">FRETE / ORIGEM</span>
            <h2 id="shipping-origin-title">Editar origem de envio</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        {loading ? (
          <div className="shipping-origin-loading">
            Carregando origem de envio...
          </div>
        ) : (
          <form onSubmit={submit}>
            <p>Endereço usado para cotar frete no Melhor Envio.</p>
            <div className="shipping-origin-grid">
              <label>
                CEP
                <input
                  inputMode="numeric"
                  maxLength="9"
                  value={form.originPostalCode}
                  onChange={(e) =>
                    setForm({ ...form, originPostalCode: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Rua
                <input
                  value={form.originStreet || ""}
                  onChange={(e) =>
                    setForm({ ...form, originStreet: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Número
                <input
                  value={form.originNumber || ""}
                  onChange={(e) =>
                    setForm({ ...form, originNumber: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Complemento
                <input
                  value={form.originComplement || ""}
                  onChange={(e) =>
                    setForm({ ...form, originComplement: e.target.value })
                  }
                />
              </label>
              <label>
                Bairro
                <input
                  value={form.originNeighborhood || ""}
                  onChange={(e) =>
                    setForm({ ...form, originNeighborhood: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Cidade
                <input
                  value={form.originCity || ""}
                  onChange={(e) =>
                    setForm({ ...form, originCity: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                UF
                <input
                  maxLength="2"
                  value={form.originState || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      originState: e.target.value.toUpperCase(),
                    })
                  }
                  required
                />
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button className="admin-primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar origem"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const adminOrderStatus = [
  "Aguardando pagamento",
  "Pago",
  "Em produção",
  "Pronto para envio",
  "Enviado",
  "Entregue",
  "Cancelado",
];
const nextOrderStatus = {
  0: [1, 6],
  1: [2, 6],
  2: [3],
  3: [4],
  4: [5],
  5: [],
  6: [],
};

function TasksWorkspace({ session, onLogout }) {
  const now = new Date();
  const iso = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState(iso(now)),
    [month, setMonth] = useState(
      new Date(now.getFullYear(), now.getMonth(), 1),
    ),
    [taskListScope, setTaskListScope] = useState("day"),
    [assigneeFilter, setAssigneeFilter] = useState(""),
    [tasks, setTasks] = useState([]),
    [orders, setOrders] = useState([]),
    [administrators, setAdministrators] = useState([]),
    [loadingAdministrators, setLoadingAdministrators] = useState(false),
    [taskError, setTaskError] = useState(""),
    [savingTask, setSavingTask] = useState(false),
    [formOpen, setFormOpen] = useState(false),
    [reading, setReading] = useState(null),
    [editing, setEditing] = useState(null),
    [orderPreview, setOrderPreview] = useState(null),
    [productPreview, setProductPreview] = useState(null),
    [form, setForm] = useState({
      title: "",
      type: "general",
      date: iso(now),
      assigneeId: "",
      orderIds: [],
      orderProgress: {},
      notes: "",
    });
  useEffect(() => {
    setLoadingAdministrators(true);
    userService
      .listTaskAssignees()
      .then((users) =>
        setAdministrators(
          users.filter(
            (user) =>
              user.active !== false &&
              user.isActive !== false,
          ),
        ),
      )
      .catch(() => setAdministrators([]))
      .finally(() => setLoadingAdministrators(false));
  }, []);
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay(),
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const selectedCalendarDate = new Date(`${selectedDate}T12:00:00`);
  const weekStart = new Date(selectedCalendarDate);
  weekStart.setDate(selectedCalendarDate.getDate() - selectedCalendarDate.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const calendarTitle = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const loadTasks = async () => {
    setTaskError("");
    try {
      const rangeStart = new Date(month.getFullYear(), month.getMonth(), 1);
      rangeStart.setDate(rangeStart.getDate() - 6);
      const rangeEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      rangeEnd.setDate(rangeEnd.getDate() + 6);
      const from = iso(rangeStart);
      const to = iso(rangeEnd);
      const result = await taskService.list(from, to, assigneeFilter);
      setTasks(Array.isArray(result) ? result : result.items || []);
    } catch (error) {
      setTaskError(error.message);
      setTasks([]);
    }
  };
  useEffect(() => { loadTasks(); }, [month, assigneeFilter]);
  useEffect(() => {
    if (!formOpen || ![1, 2].includes(Number(form.type))) {
      setOrders([]);
      return;
    }
    taskService.eligibleOrders()
      .then((result) => setOrders(Array.isArray(result) ? result : result.items || []))
      .catch(() => setOrders([]));
  }, [formOpen, form.type]);
  const taskAssignedId = (task) => task.assignedTo?.id || task.assignedToUserId || "";
  const visibleTasks = tasks.filter((task) => {
    if (assigneeFilter && String(taskAssignedId(task)) !== assigneeFilter) return false;
    if (taskListScope === "month") return task.dueDate?.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`);
    if (taskListScope === "week") {
      const dueDate = new Date(`${task.dueDate}T12:00:00`);
      return dueDate >= weekStart && dueDate <= weekEnd;
    }
    return task.dueDate === selectedDate;
  });
  const agendaTitle = taskListScope === "month"
    ? `Tarefas de ${calendarTitle}`
    : taskListScope === "week"
      ? `Semana de ${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
      : selectedCalendarDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      type: "general",
      date: selectedDate,
      assigneeId: "",
      orderIds: [],
      orderProgress: {},
      notes: "",
    });
    setFormOpen(true);
  };
  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSavingTask(true);
    setTaskError("");
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type === "general" ? "general" : Number(form.type),
        notes: form.notes || null,
        dueDate: form.date,
        orderIds: form.orderIds || [],
        ...(form.assigneeId ? { assignedToUserId: form.assigneeId } : {}),
      };
      const item = editing
        ? await taskService.update(editing.id, payload)
        : await taskService.create(payload);
      setSelectedDate(item.dueDate || form.date);
      setFormOpen(false);
      setEditing(null);
      await loadTasks();
    } catch (error) {
      setTaskError(error.message);
    } finally {
      setSavingTask(false);
    }
  };
  const complete = async (task, showDetail = true) => {
    try {
      await taskService.setCompletion(task.id, !task.isCompleted);
      if (showDetail) {
        const detail = await taskService.get(task.id);
        setReading(detail.task || detail);
      }
      await loadTasks();
    } catch (error) {
      setTaskError(error.message);
    }
  };
  const taskOrderIds = (task) =>
    task.orderIds || task.orders?.map((order) => String(order.id)) || [];
  const taskOrders = (task) => task.orders || [];
  const availableTaskOrders = orders;
  const taskTypeLabel = (type) =>
    ({ 0: "Cadastrar produto", 1: "Imprimir pedidos", 2: "Enviar pedidos", 3: "Geral", general: "Geral" })[
      type === "general" ? "general" : Number(type)
    ] || "Tarefa";
  const assigneeName = (assigneeId) =>
    administrators.find(
      (user) => String(user.id || user.userId) === String(assigneeId),
    )?.name || "Sem responsável";
  const openProductPreview = async (item) => {
    const itemName = item.name || item.productName || "Produto";
    setProductPreview({ name: itemName, loading: true });
    try {
      const products = await catalogService.list({ admin: true });
      const product = products.find(
        (candidate) => String(candidate.id) === String(item.productId),
      );
      setProductPreview(
        product || {
          name: itemName,
          description: "Os detalhes deste produto não estão mais disponíveis no catálogo.",
        },
      );
    } catch {
      setProductPreview({
        name: itemName,
        description: "Não foi possível carregar a prévia deste produto agora.",
      });
    }
  };
  const toggleTaskOrder = async (task, order) => {
    try {
      await taskService.setOrderCompletion(
        task.id,
        order.id,
        !order.isCompleted,
      );
      const detail = await taskService.get(task.id);
      setReading(detail.task || detail);
      await loadTasks();
    } catch (error) {
      setTaskError(error.message);
    }
  };
  const openTask = async (task) => {
    try {
      setTaskError("");
      const result = await taskService.get(task.id);
      setReading(result.task || result);
    } catch (error) {
      setTaskError(error.message);
    }
  };
  return (
    <main className="admin-shell tasks-page">
      <AdminSidebar active="tasks" session={session} onLoggedOut={onLogout} />
      <section className="admin-content">
        <header className="admin-top">
          <div>
            <span className="admin-kicker">PAINEL / ORGANIZAÇÃO</span>
            <h1>Tarefas</h1>
            <p>Organize operações, produtos e pendências da loja.</p>
          </div>
          <button className="admin-primary" onClick={openCreate}>
            Criar tarefa
          </button>
        </header>
        {taskError && <div className="form-error">{taskError}</div>}
        <div className="tasks-layout">
          <section className="tasks-calendar-card">
            <div className="tasks-calendar-head">
              <button
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                ←
              </button>
              <b>{calendarTitle}</b>
              <button
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                →
              </button>
            </div>
            <div className="tasks-weekdays">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="tasks-days">
              {Array.from({ length: first }, (_, i) => (
                <i key={`blank-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)).map((date) => {
                const value = iso(date),
                  count = tasks.filter(
                    (task) => task.dueDate === value && !task.isCompleted,
                  ).length;
                return (
                  <button
                    key={value}
                    className={`${value === selectedDate ? "active" : ""} ${value === iso(now) ? "today" : ""}`}
                    onClick={() => {
                      setSelectedDate(value);
                      setTaskListScope("day");
                    }}
                  >
                    <b>{date.getDate()}</b>
                    {count ? <small aria-label={`${count} tarefas pendentes`}>{count}</small> : null}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="tasks-day-card">
            <span className="admin-kicker">AGENDA / TAREFAS</span>
            <h2>{agendaTitle}</h2>
            <div className="tasks-list-scope" role="group" aria-label="Período da lista de tarefas">
              <button className={taskListScope === "day" ? "active" : ""} onClick={() => setTaskListScope("day")}>Dia</button>
              <button className={taskListScope === "week" ? "active" : ""} onClick={() => setTaskListScope("week")}>Semana</button>
              <button className={taskListScope === "month" ? "active" : ""} onClick={() => setTaskListScope("month")}>Mês</button>
              <select aria-label="Filtrar tarefas por responsável" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
                <option value="">Todos os responsáveis</option>
                {administrators.map((user) => <option key={user.id || user.userId} value={user.id || user.userId}>{user.name || user.fullName || user.email}</option>)}
              </select>
            </div>
            <button className="tasks-day-create" onClick={openCreate}>
              + Nova tarefa neste dia
            </button>
            <div className="tasks-list">
              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <article
                    key={task.id}
                    className={task.isCompleted ? "done" : ""}
                    onClick={() => openTask(task)}
                  >
                    <div className="task-list-main">
                      <div className="task-list-title">
                        <div className="task-list-heading">
                          <div className="task-list-type-row">
                            <span className="task-type">{taskTypeLabel(task.type)}</span>
                            <time className="task-list-date" dateTime={task.dueDate}>
                              {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            </time>
                          </div>
                          <b>{task.title}</b>
                        </div>
                        {task.assignedTo?.name && <span className="task-type task-list-assignee-badge">{task.assignedTo.name}</span>}
                      </div>
                      <small className="task-list-meta">
                        <span>
                          {(task.orderCount || taskOrderIds(task).length)
                            ? `${task.orderCount || taskOrderIds(task).length} pedidos vinculados`
                            : "Sem pedidos vinculados"}
                        </span>
                        <em>{task.isCompleted ? "Concluída" : "Pendente"}</em>
                      </small>
                    </div>
                  </article>
                ))
              ) : (
                <p>Nenhuma tarefa neste período.</p>
              )}
            </div>
          </section>
        </div>
      </section>
      {formOpen && (
        <div className="admin-modal-backdrop">
          <form className="product-modal task-form-modal" onSubmit={save}>
            <div className="modal-head">
              <div>
                <span className="admin-kicker">TAREFA / CONFIGURAÇÃO</span>
                <h2>{editing ? "Editar tarefa" : "Criar tarefa"}</h2>
              </div>
              <button type="button" onClick={() => setFormOpen(false)}>
                ×
              </button>
            </div>
            <div className="task-form-body">
              <label>
                Título
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex.: Imprimir pedidos"
                />
              </label>
              <label>
                Tipo
                <select
                  value={form.type}
                  onChange={(e) => {
                    const type = e.target.value === "general" ? "general" : Number(e.target.value);
                    setForm({ ...form, type, orderIds: [1, 2].includes(type) ? form.orderIds : [] });
                  }}
                >
                  <option value="general">Geral</option>
                  <option value={0}>Cadastrar produto</option>
                  <option value={1}>Imprimir pedidos</option>
                  <option value={2}>Enviar pedidos</option>
                </select>
              </label>
              <label>
                Data
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label>
                Responsável
                <select
                  value={form.assigneeId || ""}
                  onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  disabled={loadingAdministrators}
                >
                  <option value="">{loadingAdministrators ? "Carregando usuários..." : "Atribuir ao criador"}</option>
                  {administrators.map((user) => <option key={user.id || user.userId} value={user.id || user.userId}>{user.name || user.fullName || user.email} · {user.email}</option>)}
                  {!loadingAdministrators && !administrators.length && <option disabled>Nenhum usuário ativo disponível</option>}
                </select>
              </label>
              {[1, 2].includes(Number(form.type)) && <div className="task-order-picker field-wide">
                <b>Vincular pedidos (opcional)</b>
                {availableTaskOrders.map((order) => {
                  const id = String(order.id || order.orderId);
                  return <label key={id}><input type="checkbox" checked={(form.orderIds || []).includes(id)} onChange={() => setForm((current) => ({ ...current, orderIds: current.orderIds.includes(id) ? current.orderIds.filter((value) => value !== id) : [...current.orderIds, id] }))} />{order.orderNumber} · {order.customerEmail || "Cliente"}<button className="admin-primary task-order-preview" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOrderPreview(order); }}>Ver resumo</button></label>;
                })}
                {!availableTaskOrders.length && <small>Nenhum pedido confirmado aguardando envio.</small>}
              </div>}
              <label className="field-wide">
                Observações
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </button>
              <button className="admin-primary" disabled={savingTask}>{savingTask ? "Salvando..." : "Salvar tarefa"}</button>
            </div>
          </form>
        </div>
      )}
      {reading && (
        <div className="admin-modal-backdrop">
          <div className="product-modal task-read-modal">
            <div className="modal-head">
              <div>
                <span className="admin-kicker">TAREFA / DETALHES</span>
                <h2>{reading.title}</h2>
              </div>
              <div>
                <button
                  className="task-edit"
                  onClick={() => {
                    setEditing(reading);
                    setForm({ title: reading.title, type: reading.type === "general" ? "general" : Number(reading.type), date: reading.dueDate, assigneeId: reading.assignedTo?.id || "", orderIds: taskOrderIds(reading), notes: reading.notes || "" });
                    setReading(null);
                    setFormOpen(true);
                  }}
                >
                  ✎
                </button>
                <button onClick={() => setReading(null)}>×</button>
              </div>
            </div>
            <div className="task-read-body">
              <span>{taskTypeLabel(reading.type)}</span>
              <small>Responsável: {reading.assignedTo?.name || assigneeName(reading.assigneeId)}</small>
              <p className="task-notes">{reading.notes || "Sem observações."}</p>
              {taskOrders(reading).length > 0 && <div className="task-linked-orders">{taskOrders(reading).map((order) => <label key={order.id}><input type="checkbox" checked={Boolean(order.isCompleted)} onChange={() => toggleTaskOrder(reading, order)} /> <button type="button" onClick={() => setOrderPreview(order)}>{order.orderNumber}</button><small>{order.isCompleted ? "Concluído" : "Pendente"}</small></label>)}</div>}
              <button
                className="admin-primary"
                onClick={() => complete(reading)}
              >
                {reading.isCompleted ? "Reabrir tarefa" : "Concluir tarefa"}
              </button>
            </div>
          </div>
        </div>
      )}
      {orderPreview && <div className="admin-modal-backdrop"><div className="product-modal task-read-modal order-preview-modal"><div className="modal-head"><div><span className="admin-kicker">PEDIDO / RESUMO</span><h2>{orderPreview.orderNumber}</h2></div><button onClick={() => setOrderPreview(null)}>×</button></div><div className="task-read-body"><span>{adminOrderStatus[Number(orderPreview.status)]}</span><div className="order-admin-summary"><span>Produtos</span><b>{money(Number(orderPreview.subtotalCents || 0) / 100)}</b><span>Entrega</span><b>{money(Number(orderPreview.shippingCents || 0) / 100)}</b><strong>Total</strong><strong>{money(Number(orderPreview.totalCents || 0) / 100)}</strong></div><p>{orderPreview.deliveryAddress || "Endereço não informado"}</p>{orderPreview.items?.map((item) => <div className="task-order-product" key={item.productId || item.name}><b>{item.quantity}× {item.name || item.productName}</b><button className="admin-secondary" type="button" onClick={() => openProductPreview(item)}>Ver produto</button></div>)}</div></div></div>}
      {productPreview && <div className="admin-modal-backdrop"><div className="product-modal task-read-modal task-product-preview"><div className="modal-head"><div><span className="admin-kicker">PRODUTO / PRÉVIA</span><h2>{productPreview.name}</h2></div><button onClick={() => setProductPreview(null)}>×</button></div><div className="task-product-preview-body">{productPreview.loading ? <p>Carregando produto...</p> : <><ProductVisual product={productPreview} small /><div><b>{productPreview.name}</b><p>{productPreview.description || "Sem descrição disponível."}</p></div></>}</div></div></div>}
    </main>
  );
}

function TasksPage({ session, onLogout }) {
  const today = new Date();
  const dateId = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState(dateId(today));
  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("triso-admin-tasks") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(
    () => localStorage.setItem("triso-admin-tasks", JSON.stringify(tasks)),
    [tasks],
  );
  const firstWeekday = new Date(
    month.getFullYear(),
    month.getMonth(),
    1,
  ).getDay();
  const totalDays = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const selectedTasks = tasks.filter((task) => task.date === selectedDate);
  const addTask = (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setTasks((items) => [
      ...items,
      {
        id: `${Date.now()}`,
        title: title.trim(),
        date: selectedDate,
        done: false,
      },
    ]);
    setTitle("");
  };
  const monthLabel = month.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return (
    <main className="admin-shell tasks-page">
      <AdminSidebar active="tasks" session={session} onLoggedOut={onLogout} />
      <section className="admin-content">
        <header className="admin-top">
          <div>
            <span className="admin-kicker">PAINEL / ORGANIZAÇÃO</span>
            <h1>Tarefas</h1>
            <p>
              Planeje cadastro de produtos, expedições e as prioridades da
              operação.
            </p>
          </div>
        </header>
        <div className="tasks-layout">
          <section className="tasks-calendar-card">
            <div className="tasks-calendar-head">
              <button
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              >
                ←
              </button>
              <b>{monthLabel}</b>
              <button
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              >
                →
              </button>
            </div>
            <div className="tasks-weekdays">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="tasks-days">
              {Array.from({ length: firstWeekday }, (_, index) => (
                <i key={`blank-${index}`} />
              ))}
              {Array.from({ length: totalDays }, (_, index) => {
                const date = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  index + 1,
                );
                const id = dateId(date);
                const count = tasks.filter(
                  (task) => task.date === id && !task.done,
                ).length;
                return (
                  <button
                    key={id}
                    className={`${id === selectedDate ? "active" : ""} ${id === dateId(today) ? "today" : ""}`}
                    onClick={() => setSelectedDate(id)}
                  >
                    <b>{index + 1}</b>
                    {count > 0 && <small>{count}</small>}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="tasks-day-card">
            <span className="admin-kicker">TAREFAS DO DIA</span>
            <h2>
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                "pt-BR",
                { weekday: "long", day: "2-digit", month: "long" },
              )}
            </h2>
            <form onSubmit={addTask}>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Cadastrar novo produto"
              />
              <button className="admin-primary">Adicionar</button>
            </form>
            <div className="tasks-list">
              {selectedTasks.length ? (
                selectedTasks.map((task) => (
                  <article key={task.id} className={task.done ? "done" : ""}>
                    <button
                      onClick={() =>
                        setTasks((items) =>
                          items.map((item) =>
                            item.id === task.id
                              ? { ...item, done: !item.done }
                              : item,
                          ),
                        )
                      }
                    >
                      {task.done ? "✓" : ""}
                    </button>
                    <b>{task.title}</b>
                    <button
                      className="tasks-remove"
                      onClick={() =>
                        setTasks((items) =>
                          items.filter((item) => item.id !== task.id),
                        )
                      }
                    >
                      ×
                    </button>
                  </article>
                ))
              ) : (
                <p>
                  Nenhuma tarefa para este dia. Adicione a primeira prioridade.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function AdminOrdersPage({ session, onLogout, initialFilter = "" }) {
  const [orders, setOrders] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState(initialFilter),
    [selected, setSelected] = useState(null),
    [trackingCode, setTrackingCode] = useState(""),
    [saving, setSaving] = useState(false),
    [editingOrder, setEditingOrder] = useState(false),
    [manualStatus, setManualStatus] = useState("");
  const canOverrideOrderStatus = permissionName(session) === "admin";
  const canManageOrderFlow = ["admin", "gestor"].includes(
    permissionName(session),
  );
  const shippingCarrier = (order) => order?.shipping?.carrier || order?.carrier;
  const shippingService = (order) => order?.shipping?.service || order?.service;
  const shippingPrice = (order) =>
    Number(order?.shipping?.priceCents || order?.shippingCents || 0);
  const canManageTracking = (order) =>
    canManageOrderFlow &&
    shippingCarrier(order) === "Correios" &&
    [3, 4].includes(Number(order?.status));
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await orderService.adminList({
        status: filter,
        sort: "shippingDeadline",
      });
      const items = result.items || result.data || result;
      setOrders(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [filter]);
  const open = (order) => {
    setSelected(order);
    setTrackingCode(order.shipping?.trackingCode || order.trackingCode || "");
    setManualStatus(String(order.status));
    setEditingOrder(false);
  };
  const changeStatus = async (status) => {
    if (!selected) return;
    setSaving(true);
    try {
      await orderService.adminSetStatus(selected.id, status);
      const updated = await orderService.adminGet(selected.id);
      setSelected(updated);
      setManualStatus(String(updated.status));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const saveTracking = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await orderService.adminSetTracking(
        selected.id,
        trackingCode,
      );
      setSelected(updated);
      setTrackingCode(
        updated.shipping?.trackingCode || updated.trackingCode || trackingCode,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const deadlineLabel = (order) =>
    order.shippingDeadlineStatus === "overdue"
      ? "Enviar imediatamente"
      : order.shippingDeadlineStatus === "dueToday"
        ? "Enviar hoje"
        : order.shippingDeadlineAt
          ? `Enviar até ${new Date(order.shippingDeadlineAt).toLocaleDateString("pt-BR")}`
          : "Aguardando etapa de envio";
  const nextStepLabel = (order) =>
    [
      "Aguardar confirmação do pagamento",
      "Iniciar produção",
      "Preparar para envio",
      "Informar rastreio e enviar",
      "Acompanhar entrega",
      "Pedido concluído",
      "Sem ações pendentes",
    ][Number(order.status)] || "Ver pedido";
  return (
    <main className="admin-shell">
      <AdminSidebar active="orders" session={session} onLoggedOut={onLogout} />
      <section className="admin-content">
        <header className="admin-top">
          <div>
            <span className="admin-kicker">PAINEL / OPERAÇÃO</span>
            <h1>Pedidos</h1>
            <p>
              Fila de produção e expedição priorizada pelo prazo de postagem.
            </p>
          </div>
        </header>
        <div className="order-admin-filters">
          <button
            className={filter === "" ? "active" : ""}
            onClick={() => setFilter("")}
          >
            Todos
          </button>
          {[
            [0, "Aguardando pagamento"],
            [1, "Pagos"],
            [2, "Produção"],
            [3, "Prontos"],
            [4, "Enviados"],
            [5, "Entregues"],
            [6, "Cancelados"],
          ].map(([status, label]) => (
            <button
              key={status}
              className={String(filter) === String(status) ? "active" : ""}
              onClick={() => setFilter(status)}
            >
              {label}
            </button>
          ))}
        </div>
        {error && (
          <div className="users-error">
            <span>{error}</span>
            <button onClick={load}>Tentar novamente</button>
          </div>
        )}
        <div className="admin-orders-layout has-detail">
          <section className="admin-table-card">
            <div className="table-toolbar">
              <div>
                <h2>Fila de pedidos</h2>
                <span>
                  {orders.length} pedidos · clique para ver os detalhes
                </span>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th className="order-user-email">Usuário</th>
                    <th>Próximo passo</th>
                    <th>Total</th>
                    <th className="order-status-cell">Status</th>
                    {canOverrideOrderStatus && <th>Editar</th>}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id || order.orderId}
                      className={
                        (selected?.id || selected?.orderId) ===
                        (order.id || order.orderId)
                          ? "selected"
                          : ""
                      }
                      onClick={() => open(order)}
                    >
                      <td>
                        <b>{order.orderNumber}</b>
                        <small>
                          {new Date(order.createdAt).toLocaleDateString(
                            "pt-BR",
                          )}
                        </small>
                      </td>
                      <td className="order-user-email">
                        <b>
                          {order.user?.email ||
                            order.customer?.email ||
                            order.customerEmail ||
                            "E-mail não informado"}
                        </b>
                      </td>
                      <td className="order-next-step">
                        <b>{nextStepLabel(order)}</b>
                      </td>
                      <td>
                        <b>{money((order.totalCents || 0) / 100)}</b>
                      </td>
                      <td className="order-status-cell">
                        <span
                          className={`status-pill order-status-${Number(order.status)}`}
                        >
                          {adminOrderStatus[Number(order.status)] || "—"}
                        </span>
                      </td>
                      {canOverrideOrderStatus && (
                        <td className="order-table-edit">
                          <button
                            className="admin-secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              open(order);
                              setEditingOrder(true);
                            }}
                          >
                            Editar pedido
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && (
                <div className="admin-empty">Carregando pedidos...</div>
              )}
              {!loading && !orders.length && (
                <div className="admin-empty">Nenhum pedido nesta fila.</div>
              )}
            </div>
          </section>
          <aside className="order-admin-detail">
            {selected ? (
              <>
                <button
                  className="order-detail-close"
                  onClick={() => {
                    setSelected(null);
                    setEditingOrder(false);
                  }}
                  aria-label="Limpar seleção"
                >
                  ×
                </button>
                <span className="admin-kicker">
                  PEDIDO {selected.orderNumber}
                </span>
                <h2>{adminOrderStatus[Number(selected.status)]}</h2>
                <div className="order-admin-summary">
                  <span>Produtos</span>
                  <b>{money((selected.subtotalCents || 0) / 100)}</b>
                  <span>
                    Entrega
                    {shippingCarrier(selected) && (
                      <small>
                        {shippingCarrier(selected)} ·{" "}
                        {shippingService(selected)}
                      </small>
                    )}
                  </span>
                  <b>{money(shippingPrice(selected) / 100)}</b>
                  <strong>Total</strong>
                  <strong>{money((selected.totalCents || 0) / 100)}</strong>
                </div>
                <div className="order-delivery-details">
                  <div className="order-delivery-head">
                    <span>Entrega</span>
                    <b>
                      {shippingCarrier(selected)
                        ? `${shippingCarrier(selected)} · ${shippingService(selected)}`
                        : "Entrega não informada"}
                    </b>
                  </div>
                  <b className="order-delivery-address">
                    {selected.deliveryAddress ||
                      (selected.address
                        ? `${selected.address.street || ""}, ${selected.address.number || ""} — ${selected.address.city || ""}/${selected.address.state || ""}`
                        : "Endereço não informado")}
                  </b>
                  {selected.deliveryDays && (
                    <small>
                      Previsão de até {selected.deliveryDays} dias úteis
                    </small>
                  )}
                  {trackingCode && <small>Rastreio: {trackingCode}</small>}
                </div>
                {canManageTracking(selected) && (
                  <label>
                    Rastreio dos Correios
                    <input
                      value={trackingCode}
                      onChange={(event) =>
                        setTrackingCode(event.target.value.toUpperCase())
                      }
                      placeholder="AA123456789BR"
                    />
                    <button
                      className="admin-secondary"
                      disabled={saving || !trackingCode}
                      onClick={saveTracking}
                    >
                      Salvar rastreio
                    </button>
                  </label>
                )}
                {canManageOrderFlow && (
                  <div className="order-status-actions">
                    <b>Próximo passo</b>
                    {(nextOrderStatus[Number(selected.status)] || []).map(
                      (status) => (
                        <button
                          key={status}
                          className="admin-primary"
                          disabled={saving}
                          onClick={() => changeStatus(status)}
                        >
                          Alterar para {adminOrderStatus[status]}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="order-detail-empty">
                <span className="admin-kicker">RESUMO DO PEDIDO</span>
                <h2>Selecione um pedido</h2>
                <p>Os dados do pedido aparecerão aqui.</p>
              </div>
            )}
          </aside>
        </div>
        {canOverrideOrderStatus && editingOrder && selected && (
          <div
            className="admin-modal-backdrop"
            onMouseDown={(event) =>
              event.target === event.currentTarget && setEditingOrder(false)
            }
          >
            <div
              className="product-modal order-edit-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Editar pedido"
            >
              <div className="modal-head">
                <div>
                  <span className="admin-kicker">PEDIDO / EDIÇÃO</span>
                  <h2>{selected.orderNumber}</h2>
                </div>
                <button
                  onClick={() => setEditingOrder(false)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
              <div className="order-edit-body">
                <div>
                  <span>Status atual</span>
                  <b>{adminOrderStatus[Number(selected.status)]}</b>
                </div>
                <div className="order-edit-data">
                  <section>
                    <span>Cliente</span>
                    <b>
                      {selected.user?.email ||
                        selected.customer?.email ||
                        selected.customerEmail ||
                        "E-mail não informado"}
                    </b>
                  </section>
                  <section>
                    <span>Itens</span>
                    {selected.items?.length ? (
                      <ul>
                        {selected.items.map((item, index) => (
                          <li key={item.id || item.productId || index}>
                            <b>{item.productName || item.name || "Produto"}</b>
                            <small>
                              {item.quantity || 1} un. ·{" "}
                              {money(
                                Number(
                                  item.totalCents || item.unitPriceCents || 0,
                                ) / 100,
                              )}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <small>Itens não disponíveis nesta listagem.</small>
                    )}
                  </section>
                  <section>
                    <span>Entrega</span>
                    <b>
                      {shippingCarrier(selected)
                        ? `${shippingCarrier(selected)} · ${shippingService(selected)}`
                        : "Não informada"}
                    </b>
                    <small>
                      {money(shippingPrice(selected) / 100)}
                      {selected.deliveryDays
                        ? ` · até ${selected.deliveryDays} dias úteis`
                        : ""}
                    </small>
                  </section>
                  <section>
                    <span>Endereço</span>
                    {selected.deliveryAddress || selected.address ? (
                      <b>
                        {selected.deliveryAddress ||
                          `${selected.address.street || ""}, ${selected.address.number || ""} — ${selected.address.city || ""}/${selected.address.state || ""}`}
                      </b>
                    ) : (
                      <small>Endereço não disponível nesta listagem.</small>
                    )}
                  </section>
                  <section className="order-edit-total">
                    <span>Total do pedido</span>
                    <b>{money(Number(selected.totalCents || 0) / 100)}</b>
                  </section>
                </div>
                {canManageTracking(selected) && (
                  <label>
                    Código de rastreio dos Correios
                    <input
                      value={trackingCode}
                      onChange={(event) =>
                        setTrackingCode(event.target.value.toUpperCase())
                      }
                      placeholder="AA123456789BR"
                    />
                    <button
                      className="admin-secondary"
                      disabled={saving || !trackingCode}
                      onClick={saveTracking}
                    >
                      Salvar rastreio
                    </button>
                  </label>
                )}
                <label className="order-status-override">
                  Alterar status do pedido
                  <select
                    value={manualStatus}
                    onChange={(event) => setManualStatus(event.target.value)}
                  >
                    {adminOrderStatus.map((label, status) => (
                      <option key={status} value={status}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="admin-primary"
                    disabled={
                      saving || Number(manualStatus) === Number(selected.status)
                    }
                    onClick={() => changeStatus(Number(manualStatus))}
                  >
                    Atualizar status
                  </button>
                </label>
              </div>
              <div className="modal-actions">
                <button
                  className="admin-secondary"
                  onClick={() => setEditingOrder(false)}
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function AdminDashboard({
  products,
  saveProduct,
  toggleProduct,
  removeProduct,
  clicks,
  session,
  onLogout,
  productError,
  onRetryProducts,
}) {
  const access = permissionAccess(session);
  const canManageProducts = access.manageProducts;
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState(null),
    [formOpen, setFormOpen] = useState(false),
    [originOpen, setOriginOpen] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(null),
    [announcementProduct, setAnnouncementProduct] = useState(null);
  const visible = products.filter((p) =>
    `${p.name} ${p.description}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const save = async (data) => {
    await saveProduct(data);
    setFormOpen(false);
    setEditing(null);
  };
  const toggle = async (id) => {
    try {
      await toggleProduct(id);
    } catch (error) {
      window.alert(error.message);
    }
  };
  const remove = async (id) => {
    try {
      await removeProduct(id);
      setConfirmDelete(null);
    } catch (error) {
      window.alert(error.message);
    }
  };
  if (productError)
    return (
      <main className="admin-shell">
        <AdminSidebar
          active="products"
          session={session}
          onLoggedOut={onLogout}
        />
        <section className="admin-content">
          <header className="admin-top">
            <div>
              <span className="admin-kicker">PAINEL / CATÁLOGO</span>
              <h1>Produtos</h1>
              <p>
                {canManageProducts
                  ? "Gerencie tudo o que aparece na vitrine da Triso."
                  : "Consulte os produtos publicados na vitrine."}
              </p>
            </div>
            {access.manageCatalogOptions && (
              <button
                className="admin-secondary"
                type="button"
                onClick={() => setOriginOpen(true)}
              >
                Editar origem
              </button>
            )}
          </header>
          <div className="admin-table-card">
            <div className="admin-empty">
              <p>Não foi possível carregar os produtos. {productError}</p>
              <button
                className="admin-primary"
                type="button"
                onClick={onRetryProducts}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </section>
        {originOpen && (
          <ShippingOriginSettings onClose={() => setOriginOpen(false)} />
        )}
      </main>
    );
  return (
    <main className="admin-shell">
      <AdminSidebar
        active="products"
        session={session}
        onLoggedOut={onLogout}
      />
      <section className="admin-content">
        <header className="admin-top">
          <div>
            <span className="admin-kicker">PAINEL / CATÁLOGO</span>
            <h1>Produtos</h1>
            <p>
              {canManageProducts
                ? "Gerencie tudo o que aparece na vitrine da Triso."
                : "Consulte os produtos publicados na vitrine."}
            </p>
          </div>
          <div className="admin-top-actions">
            {access.manageCatalogOptions && (
              <button
                className="admin-secondary"
                type="button"
                onClick={() => setOriginOpen(true)}
              >
                Editar origem
              </button>
            )}
            {canManageProducts && (
              <button
                className="admin-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <PlusIcon /> Novo produto
              </button>
            )}
          </div>
        </header>
        <div className="admin-stats">
          <div>
            <span>Total de produtos</span>
            <b>{products.length}</b>
            <small>itens cadastrados</small>
          </div>
          <div>
            <span>Produtos ativos</span>
            <b>{products.filter((p) => p.active).length}</b>
            <small>visíveis na loja</small>
          </div>
        </div>
        <div className="admin-table-card">
          <div className="table-toolbar">
            <div>
              <h2>Catálogo</h2>
              <span>{visible.length} produtos</span>
            </div>
            <label>
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produto..."
              />
            </label>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Status</th>
                  <th>{canManageProducts ? "Ações" : "Anúncio"}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="table-product">
                        <ProductVisual product={product} small />
                        <span>
                          <b>{product.name}</b>
                          <small>#{String(product.id).slice(-5)}</small>
                        </span>
                      </div>
                    </td>
                    <td>{categories[product.category]}</td>
                    <td>
                      <b>{money(product.price)}</b>
                    </td>
                    <td>
                      {canManageProducts ? (
                        <button
                          className={`status-pill ${product.active ? "active" : ""}`}
                          onClick={() => toggle(product.id)}
                        >
                          <i />
                          {product.active ? "Ativo" : "Inativo"}
                        </button>
                      ) : (
                        <span
                          className={`status-pill ${product.active ? "active" : ""}`}
                        >
                          <i />
                          {product.active ? "Ativo" : "Inativo"}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <AnnouncementButton
                          product={product}
                          onChoose={setAnnouncementProduct}
                        />
                        {canManageProducts && (
                          <>
                            <button
                              title="Editar"
                              onClick={() => {
                                setEditing(product);
                                setFormOpen(true);
                              }}
                            >
                              <EditIcon />
                            </button>
                            <button
                              className="danger"
                              title="Excluir"
                              onClick={() => setConfirmDelete(product)}
                            >
                              <TrashIcon />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && (
              <div className="admin-empty">Nenhum produto encontrado.</div>
            )}
          </div>
        </div>
      </section>
      {canManageProducts && formOpen && (
        <ProductForm
          product={editing}
          onSave={save}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          canManageCatalogOptions={access.manageCatalogOptions}
        />
      )}
      {originOpen && (
        <ShippingOriginSettings onClose={() => setOriginOpen(false)} />
      )}
      {announcementProduct && (
        <AnnouncementChooserModal
          product={announcementProduct}
          onClose={() => setAnnouncementProduct(null)}
        />
      )}
      {canManageProducts && confirmDelete && (
        <div className="admin-modal-backdrop">
          <div className="confirm-modal">
            <div className="confirm-icon">
              <TrashIcon />
            </div>
            <h2>Excluir produto?</h2>
            <p>
              “{confirmDelete.name}” será removido do catálogo. Esta ação não
              pode ser desfeita.
            </p>
            <div>
              <button
                className="admin-secondary"
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </button>
              <button
                className="admin-danger"
                onClick={() => remove(confirmDelete.id)}
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function App() {
  const auth = useAuth();
  const location = useSpaLocation();
  const routeParams = new URLSearchParams(location.search);
  const adminPathMatch = location.pathname.match(
    /^\/admin(?:\/(produtos|usuarios|pedidos|tarefas))?\/?$/,
  );
  const isAdminRoute = routeParams.has("admin") || Boolean(adminPathMatch);
  const customerRoute = isAdminRoute ? "" : location.pathname;
  let customerPage = null;
  if (customerRoute === "/dralfredo") customerPage = <CampaignSealPage campaign={CAMPAIGNS.dralfredo} />;
  if (customerRoute === "/marlonreis") customerPage = <CampaignSealPage campaign={CAMPAIGNS.marlonreis} />;
  if (customerRoute === "/nathanbarbearia") customerPage = <CampaignSealPage campaign={CAMPAIGNS.nathanbarbearia} />;
  if (customerRoute === "/portalnoticiasbahia") customerPage = <CampaignSealPage campaign={CAMPAIGNS.portalnoticiasbahia} />;
  if (customerRoute === "/inac") customerPage = <CampaignSealPage campaign={CAMPAIGNS.inac} />;
  if (customerRoute === "/15-anos-isabella") customerPage = <PartySealPage event={EVENTS.isabella15} />;
  if (customerRoute === "/apresentacao") customerPage = <SalesTemplatePage />;
  if (customerRoute === "/modelo-selo") customerPage = <CampaignSealPage campaign={CAMPAIGNS.triso} />;
  if (customerRoute === "/carrinho") customerPage = <CartPage />;
  if (customerRoute === "/entrar") customerPage = <UniversalAuthPage />;
  if (customerRoute === "/cadastro")
    customerPage = <UniversalAuthPage register />;
  if (customerRoute === "/checkout") customerPage = <CheckoutPage />;
  if (customerRoute === "/payment/success")
    customerPage = <PaymentReturnPage />;
  const confirmationMatch = customerRoute.match(
    /^\/pedido\/([^/]+)\/confirmacao$/,
  );
  if (confirmationMatch)
    customerPage = <ConfirmationPage orderId={confirmationMatch[1]} />;
  const orderMatch = customerRoute.match(/^\/minha-conta\/pedidos\/([^/]+)$/);
  if (orderMatch)
    customerPage = (
      <AccountPage key={`order-${orderMatch[1]}`} detailId={orderMatch[1]} />
    );
  if (
    customerRoute === "/minha-conta" ||
    customerRoute === "/minha-conta/pedidos"
  )
    customerPage = <AccountPage key="orders" />;
  const session = isAdminRoute ? auth.user : null;
  const {
    products,
    loading,
    error,
    reload,
    saveProduct,
    toggleProduct,
    removeProduct,
  } = useProducts(!isAdminRoute ? "public" : session ? "admin" : null);
  const [clicks, recordClick] = useClicks();
  if (isAdminRoute && auth.isLoadingSession)
    return (
      <div className="app-loading">
        <span />
        <p>Carregando Triso...</p>
      </div>
    );
  if (!isAdminRoute)
    return (
      customerPage || (
        <PublicStore
          products={products}
          recordClick={recordClick}
          productError={error}
          productsLoading={loading}
          onRetryProducts={reload}
        />
      )
    );
  if (!session) return <UniversalAuthPage />;
  if (!auth.hasAdminAccess) return <AccountPage />;
  const adminView =
    adminPathMatch?.[1] === "produtos"
      ? "products"
      : adminPathMatch?.[1] === "usuarios"
        ? "users"
        : adminPathMatch?.[1] === "pedidos"
          ? "orders"
          : adminPathMatch?.[1] === "tarefas"
            ? "tasks"
            : routeParams.get("view");
  const access = permissionAccess(session);
  if (adminView === "users" && access.viewUsers)
    return <UsersPage session={session} onLogout={auth.logout} />;
  if (adminView === "orders")
    return (
      <AdminOrdersPage
        key={`orders-${routeParams.get("filter") || ""}`}
        session={session}
        onLogout={auth.logout}
        initialFilter={routeParams.get("filter") || ""}
      />
    );
  if (adminView === "tasks")
    return <TasksWorkspace session={session} onLogout={auth.logout} />;
  if (adminView === "products")
    return (
      <AdminDashboard
        products={products}
        saveProduct={saveProduct}
        toggleProduct={toggleProduct}
        removeProduct={removeProduct}
        clicks={clicks}
        session={session}
        onLogout={auth.logout}
        productError={error}
        onRetryProducts={reload}
      />
    );
  return (
    <AnalyticsPage clicks={clicks} session={session} onLogout={auth.logout} />
  );
}
