import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { ConfirmProvider } from "./confirm.jsx";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import { ToastProvider } from "./toasts.jsx";
import App from "./App.jsx";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/r2.css";

// PWA service worker — caches inventory reads for offline stock checks
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
