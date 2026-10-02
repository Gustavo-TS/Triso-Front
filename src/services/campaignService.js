import { apiClient } from "../lib/apiClient.js";

const unwrap = (body) => body?.data ?? body;
const downloadsEndpoint = (campaignId) =>
  `/api/v1/campaigns/${encodeURIComponent(campaignId)}/downloads`;

export const campaignService = {
  getDownloads: (campaignId) =>
    apiClient
      .get(downloadsEndpoint(campaignId), { cache: "no-store" })
      .then(unwrap),
  recordDownload: (campaignId) =>
    apiClient
      .post(downloadsEndpoint(campaignId), { source: "website" })
      .then(unwrap),
};
