import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import brandLogo from '../assets/brand-logo.jpg';

export default function Login() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password, rememberMe);
      navigate('/');
    } catch (err: any) {
      setError(
        typeof err === 'string'
          ? err
          : err?.message || 'Invalid username or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f2f7] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <img
            src={brandLogo}
            alt="SSA Logo"
            className="inline-block w-14 h-14 rounded-2xl object-cover shadow-xs border border-black/[0.08] mb-3"
          />
          <h1 className="text-xl font-bold text-[#1c1c1e] tracking-tight">
            SSA CRM
          </h1>
          <p className="text-xs text-[#8e8e93] mt-0.5">Overseas Visa Consultancy</p>
        </div>

        {/* Login Card */}
        <div className="ios-card p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="pb-4 mb-4 border-b border-black/[0.06]">
            <h2 className="text-sm font-semibold text-[#1c1c1e]">Sign in to your account</h2>
            <p className="text-xs text-[#8e8e93] mt-0.5">Role-Based Access Control CRM Portal</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-xs text-[#ff3b30] flex items-start gap-2 font-medium">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#3c3c43] mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8e8e93]">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username (e.g. admin)"
                  className="ios-input w-full pl-9 pr-3 py-2.5 text-xs font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3c3c43] mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8e8e93]">
                  <Lock size={15} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="ios-input w-full pl-9 pr-3 py-2.5 text-xs font-medium"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#3c3c43] font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-black/20 text-[#007aff] focus:ring-[#007aff]"
                />
                <span>Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 ios-btn-primary rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,122,255,0.3)]"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-[#8e8e93] mt-6">
          Overseas Work & Study Visa Consultancy · RBAC Portal
        </p>
      </div>
    </div>
  );
}
