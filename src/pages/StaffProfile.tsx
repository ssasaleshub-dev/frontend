import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Eye, EyeOff } from 'lucide-react';
import DotsLoader from '../components/common/DotsLoader';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { getDisplayName, getRoleBadgeInfo, isAdmin as checkIsAdmin } from '../utils/rbac';
import attendanceService, { StaffAttendanceRecord } from '../services/api/attendanceService';
import { useBiometricAttendance } from '../hooks/useBiometricAttendance';
import { BiometricSuccessModal } from '../components/biometrics/BiometricSuccessModal';
import { PhoneApprovalSheet } from '../components/biometrics/PhoneApprovalSheet';
import { AttendanceCard } from '../components/attendance/AttendanceCard';
import { Capacitor } from '@capacitor/core';
import attendanceVerificationService, {
  AttendanceVerification,
  describeRequestSource,
} from '../services/api/attendanceVerificationService';
import fileService from '../services/api/fileService';
import authService from '../services/api/authService';
import { formatIndianTime } from '../utils/dateTimeUtils';

export default function StaffProfile() {
  const { user, updateUserAvatar, updateUserProfile, logout } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const isAdmin = checkIsAdmin(user);

  const displayName = getDisplayName(user);
  const badgeInfo = getRoleBadgeInfo(user);
  const userInitial = (displayName?.[0] || user?.login?.[0] || 'A').toUpperCase();
  const userId = user?.login || (user?.id ? String(user.id) : '');

  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Edit Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState(displayName);
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password State & Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordOtp, setPasswordOtp] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string>('');
  const toastTimerRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 2000);
  };

  // Keep fields synced
  useEffect(() => {
    if (user) {
      setEditFullName(getDisplayName(user));
      setEditEmail(user.email || '');
    }
  }, [user]);

  // Attendance state for staff (the calendar lives inside AttendanceCard)
  const [todayRecord, setTodayRecord] = useState<StaffAttendanceRecord | null>(null);
  const [history, setHistory] = useState<StaffAttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(true);
  const [punching, setPunching] = useState<boolean>(false);

  const loadAttendance = async (force = false) => {
    if (!userId || isAdmin) return;
    setLoadingAttendance(true);
    try {
      if (force) {
        attendanceService.invalidateTodayCache(userId);
      }
      const [today, records] = await Promise.all([
        attendanceService.getTodayAttendance(userId, force).catch(() => null),
        attendanceService.getMyHistory(userId).catch(() => []),
      ]);
      if (today) setTodayRecord(today);
      if (Array.isArray(records)) setHistory(records);
    } catch (err) {
      console.warn('Failed loading attendance:', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    if (isAdmin || !userId) return;
    loadAttendance(true);

    const handleUpdate = () => loadAttendance(true);
    window.addEventListener('ssa_attendance_updated', handleUpdate);
    window.addEventListener('app:pull-to-refresh', handleUpdate);

    // Live background sync: check every 3s if not yet checked in, so phone approval updates immediately
    const liveTimer = setInterval(() => {
      attendanceService.getTodayAttendance(userId, true).then((rec) => {
        if (rec && rec.checkInTime) {
          setTodayRecord((prev) => {
            if (!prev || !prev.checkInTime || prev.checkInTime !== rec.checkInTime) {
              return rec;
            }
            return prev;
          });
        }
      }).catch(() => {});
    }, 3000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAttendance(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      window.removeEventListener('ssa_attendance_updated', handleUpdate);
      window.removeEventListener('app:pull-to-refresh', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      clearInterval(liveTimer);
    };
  }, [userId, isAdmin]);

  // Biometric Flow Hook
  const {
    biometricCred,
    enrollingBiometric,
    punching: punchingBiometric,
    successModal: checkInSuccessModal,
    closeSuccessModal,
    handleRegisterBiometric,
    handleBiometricCheckIn,
    phoneApproval,
    cancelPhoneApproval,
  } = useBiometricAttendance({
    userId,
    userName: displayName,
    userRole: badgeInfo.displayText,
    workMode: 'OFFICE',
    showToast,
    onSuccess: (res) => {
      if (res) {
        setTodayRecord(res);
      }
      loadAttendance(true);
    },
  });

  // In the app: a check-in started on the web that is waiting for this phone (in case the push was missed)
  const [pendingWebRequest, setPendingWebRequest] = useState<AttendanceVerification | null>(null);
  useEffect(() => {
    if (isAdmin || !userId || !Capacitor.isNativePlatform()) return;
    let active = true;
    const check = () =>
      attendanceVerificationService
        .getPending()
        .then((p) => active && setPendingWebRequest(p && p.source === 'WEB' ? p : null))
        .catch(() => { });
    check();
    const timer = setInterval(check, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isAdmin, userId]);

  const handleCheckIn = async () => {
    await handleBiometricCheckIn();
  };

  const handleCheckOut = async () => {
    if (!userId) return;
    setPunching(true);
    try {
      const res = await attendanceService.checkOut({ userId });
      setTodayRecord(res);
      showToast('Checked out successfully!');
      loadAttendance();
    } catch (err: any) {
      showAlert({ title: 'Profile', message: `Check-out failed: ${err?.message || 'Server error'}` });
    } finally {
      setPunching(false);
    }
  };

  // Avatar Photo Upload
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file (PNG, JPG, WebP).');
      return;
    }

    setAvatarUploading(true);
    try {
      const res = await fileService.uploadFile(file, 'avatars');
      if (res?.url) {
        await updateUserAvatar(res.url);
        showToast('Photo updated');
      }
    } catch (err: any) {
      showToast(`Upload failed: ${err?.message || 'Server error'}`);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Save Profile Details
  const handleSaveProfile = async () => {
    const nameTrimmed = editFullName.trim();
    const emailTrimmed = editEmail.trim();

    if (!nameTrimmed || !/^\S+@\S+$/.test(emailTrimmed)) {
      showToast('Enter a valid name and email');
      return;
    }

    setSavingProfile(true);
    const parts = nameTrimmed.split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    try {
      if (updateUserProfile) {
        await updateUserProfile({
          firstName,
          lastName,
          email: emailTrimmed,
        });
      } else {
        await authService.updateAccount({
          ...user,
          firstName,
          lastName,
          email: emailTrimmed,
        });
      }
      setIsEditingProfile(false);
      showToast('Profile updated');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Step 1: Validate passwords and request email OTP to go to Step 2
  const handleProceedToOtp = async () => {
    setPasswordError('');
    if (!currentPassword) {
      setPasswordError('Enter your current password');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSendingOtp(true);
    try {
      await authService.requestChangePasswordOtp();
      setOtpSent(true);
      setOtpCountdown(60);
      setPasswordStep(2);
      setPasswordOtp('');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      const data = err?.response?.data || err?.data;
      const msg = data?.title || data?.message || err?.message || 'Failed to send OTP to email';
      setPasswordError(msg);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    setPasswordError('');
    const clean = val.replace(/\D/g, '');
    if (clean.length > 1) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = clean[i] || '';
      }
      setOtpDigits(newDigits);
      setPasswordOtp(newDigits.join(''));
      const nextIdx = Math.min(clean.length, 5);
      otpInputsRef.current[nextIdx]?.focus();
      return;
    }

    const digit = clean.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setPasswordOtp(newDigits.join(''));

    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    setPasswordError('');
    setSendingOtp(true);
    try {
      await authService.requestChangePasswordOtp();
      setOtpCountdown(60);
      showToast('Verification code resent to your email');
    } catch (err: any) {
      const data = err?.response?.data || err?.data;
      const msg = data?.title || data?.message || err?.message || 'Failed to resend OTP';
      setPasswordError(msg);
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2: Submit Password Change with verified OTP
  const handleSubmitPassword = async () => {
    setPasswordError('');
    if (!passwordOtp || passwordOtp.trim().length !== 6) {
      setPasswordError('Please enter the 6-digit OTP code sent to your email');
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword, passwordOtp);
      handleClosePasswordModal();
      showToast('Password updated successfully');
    } catch (err: any) {
      const data = err?.response?.data || err?.data;
      let msg = 'Failed to update password';
      if (data?.title && (data?.title.includes('OTP') || data?.title.includes('verification'))) {
        msg = data.title;
      } else if (data?.type?.includes('invalid-password') || data?.detail?.toLowerCase()?.includes('incorrect password')) {
        msg = 'Incorrect current password. Please go back and check your password.';
      } else if (data?.detail && typeof data.detail === 'string' && !data.detail.startsWith('error.')) {
        msg = data.detail;
      } else if (data?.message && typeof data.message === 'string' && !data.message.startsWith('error.')) {
        msg = data.message;
      } else if (err?.message && !err.message.startsWith('error.')) {
        msg = err.message;
      } else if (err?.response?.status === 400) {
        msg = 'Invalid OTP or incorrect password. Please check your inputs.';
      }
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordStep(1);
    setCurrentPassword('');
    setPasswordOtp('');
    setOtpDigits(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError('');
    setOtpSent(false);
  };

  const handleLogout = () => {
    showToast('Signing out…');
    setTimeout(() => {
      logout();
      navigate('/login');
    }, 400);
  };



  return (
    <div className="crm-p" id="crmP">
      <div className="layout">
        {/* Left Profile Card */}
        <aside className="card me">
          <div className="avw">
            <div className="av" id="av">
              {avatarUploading ? (
                <DotsLoader size="sm" />
              ) : user?.imageUrl ? (
                <img src={user.imageUrl} alt={displayName} />
              ) : (
                userInitial
              )}
            </div>
            <button
              type="button"
              className="cam"
              id="cam"
              onClick={() => avatarInputRef.current?.click()}
              aria-label="Change photo"
              title="Change photo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </button>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarSelect}
              accept="image/*"
              hidden
            />
          </div>

          <h1 id="hn">{displayName}</h1>
          <p id="he">{user?.email || 'admin@localhost'}</p>

          <div className="chips">
            <span
              className="chip cursor-pointer hover:bg-slate-200 transition"
              onClick={() => {
                navigator.clipboard?.writeText(userId);
                showToast(`Copied @${userId} to clipboard`);
              }}
              title="Click to copy username"
            >
              @{userId}
            </span>
            <span className="chip b">{isAdmin ? 'Administrator' : badgeInfo.displayText}</span>
          </div>

          <div className="links">
            {isAdmin ? (
              <>
                <a
                  href="#attendance"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/attendance');
                  }}
                  data-t="Opening Staff Attendance…"
                >
                  <div>
                    Staff Attendance
                    <small>Daily register &amp; roster records</small>
                  </div>
                  <span style={{ color: 'var(--blue)' }}>›</span>
                </a>
                <a
                  href="#staff"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/users');
                  }}
                  data-t="Opening Staff Management…"
                >
                  <div>
                    Staff Management
                    <small>Staff accounts &amp; permissions</small>
                  </div>
                  <span style={{ color: 'var(--blue)' }}>›</span>
                </a>
                <a
                  href="#bio"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/biometrics');
                  }}
                  data-t="Opening Biometric Approvals…"
                >
                  <div>
                    Biometric Approvals
                    <small>Review staff office devices</small>
                  </div>
                  <span style={{ color: 'var(--blue)' }}>›</span>
                </a>
              </>
            ) : null}
          </div>
        </aside>

        {/* Right Main Column */}
        <main>
          {/* Section 1: Personal Information */}
          <section className="card sec">
            <div className="hd">
              <h3>Personal Information</h3>
              {!isEditingProfile && (
                <button
                  type="button"
                  className="lk"
                  id="ed"
                  onClick={() => setIsEditingProfile(true)}
                >
                  Edit
                </button>
              )}
            </div>

            <div className="fl">
              <div className="f">
                <label>Full name</label>
                {!isEditingProfile ? (
                  <span id="vn">{displayName}</span>
                ) : (
                  <input
                    id="in"
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Full name"
                  />
                )}
              </div>

              <div className="f">
                <label>Email address</label>
                {!isEditingProfile ? (
                  <span id="ve">{user?.email || 'admin@localhost'}</span>
                ) : (
                  <input
                    id="ie"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email address"
                  />
                )}
              </div>

              <div className="f">
                <label>Login username</label>
                <span>
                  @{userId}
                </span>
              </div>

              <div className="f">
                <label>Assigned department</label>
                <span>{badgeInfo.deskTitle || (isAdmin ? 'Super Administrator' : 'Staff Counselor')}</span>
              </div>
            </div>

            <div className={`bar ${isEditingProfile ? 'show' : ''}`} id="bar">
              <button
                type="button"
                className="b p"
                id="sv"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="b"
                id="cx"
                onClick={() => {
                  setIsEditingProfile(false);
                  setEditFullName(displayName);
                  setEditEmail(user?.email || '');
                }}
              >
                Cancel
              </button>
            </div>
          </section>

          {/* Section 1.5: Attendance (non-admin staff) */}
          {!isAdmin && pendingWebRequest && (
            <button
              type="button"
              onClick={() => navigate(`/attendance/verify/${pendingWebRequest.id}`)}
              className="w-full text-left bg-white rounded-2xl border border-black/[0.06] px-4 py-3.5 mb-3 flex items-center gap-3 active:bg-[#f2f2f7] cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#007aff] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[#1c1c1e]">Approve your check-in</p>
                <p className="text-[13px] text-[#8e8e93] truncate">
                  Requested from {describeRequestSource(pendingWebRequest.requestedFrom)}
                </p>
              </div>
              <span className="text-[#c7c7cc] text-xl leading-none">›</span>
            </button>
          )}
          {!isAdmin && (
            <div style={{ marginBottom: 16 }}>
              <AttendanceCard
                todayRecord={todayRecord}
                history={history}
                credential={biometricCred}
                isNativeApp={Capacitor.isNativePlatform()}
                enrolling={enrollingBiometric}
                checkingIn={punchingBiometric}
                checkingOut={punching}
                onRegister={handleRegisterBiometric}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
              />
            </div>
          )}

          {/* Section 2: Security & Password */}
          <section className="card sec">
            <div className="hd">
              <h3>Security</h3>
            </div>
            <div
              className="row"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowPasswordModal(true)}
            >
              <div>
                <b>Password</b>
                <small>Change your login password</small>
              </div>
              <button
                type="button"
                className="b"
                id="pw"
                style={{ whiteSpace: 'nowrap' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPasswordModal(true);
                }}
              >
                Change
              </button>
            </div>
          </section>

          {/* Section 3: Sign Out & Version */}
          <section className="card sec">
            <div className="out">
              <button
                type="button"
                id="so"
                onClick={handleLogout}
              >
                Sign out
              </button>
              <span>v1.0.41</span>
            </div>
          </section>
        </main>
      </div>

      {/* Change Password Dialog Modal - Clean 2-Step Flow */}
      <div
        className={`ov ${showPasswordModal ? 'show' : ''}`}
        id="ov"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClosePasswordModal();
        }}
      >
        {passwordStep === 1 ? (
          /* STEP 1: Enter Current & New Passwords */
          <div className="md" role="dialog" aria-modal="true" style={{ borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <div>
                <h3 style={{ margin: 0, padding: 0, fontSize: '16px', fontWeight: 700, border: 'none' }}>Change password</h3>
              </div>
              <button
                type="button"
                onClick={handleClosePasswordModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--muted)', padding: '4px', lineHeight: 1 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="bd" style={{ padding: '20px', display: 'grid', gap: '14px' }}>
              <label>
                Current password
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="p0"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter current password"
                    autoFocus
                    style={{ paddingRight: '42px', width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                    }}
                    title={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label>
                New password
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="p1"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 4 characters"
                    style={{ paddingRight: '42px', width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                    }}
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label>
                Confirm new password
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="p2"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    style={{ paddingRight: '42px', width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                    }}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              {passwordError && (
                <div className="err" id="pe" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>
                  {passwordError}
                </div>
              )}
            </div>

            <div className="ft" style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="b"
                id="pc"
                onClick={handleClosePasswordModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="b p"
                id="ps_next"
                onClick={handleProceedToOtp}
                disabled={sendingOtp}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {sendingOtp ? 'Sending code…' : 'Next: Verify OTP →'}
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: Minimalist 6-Box OTP Verification (Matching User Reference) */
          <div className="md" role="dialog" aria-modal="true" style={{ maxWidth: '380px', borderRadius: '18px', overflow: 'hidden', padding: '28px 24px 20px 24px', background: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a', border: 'none', padding: 0 }}>
                Verification Code
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                Enter the 6-digit code sent to<br />
                <strong style={{ color: '#0f172a' }}>{user?.email || 'your email'}</strong>
              </p>
            </div>

            {/* 6 Individual Rounded Digit Boxes (Exact match to user's screenshot) */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '22px' }}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputsRef.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    const newDigits = [...otpDigits];
                    for (let i = 0; i < 6; i++) {
                      newDigits[i] = pasted[i] || '';
                    }
                    setOtpDigits(newDigits);
                    setPasswordOtp(newDigits.join(''));
                    const nextIdx = Math.min(pasted.length, 5);
                    otpInputsRef.current[nextIdx]?.focus();
                  }}
                  autoFocus={idx === 0}
                  style={{
                    width: '44px',
                    height: '50px',
                    textAlign: 'center',
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#ffffff',
                    border: digit ? '2px solid #007aff' : '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'all 0.15s ease',
                    boxShadow: digit ? '0 0 0 3px rgba(0, 122, 255, 0.12)' : 'none',
                  }}
                />
              ))}
            </div>

            {passwordError && (
              <div style={{ marginBottom: '14px', textAlign: 'center', color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>
                {passwordError}
              </div>
            )}

            {/* Clean Full-Width Action Button (Just like user's reference) */}
            <button
              type="button"
              onClick={handleSubmitPassword}
              disabled={passwordLoading || passwordOtp.length !== 6}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                background: passwordOtp.length === 6 ? '#007aff' : '#e2e8f0',
                color: passwordOtp.length === 6 ? '#ffffff' : '#94a3b8',
                border: 'none',
                cursor: passwordOtp.length === 6 && !passwordLoading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                boxShadow: passwordOtp.length === 6 ? '0 4px 12px rgba(0, 122, 255, 0.25)' : 'none',
              }}
            >
              {passwordLoading ? 'Verifying…' : 'Verify Code'}
            </button>

            {/* Clean Footer Navigation (Just like user's reference) */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setPasswordStep(1);
                  setPasswordError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                Cancel
              </button>

              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Didn't receive code?{' '}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpCountdown > 0 || sendingOtp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: otpCountdown > 0 ? '#94a3b8' : '#007aff',
                    fontWeight: 600,
                    cursor: otpCountdown > 0 ? 'default' : 'pointer',
                    padding: 0,
                  }}
                >
                  {sendingOtp ? 'Resending…' : otpCountdown > 0 ? `Resend in ${otpCountdown}s` : 'Resend Code'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Web check-in waiting for approval on the phone */}
      <PhoneApprovalSheet expiresAt={phoneApproval?.expiresAt ?? null} onCancel={cancelPhoneApproval} />

      {/* Biometric Confirmation Modal */}
      <BiometricSuccessModal
        isOpen={Boolean(checkInSuccessModal?.isOpen)}
        onClose={closeSuccessModal}
        userName={displayName}
        userId={userId}
        timestamp={checkInSuccessModal?.timestamp || ''}
        deviceId={checkInSuccessModal?.deviceName}
      />

      {/* Toast Notification */}
      <div className={`toast ${toastMessage ? 'show' : ''}`} id="toast">
        {toastMessage}
      </div>
    </div>
  );
}
