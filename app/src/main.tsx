import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";

import { App } from "./App";
import "./index.css";

// HashRouter (URLs like #/section/1-07.1) needs no server rewrites, so deep links and
// page refreshes work on GitHub Pages and file shares without a custom 404 handler.
const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
