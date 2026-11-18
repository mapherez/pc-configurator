import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Configurator } from "./view";
import "./styles.css";

import { AdminRoute } from "../admin/route";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname.startsWith("/admin") ? <AdminRoute /> : <Configurator />}
  </StrictMode>,
);
