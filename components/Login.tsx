'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

type Step = 'initial' | 'email' | 'code' | 'username' | 'passkey';

export function Login() {
  const { sendCode, verifyCode, registerPasskey, loginWithPasskey, directPasskeyLogin, reset } = useAuthStore();
  
  const [step, setStep] = useState<Step>('initial');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [username, setUsername] = useState('');
  const [existingUsername, setExistingUsername] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Focus first code input when entering code step
  useEffect(() => {
    if (step === 'code') {
      codeInputRefs.current[0]?.focus();
    }
  }, [step]);

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || cooldown > 0) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendCode(email.trim().toLowerCase());
      setIsNewUser(result.isNewUser);
      setStep('code');
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    
    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only last digit
    setCode(newCode);
    
    // Auto-advance to next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when complete
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      handleVerifyCode(pasted);
    }
  };

  const handleVerifyCode = async (codeStr: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyCode(email, codeStr);
      setIsNewUser(result.isNewUser);
      
      if (result.isNewUser) {
        setStep('username');
      } else {
        // Existing user - check if they have passkey for this device
        setExistingUsername(result.username || null);
        setStep('passkey');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      setCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 2) return;
    setStep('passkey');
  };

  const handleRegisterPasskey = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await registerPasskey(isNewUser ? username.trim() : undefined);
    } catch (err) {
      if ((err as { name?: string })?.name !== 'NotAllowedError') {
        setError(err instanceof Error ? err.message : 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginPasskey = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await loginWithPasskey();
    } catch (err) {
      // If login fails (no passkey on this device), offer to register a new one
      if ((err as { name?: string })?.name === 'NotAllowedError') {
        // User cancelled - don't show error
      } else {
        setError('No passkey found for this device. Register a new one below.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 'email') {
      setStep('initial');
    } else if (step === 'code') {
      setStep('email');
      setCode(['', '', '', '', '', '']);
    } else if (step === 'username') {
      setStep('code');
    } else if (step === 'passkey') {
      if (isNewUser) {
        setStep('username');
      } else {
        setStep('code');
      }
    }
  };

  const handleStartOver = () => {
    reset();
    setStep('initial');
    setEmail('');
    setCode(['', '', '', '', '', '']);
    setUsername('');
    setExistingUsername(null);
    setIsNewUser(false);
    setError(null);
  };

  const handleDirectPasskeyLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await directPasskeyLogin();
      // If successful, the auth store will update and this component will unmount
    } catch (err) {
      // User cancelled or no passkey - silently fail and let them use email
      if ((err as { name?: string })?.name === 'NotAllowedError') {
        // User cancelled - don't show error, just stay on initial screen
      } else {
        // Other error - might be no passkey available, that's okay
        console.log('No passkey available, use email instead');
      }
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
          {/* Initial: Quick passkey login or email */}
          {step === 'initial' && (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold mb-2">Welcome</h2>
                <p className="text-gray-400 text-sm">Sign in to continue</p>
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-center">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleDirectPasskeyLogin}
                disabled={isLoading}
                className="btn btn-primary w-full py-4 text-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-surface-900 border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                    Sign in with Touch ID
                  </span>
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-surface-800 text-gray-500">or</span>
                </div>
              </div>

              <button
                onClick={() => setStep('email')}
                disabled={isLoading}
                className="btn btn-secondary w-full py-3"
              >
                Continue with email
              </button>

              <p className="text-center text-gray-500 text-xs">
                New here? Use email to create your account
              </p>
            </div>
          )}

          {/* Step 2: Email */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold mb-2">Continue with email</h2>
                <p className="text-gray-400 text-sm">Enter your email to sign in or create an account</p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input w-full"
                  autoFocus
                  autoComplete="email"
                />
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-center">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email.trim() || cooldown > 0}
                className="btn btn-primary w-full py-3"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-surface-900 border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  'Send verification code'
                )}
              </button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full text-sm text-gray-400 hover:text-gray-300"
              >
                ← Back
              </button>
            </form>
          )}

          {/* Step 2: Code Verification */}
          {step === 'code' && (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold mb-2">Check your email</h2>
                <p className="text-gray-400 text-sm">
                  We sent a code to <span className="text-gray-300">{email}</span>
                </p>
              </div>

              <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { codeInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    className="w-12 h-14 text-center text-2xl font-mono input"
                    disabled={isLoading}
                  />
                ))}
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-center">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              {isLoading && (
                <div className="flex justify-center">
                  <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <button onClick={handleBack} className="text-gray-400 hover:text-gray-300">
                  ← Back
                </button>
                <button
                  onClick={() => handleSendCode()}
                  disabled={cooldown > 0}
                  className="text-accent hover:text-accent-bright disabled:text-gray-600"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Username (new users only) */}
          {step === 'username' && (
            <form onSubmit={handleSetUsername} className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold mb-2">Create your profile</h2>
                <p className="text-gray-400 text-sm">Choose a display name</p>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your name"
                  className="input w-full"
                  autoFocus
                  minLength={2}
                />
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-center">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!username.trim() || username.trim().length < 2}
                className="btn btn-primary w-full py-3"
              >
                Continue
              </button>

              <button onClick={handleBack} className="w-full text-sm text-gray-400 hover:text-gray-300">
                ← Back
              </button>
            </form>
          )}

          {/* Step 4: Passkey Registration */}
          {step === 'passkey' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
                  <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  {isNewUser ? 'Set up Touch ID' : `Welcome back${existingUsername ? `, ${existingUsername}` : ''}!`}
                </h2>
                <p className="text-gray-400 text-sm">
                  {isNewUser 
                    ? 'Use your fingerprint for fast, secure access' 
                    : 'Use Touch ID to sign in, or register this device'
                  }
                </p>
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-center">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              {!isNewUser && (
                <button
                  onClick={handleLoginPasskey}
                  disabled={isLoading}
                  className="btn btn-primary w-full py-3 text-lg"
                >
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
                      Sign in with Touch ID
                  </span>
                )}
              </button>
              )}

              <button
                onClick={handleRegisterPasskey}
                disabled={isLoading}
                className={`w-full py-3 ${isNewUser ? 'btn btn-primary text-lg' : 'btn btn-secondary'}`}
              >
                {isLoading && isNewUser ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-surface-900 border-t-transparent rounded-full animate-spin" />
                    Setting up...
                  </span>
                ) : isNewUser ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                    Set up Touch ID
                  </span>
                ) : (
                  'Register new device'
                )}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button onClick={handleBack} className="text-gray-400 hover:text-gray-300">
                  ← Back
                </button>
                <button onClick={handleStartOver} className="text-gray-400 hover:text-gray-300">
                  Use different email
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-8">
          Secured with WebAuthn • Your fingerprint never leaves your device
        </p>
      </div>
    </div>
  );
}
