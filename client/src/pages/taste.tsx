import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import {
  tasteCategories,
  tasteCategoryOrder,
  type Session,
  type TasteSelection,
  type TasteProfile,
  type TasteQuad
} from "@shared/schema";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Star,
  ThumbsDown,
  SkipForward,
  Info,
} from "lucide-react";

interface SessionWithTasteData extends Session {
  selections?: TasteSelection[];
  profile?: TasteProfile | null;
}

interface QuadSelection {
  favorite1: number | null;
  favorite2: number | null;
  leastFavorite: number | null;
  isSkipped: boolean;
}

// Taste Exploration Page
export default function TastePage() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // State
  const [currentQuadIndex, setCurrentQuadIndex] = useState(0);
  const [selections, setSelections] = useState<Map<string, QuadSelection>>(new Map());
  const [selectionMode, setSelectionMode] = useState<'favorite1' | 'favorite2' | 'least' | 'done'>('favorite1');
  const [showInstructions, setShowInstructions] = useState(true);

  // Fetch session by access token
  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery<SessionWithTasteData>({
    queryKey: ["taste-session", token],
    queryFn: async () => {
      const res = await fetch(`/api/taste/session/${token}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load session");
      }
      return res.json();
    },
    enabled: !!token,
  });

  // Fetch quads data
  const { data: quads, isLoading: quadsLoading } = useQuery<TasteQuad[]>({
    queryKey: ["taste-quads"],
    queryFn: async () => {
      const res = await fetch("/api/taste/quads");
      if (!res.ok) throw new Error("Failed to load quads");
      return res.json();
    },
    enabled: !!session,
  });

  // Load existing selections from session
  useEffect(() => {
    if (session?.selections && session.selections.length > 0) {
      const existingSelections = new Map<string, QuadSelection>();
      session.selections.forEach((sel) => {
        existingSelections.set(sel.quadId, {
          favorite1: sel.favorite1,
          favorite2: sel.favorite2,
          leastFavorite: sel.leastFavorite,
          isSkipped: sel.isSkipped,
        });
      });
      setSelections(existingSelections);

      // Find first incomplete quad
      if (quads) {
        const firstIncomplete = quads.findIndex((quad) => {
          const sel = existingSelections.get(quad.quadId);
          return !sel || (!sel.isSkipped && (sel.favorite1 === null || sel.favorite2 === null || sel.leastFavorite === null));
        });
        if (firstIncomplete >= 0) {
          setCurrentQuadIndex(firstIncomplete);
        }
      }
    }
  }, [session?.selections, quads]);

  // Save selection mutation
  const saveSelectionMutation = useMutation({
    mutationFn: async ({ quadId, selection }: { quadId: string; selection: QuadSelection }) => {
      const res = await fetch(`/api/taste/sessions/${session!.id}/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quadId,
          favorite1: selection.favorite1,
          favorite2: selection.favorite2,
          leastFavorite: selection.leastFavorite,
          isSkipped: selection.isSkipped,
        }),
      });
      if (!res.ok) throw new Error("Failed to save selection");
      return res.json();
    },
  });

  // Complete session mutation
  const completeSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/taste/sessions/${session!.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to complete session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taste-session", token] });
      navigate(`/taste/${token}/results`);
    },
  });

  // Current quad
  const currentQuad = quads?.[currentQuadIndex];
  const currentSelection = currentQuad ? selections.get(currentQuad.quadId) : null;

  // Get category info for current quad
  const getCurrentCategory = () => {
    if (!currentQuad) return null;
    return tasteCategories[currentQuad.category];
  };

  // Handle image click
  const handleImageClick = (imageIndex: number) => {
    if (!currentQuad) return;

    const current = selections.get(currentQuad.quadId) || {
      favorite1: null,
      favorite2: null,
      leastFavorite: null,
      isSkipped: false,
    };

    // Check if this image is already selected in another role
    const isAlreadySelected =
      current.favorite1 === imageIndex ||
      current.favorite2 === imageIndex ||
      current.leastFavorite === imageIndex;

    if (isAlreadySelected) return; // Can't select same image twice

    let newSelection = { ...current };

    switch (selectionMode) {
      case 'favorite1':
        newSelection.favorite1 = imageIndex;
        setSelectionMode('favorite2');
        break;
      case 'favorite2':
        newSelection.favorite2 = imageIndex;
        setSelectionMode('least');
        break;
      case 'least':
        newSelection.leastFavorite = imageIndex;
        setSelectionMode('done');
        break;
      default:
        return;
    }

    newSelection.isSkipped = false;
    setSelections(new Map(selections).set(currentQuad.quadId, newSelection));

    // Auto-save when selection is complete
    if (selectionMode === 'least') {
      saveSelectionMutation.mutate({ quadId: currentQuad.quadId, selection: newSelection });
    }
  };

  // Handle skip
  const handleSkip = () => {
    if (!currentQuad) return;
    const newSelection: QuadSelection = {
      favorite1: null,
      favorite2: null,
      leastFavorite: null,
      isSkipped: true,
    };
    setSelections(new Map(selections).set(currentQuad.quadId, newSelection));
    saveSelectionMutation.mutate({ quadId: currentQuad.quadId, selection: newSelection });
    moveToNextQuad();
  };

  // Handle clear selection
  const handleClear = () => {
    if (!currentQuad) return;
    setSelections(new Map(selections).set(currentQuad.quadId, {
      favorite1: null,
      favorite2: null,
      leastFavorite: null,
      isSkipped: false,
    }));
    setSelectionMode('favorite1');
  };

  // Navigation
  const moveToNextQuad = useCallback(() => {
    if (!quads) return;
    if (currentQuadIndex < quads.length - 1) {
      setCurrentQuadIndex(currentQuadIndex + 1);
      setSelectionMode('favorite1');
    }
  }, [currentQuadIndex, quads]);

  const moveToPrevQuad = () => {
    if (currentQuadIndex > 0) {
      setCurrentQuadIndex(currentQuadIndex - 1);
      setSelectionMode('favorite1');
    }
  };

  // Auto-advance when selection is complete
  useEffect(() => {
    if (selectionMode === 'done' && currentQuad) {
      const timer = setTimeout(() => {
        moveToNextQuad();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectionMode, currentQuad, moveToNextQuad]);

  // Calculate progress
  const completedCount = Array.from(selections.values()).filter(
    (s) => s.isSkipped || (s.favorite1 !== null && s.favorite2 !== null && s.leastFavorite !== null)
  ).length;
  const totalQuads = quads?.length || 36;
  const progressPercent = (completedCount / totalQuads) * 100;

  // Check if all quads are complete
  const isAllComplete = completedCount === totalQuads;

  // Handle complete
  const handleComplete = () => {
    completeSessionMutation.mutate();
  };

  // Loading states
  if (sessionLoading || quadsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1a365d] mx-auto mb-4" />
          <p className="text-gray-600">Loading your Taste Exploration...</p>
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold text-[#1a365d] mb-4">Session Not Found</h1>
          <p className="text-gray-600 mb-6">
            This link may be expired or invalid. Please check your invitation email for the correct link.
          </p>
          <a href="https://not-4.sale" className="text-[#C9A962] hover:underline">
            Visit N4S →
          </a>
        </div>
      </div>
    );
  }

  // Already completed
  if (session.status === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a365d] mb-4">Exploration Complete</h1>
          <p className="text-gray-600 mb-6">
            Thank you for completing your Taste Exploration. Your design preferences have been recorded and sent to your advisor.
          </p>
          <a href="https://not-4.sale" className="text-[#C9A962] hover:underline">
            Visit N4S →
          </a>
        </div>
      </div>
    );
  }

  const category = getCurrentCategory();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#1a365d] text-white px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">N4S</div>
            <div className="text-xs text-white/70">Taste Exploration</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">{session.clientName}</div>
            <div className="text-xs text-white/70">
              {completedCount} of {totalQuads} complete
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A962] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 min-w-[60px]">
              {Math.round(progressPercent)}%
            </span>
          </div>
        </div>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-[#1a365d] mb-4">How It Works</h2>
            <div className="space-y-4 text-gray-600">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#C9A962] rounded-full flex items-center justify-center flex-shrink-0">
                  <Star className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">1. Choose Your Favorite</div>
                  <p className="text-sm">Click on the image you like best from the four options.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#C9A962]/70 rounded-full flex items-center justify-center flex-shrink-0">
                  <Star className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">2. Choose Your Second Favorite</div>
                  <p className="text-sm">Click on your next preferred option.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <ThumbsDown className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">3. Choose Your Least Favorite</div>
                  <p className="text-sm">Click on the image you like least.</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 italic">
                Trust your instincts — there are no right or wrong answers!
              </p>
            </div>
            <Button
              onClick={() => setShowInstructions(false)}
              className="w-full mt-6 bg-[#1a365d] hover:bg-[#1a365d]/90"
            >
              Begin Exploration
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Category Header */}
        {category && (
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 mb-2">
              <span className="text-xl">{category.icon}</span>
              <span className="font-semibold text-[#1a365d]">{category.name}</span>
            </div>
            <p className="text-sm text-gray-500">{category.description}</p>
            <p className="text-xs text-gray-400 mt-1">
              Quad {currentQuadIndex + 1} of {totalQuads}
            </p>
          </div>
        )}

        {/* Selection Mode Indicator */}
        <div className="flex justify-center gap-4 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
            selectionMode === 'favorite1' ? 'bg-[#C9A962] text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <Star className="h-4 w-4" />
            <span>Favorite</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
            selectionMode === 'favorite2' ? 'bg-[#C9A962]/70 text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <Star className="h-4 w-4" />
            <span>2nd Favorite</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
            selectionMode === 'least' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <ThumbsDown className="h-4 w-4" />
            <span>Least</span>
          </div>
        </div>

        {/* Quad Grid */}
        {currentQuad && (
          <div className="grid grid-cols-2 gap-3 md:gap-4 max-w-3xl mx-auto">
            {currentQuad.images.map((imageUrl, index) => {
              const isFavorite1 = currentSelection?.favorite1 === index;
              const isFavorite2 = currentSelection?.favorite2 === index;
              const isLeast = currentSelection?.leastFavorite === index;
              const isSelected = isFavorite1 || isFavorite2 || isLeast;

              return (
                <button
                  key={index}
                  onClick={() => handleImageClick(index)}
                  disabled={selectionMode === 'done' || isSelected}
                  className={`relative aspect-[4/3] rounded-xl overflow-hidden transition-all group ${
                    isSelected
                      ? 'ring-4 ' + (isFavorite1 ? 'ring-[#C9A962]' : isFavorite2 ? 'ring-[#C9A962]/70' : 'ring-gray-400')
                      : selectionMode !== 'done' ? 'hover:ring-2 hover:ring-[#1a365d]/30 cursor-pointer' : ''
                  }`}
                >
                  <img
                    src={imageUrl}
                    alt={`Option ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Selection Badge */}
                  {isSelected && (
                    <div className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center ${
                      isFavorite1 ? 'bg-[#C9A962]' : isFavorite2 ? 'bg-[#C9A962]/70' : 'bg-gray-500'
                    }`}>
                      {isFavorite1 && <span className="text-white text-sm font-bold">1</span>}
                      {isFavorite2 && <span className="text-white text-sm font-bold">2</span>}
                      {isLeast && <ThumbsDown className="h-4 w-4 text-white" />}
                    </div>
                  )}

                  {/* Hover Overlay */}
                  {!isSelected && selectionMode !== 'done' && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-3 mt-6">
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={!currentSelection || (
              currentSelection.favorite1 === null &&
              currentSelection.favorite2 === null &&
              currentSelection.leastFavorite === null
            )}
          >
            Clear Selection
          </Button>
          <Button
            variant="outline"
            onClick={handleSkip}
            className="gap-2"
          >
            <SkipForward className="h-4 w-4" />
            Skip This Set
          </Button>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="bg-white border-t border-gray-200 px-4 py-4 sticky bottom-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={moveToPrevQuad}
            disabled={currentQuadIndex === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInstructions(true)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <Info className="h-5 w-5" />
            </button>
          </div>

          {isAllComplete ? (
            <Button
              onClick={handleComplete}
              disabled={completeSessionMutation.isPending}
              className="bg-[#C9A962] hover:bg-[#C9A962]/90 gap-2"
            >
              {completeSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Complete
            </Button>
          ) : (
            <Button
              onClick={moveToNextQuad}
              disabled={currentQuadIndex === (quads?.length || 0) - 1}
              className="bg-[#1a365d] hover:bg-[#1a365d]/90 gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
