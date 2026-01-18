import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { categoryLabels, type Question, type Session, type Response as BriefingResponse, type QuestionCategory } from "@shared/schema";
import { VoiceRecorder } from "@/components/voice-recorder";
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Check, 
  Loader2,
  FileText
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface SessionWithResponses extends Session {
  responses: BriefingResponse[];
}

export default function BriefingPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [localTranscription, setLocalTranscription] = useState("");
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);

  const { data: session, isLoading: isSessionLoading } = useQuery<SessionWithResponses>({
    queryKey: ["/api/sessions", id],
  });

  const { data: questions = [], isLoading: isQuestionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const isLoading = isSessionLoading || isQuestionsLoading;
  const currentQuestionIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = questions[currentQuestionIndex];
  const currentResponse = session?.responses?.find(
    (r) => r.questionId === currentQuestion?.id
  );

  useEffect(() => {
    if (currentResponse?.transcription) {
      setLocalTranscription(currentResponse.transcription);
    } else {
      setLocalTranscription("");
    }
    setCurrentAudio(null);
  }, [currentResponse?.transcription, currentQuestionIndex]);

  const updateQuestion = useMutation({
    mutationFn: async (index: number) => {
      await apiRequest("PATCH", `/api/sessions/${id}`, { currentQuestionIndex: index });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
    },
  });

  const saveTranscription = useMutation({
    mutationFn: async ({ questionId, transcription, audio, questionTitle }: { 
      questionId: number; 
      transcription: string; 
      audio?: string | null;
      questionTitle?: string;
    }) => {
      await apiRequest("POST", `/api/sessions/${id}/responses`, {
        questionId,
        transcription,
        isCompleted: true,
        audio,
        questionTitle,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
      setCurrentAudio(null);
    },
  });

  const completeSession = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sessions/${id}/complete`);
      return res.json();
    },
    onSuccess: () => {
      setLocation(`/report/${id}`);
    },
  });

  const handleTranscriptionComplete = useCallback((transcription: string, audioBase64?: string) => {
    setLocalTranscription(transcription);
    setIsTranscribing(false);
    if (audioBase64) {
      setCurrentAudio(audioBase64);
    }
    if (currentQuestion) {
      saveTranscription.mutate({ 
        questionId: currentQuestion.id, 
        transcription, 
        audio: audioBase64,
        questionTitle: currentQuestion.title,
      });
    }
  }, [currentQuestion, saveTranscription]);

  const handleTranscriptionStart = useCallback(() => {
    setIsTranscribing(true);
  }, []);

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      updateQuestion.mutate(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    // Save current transcription if edited (without audio - that was saved with the recording)
    if (localTranscription !== currentResponse?.transcription && currentQuestion) {
      saveTranscription.mutate({ 
        questionId: currentQuestion.id, 
        transcription: localTranscription,
        questionTitle: currentQuestion.title,
      });
    }
    
    if (currentQuestionIndex < questions.length - 1) {
      updateQuestion.mutate(currentQuestionIndex + 1);
    }
  };

  const handleComplete = () => {
    // Save current transcription if edited (without audio - that was saved with the recording)
    if (localTranscription !== currentResponse?.transcription && currentQuestion) {
      saveTranscription.mutate({ 
        questionId: currentQuestion.id, 
        transcription: localTranscription,
        questionTitle: currentQuestion.title,
      });
    }
    completeSession.mutate();
  };

  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = session?.responses?.filter((r) => r.isCompleted).length ?? 0;
  const isLastQuestion = questions.length > 0 && currentQuestionIndex === questions.length - 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Session not found</p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No questions available. Please contact support.</p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Question not found</p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
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
              <p className="font-medium text-sm">{session.clientName}</p>
              <p className="text-xs text-muted-foreground">Design Briefing</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {answeredCount} of {questions.length} answered
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-background border-b border-border/30">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-3">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className="text-xs font-medium text-primary">
              {categoryLabels[currentQuestion.category as QuestionCategory]}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
          {/* Question Card */}
          <Card className="mb-8">
            <CardContent className="p-6 md:p-8">
              <div className="mb-6">
                <h2 className="text-sm font-medium text-primary mb-2">
                  {currentQuestion.title}
                </h2>
                <p className="text-xl md:text-2xl font-semibold leading-relaxed" data-testid="text-question">
                  {currentQuestion.question}
                </p>
                {currentQuestion.helpText && (
                  <p className="text-sm text-muted-foreground mt-3">
                    {currentQuestion.helpText}
                  </p>
                )}
              </div>

              {/* Voice Recorder */}
              <div className="flex justify-center py-6">
                <VoiceRecorder
                  onTranscriptionComplete={handleTranscriptionComplete}
                  onTranscriptionStart={handleTranscriptionStart}
                  isTranscribing={isTranscribing}
                />
              </div>
            </CardContent>
          </Card>

          {/* Transcription Display/Edit */}
          {(localTranscription || isTranscribing) && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm font-medium text-primary">Transcribing...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Your Response</span>
                      {currentResponse?.isCompleted && (
                        <Check className="w-4 h-4 text-green-600 ml-auto" />
                      )}
                    </>
                  )}
                </div>
                <Textarea
                  value={localTranscription}
                  onChange={(e) => setLocalTranscription(e.target.value)}
                  placeholder="Your transcription will appear here..."
                  className="min-h-32 text-base resize-none"
                  disabled={isTranscribing}
                  data-testid="textarea-transcription"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  You can edit the transcription before continuing.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="border-t border-border bg-background sticky bottom-0">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0 || updateQuestion.isPending}
              data-testid="button-previous"
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex items-center gap-2">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => updateQuestion.mutate(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentQuestionIndex
                      ? "bg-primary"
                      : session.responses?.some((r) => r.questionId === questions[idx].id && r.isCompleted)
                      ? "bg-primary/40"
                      : "bg-muted"
                  }`}
                  data-testid={`button-question-dot-${idx}`}
                />
              ))}
            </div>

            {isLastQuestion ? (
              <Button
                onClick={handleComplete}
                disabled={completeSession.isPending}
                data-testid="button-complete"
                className="gap-2"
              >
                {completeSession.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <span>Complete</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={updateQuestion.isPending}
                data-testid="button-next"
                className="gap-2"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
