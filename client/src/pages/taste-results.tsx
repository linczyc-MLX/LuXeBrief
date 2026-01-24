import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, Star, Download } from "lucide-react";
import type { Session, TasteProfile, TasteSelection } from "@shared/schema";
import { downloadTasteReport } from "../utils/TasteReportGenerator";

interface SessionWithProfile extends Session {
  profile?: TasteProfile | null;
  selections?: TasteSelection[];
}

// Axis descriptions for display
const axisInfo = {
  warmth: {
    label: "Warmth",
    low: "Cool",
    high: "Warm",
    description: "Color temperature preference from cool blues/grays to warm earth tones",
  },
  formality: {
    label: "Formality",
    low: "Casual",
    high: "Formal",
    description: "Level of refinement from relaxed comfort to structured elegance",
  },
  drama: {
    label: "Drama",
    low: "Subtle",
    high: "Dramatic",
    description: "Visual impact from understated simplicity to bold statements",
  },
  tradition: {
    label: "Tradition",
    low: "Contemporary",
    high: "Traditional",
    description: "Style era preference from modern design to classic heritage",
  },
  openness: {
    label: "Openness",
    low: "Defined",
    high: "Open",
    description: "Spatial flow preference from defined rooms to open-concept layouts",
  },
  artFocus: {
    label: "Art Integration",
    low: "Minimal",
    high: "Art-Centric",
    description: "Role of art from architectural simplicity to gallery-like display",
  },
};

function ScoreBar({ label, score, low, high, description }: {
  label: string;
  score: number;
  low: string;
  high: string;
  description: string;
}) {
  // Score is 1-100, convert to percentage
  const percent = Math.max(0, Math.min(100, score));

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-medium text-[#1a365d]">{label}</span>
        <span className="text-sm text-gray-500">{percent}/100</span>
      </div>
      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1a365d] to-[#C9A962] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-400">{low}</span>
        <span className="text-xs text-gray-400">{high}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}

export default function TasteResultsPage() {
  const { token } = useParams<{ token: string }>();
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch session with profile
  const { data: session, isLoading, error } = useQuery<SessionWithProfile>({
    queryKey: ["taste-session", token],
    queryFn: async () => {
      const res = await fetch(`/api/taste/session/${token}`);
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1a365d] mx-auto mb-4" />
          <p className="text-gray-600">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold text-[#1a365d] mb-4">Session Not Found</h1>
          <p className="text-gray-600 mb-6">
            This link may be expired or invalid.
          </p>
          <a href="https://not-4.sale" className="text-[#C9A962] hover:underline">
            Visit N4S →
          </a>
        </div>
      </div>
    );
  }

  const profile = session.profile;

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold text-[#1a365d] mb-4">Not Yet Complete</h1>
          <p className="text-gray-600 mb-6">
            Please complete your Taste Exploration to see your results.
          </p>
          <a href={`/taste/${token}`} className="text-[#C9A962] hover:underline">
            Continue Exploration →
          </a>
        </div>
      </div>
    );
  }

  // Parse top materials if it's a JSON string
  let topMaterials: string[] = [];
  if (profile.topMaterials) {
    try {
      topMaterials = JSON.parse(profile.topMaterials);
    } catch {
      topMaterials = [];
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1a365d] text-white px-4 py-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 bg-[#C9A962] rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Your Design DNA</h1>
          <p className="text-white/70">
            {session.clientName}'s Taste Profile
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Stats Summary */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#1a365d] mb-4">Exploration Summary</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-[#1a365d]">{profile.completedQuads}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-400">{profile.skippedQuads}</div>
              <div className="text-sm text-gray-500">Skipped</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#C9A962]">{profile.totalQuads}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
          </div>
        </div>

        {/* Design Axes */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#1a365d] mb-6">Design Preferences</h2>

          <ScoreBar
            label={axisInfo.warmth.label}
            score={profile.warmthScore ?? 50}
            low={axisInfo.warmth.low}
            high={axisInfo.warmth.high}
            description={axisInfo.warmth.description}
          />

          <ScoreBar
            label={axisInfo.formality.label}
            score={profile.formalityScore ?? 50}
            low={axisInfo.formality.low}
            high={axisInfo.formality.high}
            description={axisInfo.formality.description}
          />

          <ScoreBar
            label={axisInfo.drama.label}
            score={profile.dramaScore ?? 50}
            low={axisInfo.drama.low}
            high={axisInfo.drama.high}
            description={axisInfo.drama.description}
          />

          <ScoreBar
            label={axisInfo.tradition.label}
            score={profile.traditionScore ?? 50}
            low={axisInfo.tradition.low}
            high={axisInfo.tradition.high}
            description={axisInfo.tradition.description}
          />

          <ScoreBar
            label={axisInfo.openness.label}
            score={profile.opennessScore ?? 50}
            low={axisInfo.openness.low}
            high={axisInfo.openness.high}
            description={axisInfo.openness.description}
          />

          <ScoreBar
            label={axisInfo.artFocus.label}
            score={profile.artFocusScore ?? 50}
            low={axisInfo.artFocus.low}
            high={axisInfo.artFocus.high}
            description={axisInfo.artFocus.description}
          />
        </div>

        {/* Top Materials */}
        {topMaterials.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#1a365d] mb-4">Preferred Materials</h2>
            <div className="flex flex-wrap gap-2">
              {topMaterials.map((material, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1a365d]/10 text-[#1a365d] text-sm"
                >
                  <Star className="h-3 w-3 text-[#C9A962]" />
                  {material}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Thank You */}
        <div className="text-center py-8">
          <p className="text-gray-600 mb-6">
            Your taste profile has been saved. Your N4S advisor can view these results in the KYC portal by clicking "Refresh Status" in the Design Preferences section.
          </p>
          <button
            onClick={async () => {
              if (!session || !profile) return;
              setIsDownloading(true);
              try {
                await downloadTasteReport(
                  {
                    clientName: session.clientName,
                    projectName: session.projectName,
                    completedAt: session.completedAt,
                  },
                  profile,
                  session.selections || []
                );
              } catch (err) {
                console.error("Failed to download PDF:", err);
              } finally {
                setIsDownloading(false);
              }
            }}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a365d] text-white rounded-lg font-semibold hover:bg-[#1a365d]/90 transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            Download PDF
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-4 py-4 text-center text-xs text-gray-500">
        © 2026 N4S Luxury Residential Advisory. All rights reserved.
      </footer>
    </div>
  );
}
