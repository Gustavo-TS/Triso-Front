import { useEffect, useMemo, useRef, useState } from "react";
import { campaignService } from "../../services/campaignService.js";
import { TrisoLogo } from "../../components/TrisoLogo.jsx";
import { CAMPAIGNS } from "./campaigns.js";
import { SEAL_FORMATS, photoBounds, drawResponsiveTemplate } from "./sealFormats.js";

const readCounter = (campaignId) => Number(window.localStorage.getItem(`${campaignId}-download-count`) || 0);

const loadImage = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

function drawCampaignFrame(context, width, height, campaign) {
  if (campaign.brandPage) {
    context.save();
    context.fillStyle = campaign.theme.deep;
    context.fillRect(0, 0, width, height);
    context.fillStyle = campaign.theme.primary;
    context.fillRect(0, height * 0.68, width, height * 0.32);
    context.fillStyle = campaign.theme.accent;
    context.fillRect(width * 0.07, height * 0.07, width * 0.86, height * 0.025);
    const brandName = campaign.name.toUpperCase();
    const brandFontSize = Math.min(width * 0.12, (width * 0.78) / Math.max(brandName.length, 1));
    context.fillStyle = "#fff";
    context.font = `900 ${Math.round(brandFontSize)}px Arial`;
    context.fillText(brandName, width * 0.08, height * 0.32);
    context.fillStyle = campaign.theme.accent;
    context.font = `800 ${Math.round(width * 0.048)}px Arial`;
    context.fillText("SELO DA COMUNIDADE", width * 0.08, height * 0.43);
    context.fillStyle = "#fff";
    context.font = `800 ${Math.round(width * 0.055)}px Arial`;
    context.fillText("FAÇO PARTE", width * 0.08, height * 0.78);
    context.font = `900 ${Math.round(width * 0.065)}px Arial`;
    context.fillText("DA COMUNIDADE", width * 0.08, height * 0.87);
    context.restore();
    return;
  }
  context.save();
  context.strokeStyle = "#ffda20";
  context.lineWidth = Math.max(20, width * 0.025);
  context.strokeRect(0, 0, width, height);
  context.fillStyle = "rgba(9, 81, 207, .94)";
  context.fillRect(0, height * 0.73, width, height * 0.27);
  context.fillStyle = "rgba(255, 218, 32, .96)";
  context.fillRect(width * 0.055, height * 0.055, width * 0.4, height * 0.09);
  context.fillStyle = "#06316f";
  context.font = `900 ${Math.round(width * 0.045)}px Arial`;
  context.fillText("EU APOIO", width * 0.08, height * 0.115);
  context.fillStyle = "#fff";
  context.font = `900 ${Math.round(width * 0.087)}px Arial`;
  context.fillText(campaign.name.toUpperCase(), width * 0.055, height * 0.83);
  context.font = `800 ${Math.round(width * 0.038)}px Arial`;
  context.fillText("DEPUTADO FEDERAL", width * 0.06, height * 0.89);
  context.fillStyle = "#ffda20";
  context.font = `900 ${Math.round(width * 0.15)}px Arial`;
  context.fillText(campaign.number, width * 0.055, height * 0.985);
  context.restore();
}

function composeSelo(person, template, zoom, position, campaign, format) {
  const canvas = document.createElement("canvas");
  canvas.width = format.width;
  canvas.height = format.height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (person) context.drawImage(person, ...photoBounds(person, canvas.width, canvas.height, zoom, position));
  if (template) drawResponsiveTemplate(context, template, canvas.width, canvas.height);
  else drawCampaignFrame(context, canvas.width, canvas.height, campaign);
  return canvas;
}

