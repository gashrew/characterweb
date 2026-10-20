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

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <BookProvider>
          <TooltipProvider>
            <Toaster
              toastOptions={{
                style: {
                  background: '#1a2035',
                  border: '1px solid #2a3350',
                  color: '#e8e0d0',
                },
              }}
            />
            <Home />
          </TooltipProvider>
        </BookProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
