import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Home, 
  Download, 
  FileText, 
  Loader2,
  Sparkles,
  Palette,
  Layout,
  Heart,
  MessageSquare,
  ArrowLeft,
  CheckCircle2
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { type Session, type Report, type Response as BriefingResponse, type Question, categoryLabels } from "@shared/schema";

interface SessionWithReportAndResponses extends Session {
  report: Report;
  responses: BriefingResponse[];
}

const categoryIcons = {
  vision: Sparkles,
  design: Palette,
  functional: Layout,
  lifestyle: Heart,
  emotional: MessageSquare,
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: session, isLoading: sessionLoading } = useQuery<SessionWithReportAndResponses>({
    queryKey: ["/api/sessions", id, "report"],
  });

  const { data: questions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const isLoading = sessionLoading || questionsLoading;

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/sessions/${id}/export/pdf`);
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LuXeBrief-${session?.projectName || session?.clientName || "briefing"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF export error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your design brief...</p>
        </div>
      </div>
    );
  }

  if (!session || !session.report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Report not found</p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  const { report, responses } = session;

  // Group responses by category
  const responsesByCategory = questions.reduce((acc, q) => {
    const response = responses.find((r) => r.questionId === q.id);
    if (!acc[q.category]) {
      acc[q.category] = [];
    }
    acc[q.category].push({ question: q, response });
    return acc;
  }, {} as Record<string, { question: Question; response?: BriefingResponse }[]>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-home"
            >
              <Home className="w-5 h-5" />
            </Button>
            <div>
              <p className="font-medium text-sm">{session.projectName || "LuXeBrief Project"}</p>
              <p className="text-xs text-muted-foreground">Lifestyle Brief</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={handleDownloadPDF} className="gap-2" data-testid="button-download-pdf">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download PDF</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
            LuXeBrief Lifestyle
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            A comprehensive summary of your vision for your ultra-luxury residence.
          </p>
          {/* Client & Project Info */}
          <div className="mt-6 p-4 bg-muted/30 rounded-lg inline-block">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Client:</span> {session.clientName}
              {session.projectName && (
                <>
                  <span className="mx-2">•</span>
                  <span className="font-medium text-foreground">Project:</span> {session.projectName}
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed whitespace-pre-wrap" data-testid="text-summary">
              {report.summary}
            </p>
          </CardContent>
        </Card>

        {/* Categorized Insights */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {report.designPreferences && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  Design Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-design-preferences">
                  {report.designPreferences}
                </p>
              </CardContent>
            </Card>
          )}

          {report.functionalNeeds && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layout className="w-5 h-5 text-primary" />
                  Functional Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-functional-needs">
                  {report.functionalNeeds}
                </p>
              </CardContent>
            </Card>
          )}

          {report.lifestyleElements && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  Lifestyle Elements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-lifestyle-elements">
                  {report.lifestyleElements}
                </p>
              </CardContent>
            </Card>
          )}

          {report.additionalNotes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Additional Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-additional-notes">
                  {report.additionalNotes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator className="my-8" />

        {/* Full Responses by Category */}
        <div className="space-y-8">
          <h2 className="text-xl font-semibold">Complete Responses</h2>
          
          {(Object.entries(responsesByCategory) as [keyof typeof categoryLabels, typeof responsesByCategory[string]][]).map(([category, items]) => {
            const Icon = categoryIcons[category];
            return (
              <div key={category} className="space-y-4">
                <h3 className="flex items-center gap-2 text-lg font-medium text-primary">
                  <Icon className="w-5 h-5" />
                  {categoryLabels[category]}
                </h3>
                <div className="space-y-4 pl-7">
                  {items.map(({ question, response }) => (
                    <div key={question.id} className="space-y-2">
                      <p className="text-sm font-medium">{question.question}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {response?.transcription || <span className="italic">No response recorded</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 pt-8 border-t border-border">
          <Button variant="outline" onClick={() => setLocation("/")} className="gap-2" data-testid="button-new-session">
            <ArrowLeft className="w-4 h-4" />
            Start New Briefing
          </Button>
          <Button onClick={handleDownloadPDF} className="gap-2" data-testid="button-download-pdf-bottom">
            <Download className="w-4 h-4" />
            Download PDF Report
          </Button>
        </div>
      </main>
    </div>
  );
}
