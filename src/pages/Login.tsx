import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import brandLogo from '../assets/brand-logo.jpg';

export default function Login() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
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
          : err?.message || 'Invalid username or password. Please verify your credentials and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#f2f2f7] font-sans text-[#1c1c1e] antialiased">
      {/* LEFT SIDE: Brand Showcase & Logo Panel */}
      <div className="hidden md:flex md:w-5/12 lg:w-1/2 bg-white/80 border-r border-black/[0.06] p-8 lg:p-14 flex-col justify-between relative overflow-hidden backdrop-blur-2xl">
        {/* Soft Ambient Radial Background Highlights */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#007aff]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#34c759]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Centerpiece */}
        <div className="relative z-10 my-auto py-8">
          <div className="flex items-center gap-4 mb-5">
            <img
              src={brandLogo}
              alt="SSA Logo"
              className="w-20 h-20 lg:w-24 lg:h-24 rounded-[26px] object-cover shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-black/[0.08]"
            />
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-[#1c1c1e] leading-tight">
                SSA CRM
              </h1>
              <p className="text-xs lg:text-sm font-medium text-[#8e8e93] mt-0.5">
                Overseas Work & Study Visa Consultancy
              </p>
            </div>
          </div>

          <p className="text-xs lg:text-sm text-[#3c3c43] font-normal leading-relaxed max-w-md">
            Integrated counselor command center for international student admissions, employment visas, and role-scoped pipeline governance.
          </p>
        </div>

        {/* Footer Brand Info */}
        <div className="relative z-10 flex items-center justify-end text-[11px] text-[#8e8e93] pt-4 border-t border-black/[0.05]">
          <span>© 2026 SSA Careers</span>
        </div>
      </div>

      {/* RIGHT SIDE: Login ID & Password Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile-Only Header Brand */}
          <div className="md:hidden text-center mb-6">
            <img
              src={brandLogo}
              alt="SSA Logo"
              className="inline-block w-14 h-14 rounded-2xl object-cover shadow-xs border border-black/[0.08] mb-2.5"
            />
            <h1 className="text-xl font-bold text-[#1c1c1e] tracking-tight">SSA CRM</h1>
            <p className="text-xs text-[#8e8e93]">Overseas Visa Consultancy</p>
          </div>

          {/* Login Card Container */}
          <div className="ios-card p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-black/[0.07]">
            <div className="pb-4 mb-5 border-b border-black/[0.06]">
              <h2 className="text-base sm:text-lg font-bold text-[#1c1c1e] tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-xs text-[#8e8e93] mt-0.5">
                Enter your counselor or administrator credentials to access your desk.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3.5 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-xs text-[#ff3b30] flex items-start gap-2.5 font-medium animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Username Input with guaranteed icon clearance */}
              <div>
                <label className="block text-xs font-semibold text-[#1c1c1e] mb-1.5">
                  Username or Email ID <span className="text-[#ff3b30]">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center pointer-events-none text-[#8e8e93]">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ paddingLeft: '2.75rem' }}
                    className="ios-input ios-input-icon-left w-full pr-3 py-2.5 text-xs font-medium"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password Input with guaranteed clearance & show/hide toggle */}
              <div>
                <label className="block text-xs font-semibold text-[#1c1c1e] mb-1.5">
                  Password <span className="text-[#ff3b30]">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center pointer-events-none text-[#8e8e93]">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                    className="ios-input ios-input-icon-both w-full py-2.5 text-xs font-medium"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1 text-[#8e8e93] hover:text-[#1c1c1e] transition-colors focus:outline-none"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Option */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-[#3c3c43] font-medium select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-black/20 text-[#007aff] focus:ring-[#007aff] cursor-pointer"
                  />
                  <span>Remember my login</span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 ios-btn-primary rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_2px_10px_rgba(0,122,255,0.32)] active:scale-[0.99] transition-all"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to CRM</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
