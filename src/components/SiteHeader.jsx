import { useEffect, useState } from "react";
import { useCart } from "../features/cart/CartContext.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { TrisoLogo } from "./TrisoLogo.jsx";

export function SiteHeader({ commerce = false }) {
  const { totalQuantity } = useCart();
  const { user, isLoadingSession, isCustomer, hasAdminAccess } = useAuth();
  const [menu, setMenu] = useState(false);
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    if (commerce) return undefined;
    const scroll = () => setSticky(window.scrollY > 70);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, [commerce]);

  const accountLink = !user ? "/entrar" : isCustomer ? "/minha-conta" : hasAdminAccess ? "/admin" : "/entrar";
  const accountLabel = !user ? "Entrar" : isCustomer ? "Minha conta" : hasAdminAccess ? "Área administrativa" : "Entrar";
  const sections = [["Produtos", "#loja"], ["Coleções", "#colecoes"], ["Sobre", "#sobre"]];
  const sectionHref = (hash) => commerce ? `/${hash}` : hash;
  const accountNavigation = isLoadingSession ? <span className="header-account-skeleton" aria-label="Carregando sessão" /> : <a className="admin-entry" href={accountLink}>{accountLabel}</a>;

  return <header className={`header ${commerce ? "commerce-header" : ""} ${sticky ? "sticky" : ""}`}><div className="container header-inner"><TrisoLogo light /><nav className="desktop-nav">{sections.map(([label, hash]) => <a key={hash} href={sectionHref(hash)}>{label}</a>)}</nav><div className="header-actions"><a className="cart-button" href="/carrinho">Carrinho <b>{totalQuantity}</b></a>{accountNavigation}<button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Abrir menu" aria-expanded={menu}><i /><i /></button></div></div><div className={`mobile-menu ${menu ? "open" : ""}`} aria-hidden={!menu}>{sections.map(([label, hash]) => <a key={hash} href={sectionHref(hash)} onClick={() => setMenu(false)}>{label}</a>)}<a href="/carrinho">Carrinho ({totalQuantity})</a>{isLoadingSession ? <span className="header-account-skeleton" aria-label="Carregando sessão" /> : <a href={accountLink}>{accountLabel}</a>}</div></header>;
}
