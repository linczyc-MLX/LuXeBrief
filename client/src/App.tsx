import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import BriefingPage from "@/pages/briefing";
import LivingPage from "@/pages/living";
import TastePage from "@/pages/taste";
import TasteResultsPage from "@/pages/taste-results";
import ReportPage from "@/pages/report";
import AdminPage from "@/pages/admin";
import PortalLoginPage from "@/pages/portal-login";
import PortalPage from "@/pages/portal";

// Check if we're on a portal subdomain (e.g., thornwood.luxebrief.not-4.sale)
function isPortalSubdomain(): boolean {
  const hostname = window.location.hostname;
  // Match [project].luxebrief.not-4.sale but not www.luxebrief.not-4.sale
  const match = hostname.match(/^([^.]+)\.luxebrief\.not-4\.sale$/);
  return match !== null && match[1] !== 'www' && match[1] !== 'api';
}

// Portal Router - for client portal subdomains
function PortalRouter() {
  return (
    <Switch>
      <Route path="/" component={PortalLoginPage} />
      <Route path="/login" component={PortalLoginPage} />
      <Route path="/portal" component={PortalPage} />
      <Route path="/advisor" component={PortalLoginPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Main Router - for luxebrief.not-4.sale
function MainRouter() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/briefing/:id" component={BriefingPage} />
      <Route path="/living/:id" component={LivingPage} />
      <Route path="/taste/:token" component={TastePage} />
      <Route path="/taste/:token/results" component={TasteResultsPage} />
      <Route path="/report/:id" component={ReportPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isPortal, setIsPortal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Determine routing mode on mount
    setIsPortal(isPortalSubdomain());
    setLoading(false);
  }, []);

  // Show nothing while determining routing mode
  if (loading) {
    return null;
  }

  return (
    <ThemeProvider defaultTheme={isPortal ? "dark" : "light"} storageKey="briefing-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          {isPortal ? <PortalRouter /> : <MainRouter />}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
