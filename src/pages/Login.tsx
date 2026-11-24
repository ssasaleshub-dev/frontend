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
                Sign in
              </h2>
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

              {/* Remember Me & Forgot Password Option */}
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
                <button
                  type="button"
                  onClick={handleOpenForgotModal}
                  className="text-xs font-semibold text-[#007aff] hover:underline focus:outline-none"
                >
                  Forgot password?
                </button>
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

              <div className="text-center pt-2">
                <a
                  href="/privacy"
                  className="text-[11px] text-[#8e8e93] hover:text-[#1c1c1e] transition underline underline-offset-2"
                >
                  Privacy Policy
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-black/[0.08] p-6 relative overflow-hidden animate-in zoom-in-95 duration-200 text-xs">
            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseForgotModal}
              className="absolute top-5 right-5 p-1.5 rounded-full text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/5 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Error Banner */}
            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-xs text-[#ff3b30] flex items-start gap-2 font-medium">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* STEP 1: Enter Username or Email */}
            {forgotStep === 1 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#007aff]/10 flex items-center justify-center text-[#007aff] shrink-0">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1c1c1e] tracking-tight">Forgot Password</h3>
                    <p className="text-[11px] text-[#8e8e93]">Recover access to your account</p>
                  </div>
                </div>

                <p className="text-xs text-[#64748b] mb-4 leading-relaxed">
                  Enter your registered username or email address. We will send a 6-digit verification code to reset your password.
                </p>

                <form onSubmit={handleSendForgotOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1c1c1e] mb-1.5">
                      Username or Email <span className="text-[#ff3b30]">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 flex items-center pointer-events-none text-[#8e8e93]">
                        <Mail size={16} />
                      </div>
                      <input
                        type="text"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        style={{ paddingLeft: '2.75rem' }}
                        className="ios-input ios-input-icon-left w-full pr-3 py-2.5 text-xs font-medium"
                        placeholder="e.g. counselor@ssacareers.com"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCloseForgotModal}
                      className="w-1/3 py-2.5 px-3 rounded-xl border border-black/10 text-xs font-semibold text-[#64748b] hover:bg-black/5 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 py-2.5 px-4 ios-btn-primary rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_2px_10px_rgba(0,122,255,0.32)] transition"
                    >
                      {forgotLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Sending code…</span>
                        </>
                      ) : (
                        <>
                          <span>Send Code</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 2: Enter 6-digit OTP and New Password */}
            {forgotStep === 2 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setForgotError('');
                    }}
                    className="p-1 rounded-lg text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/5 -ml-1"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <h3 className="text-base font-bold text-[#1c1c1e] tracking-tight">Enter Verification Code</h3>
                    <p className="text-[11px] text-[#8e8e93]">Code sent to registered email</p>
                  </div>
                </div>

                <div className="mb-4 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 leading-relaxed">
                  We've sent a 6-digit code to <strong>{forgotEmail}</strong>. Code expires in 15 minutes.
                </div>

                <form onSubmit={handleFinishResetPassword} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1c1c1e] mb-1.5">
                      6-Digit OTP Code <span className="text-[#ff3b30]">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      className="ios-input w-full py-2.5 text-center font-mono text-xl tracking-[8px] font-bold"
                      placeholder="123456"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1c1c1e] mb-1.5">
                      New Password <span className="text-[#ff3b30]">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 flex items-center pointer-events-none text-[#8e8e93]">
                        <Lock size={15} />
                      </div>
                      <input
                        type={showForgotNewPassword ? 'text' : 'password'}
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                        className="ios-input w-full py-2.5 text-xs font-medium"
                        placeholder="At least 4 characters"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                        className="absolute right-3 p-1 text-[#8e8e93] hover:text-[#1c1c1e]"
                      >
                        {showForgotNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1c1c1e] mb-1.5">
                      Confirm New Password <span className="text-[#ff3b30]">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 flex items-center pointer-events-none text-[#8e8e93]">
                        <Lock size={15} />
                      </div>
                      <input
                        type={showForgotNewPassword ? 'text' : 'password'}
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                        className="ios-input w-full py-2.5 text-xs font-medium"
                        placeholder="Re-enter new password"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-[#8e8e93]">Didn't get the code?</span>
                    <button
                      type="button"
                      disabled={forgotCountdown > 0 || forgotLoading}
                      onClick={handleSendForgotOtp}
                      className="font-semibold text-[#007aff] hover:underline disabled:text-[#8e8e93] disabled:no-underline"
                    >
                      {forgotCountdown > 0 ? `Resend in ${forgotCountdown}s` : 'Resend Code'}
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full py-2.5 px-4 ios-btn-primary rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_2px_10px_rgba(0,122,255,0.32)] transition"
                    >
                      {forgotLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Resetting password…</span>
                        </>
                      ) : (
                        <span>Set New Password</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 3: Success Screen */}
            {forgotStep === 3 && (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-base font-bold text-[#1c1c1e] mb-1">Password Changed Successfully!</h3>
                <p className="text-xs text-[#64748b] max-w-xs mx-auto mb-6">
                  Your account password has been updated. You can now log in with your new password.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseForgotModal();
                    setUsername(forgotEmail);
                    setPassword('');
                  }}
                  className="w-full py-2.5 px-4 ios-btn-primary rounded-xl text-xs font-semibold shadow-[0_2px_10px_rgba(0,122,255,0.32)]"
                >
                  Sign In to CRM
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
