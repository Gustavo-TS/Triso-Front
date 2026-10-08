import { useEffect, useRef, useState } from "react";
import { TrisoLogo } from "../../components/TrisoLogo.jsx";
import fitaIsabella1 from "../../assets/festas/isabella15/fita_isabella_1.png";
import fitaIsabella2 from "../../assets/festas/isabella15/fita_isabella_2.png";
import fitaIsabella3 from "../../assets/festas/isabella15/fita_isabella_3.png";
import fitaIsabella4 from "../../assets/festas/isabella15/fita_isabella_4.png";

const OUTPUT = { width: 1080, height: 1920 };
const PARTY_TEMPLATES = {
  1: fitaIsabella1,
  2: fitaIsabella2,
  3: fitaIsabella3,
  4: fitaIsabella4,
};
const loadImage = (source) => new Promise((resolve, reject) => {
  if (!source) return resolve(null);
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = source;
});

const p = (x, y) => ({ x, y });
const photoCropCache = new WeakMap();
const ISABELLA_LAYOUTS = {
  one: { slots: [{ x: 98, y: 157, width: 745, height: 1143, rotation: 0 }] },
  two: { slots: [
    { x: 105, y: 161, width: 732, height: 573, rotation: 0 },
    { x: 105, y: 804, width: 734, height: 468, rotation: 0 },
  ] },
  three: { slots: [
    { x: 108, y: 179, width: 324, height: 541, rotation: 0 },
    { x: 512, y: 180, width: 326, height: 539, rotation: 0 },
    { x: 109, y: 776, width: 727, height: 494, rotation: 0 },
  ] },
  four: { slots: [
    { x: 101, y: 169, width: 342, height: 550, rotation: 0 },
    { x: 499, y: 169, width: 343, height: 550, rotation: 0 },
    { x: 102, y: 782, width: 341, height: 486, rotation: 0 },
    { x: 499, y: 782, width: 343, height: 486, rotation: 0 },
  ] },
};

function drawIntoPolygon(context, image, polygon) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  const crop = getPhotoCrop(image);
  const scale = Math.max(width / crop.width, height / crop.height);
  const drawWidth = crop.width * scale;
  const drawHeight = crop.height * scale;
  context.save();
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);
  polygon.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  context.clip();
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function getPhotoCrop(image) {
  if (photoCropCache.has(image)) return photoCropCache.get(image);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { x: 0, y: 0, width: image.width, height: image.height };
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const isDarkRow = (row) => {
    let dark = 0;
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (row * canvas.width + x) * 4;
      if (pixels[offset] < 28 && pixels[offset + 1] < 28 && pixels[offset + 2] < 28) dark += 1;
    }
    return dark / canvas.width > 0.94;
  };
  let top = 0;
  let bottom = canvas.height - 1;
  while (top < bottom && isDarkRow(top)) top += 1;
  while (bottom > top && isDarkRow(bottom)) bottom -= 1;
  const crop = { x: 0, y: top, width: canvas.width, height: bottom - top + 1 };
  photoCropCache.set(image, crop);
  return crop;
}

