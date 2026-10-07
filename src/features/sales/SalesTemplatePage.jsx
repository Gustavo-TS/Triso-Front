import { TrisoLogo } from "../../components/TrisoLogo.jsx";

const steps = [
  { number: "01", title: "Sua marca ganha um selo", text: "Criamos uma arte personalizada com seu logo, suas cores e a mensagem que você quer espalhar." },
  { number: "02", title: "Você compartilha o link", text: "A Triso entrega uma página própria para sua campanha. É só enviar para clientes, apoiadores ou sua comunidade." },
  { number: "03", title: "Cada pessoa cria o próprio selo", text: "O visitante escolhe uma foto, ajusta na moldura e baixa ou compartilha o selo pronto em poucos segundos." },
];

export function SalesTemplatePage() {
  return (
    <main className="sales-page">
      <header className="sales-header">
        <TrisoLogo light />
        <span>APRESENTAÇÃO COMERCIAL</span>
      </header>

      <section className="sales-hero">
        <div className="sales-hero-copy">
          <span className="sales-eyebrow">APRESENTAÇÃO DO SITE DE SELOS</span>
          <h1>Transforme sua marca em um selo <em>que todo mundo pode usar.</em></h1>
          <p>Um site personalizado para sua campanha, empresa ou comunidade. Seu público envia uma foto, cria o próprio selo e compartilha a sua mensagem.</p>
          <a className="sales-button" href="#como-funciona">Ver como funciona <span>↓</span></a>
        </div>
        <div className="sales-hero-card" aria-label="Prévia de uma experiência personalizada">
          <div className="sales-card-top"><span className="sales-dot" /> SELO DA SUA MARCA <b>AO VIVO</b></div>
          <div className="sales-card-art"><i /><i /><strong>EU<br />FAÇO<br /><em>PARTE</em></strong></div>
          <div className="sales-card-bottom"><small>ENVIE SUA FOTO · CRIE · COMPARTILHE</small><span>→</span></div>
        </div>
      </section>

      <section className="sales-section" id="como-funciona">
        <div className="sales-section-heading"><span className="sales-eyebrow">PASSO A PASSO</span><h2>Da sua identidade até o selo compartilhado pelo seu público.</h2></div>
        <div className="sales-steps">{steps.map((step) => <article key={step.number} className="sales-step"><b>{step.number}</b><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      </section>

      <section className="sales-proof"><div><span className="sales-eyebrow">POR QUE CRIAR UM SITE DE SELOS?</span><h2>Uma ação simples para fazer sua marca aparecer nas fotos e nas redes.</h2></div><div className="sales-proof-list"><span>↗ Selo com sua identidade visual</span><span>↗ Página exclusiva para sua campanha</span><span>↗ Upload e ajuste de foto pelo celular</span><span>↗ Download e compartilhamento do selo</span></div></section>

      <section className="sales-cta"><span className="sales-eyebrow">AGORA IMAGINE O SEU</span><h2>Como seria o selo da sua marca?</h2><p>A Triso cria a arte, monta o site e deixa tudo pronto para o seu público participar, baixar e compartilhar.</p><a className="sales-button sales-button-light" href="mailto:oi@triso.com.br">Quero meu site de selos <span>↗</span></a></section>
      <footer className="sales-footer"><span>Feito pela <b>TRISO STUDIO</b></span><a href="/">Conheça nosso site <span>→</span></a></footer>
    </main>
  );
}
