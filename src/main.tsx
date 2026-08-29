import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./app/App";
import { initAnalytics } from "./app/lib/analytics";
import { StoreProvider } from "./app/lib/store";
import "./styles/index.css";

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <StoreProvider>
      <App />
    </StoreProvider>
  </BrowserRouter>,
);
