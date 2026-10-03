import test from "node:test";
import assert from "node:assert/strict";
import { SEAL_FORMATS, photoBounds, drawResponsiveTemplate } from "../src/features/campaigns/sealFormats.js";

test("preenchimento cobre todos os formatos mesmo nos extremos do posicionamento", () => {
  for (const format of SEAL_FORMATS) for (const image of [{ width: 600, height: 1200 }, { width: 1600, height: 900 }]) {
    for (const p of [-100, 0, 100]) {
      const [x, y, w, h] = photoBounds(image, format.width, format.height, 1, { x: p, y: p });
      assert.ok(x <= 0 && y <= 0);
      assert.ok(x + w >= format.width && y + h >= format.height);
    }
  }
});

test("foto inteira cabe no canvas sem distorção", () => {
  for (const format of SEAL_FORMATS) {
    const [x, y, w, h] = photoBounds({ width: 1600, height: 900 }, format.width, format.height, 1, { x: 0, y: 0 }, "contain");
    assert.ok(x >= 0 && y >= 0 && w <= format.width && h <= format.height);
    assert.ok(Math.abs(w / h - 1600 / 900) < 0.00001);
  }
});

test("molduras preservam proporções das faixas e cobrem a altura sem lacunas", () => {
  for (const format of SEAL_FORMATS) {
    const calls = [];
    drawResponsiveTemplate({ drawImage: (...args) => calls.push(args) }, { width: 1254, height: 1254 }, format.width, format.height);
    const [top, middle, bottom] = calls;
    for (const band of [top, bottom]) assert.ok(Math.abs(band[7] / band[3] - band[8] / band[4]) < 0.00001);
    assert.equal(top[6], 0);
    assert.equal(middle[6], top[8]);
    assert.ok(Math.abs(middle[6] + middle[8] - bottom[6]) < 0.00001);
    assert.equal(bottom[6] + bottom[8], format.height);
  }
});
