import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

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

  const loadAttendance = async () => {
    if (!userId || isAdmin) return;
    setLoadingAttendance(true);
    try {
      const [today, records] = await Promise.all([
        attendanceService.getTodayAttendance(userId).catch(() => null),
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
    if (isAdmin) return;
    loadAttendance();

    const handleUpdate = () => loadAttendance();
    window.addEventListener('ssa_attendance_updated', handleUpdate);
    return () => window.removeEventListener('ssa_attendance_updated', handleUpdate);
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
      setTodayRecord(res);
      loadAttendance();
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

  // Change Password
  const handleSubmitPassword = async () => {
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
      setPasswordError('New password must be different from the current one');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated');
    } catch (err: any) {
      const data = err?.response?.data || err?.data;
      let msg = 'Failed to update password';
      if (data?.type?.includes('invalid-password') || data?.detail?.toLowerCase()?.includes('incorrect password')) {
        msg = 'Incorrect current password. Please try again.';
      } else if (data?.detail && typeof data.detail === 'string' && !data.detail.startsWith('error.')) {
        msg = data.detail;
      } else if (data?.message && typeof data.message === 'string' && !data.message.startsWith('error.')) {
        msg = data.message;
      } else if (err?.message && !err.message.startsWith('error.')) {
        msg = err.message;
      } else if (err?.response?.status === 400) {
        msg = 'Incorrect current password. Please try again.';
      }
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
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
                <Loader2 size={32} className="animate-spin text-white" />
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
                <span>{badgeInfo.deskTitle || (isAdmin ? 'Super Administrator' : 'Staff Desk')}</span>
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

      {/* Change Password Dialog Modal */}
      <div
        className={`ov ${showPasswordModal ? 'show' : ''}`}
        id="ov"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClosePasswordModal();
        }}
      >
        <div className="md" role="dialog" aria-modal="true">
          <h3>Change password</h3>
          <div className="bd">
            <label>
              Current password
              <input
                id="p0"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter current password"
              />
            </label>
            <label>
              New password
              <input
                id="p1"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 4 characters"
              />
            </label>
            <label>
              Confirm new password
              <input
                id="p2"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Re-enter new password"
              />
            </label>
            <div className="err" id="pe">
              {passwordError}
            </div>
          </div>
          <div className="ft">
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
              id="ps"
              onClick={handleSubmitPassword}
              disabled={passwordLoading}
            >
              {passwordLoading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>
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
