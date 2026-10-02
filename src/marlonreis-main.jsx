import React from "react";
import { createRoot } from "react-dom/client";
import { CampaignSealPage } from "./features/campaigns/CampaignSealPage.jsx";
import { CAMPAIGNS } from "./features/campaigns/campaigns.js";
import "./dralfredo.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><CampaignSealPage campaign={CAMPAIGNS.marlonreis} /></React.StrictMode>,
);
