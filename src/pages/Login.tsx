import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/api/authService';
import {
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  CheckCircle2,
  X,
  ChevronLeft,
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

  // Forgot Password State & Modal
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotOtp, setForgotOtp] = useState<string>('');
  const [forgotNewPassword, setForgotNewPassword] = useState<string>('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState<string>('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState<boolean>(false);
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotError, setForgotError] = useState<string>('');
  const [forgotCountdown, setForgotCountdown] = useState<number>(0);

  useEffect(() => {
    let timer: any;
    if (forgotCountdown > 0) {
      timer = setTimeout(() => setForgotCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [forgotCountdown]);

  const handleOpenForgotModal = () => {
    setShowForgotModal(true);
    setForgotStep(1);
    setForgotEmail(username || '');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError('');
  };

  const handleCloseForgotModal = () => {
    setShowForgotModal(false);
    setForgotError('');
    setForgotLoading(false);
  };

  const handleSendForgotOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotError('');
    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotError('Please enter your username or registered email address');
      return;
    }
    setForgotLoading(true);
    try {
      await authService.requestPasswordReset(forgotEmail.trim());
      setForgotStep(2);
      setForgotCountdown(60);
    } catch (err: any) {
      const data = err?.response?.data || err?.data;
      const msg =
        data?.title ||
        data?.message ||
        err?.message ||
        'Could not send verification code. Please check your username/email.';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleFinishResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setForgotError('Please enter the 6-digit OTP code sent to your email');
      return;
    }
    if (forgotNewPassword.length < 4) {
      setForgotError('New password must be at least 4 characters');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match');
      return;
    }
    setForgotLoading(true);
    try {
      await authService.finishPasswordReset(forgotOtp.trim(), forgotNewPassword);
      setForgotStep(3);
    } catch (err: any) {
      const data = err?.response?.data || err?.data;
      let msg = 'Failed to reset password';
      if (data?.title && (data?.title.includes('OTP') || data?.title.includes('code') || data?.title.includes('key'))) {
        msg = data.title;
      } else if (data?.message && !data.message.startsWith('error.')) {
        msg = data.message;
      } else if (err?.response?.status === 400) {
        msg = 'Invalid or expired OTP verification code. Please try again or request a new code.';
      } else if (err?.message && !err.message.startsWith('error.')) {
        msg = err.message;
      }
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

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
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f0f2f5] font-sans text-[#172B4D] antialiased">
      {/* ── CENTERED 2-COLUMN UNIFIED CARD ── */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-slate-200/90 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* LEFT COLUMN: Deep Branded SSA Panel with Network Mesh */}
        <div className="relative bg-gradient-to-br from-[#0c532b] via-[#063f1f] to-[#022411] text-white p-8 sm:p-10 flex flex-col justify-between items-center text-center overflow-hidden min-h-[360px] md:min-h-[540px]">
          {/* Subtle Geometric Network Constellation Background */}
          <svg
            className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="network-mesh" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="15" cy="15" r="2" fill="#a7f3d0" />
                <circle cx="85" cy="45" r="2" fill="#a7f3d0" />
                <circle cx="45" cy="85" r="2" fill="#a7f3d0" />
                <line x1="15" y1="15" x2="85" y2="45" stroke="#ffffff" strokeWidth="0.8" />
                <line x1="85" y1="45" x2="45" y2="85" stroke="#ffffff" strokeWidth="0.8" />
                <line x1="45" y1="85" x2="15" y2="15" stroke="#ffffff" strokeWidth="0.8" />
                <line x1="15" y1="15" x2="100" y2="15" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="85" y1="45" x2="100" y2="70" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="3 3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#network-mesh)" />
          </svg>

          {/* Top spacer */}
          <div className="hidden md:block"></div>

          {/* Center Brand Grouping */}
          <div className="my-auto relative z-10 flex flex-col items-center">
            {/* White Circular Brand Emblem - Prominent & Bigger */}
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-white p-3 sm:p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] flex items-center justify-center mb-5 border-4 border-white/90 ring-4 ring-emerald-500/25">
              <img
                src={brandLogo}
                alt="SSA Career Solutions"
                className="w-full h-full object-cover rounded-full"
              />
            </div>

            {/* Internal Access Badge */}
            <span className="inline-block px-3 py-1 rounded-full bg-[#022411]/70 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider text-emerald-200 mb-2">
              Authorized Staff Only
            </span>

            {/* Company Name */}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1">
              SSA Career Solutions
            </h2>

            {/* Department / Internal Subtitle */}
            <p className="text-xs uppercase tracking-widest font-bold text-amber-300/90 mb-3">
              Internal CRM & Operations Desk
            </p>

            {/* Internal Notice Description */}
            <p className="text-xs text-emerald-100/80 max-w-xs leading-relaxed font-normal">
              Internal operations system for SSA counselors, admissions officers, and visa processing staff. Strictly for authorized use.
            </p>
          </div>

          {/* Footer Copyright */}
          <div className="relative z-10 text-[11px] text-emerald-200/60 pt-4">
            © 2026 SSA Careers · Internal System
          </div>
        </div>

        {/* RIGHT COLUMN: Clean Sign In Form */}
        <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              Staff Sign In
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Enter your credentials to access your internal desk
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 font-medium">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Username / Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Staff Username or Email <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                  className="w-full pr-3 py-2.5 text-xs font-medium text-slate-800 bg-[#f8fafc] border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-[#0c532b] focus:ring-1 focus:ring-[#0c532b] transition"
                  placeholder="e.g. kavin"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  className="w-full py-2.5 text-xs font-medium text-slate-800 bg-[#f8fafc] border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-[#0c532b] focus:ring-1 focus:ring-[#0c532b] transition"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-medium select-none text-xs">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                />
                <span>Remember Me</span>
              </label>
              <button
                type="button"
                onClick={handleOpenForgotModal}
                className="text-xs font-semibold text-[#0c532b] hover:underline focus:outline-none cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#0c532b] hover:bg-[#073f1f] text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>→ LOGIN TO DESK</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-400">
                Restricted portal for SSA internal personnel only.
              </p>
            </div>
          </form>
        </div>
      </div>
      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full border border-slate-200 p-5 relative text-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {forgotStep === 1 && 'Reset Password'}
                {forgotStep === 2 && 'Verify Code'}
                {forgotStep === 3 && 'Password Changed'}
              </h3>
              <button
                type="button"
                onClick={handleCloseForgotModal}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Banner */}
            {forgotError && (
              <div className="mb-3 p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* STEP 1: Enter Username or Email */}
            {forgotStep === 1 && (
              <div>
                <p className="text-xs text-slate-600 mb-3">
                  Enter your username or email to receive a reset code.
                </p>

                <form onSubmit={handleSendForgotOtp} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Username or Email
                    </label>
                    <input
                      type="text"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0c532b]"
                      placeholder="e.g. kavin"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCloseForgotModal}
                      className="px-3 py-1.5 rounded border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-1.5 bg-[#0c532b] hover:bg-[#073f1f] text-white rounded text-xs font-semibold disabled:opacity-50 transition cursor-pointer"
                    >
                      {forgotLoading ? 'Sending…' : 'Send Code'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 2: Enter 6-digit OTP and New Password */}
            {forgotStep === 2 && (
              <div>
                <p className="text-xs text-slate-600 mb-3">
                  We sent a 6-digit code to <strong className="text-slate-800">{forgotEmail}</strong>.
                </p>

                <form onSubmit={handleFinishResetPassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full border border-slate-300 rounded py-2 text-center font-mono text-base tracking-widest font-semibold focus:outline-none focus:border-[#0c532b]"
                      placeholder="123456"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      New Password
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showForgotNewPassword ? 'text' : 'password'}
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        className="w-full border border-slate-300 rounded px-3 py-2 pr-9 text-xs text-slate-900 focus:outline-none focus:border-[#0c532b]"
                        placeholder="At least 4 characters"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                        className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showForgotNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#0c532b]"
                      placeholder="Re-enter new password"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">Didn't get the code?</span>
                    <button
                      type="button"
                      disabled={forgotCountdown > 0 || forgotLoading}
                      onClick={handleSendForgotOtp}
                      className="font-medium text-[#0c532b] hover:underline disabled:text-slate-400 disabled:no-underline cursor-pointer"
                    >
                      {forgotCountdown > 0 ? `Resend in ${forgotCountdown}s` : 'Resend'}
                    </button>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="px-3 py-1.5 rounded border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-1.5 bg-[#0c532b] hover:bg-[#073f1f] text-white rounded text-xs font-semibold disabled:opacity-50 transition cursor-pointer"
                    >
                      {forgotLoading ? 'Saving…' : 'Save Password'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 3: Success Screen */}
            {forgotStep === 3 && (
              <div className="text-center py-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={22} />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">Password Changed</h4>
                <p className="text-xs text-slate-600 mb-4">
                  You can now sign in with your new password.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseForgotModal();
                    setUsername(forgotEmail);
                    setPassword('');
                  }}
                  className="w-full py-2 bg-[#0c532b] hover:bg-[#073f1f] text-white rounded text-xs font-semibold transition cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
