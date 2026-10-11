import { domAnimation, LazyMotion } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AuthProvider } from "./app/AuthContext";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/dm-sans/latin-900.css";
import "./design/tokens.css";
import "./design/primitiver.css";
import "./app/styles.css";
import "./design/bevegelse.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LazyMotion>
  </StrictMode>,
);
