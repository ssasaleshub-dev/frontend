import React, { useState, useEffect, useMemo } from 'react';
import {
  Fingerprint,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Search,
  Copy,
  Check,
  Tablet,
  User,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ChevronRight,
  Filter,
  Loader2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { isAdmin as checkIsAdmin } from '../utils/rbac';
import biometricService, { StaffBiometricCredential } from '../services/biometricService';
import { formatIndianTime } from '../utils/dateTimeUtils';

export default function BiometricApprovalsPage() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const isAdmin = checkIsAdmin(user);

  const [activeTab, setActiveTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [credentials, setCredentials] = useState<StaffBiometricCredential[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'PENDING') {
        const pending = await biometricService.getPendingApprovals();
        setCredentials(pending);
      } else {
        const all = await biometricService.getAllCredentials();
        setCredentials(all);
      }
    } catch (err: any) {
      console.warn('Failed loading biometric credentials:', err);
      showAlert({
        title: 'Biometric Approvals',
        message: `Failed to load credentials: ${err?.message || 'Server error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Copy biometric key to clipboard
  const handleCopyKey = async (keyStr: string) => {
    try {
      await navigator.clipboard.writeText(keyStr);
      setCopiedKeyId(keyStr);
      setTimeout(() => setCopiedKeyId(null), 2500);
    } catch {
      // fallback
    }
  };

  // Admin Approve & Lock Action
  const handleApproveAndLock = async (item: StaffBiometricCredential) => {
    if (!item.id) return;
    const staffName = item.userName || item.userId;
    const confirmed = await showConfirm({
      title: 'Approve & Lock Fingerprint',
      message: `Are you sure you want to permanently lock this fingerprint to this office device for ${staffName}?`,
      confirmText: 'Approve & Lock',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    setActionLoadingId(item.id);
    try {
      const updated = await biometricService.lockCredential(item.id);
      showToast('Biometric credential locked successfully! Employee can now check in using this office device.');

      // Update state locally
      setCredentials((prev) =>
        prev
          .map((c) => (c.id === item.id ? { ...c, ...updated, status: 'LOCKED', isLocked: true } : c))
          .filter((c) => (activeTab === 'PENDING' ? c.status === 'PENDING_APPROVAL' : true))
      );
      loadData();
    } catch (err: any) {
      showAlert({
        title: 'Device Lock Error',
        message: err?.response?.data?.message || err?.message || 'Failed to lock biometric credential',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Admin Revoke Action
  const handleRevoke = async (item: StaffBiometricCredential) => {
    if (!item.id) return;
    const staffName = item.userName || item.userId;
    const confirmed = await showConfirm({
      title: 'Revoke Biometric Credential',
      message: `Are you sure you want to revoke biometric check-in access for ${staffName} on device ${item.deviceId}?`,
      confirmText: 'Revoke Credential',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    setActionLoadingId(item.id);
    try {
      const updated = await biometricService.revokeCredential(item.id);
      showToast(`Biometric credential for ${staffName} has been revoked.`);

      setCredentials((prev) =>
        prev
          .map((c) => (c.id === item.id ? { ...c, ...updated, status: 'REVOKED', isLocked: false } : c))
          .filter((c) => (activeTab === 'PENDING' ? c.status === 'PENDING_APPROVAL' : true))
      );
      loadData();
    } catch (err: any) {
      showAlert({
        title: 'Revoke Error',
        message: err?.response?.data?.message || err?.message || 'Failed to revoke biometric credential',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered list by search
  const filteredCredentials = useMemo(() => {
    if (!searchQuery.trim()) return credentials;
    const q = searchQuery.toLowerCase().trim();
    return credentials.filter((c) => {
      const name = (c.userName || '').toLowerCase();
      const uId = (c.userId || '').toLowerCase();
      const devId = (c.deviceId || '').toLowerCase();
      const devName = (c.deviceName || '').toLowerCase();
      const key = (c.biometricKeyId || '').toLowerCase();
      return name.includes(q) || uId.includes(q) || devId.includes(q) || devName.includes(q) || key.includes(q);
    });
  }, [credentials, searchQuery]);

  // Truncate key: BIO-KEY-8F42...129
  const formatTruncatedKey = (key: string) => {
    if (!key) return '-';
    if (key.length <= 16) return key;
    return `${key.slice(0, 12)}...${key.slice(-4)}`;
  };

  const pendingCount = useMemo(() => {
    if (activeTab === 'PENDING') return credentials.length;
    return credentials.filter((c) => c.status === 'PENDING_APPROVAL').length;
  }, [credentials, activeTab]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-22 sm:bottom-6 right-6 z-50 bg-[#1d1d1f] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10 animate-fade-in">
          <CheckCircle2 size={18} className="text-[#34c759]" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
              <Fingerprint size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Biometric Approvals</h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Admin Device Lock
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Review office tablet registrations and permanently lock counselor fingerprints to authorized office devices.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 self-end sm:self-auto"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-slate-500' : 'text-slate-600'} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Tab & Search Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80 self-start">
            <button
              type="button"
              onClick={() => setActiveTab('PENDING')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === 'PENDING'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={13} className={activeTab === 'PENDING' ? 'text-amber-600' : 'text-slate-400'} />
              <span>Pending Approvals</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={13} className={activeTab === 'ALL' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>All Registered Credentials</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff, device ID, key..."
              className="w-full !pl-9.5 pr-8 py-1.5 h-[34px] rounded-md border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Clear Search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Office Device Info</th>
                <th className="py-3 px-4">Biometric Key ID</th>
                <th className="py-3 px-4">Submitted At</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 size={24} className="animate-spin text-emerald-600" />
                      <span className="text-xs font-medium text-slate-600">Loading biometric credentials...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCredentials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center gap-2 text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                        <Fingerprint size={24} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {activeTab === 'PENDING' ? 'No Pending Approvals' : 'No Biometric Credentials Found'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {activeTab === 'PENDING'
                          ? 'All office device fingerprint enrollments are currently locked and approved.'
                          : 'No staff members have enrolled their biometric fingerprint on an office device yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCredentials.map((item) => {
                  const isLocked = item.status === 'LOCKED' || item.isLocked;
                  const isPending = item.status === 'PENDING_APPROVAL';
                  const isRevoked = item.status === 'REVOKED';
                  const isOperating = actionLoadingId === item.id;

                  return (
                    <tr key={item.id || item.biometricKeyId} className="hover:bg-slate-50/60 transition-colors">
                      {/* Staff Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {(item.userName?.[0] || item.userId?.[0] || 'U').toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block leading-tight">
                              {item.userName || item.userId}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">@{item.userId}</span>
                          </div>
                        </div>
                      </td>

                      {/* Device Name & Hardware ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <Tablet size={13} className="text-slate-400 shrink-0" />
                            <span>{item.deviceName || 'Office Device'}</span>
                          </div>
                          <span className="inline-block self-start font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            ID: {item.deviceId}
                          </span>
                        </div>
                      </td>

                      {/* Biometric Key ID (Truncated + Copy button) */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/80 font-mono text-[11px] text-slate-700">
                          <span>{formatTruncatedKey(item.biometricKeyId)}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyKey(item.biometricKeyId)}
                            title="Copy full key"
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                          >
                            {copiedKeyId === item.biometricKeyId ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Submitted At (Asia/Kolkata timezone) */}
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {item.createdAt ? (
                          formatIndianTime(item.createdAt, { includeSeconds: false, fallback: item.createdAt })
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>PENDING_APPROVAL</span>
                          </span>
                        )}
                        {isLocked && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Lock size={11} className="text-emerald-600" />
                            <span>LOCKED</span>
                          </span>
                        )}
                        {isRevoked && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <Unlock size={11} className="text-rose-500" />
                            <span>REVOKED</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleApproveAndLock(item)}
                              disabled={isOperating}
                              className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                            >
                              {isOperating ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Lock size={12} />
                              )}
                              <span>Approve & Lock</span>
                            </button>
                          )}

                          {isLocked && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(item)}
                              disabled={isOperating}
                              className="px-2.5 py-1.5 rounded-md bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              {isOperating ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
                              <span>Revoke</span>
                            </button>
                          )}

                          {isRevoked && (
                            <button
                              type="button"
                              onClick={() => handleApproveAndLock(item)}
                              disabled={isOperating}
                              className="px-2.5 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              {isOperating ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                              <span>Re-Lock</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
