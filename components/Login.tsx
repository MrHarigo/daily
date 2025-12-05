'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function Login() {
  const { hasExistingUser, register, login } = useAuthStore();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await login();
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== 'NotAllowedError') {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await register(username.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-accent mb-2">Daily</h1>
          <p className="text-gray-500">Track your habits. Build your streak.</p>
        </div>

        <div className="card">
          {hasExistingUser ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
                  <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">Welcome back</h2>
                <p className="text-gray-400 text-sm">Use Touch ID to continue</p>
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-center">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              <button onClick={handleLogin} disabled={isLoading} className="btn btn-primary w-full py-3 text-lg">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-surface-900 border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                    Authenticate with Touch ID
                  </span>
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold mb-2">Get Started</h2>
                <p className="text-gray-400 text-sm">Set up your account with Touch ID</p>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
                <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name" className="input w-full" autoFocus />
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-center">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              <button type="submit" disabled={isLoading || !username.trim()} className="btn btn-primary w-full py-3">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-surface-900 border-t-transparent rounded-full animate-spin" />
                    Setting up...
                  </span>
                ) : 'Continue with Touch ID'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-8">
          Secured with WebAuthn • Your fingerprint never leaves your device
        </p>
      </div>
    </div>
  );
}

