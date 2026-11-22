import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { CheckCircle2, Fingerprint, Globe, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import biometricService, { FINGERPRINT_APP_ONLY_MESSAGE } from '../services/biometricService';
import attendanceVerificationService, {
  AttendanceVerification,
  describeRequestSource,
} from '../services/api/attendanceVerificationService';
import { formatIndianTime } from '../utils/dateTimeUtils';

type Outcome = 'approved' | 'rejected' | null;

/**
 * Opened on the phone from the "Approve your check-in" push notification (or the Attendance
 * banner). The staff member confirms a web check-in with their fingerprint, or declines it.
 */
export default function AttendanceApprovePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.login || '';

  const [request, setRequest] = useState<AttendanceVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [checkInTime, setCheckInTime] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setRequest(await attendanceVerificationService.get(id));
    } catch (err: any) {
      setError(err?.message || 'Could not load this check-in request.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!request?.expiresAt || request.status !== 'PENDING') return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(request.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [request?.expiresAt, request?.status]);

  const isPending = request?.status === 'PENDING' && secondsLeft > 0;

  const handleApprove = async () => {
    if (!request?.signedMessage || !userId) return;
    setBusy(true);
    setError(null);
    try {
      const signed = await biometricService.signAttendanceChallenge({
        userId,
        message: request.signedMessage,
        title: 'Approve check-in',
        subtitle: `Requested from ${describeRequestSource(request.requestedFrom)}`,
      });
      const record = await attendanceVerificationService.approve(request.id, signed.signature, signed.deviceId);
      setCheckInTime(record?.checkInTime ? formatIndianTime(record.checkInTime, { includeSeconds: true }) : '');
      setOutcome('approved');
      window.dispatchEvent(new CustomEvent('ssa_attendance_updated'));
    } catch (err: any) {
      const code = err?.code;
      if (code === 'NO_KEY' || code === 'KEY_INVALIDATED') {
        setError(`${err.message} Go to Attendance → Register Office Fingerprint, then ask an admin to approve it.`);
      } else {
        setError(err?.response?.data?.detail || err?.message || 'Fingerprint approval failed.');
      }
      load();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;
    setBusy(true);
    try {
      await attendanceVerificationService.reject(request.id);
      setOutcome('rejected');
    } catch (err: any) {
      setError(err?.message || 'Could not decline the request.');
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl border border-black/[0.06] shadow-xs p-6 text-center">{children}</div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="py-10 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 size={22} className="animate-spin" />
        <p className="text-sm">Loading check-in request…</p>
      </div>
    );
  }

  if (outcome === 'approved') {
    return shell(
      <>
        <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">You're checked in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fingerprint verified{checkInTime ? ` at ${checkInTime}` : ''}. The web page will update in a moment.
        </p>
        <button type="button" onClick={() => navigate('/attendance')} className="mt-6 w-full h-11 rounded-xl bg-[#007aff] text-white text-sm font-semibold">
          Done
        </button>
      </>
    );
  }

  if (outcome === 'rejected') {
    return shell(
      <>
        <XCircle size={48} className="mx-auto text-rose-600" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">Request declined</h1>
        <p className="mt-1 text-sm text-slate-600">No check-in was recorded. If you didn't start this, tell your admin and change your password.</p>
        <button type="button" onClick={() => navigate('/attendance')} className="mt-6 w-full h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
          Close
        </button>
      </>
    );
  }

  if (!request) {
    return shell(
      <>
        <ShieldAlert size={44} className="mx-auto text-slate-400" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">Request not found</h1>
        <p className="mt-1 text-sm text-slate-600">{error || 'This check-in request no longer exists.'}</p>
        <button type="button" onClick={() => navigate('/attendance')} className="mt-6 w-full h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
          Go to Attendance
        </button>
      </>
    );
  }

  if (!isPending) {
    const label = request.status === 'APPROVED' ? 'already approved' : request.status === 'REJECTED' ? 'declined' : 'expired';
    return shell(
      <>
        <ShieldAlert size={44} className="mx-auto text-slate-400" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">This request was {label}</h1>
        <p className="mt-1 text-sm text-slate-600">To check in, start again from the web page or from Attendance in this app.</p>
        <button type="button" onClick={() => navigate('/attendance')} className="mt-6 w-full h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
          Go to Attendance
        </button>
      </>
    );
  }

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return shell(
    <>
      <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-[#007aff] flex items-center justify-center">
        <Fingerprint size={32} />
      </div>
      <h1 className="mt-4 text-lg font-bold text-slate-900">Approve check-in?</h1>
      <p className="mt-1 text-sm text-slate-600">Only approve if you just tried to check in yourself.</p>

      <dl className="mt-5 text-left bg-slate-50 border border-slate-200 rounded-2xl divide-y divide-slate-200 text-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-slate-500">Requested from</dt>
          <dd className="flex items-center gap-1.5 font-medium text-slate-800">
            <Globe size={14} className="text-slate-400" />
            {describeRequestSource(request.requestedFrom)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-slate-500">Requested at</dt>
          <dd className="font-medium text-slate-800">{formatIndianTime(request.createdAt, { includeSeconds: true })}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-slate-500">Work mode</dt>
          <dd className="font-medium text-slate-800 capitalize">{(request.workMode || 'OFFICE').toLowerCase()}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-slate-500">Expires in</dt>
          <dd className="font-mono tabular-nums font-medium text-slate-800">
            {mm}:{ss}
          </dd>
        </div>
      </dl>

      {error && <p className="mt-4 text-sm text-rose-600 text-left">{error}</p>}

      {Capacitor.isNativePlatform() ? (
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            className="w-full h-12 rounded-xl bg-[#007aff] active:bg-[#0062cc] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={18} />}
            Approve with fingerprint
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={busy}
            className="w-full h-11 rounded-xl border border-slate-200 text-sm font-semibold text-rose-600 disabled:opacity-60"
          >
            This wasn't me
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-600">{FINGERPRINT_APP_ONLY_MESSAGE} Open the notification on your registered phone.</p>
      )}
    </>
  );
}
