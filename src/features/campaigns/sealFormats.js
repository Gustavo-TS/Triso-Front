export const SEAL_FORMATS = [
  { id: "quadrado", label: "Perfil / quadrado", width: 1080, height: 1080, hint: "Perfil e publicações quadradas · 1:1" },
  { id: "feed", label: "Feed vertical", width: 1080, height: 1350, hint: "Instagram e Facebook · 4:5" },
  { id: "stories", label: "Stories / status", width: 1080, height: 1920, hint: "Stories e status do WhatsApp · 9:16" },
  { id: "horizontal", label: "Horizontal", width: 1920, height: 1080, hint: "Publicações em outras redes · 16:9" },
];

export function photoBounds(image, width, height, zoom, position, fit = "cover") {
  const scale = (fit === "contain" ? Math.min : Math.max)(width / image.width, height / image.height) * zoom;
  const w = image.width * scale;
  const h = image.height * scale;
  return [(width - w) / 2 + position.x / 100 * Math.abs(w - width) / 2,
    (height - h) / 2 + position.y / 100 * Math.abs(h - height) / 2, w, h];
}

// Preserve the lettering in the top and bottom bands; only extend the middle border.
export function drawResponsiveTemplate(context, template, width, height) {
  const scale = Math.min(width / template.width, height / (template.height * 0.55));
  const w = template.width * scale;
  const x = (width - w) / 2;
  const top = Math.round(template.height * 0.28);
  const bottom = Math.round(template.height * 0.22);
  const middle = template.height - top - bottom;
  context.drawImage(template, 0, 0, template.width, top, x, 0, w, top * scale);
  context.drawImage(template, 0, top, template.width, middle, x, top * scale, w, height - (top + bottom) * scale);
  context.drawImage(template, 0, template.height - bottom, template.width, bottom, x, height - bottom * scale, w, bottom * scale);
}
