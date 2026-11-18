import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfiguratorPrototype } from "./view";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfiguratorPrototype />
  </StrictMode>,
);
