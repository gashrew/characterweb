import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress the benign "ResizeObserver loop completed with undelivered notifications"
// warning that ReactFlow triggers during canvas resize. This is a known non-breaking
// browser notification, not an actual error.
const _origOnError = window.onerror;
window.onerror = (message, ...rest) => {
  if (typeof message === "string" && message.includes("ResizeObserver loop")) {
    return true; // suppress
  }
  return _origOnError ? _origOnError(message, ...rest) : false;
};

const _origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (
    args[0] &&
    typeof args[0] === "string" &&
    args[0].includes("ResizeObserver loop")
  ) {
    return;
  }
  _origConsoleError(...args);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
