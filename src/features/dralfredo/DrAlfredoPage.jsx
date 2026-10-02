import { useEffect, useMemo, useRef, useState } from "react";
import { campaignService } from "../../services/campaignService.js";

const TEMPLATE_URL = import.meta.env.VITE_DRALFREDO_TEMPLATE_URL || "/DrAlfredo/drAlfredo4063.png";
const COUNTER_KEY = "dralfredo-download-count";

const readCounter = () => Number(window.localStorage.getItem(COUNTER_KEY) || 0);

const loadImage = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

function drawAdjustedImage(context, image, width, height, zoom = 1, position = { x: 0, y: 0 }) {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  if (imageRatio > boxRatio) drawWidth = height * imageRatio;
  else drawHeight = width / imageRatio;
  drawWidth *= zoom;
  drawHeight *= zoom;
  const travelX = Math.max(Math.abs(drawWidth - width) / 2, width * 0.34);
  const travelY = Math.max(Math.abs(drawHeight - height) / 2, height * 0.34);
  const x = (width - drawWidth) / 2 + (position.x / 100) * travelX;
  const y = (height - drawHeight) / 2 + (position.y / 100) * travelY;
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function composeSelo(person, template, zoom, position) {
  const canvas = document.createElement("canvas");
  canvas.width = template?.width || 1080;
  canvas.height = template?.height || 1080;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawAdjustedImage(context, person, canvas.width, canvas.height, zoom, position);
  if (template) context.drawImage(template, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function DrAlfredoPage() {
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
  const previewInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    campaignService
      .getDownloads()
      .then((data) => {
        if (!active) return;
        setDownloads(Number(data?.downloadsCount || 0));
        setCounterError("");
      })
      .catch((err) => {
        if (!active) return;
        setDownloads(readCounter());
        setCounterError(`Não foi possível consultar os apoios agora (HTTP ${err?.status || "rede"}).`);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl("");
      return undefined;
    }
    let cancelled = false;
    Promise.all([loadImage(photo), loadImage(TEMPLATE_URL).catch(() => null)])
      .then(([person, template]) => {
        if (!cancelled) setPreviewUrl(composeSelo(person, template, zoom, position).toDataURL("image/png"));
      })
      .catch(() => !cancelled && setPreviewUrl(photo));
    return () => { cancelled = true; };
  }, [photo, zoom, position]);

  const supportText = useMemo(
    () => `${downloads} ${downloads === 1 ? "apoio registrado" : "apoios registrados"}`,
    [downloads],
  );

  const selectPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Escolha uma imagem em JPG, PNG ou WEBP.");
      return;
    }
    setError("");
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };

  const registerDownload = async () => {
    try {
      const result = await campaignService.recordDownload();
      setDownloads(Number(result?.downloadsCount || downloads));
    } catch {
      const nextDownloads = readCounter() + 1;
      window.localStorage.setItem(COUNTER_KEY, String(nextDownloads));
      setDownloads(nextDownloads);
    }
  };

  const saveSelo = async () => {
    if (!finalSeloBlob) return;
    const url = URL.createObjectURL(finalSeloBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "eu-apoio-dr-ze-alfredo-4063.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const shareSelo = async () => {
    if (!finalSeloBlob) return;
    const file = new File([finalSeloBlob], "eu-apoio-dr-ze-alfredo-4063.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Dr. Zé Alfredo 4063", text: "Meu selo de apoio ao Dr. Zé Alfredo 4063.", files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: "Dr. Zé Alfredo 4063", url: window.location.href });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setError("Link copiado para compartilhar.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") setError("Não foi possível abrir o compartilhamento.");
    }
  };

  const createAndDownload = async () => {
    if (!photo || creating) return;
    setCreating(true);
    setThanksOpen(false);
    setError("");
    void registerDownload();
    try {
      const [person, template] = await Promise.all([
        loadImage(photo),
        loadImage(TEMPLATE_URL).catch(() => null),
      ]);
      const canvas = composeSelo(person, template, zoom, position);
      const blobPromise = new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const loadingDelay = new Promise((resolve) => window.setTimeout(resolve, 3000));
      setFinalSeloUrl(canvas.toDataURL("image/png"));
      const [blob] = await Promise.all([blobPromise, loadingDelay]);
      setFinalSeloBlob(blob);
      setThanksOpen(true);
    } catch {
      setError("Não foi possível montar sua imagem agora. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="dralfredo-page">
      <header className="dralfredo-header">
        <a className="dralfredo-brand" href="/" aria-label="Triso Studio">
          TRISO <small>STUDIO</small>
        </a>
        <span>Uma iniciativa de apoio</span>
      </header>

      <section className="dralfredo-hero">
        <div className="dralfredo-intro">
          <span className="dralfredo-kicker">SEU APOIO FAZ A DIFERENÇA</span>
          <h1>Mostre que você apoia o <em>Dr. Zé Alfredo.</em></h1>
          <div className="dralfredo-candidate-number">
            <span>DEPUTADO<br />FEDERAL</span>
            <b>4063</b>
          </div>
          <p>Envie sua foto, gere seu selo de apoio e compartilhe esta mensagem com quem acredita em uma cidade melhor.</p>
          <div className="dralfredo-counter" aria-live="polite">
            <span className="dralfredo-counter-label">APOIOS QUE JÁ ESTÃO COM A GENTE</span>
            <b>{String(downloads).padStart(4, "0")}</b>
            <span className="dralfredo-counter-copy">{supportText}</span>
          </div>
          {counterError && <small className="dralfredo-counter-error">{counterError}</small>}
          <a className="dralfredo-instagram" href="https://www.instagram.com/dr.zealfredo" target="_blank" rel="noreferrer">@dr.zealfredo <span>↗</span></a>
        </div>

        <div className="dralfredo-maker">
          <input ref={previewInputRef} className="dralfredo-preview-input" type="file" accept="image/*" onChange={selectPhoto} />
          <div
            className={`dralfredo-preview ${photo ? "has-photo" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => previewInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") previewInputRef.current?.click();
            }}
            aria-label={photo ? "Trocar foto" : "Enviar sua foto"}
          >
            {photo ? <img src={previewUrl || photo} alt="Prévia da foto enviada" /> : <img className="dralfredo-template-preview" src={TEMPLATE_URL} alt="" aria-hidden="true" />}
            {!photo && <span>Sua foto<br />aparece aqui</span>}
            {!photo && <span className="dralfredo-preview-action">Toque para enviar sua foto</span>}
          </div>
          <p className="dralfredo-upload-hint">{photo ? "Toque na imagem para trocar sua foto." : "Toque na imagem e escolha uma foto para criar seu selo."}</p>
          {photo && <div className="dralfredo-photo-adjustments">
            <div className="dralfredo-adjustments-head">
              <b>Ajuste sua foto</b>
              <button type="button" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}>Centralizar</button>
            </div>
            <label>Zoom <input type="range" min="0.25" max="2.5" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
            <div className="dralfredo-position-controls">
              <label>Horizontal <input type="range" min="-100" max="100" value={position.x} onChange={(event) => setPosition((current) => ({ ...current, x: Number(event.target.value) }))} /></label>
              <label>Vertical <input type="range" min="-100" max="100" value={position.y} onChange={(event) => setPosition((current) => ({ ...current, y: Number(event.target.value) }))} /></label>
            </div>
          </div>}
          {error && <p className="dralfredo-error">{error}</p>}
          <button className="dralfredo-download" type="button" disabled={!photo || creating} onClick={createAndDownload}>
            {creating ? "Montando sua imagem..." : "Criar meu selo de apoio"}
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
            <span>APOIO REGISTRADO · 4063</span>
            <h2 id="dralfredo-thanks-title">Obrigado por estar com o Dr. Zé Alfredo.</h2>
            <p>Seu selo está pronto. Salve ou compartilhe nas redes e ajude essa mensagem a chegar ainda mais longe.</p>
            <div className="dralfredo-thanks-number"><span>DEPUTADO<br />FEDERAL</span><b>4063</b></div>
            {finalSeloUrl && <img className="dralfredo-thanks-preview" src={finalSeloUrl} alt="Seu selo de apoio pronto" />}
            <div className="dralfredo-thanks-actions"><button type="button" onClick={saveSelo}>Salvar imagem</button><button type="button" onClick={shareSelo}>Compartilhar</button></div>
            <a className="dralfredo-thanks-instagram" href="https://www.instagram.com/dr.zealfredo" target="_blank" rel="noreferrer">Acompanhar @dr.zealfredo</a>
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