export function CampaignSealPage({ campaign = CAMPAIGNS.dralfredo }) {
  const [format, setFormat] = useState(SEAL_FORMATS[0]);
  const [finalFormat, setFinalFormat] = useState(SEAL_FORMATS[0]);
  const isBrandPage = campaign.brandPage;
  const [photo, setPhoto] = useState("");
  const [downloads, setDownloads] = useState(0);
  const [creating, setCreating] = useState(false);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [error, setError] = useState("");
  const [counterError, setCounterError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [previewUrl, setPreviewUrl] = useState("");
  const [finalSeloUrl, setFinalSeloUrl] = useState("");
  const [finalSeloBlob, setFinalSeloBlob] = useState(null);
  const [sharing, setSharing] = useState(false);
  const previewInputRef = useRef(null);
  const campaignStyle = {
    "--campaign-primary": campaign.theme.primary,
    "--campaign-deep": campaign.theme.deep,
    "--campaign-accent": campaign.theme.accent,
    "--campaign-action": campaign.theme.action,
    "--campaign-action-hover": campaign.theme.actionHover,
  };

  useEffect(() => {
    let active = true;
    if (!campaign.trackingEnabled) {
      setDownloads(readCounter(campaign.id));
      return undefined;
    }
    campaignService
      .getDownloads(campaign.id)
      .then((data) => {
        if (!active) return;
        setDownloads(Number(data?.downloadsCount || 0));
        setCounterError("");
      })
      .catch((err) => {
        if (!active) return;
        setDownloads(readCounter(campaign.id));
        setCounterError(`Não foi possível consultar os apoios agora (HTTP ${err?.status || "rede"}).`);
      });
    return () => { active = false; };
  }, [campaign]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([photo ? loadImage(photo) : null, loadImage(campaign.templateUrl).catch(() => null)])
      .then(([person, template]) => {
        if (!cancelled) setPreviewUrl(composeSelo(person, template, zoom, position, campaign, format).toDataURL("image/png"));
      })
      .catch(() => !cancelled && setPreviewUrl(photo));
    return () => { cancelled = true; };
  }, [photo, zoom, position, campaign, format]);

  const supportText = useMemo(
    () => campaign.id === "triso"
      ? `${downloads} ${downloads === 1 ? "selo criado" : "selos criados"}`
      : `${downloads} ${downloads === 1 ? "apoio registrado" : "apoios registrados"}`,
    [downloads, campaign.id],
  );

  const selectPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Escolha uma imagem em JPG, PNG ou WEBP.");
      return;
    }
    setError("");
    setFormat(SEAL_FORMATS[0]);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };

  const registerDownload = async () => {
    if (!campaign.trackingEnabled) {
      const nextDownloads = readCounter(campaign.id) + 1;
      window.localStorage.setItem(`${campaign.id}-download-count`, String(nextDownloads));
      setDownloads(nextDownloads);
      return;
    }
    try {
      const result = await campaignService.recordDownload(campaign.id);
      setDownloads(Number(result?.downloadsCount || downloads));
    } catch {
      const nextDownloads = readCounter(campaign.id) + 1;
      window.localStorage.setItem(`${campaign.id}-download-count`, String(nextDownloads));
      setDownloads(nextDownloads);
    }
  };

  const generateSelo = async (selectedFormat, registerSupport = false) => {
    if (!photo || creating) return;
    const minimumLoading = new Promise((resolve) => window.setTimeout(resolve, 3000));
    setCreating(true);
    setError("");
    if (registerSupport) void registerDownload();
    try {
      const [person, template] = await Promise.all([
        loadImage(photo),
        loadImage(campaign.templateUrl).catch(() => null),
      ]);
      const canvas = composeSelo(person, template, zoom, position, campaign, selectedFormat);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Não foi possível gerar o selo.");
      setFinalSeloUrl(canvas.toDataURL("image/png"));
      setFinalSeloBlob(blob);
      setFinalFormat(selectedFormat);
      setFormat(selectedFormat);
      setThanksOpen(true);
    } catch {
      setError("Não foi possível montar sua imagem agora. Tente novamente.");
    } finally {
      await minimumLoading;
      setCreating(false);
    }
  };

  const createAndDownload = () => generateSelo(format, true);

  const saveSelo = () => {
    if (!finalSeloBlob) return;
    const url = URL.createObjectURL(finalSeloBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eu-apoio-${campaign.id}-${campaign.number}-${finalFormat.id}-${finalFormat.width}x${finalFormat.height}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const shareSelo = async () => {
    if (!finalSeloBlob || sharing) return;
    setSharing(true);
    try {
      const file = new File([finalSeloBlob], `eu-apoio-${campaign.id}-${campaign.number}-${finalFormat.id}-${finalFormat.width}x${finalFormat.height}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else saveSelo();
    } catch (err) {
      if (err?.name !== "AbortError") saveSelo();
    } finally { setSharing(false); }
  };

  return (
    <main className={`dralfredo-page campaign-${campaign.id}`} style={campaignStyle}>
      <header className="dralfredo-header">
        <TrisoLogo className="dralfredo-brand" light />
        <span>{isBrandPage ? "SELO DA COMUNIDADE" : "Uma iniciativa de apoio"}</span>
      </header>

      <section className="dralfredo-hero">
        <div className="dralfredo-intro">
          <span className="dralfredo-kicker">{campaign.copy.kicker}</span>
          <h1>{isBrandPage ? <>Faça parte do <em>{campaign.name}.</em></> : <>Mostre que você apoia <em>{campaign.name}.</em></>}</h1>
          {!isBrandPage && <div className="dralfredo-candidate-number">
            <span>DEPUTADO<br />FEDERAL</span>
            <b>{campaign.number}</b>
          </div>}
          <p>{campaign.copy.description}</p>
          {campaign.id === "triso" && <ol className="dralfredo-howto">
            <li><b>1</b><span><strong>Escolha uma foto</strong><small>Toque na prévia ao lado e envie uma imagem.</small></span></li>
            <li><b>2</b><span><strong>Ajuste o tamanho e a posição</strong><small>Aumente ou reduza a foto no controle Zoom. Depois mova para os lados ou para cima e baixo até encaixar no selo.</small></span></li>
            <li><b>3</b><span><strong>Crie e compartilhe</strong><small>Toque no botão para gerar, baixar ou compartilhar.</small></span></li>
          </ol>}
          <div className="dralfredo-counter" aria-live="polite">
            <span className="dralfredo-counter-label">{isBrandPage ? "SELOS DA COMUNIDADE" : "SELOS CRIADOS POR APOIADORES"}</span>
            <b>{String(downloads).padStart(4, "0")}</b>
            <span className="dralfredo-counter-copy">{supportText}</span>
          </div>
          {counterError && <small className="dralfredo-counter-error">{counterError}</small>}
          <a className="dralfredo-instagram" href={`https://www.instagram.com/${campaign.instagram}`} target="_blank" rel="noreferrer">@{campaign.instagram}</a>
        </div>

        <div className="dralfredo-maker">
          {photo && <fieldset className="campaign-formats">
            <legend>{campaign.id === "triso" ? "Um selo para cada canal" : "Onde você quer aparecer?"}</legend>
            <p className="campaign-format-intro">{campaign.id === "triso" ? "O site pode entregar o selo no tamanho certo para cada rede. Assim, a pessoa cria uma imagem pronta para publicar onde sua marca está presente." : "Escolha o espaço onde a sua foto vai ser publicada."}</p>
            <div className="campaign-format-options">
              {SEAL_FORMATS.map((option) => <label key={option.id} data-format={option.id}>
                <input type="radio" name="seal-format" checked={format.id === option.id} onChange={() => { setFormat(option); setZoom(1); setPosition({ x: 0, y: 0 }); }} />
                <span><i aria-hidden="true" /><b>{option.label}</b><small>{option.hint.split(" · ")[0]}</small></span>
              </label>)}
            </div>
            {campaign.id === "triso" && <p className="campaign-format-selected"><b>Como funciona:</b> a pessoa escolhe o formato, envia a foto e recebe uma arte pronta para o perfil, feed, Stories ou status.</p>}
          </fieldset>}
          <input ref={previewInputRef} className="dralfredo-preview-input" type="file" accept="image/*" onChange={selectPhoto} />
          <div
            className={`dralfredo-preview ${photo ? "has-photo" : ""}`}
            style={{ aspectRatio: `${format.width} / ${format.height}` }}
            role="button"
            tabIndex={0}
            onClick={() => previewInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); previewInputRef.current?.click(); }
            }}
            aria-label={photo ? "Trocar foto" : "Enviar sua foto"}
          >
            {previewUrl && <img src={previewUrl} alt={photo ? `Prévia no formato ${format.label}` : "Moldura do formato selecionado"} />}
            {!photo && <span>Sua foto<br />aparece aqui</span>}
            {!photo && <span className="dralfredo-preview-action">Toque para enviar sua foto</span>}
          </div>
          <p className="dralfredo-upload-hint">{photo ? "A prévia acima mostra como sua foto ficará no formato selecionado." : "Toque na imagem e escolha uma foto para criar seu selo."}</p>
          {photo && <div className="dralfredo-photo-adjustments">
            <div className="dralfredo-adjustments-head"><b>Ajuste sua foto no selo</b><button type="button" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}>Voltar ao centro</button></div>
            <p className="dralfredo-adjustments-help">Use o Zoom para deixar a foto maior ou menor. Os controles de posição ajudam a escolher exatamente qual parte da imagem aparece.</p>
            <label>Zoom <input type="range" min="0.25" max="2.5" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
            <div className="dralfredo-position-controls">
              <label>Horizontal <input type="range" min="-100" max="100" value={position.x} onChange={(event) => setPosition((current) => ({ ...current, x: Number(event.target.value) }))} /></label>
              <label>Vertical <input type="range" min="-100" max="100" value={position.y} onChange={(event) => setPosition((current) => ({ ...current, y: Number(event.target.value) }))} /></label>
            </div>
          </div>}
          {error && <p className="dralfredo-error">{error}</p>}
          <button className="dralfredo-download" type="button" disabled={!photo || creating} onClick={createAndDownload}>
            {creating ? "Montando seu selo..." : isBrandPage ? `Criar meu selo ${campaign.name}` : "Criar meu selo de apoio"}
          </button>
        </div>
      </section>

      <footer className="dralfredo-footer">
        <span>Feito pela <b>TRISO STUDIO</b></span>
        <a href="/">Conheça nosso site <span>→</span></a>
      </footer>

      {creating && <div className="dralfredo-building" role="status"><span /><b>Montando seu selo...</b><small>Estamos preparando sua imagem.</small></div>}

      {thanksOpen && (
        <div className="dralfredo-thanks-backdrop" role="presentation">
          <section className="dralfredo-thanks" role="dialog" aria-modal="true" aria-labelledby="dralfredo-thanks-title">
            <button type="button" onClick={() => setThanksOpen(false)} aria-label="Fechar">×</button>
            <span>{isBrandPage ? `SELO CRIADO · ${campaign.name.toUpperCase()}` : `APOIO REGISTRADO · ${campaign.number}`}</span>
            <h2 id="dralfredo-thanks-title">{campaign.copy.thanks}</h2>
            <p>Seu selo está pronto. Baixe ou compartilhe quando quiser.</p>
            {!isBrandPage && <div className="dralfredo-thanks-number"><span>DEPUTADO<br />FEDERAL</span><b>{campaign.number}</b></div>}
            {finalSeloUrl && <img className="dralfredo-thanks-preview" src={finalSeloUrl} alt="Seu selo de apoio pronto" />}
            <div className="dralfredo-thanks-actions"><button type="button" onClick={saveSelo}>Baixar meu selo</button><button type="button" onClick={shareSelo} disabled={sharing}>{sharing ? "Abrindo..." : "Compartilhar"}</button></div>
            <a className="dralfredo-thanks-instagram" href={`https://www.instagram.com/${campaign.instagram}`} target="_blank" rel="noreferrer">Acompanhar @{campaign.instagram}</a>
            <div className="dralfredo-thanks-credit">
              <span>Esta experiência foi criada pela Triso Studio.</span>
              <a href="/">Se quiser nos conhecer, clique aqui <span>→</span></a>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

