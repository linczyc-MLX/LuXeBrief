import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onTranscriptionComplete: (transcription: string, audioBase64?: string) => void;
  onTranscriptionStart: () => void;
  isTranscribing: boolean;
}

type RecordingState = "idle" | "recording" | "processing";

export function VoiceRecorder({
  onTranscriptionComplete,
  onTranscriptionStart,
  isTranscribing,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      recorder.start(100);
      setState("recording");
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setError("Could not access microphone. Please grant permission.");
      console.error("Microphone access error:", err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
      return;
    }

    return new Promise<Blob>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        resolve(blob);
      };
      
      recorder.stop();
    });
  }, []);

  const handleRecordClick = useCallback(async () => {
    if (state === "idle") {
      await startRecording();
    } else if (state === "recording") {
      setState("processing");
      onTranscriptionStart();
      
      const blob = await stopRecording();
      
      if (blob && blob.size > 0) {
        try {
          // Convert blob to base64
          const reader = new FileReader();
          const base64Audio = await new Promise<string>((resolve) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1]);
            };
            reader.readAsDataURL(blob);
          });

          // Send to transcription endpoint
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64Audio }),
          });

          if (!response.ok) {
            throw new Error("Transcription failed");
          }

          const data = await response.json();
          onTranscriptionComplete(data.transcription, base64Audio);
        } catch (err) {
          setError("Failed to transcribe audio. Please try again.");
          console.error("Transcription error:", err);
        }
      }
      
      setState("idle");
      setDuration(0);
    }
  }, [state, startRecording, stopRecording, onTranscriptionStart, onTranscriptionComplete]);

  const handleReset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    setState("idle");
    setDuration(0);
    setError(null);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isProcessing = state === "processing" || isTranscribing;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main Record Button */}
      <button
        onClick={handleRecordClick}
        disabled={isProcessing}
        className={cn(
          "relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          state === "idle" && "bg-primary/10 hover:bg-primary/20 border-2 border-primary",
          state === "recording" && "bg-destructive animate-pulse",
          isProcessing && "bg-muted cursor-not-allowed"
        )}
        data-testid="button-record"
      >
        {isProcessing ? (
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        ) : state === "recording" ? (
          <Square className="w-6 h-6 text-destructive-foreground fill-current" />
        ) : (
          <Mic className="w-8 h-8 text-primary" />
        )}
        
        {/* Recording pulse effect */}
        {state === "recording" && (
          <span className="absolute inset-0 rounded-full bg-destructive/50 animate-ping" />
        )}
      </button>

      {/* Status Text */}
      <div className="text-center">
        {isProcessing ? (
          <p className="text-sm text-muted-foreground" data-testid="text-transcribing">Transcribing your response...</p>
        ) : state === "recording" ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-destructive" data-testid="text-recording-status">Recording</p>
            <p className="text-lg font-mono tabular-nums" data-testid="text-duration">
              {formatDuration(duration)}
            </p>
            <p className="text-xs text-muted-foreground">Click to stop</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="text-record-prompt">
            Click to record your response
          </p>
        )}
      </div>

      {/* Reset Button (during recording) */}
      {state === "recording" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-2 text-muted-foreground"
          data-testid="button-reset-recording"
        >
          <RotateCcw className="w-4 h-4" />
          Cancel
        </Button>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive text-center max-w-xs" data-testid="text-error">{error}</p>
      )}
    </div>
  );
}