function drawIntoBox(context, image, box, scaleFactor = 1) {
  const x = box.x * scaleFactor;
  const y = box.y * scaleFactor;
  const width = box.width * scaleFactor;
  const height = box.height * scaleFactor;
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const imageScale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * imageScale;
  const drawHeight = imageHeight * imageScale;
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate(((box.rotation || 0) * Math.PI) / 180);
  context.beginPath();
  context.rect(-width / 2, -height / 2, width, height);
  context.clip();
  context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

const slotsFor = (count, width, height) => {
  const makeSlot = (x, y, slotWidth, slotHeight) => ({ x: width * x, y: height * y, width: width * slotWidth, height: height * slotHeight });
  if (count === 1) return [makeSlot(.18, .145, .64, .53)];
  if (count === 2) return [makeSlot(.18, .22, .70, .22), makeSlot(.18, .47, .70, .22)];
  if (count === 4) return [
    makeSlot(.12, .17, .36, .28),
    makeSlot(.52, .17, .36, .28),
    makeSlot(.12, .51, .36, .28),
    makeSlot(.52, .51, .36, .28),
  ];
  return [makeSlot(.18, .20, .70, .18), makeSlot(.18, .405, .70, .18), makeSlot(.18, .61, .70, .18)];
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

function drawPartyArt(images, count, event, template) {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT.width;
  canvas.height = OUTPUT.height;
  const context = canvas.getContext("2d");
  if (template) {
    const scale = Math.max(canvas.width / template.width, canvas.height / template.height);
    const templateWidth = template.width * scale;
    const templateHeight = template.height * scale;
    const offsetX = (canvas.width - templateWidth) / 2;
    const offsetY = (canvas.height - templateHeight) / 2;
    const measuredLayout = ISABELLA_LAYOUTS[{ 1: "one", 2: "two", 3: "three", 4: "four" }[count]] || null;
    if (measuredLayout) {
      measuredLayout.slots.forEach((slot, index) => {
        if (!images[index]) return;
        drawIntoBox(context, images[index], slot, scale);
      });
    } else {
      slotsFor(count, template.width, template.height).forEach((templateSlot, index) => {
        if (!images[index]) return;
        const slot = { x: offsetX + templateSlot.x * scale, y: offsetY + templateSlot.y * scale, width: templateSlot.width * scale, height: templateSlot.height * scale };
        drawCover(context, images[index], slot);
      });
    }
    context.drawImage(template, offsetX, offsetY, templateWidth, templateHeight);
    return canvas;
  }
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

  slotsFor(count, canvas.width, canvas.height).forEach((slot, index) => {
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

function PhotoCountIcon({ count }) {
  return (
    <span className={`party-count-icon party-count-icon-${count}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <i key={index} />)}
    </span>
  );
}

function PhotoCountSelector({ value, onChange }) {
  return (
    <div className="party-counts" role="group" aria-label="Quantidade de fotos">
      {[1, 2, 3, 4].map((option) => (
        <button key={option} type="button" className={value === option ? "active" : ""} onClick={() => onChange(option)}>
          <PhotoCountIcon count={option} />
          <b>{option}</b>
          <small>{option === 1 ? "foto" : "fotos"}</small>
        </button>
      ))}
    </div>
  );
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
  const nextPhotoIndex = photos.findIndex((photo) => !photo);
  const remaining = photos.filter((photo) => !photo).length;
  const landscapeHint = count === 2 || (count === 3 && nextPhotoIndex === 2);

  useEffect(() => {
    let cancelled = false;
    Promise.all([Promise.all(photos.map((photo) => photo ? loadImage(photo).catch(() => null) : null)), loadImage(PARTY_TEMPLATES[count]).catch(() => null)]).then(([images, template]) => {
      if (!cancelled) setPreview(drawPartyArt(images, count, event, template).toDataURL("image/png"));
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
      const [[images, template]] = await Promise.all([Promise.all([Promise.all(photos.map(loadImage)), loadImage(PARTY_TEMPLATES[count]).catch(() => null)]), new Promise((resolve) => window.setTimeout(resolve, 1800))]);
      const canvas = drawPartyArt(images, count, event, template);
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
    <header className="dralfredo-header"><TrisoLogo className="dralfredo-brand" light /><span>LEMBRANÇA DIGITAL</span></header>
    <section className="party-layout">
      <div className="party-copy">
        <p>FESTA DE 15 ANOS</p><h1>Eu fui aos 15 da <em>{event.shortName}.</em></h1>
        <span>Escolha quantas fotos farão parte da sua lembrança. Todas as opções saem no formato de tela cheia para Stories e Reels.</span>
        <PhotoCountSelector value={count} onChange={chooseCount} />
        <div className="party-uploads">
          {nextPhotoIndex >= 0 ? <div className="party-upload">
            <input ref={(node) => { inputs.current[nextPhotoIndex] = node; }} id={`party-photo-${nextPhotoIndex}`} type="file" accept="image/*" onChange={(eventInput) => selectPhoto(nextPhotoIndex, eventInput.target.files?.[0])} />
            {landscapeHint && <small>Para este quadro, tire a foto com o celular deitado.</small>}
            {landscapeHint && <b className="party-orientation-note">Antes de tocar na prévia: use o celular deitado para esta foto.</b>}
            <small>Toque na prévia abaixo para adicionar a foto {nextPhotoIndex + 1}. Faltam {remaining} {remaining === 1 ? "foto" : "fotos"}.</small>
          </div> : <div className="party-upload party-upload-complete"><span>{count} {count === 1 ? "foto enviada" : "fotos enviadas"}</span><b>Montagem pronta para criar.</b></div>}
        </div>
        {message && <p className="party-message">{message}</p>}
        {nextPhotoIndex < 0 && <div className="party-actions"><button type="button" disabled={creating} onClick={generate}>{creating ? "Preparando a festa..." : "Criar minha lembrança"}</button>{finalBlob && <button type="button" className="secondary" onClick={download}>Baixar lembrança</button>}</div>}
      </div>
      <div className={`party-preview ${nextPhotoIndex >= 0 ? "is-pending" : ""}`} role={nextPhotoIndex >= 0 ? "button" : undefined} tabIndex={nextPhotoIndex >= 0 ? 0 : undefined} onClick={() => nextPhotoIndex >= 0 && inputs.current[nextPhotoIndex]?.click()} onKeyDown={(keyboardEvent) => { if (nextPhotoIndex >= 0 && (keyboardEvent.key === "Enter" || keyboardEvent.key === " ")) { keyboardEvent.preventDefault(); inputs.current[nextPhotoIndex]?.click(); } }}><img src={preview} alt={`Prévia da lembrança com ${count} ${count === 1 ? "foto" : "fotos"}`} />{nextPhotoIndex >= 0 && <span>Toque no espaço da foto {nextPhotoIndex + 1}<small>Faltam {remaining} {remaining === 1 ? "foto" : "fotos"}</small></span>}</div>
    </section>
    <footer className="dralfredo-footer"><span>Feito pela <b>TRISO STUDIO</b></span><a href="/">Conheça nosso site <span>→</span></a></footer>
    {creating && <div className="party-building" role="status" aria-live="polite"><div className="party-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ "--item": index }} />)}</div><div className="party-balloon balloon-one" aria-hidden="true" /><div className="party-balloon balloon-two" aria-hidden="true" /><div className="party-building-card"><span>XV</span><h2>{["Separando suas fotos", "Dando brilho à lembrança", "Finalizando sua arte"][buildingStep]}</h2><p>{["Preparando cada momento para entrar na montagem.", "Aplicando a moldura e os detalhes da festa.", "Só mais um instante para sua lembrança ficar pronta."][buildingStep]}</p><ol><li className={buildingStep >= 0 ? "done" : ""}>Fotos</li><li className={buildingStep >= 1 ? "done" : ""}>Moldura</li><li className={buildingStep >= 2 ? "done" : ""}>Finalização</li></ol><div><i /><i /><i /></div></div></div>}
    {thanksOpen && <div className="party-thanks-backdrop"><section className="party-thanks" role="dialog" aria-modal="true" aria-labelledby="party-thanks-title"><button type="button" onClick={() => setThanksOpen(false)} aria-label="Fechar">×</button><span>LEMBRANÇA PRONTA</span><h2 id="party-thanks-title">Que noite especial!</h2><p>Sua lembrança dos {event.name} está pronta para guardar e compartilhar.</p>{preview && <img src={preview} alt="Lembrança pronta" />}<div><button type="button" onClick={download}>Baixar lembrança</button><button type="button" onClick={restart}>Refazer</button></div></section></div>}
  </main>;
}
