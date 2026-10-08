import { apiClient } from "../lib/apiClient.js";

const unwrap = (body) => body?.data ?? body;
const downloadsEndpoint = (campaignId) =>
  `/api/v1/campaigns/${encodeURIComponent(campaignId)}/downloads`;
const storageKey = (campaignId) => `triso-campaign-${campaignId}-downloads`;
const readLocal = (campaignId) => Number(window.localStorage.getItem(storageKey(campaignId)) || 0);
const writeLocal = (campaignId, count) => {
  const safeCount = Math.max(0, Number(count) || 0);
  window.localStorage.setItem(storageKey(campaignId), String(safeCount));
  return safeCount;
};
const responseCount = (body) => Number(body?.downloadsCount ?? body?.downloads ?? body?.count);

export const campaignService = {
  async getDownloads(campaignId) {
    const localCount = readLocal(campaignId);
    try {
      const body = unwrap(await apiClient.get(downloadsEndpoint(campaignId), {
        cache: "no-store",
        credentials: "omit",
      }));
      const count = responseCount(body);
      const downloadsCount = Number.isFinite(count) ? Math.max(localCount, count) : localCount;
      writeLocal(campaignId, downloadsCount);
      return { downloadsCount };
    } catch {
      return { downloadsCount: localCount, offline: true };
    }
  },
  async recordDownload(campaignId) {
    const nextLocalCount = readLocal(campaignId) + 1;
    writeLocal(campaignId, nextLocalCount);
    try {
      const body = unwrap(await apiClient.post(
        downloadsEndpoint(campaignId),
        { source: "website" },
        { credentials: "omit" },
      ));
      const count = responseCount(body);
      const downloadsCount = Number.isFinite(count) ? Math.max(nextLocalCount, count) : nextLocalCount;
      writeLocal(campaignId, downloadsCount);
      return { downloadsCount };
    } catch {
      return { downloadsCount: nextLocalCount, offline: true };
    }
  },
};
