import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRight, Home, Sparkles, Settings, Shield, Cpu, FileText } from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [, setLocation] = useLocation();

  const { data: content = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/content"],
  });

  const c = (key: string, fallback: string) => content[key] || fallback;

  const createSession = useMutation({
    mutationFn: async (data: { clientName: string; projectName?: string }) => {
      const res = await apiRequest("POST", "/api/sessions", data);
      return res.json();
    },
    onSuccess: (data) => {
      setLocation(`/briefing/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clientName.trim()) {
      createSession.mutate({
        clientName: clientName.trim(),
        projectName: projectName.trim() || undefined
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Home className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Residence Briefing</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Welcome Card */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Ultra-Luxury Design Experience</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
              {c("home.headline", "Design Your Dream Residence")}
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              {c("home.subtitle", "A guided experience for articulating your vision for ultra-luxury living")}
            </p>
          </div>

          {/* Start Form */}
          <Card className="shadow-lg">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="clientName" className="text-base font-medium">
                    Client Name
                  </Label>
                  <Input
                    id="clientName"
                    data-testid="input-client-name"
                    placeholder="First and Last Name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="h-12 text-base px-4"
                    autoComplete="name"
                    autoFocus
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="projectName" className="text-base font-medium">
                    Project Name <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="projectName"
                    data-testid="input-project-name"
                    placeholder="e.g. Thornwood Estate"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="h-12 text-base px-4"
                  />
                  <p className="text-sm text-muted-foreground">
                    Used for report identification.
                  </p>
                </div>

                <Button
                  type="submit"
                  data-testid="button-begin-briefing"
                  className="w-full h-12 text-base font-medium gap-2"
                  disabled={!clientName.trim() || createSession.isPending}
                >
                  {createSession.isPending ? (
                    <span>Creating Session...</span>
                  ) : (
                    <>
                      <span>{c("home.cta_button", "Begin Your Design Journey")}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="font-medium text-sm text-muted-foreground mb-4">What to Expect</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">1</span>
                    </div>
                    <span className="text-muted-foreground">Answer 12 thoughtful questions about your vision</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">2</span>
                    </div>
                    <span className="text-muted-foreground">Record your responses verbally with one click</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">3</span>
                    </div>
                    <span className="text-muted-foreground">Receive a comprehensive design brief summary</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Footer Note */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <p className="text-xs text-muted-foreground">
              Your responses are processed securely and used solely for your design brief.
            </p>
          </div>
          <div className="text-center mt-4">
            <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors" data-testid="link-admin">
              <Settings className="w-3 h-3" />
              Admin
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
