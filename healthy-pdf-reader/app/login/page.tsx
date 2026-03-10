'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Activity, Mail, Lock, ArrowRight, Chrome } from 'lucide-react';

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    setStatusMsg('Opening secure login popup...');

    // Check for popup blocked/background
    const timer = setTimeout(() => {
      setStatusMsg('Please check for the Google Login popup window. It might be behind this browser.');
    }, 3000);

    try {
      await signInWithGoogle();
      clearTimeout(timer);
      setStatusMsg('Login successful! Redirecting...');
      // Redirect handled in AuthContext
    } catch (error: any) {
      clearTimeout(timer);
      console.error(error);
      setErrorMsg(error.message || 'Failed to sign in');
      setLoading(false);
      setStatusMsg('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white p-6 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-zinc-400">Sign in to continue your healthy reading journey</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-8 space-y-6 backdrop-blur-xl">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                {/* Google Icon SVG */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {statusMsg && (
            <div className={`text-sm text-center ${statusMsg.includes('Failed') ? 'text-red-400' : 'text-zinc-400 animate-pulse'}`}>
              {statusMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {errorMsg}
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0f1422] px-2 text-zinc-500">Or continue with email</span>
            </div>
          </div>

          <form className="space-y-4 opacity-50 pointer-events-none"> {/* Disabled visual for now as Google is priority */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Email</label>
              <input type="email" placeholder="name@example.com" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 outline-none text-white placeholder:text-zinc-600" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Password</label>
              <input type="password" placeholder="••••••••" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 outline-none text-white placeholder:text-zinc-600" />
            </div>
            <button className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold flex items-center justify-center gap-2">
              Sign In <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          <p className="text-xs text-center text-zinc-500 mt-4">Email login disabled for this demo. Use Google.</p>
        </div>
      </div>
    </div>
  );
}
