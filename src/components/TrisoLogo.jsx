export function TrisoLogo({ className = "", dark = false, large = false, light = false, colored = false }) {
  return (
    <a
      className={`brand ${className} ${dark ? "brand-dark" : ""} ${large ? "brand-large" : ""}`.trim()}
      href="/"
      aria-label="Triso Studio, página inicial"
    >
      <img src={colored ? "/Triso/logo-triso.png" : "/Triso/logo-Branca.png"} alt="Triso Studio" />
    </a>
  );
}
