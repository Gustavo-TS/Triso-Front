import React from "react";
import { createRoot } from "react-dom/client";
import { DrAlfredoPage } from "./features/dralfredo/DrAlfredoPage.jsx";
import "./dralfredo.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><DrAlfredoPage /></React.StrictMode>,
);
