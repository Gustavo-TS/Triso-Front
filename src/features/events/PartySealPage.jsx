import { useEffect, useMemo, useRef, useState } from "react";
import { TrisoLogo } from "../../components/TrisoLogo.jsx";

const OUTPUT = { width: 1080, height: 1350 };
const loadImage = (source) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = source;
});

const slotsFor = (count) => {
  if (count === 1) return [{ x: 126, y: 300, width: 828, height: 760 }];
  if (count === 2) return [{ x: 126, y: 290, width: 828, height: 355 }, { x: 126, y: 690, width: 828, height: 355 }];
  return [{ x: 126, y: 275, width: 828, height: 230 }, { x: 126, y: 545, width: 828, height: 230 }, { x: 126, y: 815, width: 828, height: 230 }];
};

function drawCover(context, image, slot) {
  const scale = Math.max(slot.width / image.width, slot.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.save();
  context.beginPath();
  context.rect(slot.x, slot.y, slot.width, slot.height);
  context.clip();
  context.drawImage(image, slot.x + (slot.width - width) / 2, slot.y + (slot.height - height) / 2, width, height);
  context.restore();
}

function drawPartyArt(images, count, event) {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT.width;
  canvas.height = OUTPUT.height;
  const context = canvas.getContext("2d");
  const { deep, wine, pink, blush, gold } = event.palette;
  const gradient = context.createLinearGradient(0, 0, OUTPUT.width, OUTPUT.height);
  gradient.addColorStop(0, deep);
  gradient.addColorStop(.5, wine);
  gradient.addColorStop(1, "#210212");
  context.fillStyle = gradient;
  context.fillRect(0, 0, OUTPUT.width, OUTPUT.height);

  context.fillStyle = "rgba(255,255,255,.08)";
  for (let index = 0; index < 42; index += 1) {
    const x = (index * 137) % OUTPUT.width;
    const y = (index * 79 + 45) % OUTPUT.height;
    context.beginPath(); context.arc(x, y, index % 4 + 2, 0, Math.PI * 2); context.fill();
  }
  context.strokeStyle = pink;
  context.lineWidth = 18;
  context.strokeRect(28, 28, OUTPUT.width - 56, OUTPUT.height - 56);
  context.strokeStyle = gold;
  context.lineWidth = 5;
  context.strokeRect(48, 48, OUTPUT.width - 96, OUTPUT.height - 96);

  context.fillStyle = blush;
  context.font = "italic 64px Georgia";
  context.textAlign = "center";
  context.fillText("Eu fui aos", OUTPUT.width / 2, 112);
  context.fillStyle = gold;
  context.font = "900 92px Arial";
  context.fillText("15 ANOS DA", OUTPUT.width / 2, 202);
  context.fillStyle = "#fff";
  context.font = "italic 92px Georgia";
  context.fillText(event.shortName, OUTPUT.width / 2, 282);

  slotsFor(count).forEach((slot, index) => {
    context.fillStyle = "rgba(255,255,255,.13)";
    context.fillRect(slot.x, slot.y, slot.width, slot.height);
    if (images[index]) drawCover(context, images[index], slot);
    context.lineWidth = 14;
    context.strokeStyle = gold;
    context.strokeRect(slot.x - 7, slot.y - 7, slot.width + 14, slot.height + 14);
    context.lineWidth = 4;
    context.strokeStyle = "#fff1f6";
    context.strokeRect(slot.x + 8, slot.y + 8, slot.width - 16, slot.height - 16);
    if (!images[index]) {
      context.fillStyle = "rgba(255,255,255,.85)";
      context.font = "700 28px Arial";
      context.fillText(`FOTO ${index + 1}`, slot.x + slot.width / 2, slot.y + slot.height / 2 + 10);
    }
  });

  context.fillStyle = "rgba(255,255,255,.12)";
  context.beginPath(); context.arc(118, 1185, 92, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.arc(960, 1170, 118, 0, Math.PI * 2); context.fill();
  context.fillStyle = gold;
  context.font = "900 40px Arial";
  context.fillText("XV", OUTPUT.width / 2, 1192);
  context.fillStyle = blush;
  context.font = "600 26px Arial";
  context.fillText(event.date, OUTPUT.width / 2, 1240);
  return canvas;
}

export function PartySealPage({ event }) {
  const [count, setCount] = useState(1);
  const [photos, setPhotos] = useState([""]);
  const [preview, setPreview] = useState("");
  const [finalBlob, setFinalBlob] = useState(null);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [buildingStep, setBuildingStep] = useState(0);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const inputs = useRef([]);
  const optionPreviews = useMemo(() => [1, 2, 3].map((option) => drawPartyArt([], option, event).toDataURL("image/png")), [event]);
  const nextPhotoIndex = photos.findIndex((photo) => !photo);
  const remaining = photos.filter((photo) => !photo).length;

  useEffect(() => {
    let cancelled = false;
    Promise.all(photos.map((photo) => photo ? loadImage(photo).catch(() => null) : null)).then((images) => {
      if (!cancelled) setPreview(drawPartyArt(images, count, event).toDataURL("image/png"));
    });
    return () => { cancelled = true; };
  }, [photos, count, event]);

  const chooseCount = (nextCount) => {
    setCount(nextCount);
    setPhotos((current) => Array.from({ length: nextCount }, (_, index) => current[index] || ""));
    setMessage("");
  };

  const selectPhoto = (index, file) => {
    if (!file?.type.startsWith("image/")) { setMessage("Escolha uma imagem em JPG, PNG ou WEBP."); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotos((current) => current.map((photo, position) => position === index ? String(reader.result) : photo));
    reader.readAsDataURL(file);
    setMessage("");
  };

  const generate = async () => {
    if (photos.some((photo) => !photo)) { setMessage(`Envie as ${count} fotos para continuar.`); return; }
    setCreating(true);
    setBuildingStep(0);
    setMessage("");
    try {
      window.setTimeout(() => setBuildingStep(1), 480);
      window.setTimeout(() => setBuildingStep(2), 1040);
      const [images] = await Promise.all([Promise.all(photos.map(loadImage)), new Promise((resolve) => window.setTimeout(resolve, 1800))]);
      const canvas = drawPartyArt(images, count, event);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      setFinalBlob(blob);
      setPreview(canvas.toDataURL("image/png"));
      setMessage("Sua lembrança está pronta para baixar.");
      setThanksOpen(true);
    } catch {
      setMessage("Não foi possível montar agora. Tente novamente.");
    } finally { setCreating(false); }
  };

  const download = () => {
    if (!finalBlob) return;
    const url = URL.createObjectURL(finalBlob);
    const link = document.createElement("a");
    link.href = url; link.download = `${event.id}-${count}-fotos.png`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const restart = () => {
    setPhotos(Array.from({ length: count }, () => ""));
    setFinalBlob(null);
    setThanksOpen(false);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const share = async () => {
    if (!finalBlob || sharing) return;
    setSharing(true);
    try {
      const file = new File([finalBlob], `${event.id}-${count}-fotos.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else download();
    } catch (error) { if (error?.name !== "AbortError") download(); }
    finally { setSharing(false); }
  };

  return <main className="party-page">
    <header className="party-header"><TrisoLogo className="party-brand" light /><b>LEMBRANÇA DIGITAL</b></header>
    <section className="party-layout">
      <div className="party-copy">
        <p>FESTA DE 15 ANOS</p><h1>Eu fui aos 15 da <em>{event.shortName}.</em></h1>
        <span>Escolha quantas fotos farão parte da sua lembrança. A montagem já nasce no formato certo para compartilhar.</span>
        <div className="party-counts" role="group" aria-label="Quantidade de fotos">
          {[1, 2, 3].map((option, index) => <button key={option} type="button" className={count === option ? "active" : ""} onClick={() => chooseCount(option)}><img src={optionPreviews[index]} alt={`Modelo com ${option} ${option === 1 ? "foto" : "fotos"}`} /><b>{option}</b><small>{option === 1 ? "foto" : "fotos"}</small></button>)}
        </div>
        <div className="party-uploads">
          {nextPhotoIndex >= 0 ? <div className="party-upload">
            <input ref={(node) => { inputs.current[nextPhotoIndex] = node; }} id={`party-photo-${nextPhotoIndex}`} type="file" accept="image/*" onChange={(eventInput) => selectPhoto(nextPhotoIndex, eventInput.target.files?.[0])} />
            <small>Toque na prévia abaixo para adicionar a foto {nextPhotoIndex + 1}. Faltam {remaining} {remaining === 1 ? "foto" : "fotos"}.</small>
          </div> : <div className="party-upload party-upload-complete"><span>{count} {count === 1 ? "foto enviada" : "fotos enviadas"}</span><b>Montagem pronta para criar.</b></div>}
        </div>
        {message && <p className="party-message">{message}</p>}
        {nextPhotoIndex < 0 && <div className="party-actions"><button type="button" disabled={creating} onClick={generate}>{creating ? "Preparando a festa..." : "Criar minha lembrança"}</button>{finalBlob && <button type="button" className="secondary" onClick={download}>Baixar lembrança</button>}</div>}
      </div>
      <div className={`party-preview ${nextPhotoIndex >= 0 ? "is-pending" : ""}`} role={nextPhotoIndex >= 0 ? "button" : undefined} tabIndex={nextPhotoIndex >= 0 ? 0 : undefined} onClick={() => nextPhotoIndex >= 0 && inputs.current[nextPhotoIndex]?.click()} onKeyDown={(keyboardEvent) => { if (nextPhotoIndex >= 0 && (keyboardEvent.key === "Enter" || keyboardEvent.key === " ")) { keyboardEvent.preventDefault(); inputs.current[nextPhotoIndex]?.click(); } }}><img src={preview} alt={`Prévia da lembrança com ${count} ${count === 1 ? "foto" : "fotos"}`} />{nextPhotoIndex >= 0 && <span>Toque no espaço da foto {nextPhotoIndex + 1}<small>Faltam {remaining} {remaining === 1 ? "foto" : "fotos"}</small></span>}</div>
    </section>
    {creating && <div className="party-building" role="status" aria-live="polite"><div className="party-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ "--item": index }} />)}</div><div className="party-balloon balloon-one" aria-hidden="true" /><div className="party-balloon balloon-two" aria-hidden="true" /><div className="party-building-card"><span>XV</span><h2>{["Separando suas fotos", "Dando brilho à lembrança", "Finalizando sua arte"][buildingStep]}</h2><p>{["Preparando cada momento para entrar na montagem.", "Aplicando a moldura e os detalhes da festa.", "Só mais um instante para sua lembrança ficar pronta."][buildingStep]}</p><ol><li className={buildingStep >= 0 ? "done" : ""}>Fotos</li><li className={buildingStep >= 1 ? "done" : ""}>Moldura</li><li className={buildingStep >= 2 ? "done" : ""}>Finalização</li></ol><div><i /><i /><i /></div></div></div>}
    {thanksOpen && <div className="party-thanks-backdrop"><section className="party-thanks" role="dialog" aria-modal="true" aria-labelledby="party-thanks-title"><button type="button" onClick={() => setThanksOpen(false)} aria-label="Fechar">×</button><span>LEMBRANÇA PRONTA</span><h2 id="party-thanks-title">Que noite especial!</h2><p>Sua lembrança dos {event.name} está pronta para guardar e compartilhar.</p>{preview && <img src={preview} alt="Lembrança pronta" />}<div><button type="button" onClick={download}>Baixar lembrança</button><button type="button" onClick={restart}>Refazer</button></div></section></div>}
  </main>;
}
