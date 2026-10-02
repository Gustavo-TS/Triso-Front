export function TrisoLogo({ className = "", dark = false, large = false, light = false }) {
  return (
    <a
      className={`brand ${className} ${dark ? "brand-dark" : ""} ${large ? "brand-large" : ""}`.trim()}
      href="/"
      aria-label="Triso Studio, página inicial"
    >
      <img src={light ? "/Triso/logo-Branca.png" : "/Triso/logo-triso.png"} alt="Triso Studio" />
    </a>
  );
}
