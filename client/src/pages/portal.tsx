/**
 * Portal Dashboard Page
 *
 * Main client portal dashboard showing project progress,
 * deliverables, and sign-off status.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  LogOut,
  Loader2,
  CheckCircle2,
  Circle,
  Lock,
  FileText,
  Download,
  AlertCircle,
  ChevronRight,
  Users,
  Search,
  ClipboardCheck,
  Map,
  MapPin,
  DollarSign,
} from 'lucide-react';

interface PortalData {
  project: {
    name: string;
    clientName: string;
  };
  parker: {
    greetingStyle: 'professional' | 'friendly' | 'formal';
    customWelcome: string;
  };
  progress: {
    currentPhase: number;
    percentage: number;
    completedModules: number;
    totalModules: number;
  };
  phases: {
    p1Complete: boolean;
    p2Unlocked: boolean;
    p3Unlocked: boolean;
  };
  modules: Record<string, ModuleData>;
  role: 'client' | 'advisor';
}

interface ModuleData {
  visible: boolean;
  signed: boolean;
  signedAt: string | null;
  deliverables: Record<string, boolean>;
  pdfUrls?: Record<string, string>;
  kycCompleted?: boolean;
  partnerAlignmentScore?: number;
  totalSqFt?: number;
  budgetRange?: string;
}

// Module metadata
const moduleInfo: Record<string, { label: string; fullName: string; icon: any; color: string }> = {
  kyc: { label: 'KYC', fullName: 'Know Your Client', icon: Users, color: '#315098' },
  fyi: { label: 'FYI', fullName: 'Find Your Inspiration', icon: Search, color: '#8CA8BE' },
  mvp: { label: 'MVP', fullName: 'Mansion Validation', icon: ClipboardCheck, color: '#AFBDB0' },
  kym: { label: 'KYM', fullName: 'Know Your Market', icon: Map, color: '#E4C0BE' },
  kys: { label: 'KYS', fullName: 'Know Your Site', icon: MapPin, color: '#C4A484' },
  vmx: { label: 'VMX', fullName: 'Vision Matrix', icon: DollarSign, color: '#FBD0E0' },
};

export default function Portal() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOff, setSigningOff] = useState<string | null>(null);

  // Check authentication and load data
  useEffect(() => {
    const token = sessionStorage.getItem('portalToken');
    if (!token) {
      navigate('/login');
      return;
    }

    async function loadData() {
      try {
        const res = await fetch('/api/portal/data', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          sessionStorage.removeItem('portalToken');
          sessionStorage.removeItem('portalRole');
          navigate('/login');
          return;
        }

        if (!res.ok) {
          setError('Unable to load portal data');
          return;
        }

        const portalData = await res.json();
        setData(portalData);
      } catch (err) {
        setError('Unable to connect to portal');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [navigate]);

  // Handle logout
  const handleLogout = async () => {
    const token = sessionStorage.getItem('portalToken');
    if (token) {
      await fetch('/api/portal/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    sessionStorage.removeItem('portalToken');
    sessionStorage.removeItem('portalRole');
    navigate('/login');
  };

  // Handle sign-off
  const handleSignOff = async (module: string) => {
    const token = sessionStorage.getItem('portalToken');
    if (!token) return;

    setSigningOff(module);
    try {
      const res = await fetch(`/api/portal/sign-off/${module}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to sign off');
        return;
      }

      // Reload data to reflect changes
      const dataRes = await fetch('/api/portal/data', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (dataRes.ok) {
        setData(await dataRes.json());
      }
    } catch (err) {
      alert('Failed to sign off. Please try again.');
    } finally {
      setSigningOff(null);
    }
  };

  // Get Parker greeting
  const getParkerGreeting = () => {
    if (!data) return '';

    if (data.parker.customWelcome) {
      return data.parker.customWelcome;
    }

    const { percentage, completedModules, totalModules } = data.progress;
    const clientName = data.project.clientName;

    if (completedModules === 0) {
      switch (data.parker.greetingStyle) {
        case 'friendly':
          return `Hey ${clientName}! 🐼 Exciting times ahead - let's start building your vision!`;
        case 'formal':
          return `Welcome. Your luxury residence journey begins here. Please review the available deliverables.`;
        default:
          return `Welcome, ${clientName}. I'm here to guide you through each milestone of your luxury residence project.`;
      }
    }

    if (percentage === 100) {
      return `Congratulations, ${clientName}! Phase 1 is complete. Your vision is taking shape beautifully.`;
    }

    return `Great progress, ${clientName}! You've completed ${completedModules} of ${totalModules} milestones. Keep the momentum going!`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#c9a227]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-lg mb-4">{error || 'Something went wrong'}</p>
          <Button onClick={() => navigate('/login')} variant="outline">
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  const moduleOrder = ['kyc', 'fyi', 'mvp', 'kym', 'kys', 'vmx'];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-[#333] bg-[#111] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/panda-assets/PANDA.png"
              alt="Parker"
              className="w-10 h-10 rounded-full border-2 border-[#c9a227]"
            />
            <div>
              <h1 className="text-lg font-bold tracking-wide">LuXeBrief</h1>
              <p className="text-sm text-gray-400">{data.project.name}</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="text-gray-400 hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Parker Welcome */}
        <Card className="bg-gradient-to-r from-[#1a1a1a] to-[#252525] border-[#333]">
          <CardContent className="p-6 flex items-start gap-4">
            <img
              src="/panda-assets/PANDA.png"
              alt="Parker"
              className="w-16 h-16 rounded-full border-2 border-[#c9a227] flex-shrink-0"
            />
            <div>
              <p className="text-gray-300 text-lg leading-relaxed">
                {getParkerGreeting()}
              </p>
              {data.role === 'advisor' && (
                <span className="inline-block mt-2 text-xs bg-[#c9a227]/20 text-[#c9a227] px-2 py-1 rounded">
                  Viewing as Advisor
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Overview */}
        <Card className="bg-[#1a1a1a] border-[#333]">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">
              Phase {data.progress.currentPhase}: Ask the Right Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Overall Progress</span>
                <span className="text-[#c9a227] font-semibold">
                  {data.progress.percentage}%
                </span>
              </div>
              <Progress
                value={data.progress.percentage}
                className="h-2 bg-[#333]"
              />
            </div>

            {/* Module Progress Dots */}
            <div className="flex items-center justify-between pt-4">
              {moduleOrder.map((module, index) => {
                const moduleData = data.modules[module];
                const info = moduleInfo[module];
                const Icon = info.icon;
                const isComplete = moduleData?.signed;
                const isVisible = moduleData?.visible;

                return (
                  <div key={module} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                          isComplete
                            ? 'bg-green-600/20 border-green-500'
                            : isVisible
                            ? 'bg-[#c9a227]/20 border-[#c9a227]'
                            : 'bg-[#333] border-[#555]'
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : isVisible ? (
                          <Icon className="w-5 h-5 text-[#c9a227]" />
                        ) : (
                          <Lock className="w-4 h-4 text-gray-600" />
                        )}
                      </div>
                      <span
                        className={`text-xs mt-1 font-medium ${
                          isComplete
                            ? 'text-green-500'
                            : isVisible
                            ? 'text-[#c9a227]'
                            : 'text-gray-600'
                        }`}
                      >
                        {info.label}
                      </span>
                    </div>
                    {index < moduleOrder.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-[#555] mx-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Modules Accordion */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-100">
            Documents & Deliverables
          </h2>

          <Accordion type="single" collapsible className="space-y-2">
            {moduleOrder.map((module) => {
              const moduleData = data.modules[module];
              const info = moduleInfo[module];
              const Icon = info.icon;

              if (!moduleData?.visible) {
                return (
                  <Card key={module} className="bg-[#151515] border-[#2a2a2a]">
                    <div className="p-4 flex items-center justify-between opacity-50">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${info.color}20` }}
                        >
                          <Lock className="w-5 h-5" style={{ color: info.color }} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-400">{info.label}</p>
                          <p className="text-sm text-gray-600">{info.fullName}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-600">Coming Soon</span>
                    </div>
                  </Card>
                );
              }

              return (
                <AccordionItem
                  key={module}
                  value={module}
                  className="border-0"
                >
                  <Card className="bg-[#1a1a1a] border-[#333]">
                    <AccordionTrigger className="p-4 hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${info.color}30` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: info.color }} />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-100">{info.label}</p>
                          <p className="text-sm text-gray-500">{info.fullName}</p>
                        </div>
                      </div>
                      {/* Show completion status based on data (kycCompleted) not sign-off */}
                      {module === 'kyc' ? (
                        moduleData.kycCompleted ? (
                          <span className="flex items-center gap-1 text-xs text-green-500 bg-green-900/30 px-2 py-1 rounded mr-2">
                            <CheckCircle2 className="w-3 h-3" />
                            Complete
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-[#c9a227] bg-[#c9a227]/20 px-2 py-1 rounded mr-2">
                            <Circle className="w-3 h-3" />
                            In Progress
                          </span>
                        )
                      ) : moduleData.signed ? (
                        <span className="flex items-center gap-1 text-xs text-green-500 bg-green-900/30 px-2 py-1 rounded mr-2">
                          <CheckCircle2 className="w-3 h-3" />
                          Signed Off
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-[#c9a227] bg-[#c9a227]/20 px-2 py-1 rounded mr-2">
                          <Circle className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {/* Deliverables */}
                      <div className="space-y-3">
                        {Object.entries(moduleData.deliverables).map(([key, available]) => {
                          // Format display name: camelCase to Title Case
                          const displayName = key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, str => str.toUpperCase())
                            .trim();

                          // Get PDF URL for this deliverable
                          const pdfUrl = moduleData.pdfUrls?.[key];

                          // Handle View button click - open PDF in new tab
                          const handleView = () => {
                            if (pdfUrl) {
                              const token = sessionStorage.getItem('portalToken');
                              // Open PDF with auth token
                              window.open(`${pdfUrl}?token=${token}`, '_blank');
                            }
                          };

                          return (
                            <div
                              key={key}
                              className={`flex items-center justify-between p-3 rounded-lg ${
                                available ? 'bg-[#252525]' : 'bg-[#151515] opacity-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <FileText
                                  className={`w-5 h-5 ${
                                    available ? 'text-[#c9a227]' : 'text-gray-600'
                                  }`}
                                />
                                <span className="text-sm text-gray-300">
                                  {displayName}
                                </span>
                              </div>
                              {available ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-[#c9a227] hover:text-[#d4af37]"
                                  onClick={handleView}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              ) : (
                                <span className="text-xs text-gray-600">
                                  Not Available
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Sign-off Button */}
                      {!moduleData.signed && (
                        <div className="mt-4 pt-4 border-t border-[#333]">
                          <Button
                            onClick={() => handleSignOff(module)}
                            disabled={signingOff === module}
                            className="w-full bg-[#c9a227] hover:bg-[#d4af37] text-black"
                          >
                            {signingOff === module ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Signing Off...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Sign Off on {info.label}
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Signed confirmation */}
                      {moduleData.signed && moduleData.signedAt && (
                        <div className="mt-4 pt-4 border-t border-[#333]">
                          <p className="text-sm text-green-500 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Signed off on{' '}
                            {new Date(moduleData.signedAt).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-600 text-xs py-8">
          <p>Powered by N4S • Luxury Residential Advisory</p>
          <p className="mt-1">© 2026 Not4Sale LLC. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
