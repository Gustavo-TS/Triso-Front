import { APP_CONFIG } from "../config/app.js";
import { apiClient } from "../lib/apiClient.js";

const unwrap = (body) => body?.data ?? body;

export const campaignService = {
  getDownloads: () =>
    apiClient.get(APP_CONFIG.endpoints.drAlfredoDownloads).then(unwrap),
  recordDownload: () =>
    apiClient
      .post(APP_CONFIG.endpoints.drAlfredoDownloads, { source: "website" })
      .then(unwrap),
};
