// ============================================================
// App — Root component
// Design: Dark Scholarly Codex — dark theme, Playfair + DM Sans
// ============================================================
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BookProvider } from "./contexts/BookContext";
import Home from "./pages/Home";
import { QuickView } from "./components/QuickView";
import { useState } from "react";

import { initialViewMode, setViewMode, type ViewMode } from "./lib/viewMode";

function App() {
  const [mode] = useState<ViewMode>(initialViewMode);
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <BookProvider>
          <TooltipProvider>
            <Toaster
              position={mode === "quick" ? "top-center" : "bottom-right"}
              duration={mode === "quick" ? 2200 : undefined}
              offset={mode === "quick" ? 12 : undefined}
              toastOptions={{
                style: {
                  background: '#1a2035',
                  border: '1px solid #2a3350',
                  color: '#e8e0d0',
                },
              }}
            />
            {mode === "quick" ? <QuickView onSwitchToFull={() => setViewMode("full")} /> : <Home />}
          </TooltipProvider>
        </BookProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
