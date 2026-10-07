export function TrisoLogo({ className = "", dark = false, large = false, light = false }) {
  return (
    <a
      className={`brand ${className} ${dark ? "brand-dark" : ""} ${large ? "brand-large" : ""}`.trim()}
      href="/"
      aria-label="Triso Studio, página inicial"
    >
      <img src="/Triso/logo-Branca.png" alt="Triso Studio" />
    </a>
  );
}
