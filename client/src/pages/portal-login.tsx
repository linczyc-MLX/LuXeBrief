/**
 * Portal Login Page
 *
 * Client portal login with Parker the Panda branding.
 * Uses subdomain to identify the project.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';

interface PortalConfig {
  slug: string;
  projectName: string;
  clientName: string;
  parker: {
    greetingStyle: 'professional' | 'friendly' | 'formal';
    customWelcome: string;
  };
  active: boolean;
}

export default function PortalLogin() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'client' | 'advisor'>('client');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Load portal configuration on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/portal/config');
        if (!res.ok) {
          if (res.status === 404) {
            setError('Portal not found. Please check the URL.');
          } else if (res.status === 403) {
            setError('This portal is not currently active.');
          } else {
            setError('Unable to load portal. Please try again.');
          }
          return;
        }
        const data = await res.json();
        setConfig(data);
      } catch (err) {
        setError('Unable to connect to portal. Please try again.');
      } finally {
        setConfigLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid password');
        setLoading(false);
        return;
      }

      // Store token and navigate to dashboard
      sessionStorage.setItem('portalToken', data.token);
      sessionStorage.setItem('portalRole', data.role);
      navigate('/portal');
    } catch (err) {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get Parker greeting based on style
  const getParkerGreeting = () => {
    if (config?.parker.customWelcome) {
      return config.parker.customWelcome;
    }

    const clientName = config?.clientName || 'there';

    switch (config?.parker.greetingStyle) {
      case 'friendly':
        return `Hey ${clientName}! Parker here. Ready to explore your dream home journey?`;
      case 'formal':
        return `Good day. Welcome to your LuXeBrief portal. Please authenticate to proceed.`;
      default: // professional
        return `Welcome, ${clientName}. I'm Parker, your personal guide through the LuXeBrief experience.`;
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#c9a227]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-[#333] bg-[#111]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <img
            src="/panda-assets/PANDA.png"
            alt="Parker the Panda"
            className="w-12 h-12 rounded-full border-2 border-[#c9a227]"
          />
          <div>
            <h1 className="text-xl font-bold tracking-wide">LuXeBrief</h1>
            <p className="text-sm text-gray-400">
              {config?.projectName || 'Your Project'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-6 py-16">
        {/* Parker Avatar & Greeting */}
        <div className="text-center mb-10">
          <img
            src="/panda-assets/PANDA.png"
            alt="Parker"
            className="w-24 h-24 mx-auto mb-4 rounded-full border-4 border-[#c9a227] shadow-lg shadow-[#c9a227]/20"
          />
          <p className="text-gray-300 text-lg leading-relaxed">
            {getParkerGreeting()}
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-[#1a1a1a] border-[#333]">
          <CardContent className="p-6">
            {error && !config && (
              <div className="flex items-center gap-2 text-red-400 mb-4 p-3 bg-red-900/20 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            {config && (
              <form onSubmit={handleLogin} className="space-y-6">
                {/* Role Selection */}
                <div className="flex gap-2 p-1 bg-[#0a0a0a] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setRole('client')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      role === 'client'
                        ? 'bg-[#c9a227] text-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('advisor')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      role === 'advisor'
                        ? 'bg-[#c9a227] text-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Advisor
                  </button>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your access code"
                      className="pl-10 bg-[#0a0a0a] border-[#333] text-white placeholder:text-gray-600 focus:border-[#c9a227] focus:ring-[#c9a227]/20"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full bg-[#c9a227] hover:bg-[#d4af37] text-black font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    'Enter Portal'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-8">
          Powered by N4S • Luxury Residential Advisory
        </p>
      </main>
    </div>
  );
}
