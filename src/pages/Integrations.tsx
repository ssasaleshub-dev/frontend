import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileSpreadsheet,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  X,
  Calendar,
  Globe,
  Settings,
  AlertCircle,
  Key,
  Mail,
  Send,
  MessageCircle,
} from 'lucide-react';
import integrationsService, {
  GoogleIntegrationStatus,
  InstagramIntegrationStatus,
  DEFAULT_GOOGLE_CLIENT_ID,
} from '../services/api/integrationsService';

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Google status & actions
  const [googleStatus, setGoogleStatus] = useState<GoogleIntegrationStatus>({ connected: false });
  const [loadingGoogle, setLoadingGoogle] = useState<boolean>(true);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);

  // Instagram status
  const [instagramStatus, setInstagramStatus] = useState<InstagramIntegrationStatus>({
    configured: true,
    webhookUrl: 'https://ssasaleshub.cloud/api/webhooks/instagram',
    cachedProfilesCount: 0,
  });

  // Filter tabs: ALL, DIRECT (Gmail & Instagram DM), GOOGLE (Workspace)
  const [activeTab, setActiveTab] = useState<'ALL' | 'DIRECT' | 'GOOGLE'>('ALL');

  // Copy feedback state (holds provider id)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [showGoogleSetupModal, setShowGoogleSetupModal] = useState<boolean>(false);
  const [showTestEmailModal, setShowTestEmailModal] = useState<boolean>(false);
  const [showInstagramReplyModal, setShowInstagramReplyModal] = useState<boolean>(false);

  // Form states
  const [googleClientIdInput, setGoogleClientIdInput] = useState<string>(() => {
    return (
      localStorage.getItem('ssa_google_client_id') ||
      ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '') ||
      DEFAULT_GOOGLE_CLIENT_ID
    );
  });

  // Send Test Email form
  const [testEmailTo, setTestEmailTo] = useState<string>('');
  const [testEmailSubject, setTestEmailSubject] = useState<string>('SSA SalesHub - Test Verification Email');
  const [testEmailBody, setTestEmailBody] = useState<string>(
    'Hello from SSA SalesHub!\n\nYour Gmail integration is connected and sending messages successfully.'
  );
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);

  // Send Instagram DM form
  const [igRecipientId, setIgRecipientId] = useState<string>('');
  const [igMessage, setIgMessage] = useState<string>('Hello! Thanks for contacting SSA Saleshub.');
  const [igLeadId, setIgLeadId] = useState<string>('');
  const [sendingDm, setSendingDm] = useState<boolean>(false);

  // Notification feedback banner
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const [gStatus, igStatus] = await Promise.all([
        integrationsService.getGoogleStatus(),
        integrationsService.getInstagramStatus(),
      ]);
      setGoogleStatus(gStatus);
      if (gStatus.email && !testEmailTo) {
        setTestEmailTo(gStatus.email);
      }
      if (igStatus) {
        setInstagramStatus(igStatus);
      }
    } catch {
      setGoogleStatus({ connected: false });
    } finally {
      setLoadingGoogle(false);
    }
  }, [testEmailTo]);

  // Handle OAuth callback parameters (?code=XYZ or ?google_connected=true or ?google_error=...)
  useEffect(() => {
    const codeParam = searchParams.get('code');
    const connectedParam = searchParams.get('google_connected');
    const errorParam = searchParams.get('google_error');

    if (codeParam) {
      setBanner({
        type: 'success',
        text: 'Exchanging authorization code with Google…',
      });
      integrationsService
        .exchangeGoogleCode(codeParam)
        .then(() => {
          setBanner({
            type: 'success',
            text: 'Gmail account connected successfully!',
          });
          fetchStatus();
        })
        .catch((err: any) => {
          console.error('Code exchange failed:', err);
          setBanner({
            type: 'error',
            text: 'Authorization code exchange failed. Please verify client credentials or try again.',
          });
          fetchStatus();
        })
        .finally(() => {
          searchParams.delete('code');
          searchParams.delete('state');
          searchParams.delete('scope');
          setSearchParams(searchParams, { replace: true });
        });
    } else if (connectedParam === 'true') {
      setBanner({
        type: 'success',
        text: 'Gmail account connected successfully!',
      });
      fetchStatus();
      searchParams.delete('google_connected');
      setSearchParams(searchParams, { replace: true });
    } else if (errorParam) {
      setBanner({
        type: 'error',
        text: `Google connection failed: ${decodeURIComponent(errorParam)}.`,
      });
      fetchStatus();
      searchParams.delete('google_error');
      setSearchParams(searchParams, { replace: true });
    } else {
      fetchStatus();
    }
  }, [fetchStatus, searchParams, setSearchParams]);

  // Connect Google
  const handleConnectGoogle = async (customClientId?: string) => {
    setConnecting(true);
    try {
      const result = await integrationsService.getGoogleAuthUrl(customClientId);
      if (!result.hasClientId) {
        setShowGoogleSetupModal(true);
        setConnecting(false);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Unable to start Google sign-in. Please try again.',
      });
      setConnecting(false);
    }
  };

  const handleSaveAndConnectGoogle = () => {
    const trimmed = googleClientIdInput.trim();
    if (!trimmed) {
      alert('Please enter your Google OAuth Client ID.');
      return;
    }
    localStorage.setItem('ssa_google_client_id', trimmed);
    setShowGoogleSetupModal(false);
    handleConnectGoogle(trimmed);
  };

  // Disconnect Google
  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Disconnect your Google / Gmail account from SSA SalesHub?')) return;
    setDisconnecting(true);
    try {
      await integrationsService.disconnectGoogle();
      setGoogleStatus({ connected: false });
      setBanner({
        type: 'success',
        text: 'Gmail account disconnected.',
      });
    } catch {
      setBanner({
        type: 'error',
        text: 'Failed to disconnect account. Please try again.',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  // Send Test Email Submit
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailTo.trim()) {
      alert('Please provide a recipient email address.');
      return;
    }
    setSendingEmail(true);
    try {
      await integrationsService.sendTestEmail({
        to: testEmailTo.trim(),
        subject: testEmailSubject.trim(),
        body: testEmailBody.trim(),
      });
      setBanner({
        type: 'success',
        text: `Test email sent successfully to ${testEmailTo}!`,
      });
      setShowTestEmailModal(false);
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to send test email. Ensure Gmail account is connected.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Send Instagram DM Submit
  const handleSendInstagramDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igRecipientId.trim() || !igMessage.trim()) {
      alert('Recipient ID and Message are required.');
      return;
    }
    setSendingDm(true);
    try {
      await integrationsService.sendInstagramMessage({
        recipientId: igRecipientId.trim(),
        message: igMessage.trim(),
        leadId: igLeadId ? Number(igLeadId) : undefined,
      });
      setBanner({
        type: 'success',
        text: 'Instagram DM sent successfully!',
      });
      setShowInstagramReplyModal(false);
      setIgRecipientId('');
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to send Instagram DM. Check recipient ID and permissions.',
      });
    } finally {
      setSendingDm(false);
    }
  };

  // Copy helper
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const connectedEmail = googleStatus.email || googleStatus.googleEmail;

  return (
    <div className="max-w-6xl mx-auto py-2 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Integrations Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect communication channels and Google Workspace to your candidate pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtle Google Status */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded text-xs text-slate-600">
            <span
              className={`w-2 h-2 rounded-full ${
                googleStatus.connected ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
            />
            <span className="font-medium">
              Gmail: {googleStatus.connected ? connectedEmail || 'Connected' : 'Not connected'}
            </span>
          </div>

          <button
            type="button"
            onClick={fetchStatus}
            disabled={loadingGoogle}
            title="Refresh status"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loadingGoogle ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Status Feedback Banner ── */}
      {banner && (
        <div
          className={`flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs font-medium border ${
            banner.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-slate-700 ml-3 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Standard Horizontal Filter Tabs ── */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs">
        {[
          { id: 'ALL', label: 'All Integrations' },
          { id: 'DIRECT', label: 'Gmail & Instagram DM' },
          { id: 'GOOGLE', label: 'Google Workspace' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-2.5 -mb-px font-medium transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-b-2 border-slate-900 text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 3-Column Responsive Clean Card Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* CARD 1: GMAIL INTEGRATION CARD                                      */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'ALL' || activeTab === 'DIRECT' || activeTab === 'GOOGLE') && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  {/* Authentic Gmail Logo Icon */}
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M2.25 19.5h3.75V10.5L2.25 7.687V19.5z"
                      />
                      <path
                        fill="#34A853"
                        d="M18 19.5h3.75V7.687L18 10.5v9z"
                      />
                      <path
                        fill="#EA4335"
                        d="M18 7.687l-6 4.5-6-4.5V4.5l6 4.5 6-4.5v3.187z"
                      />
                      <path
                        fill="#FBBC04"
                        d="M6 7.687L2.25 4.875A1.5 1.5 0 014.5 3h15a1.5 1.5 0 012.25 1.875L18 7.687l-6 4.5-6-4.5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Gmail</h3>
                    <span className="text-[11px] text-slate-400">Direct Candidate Inbox</span>
                  </div>
                </div>

                {/* Badge */}
                {googleStatus.connected ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 max-w-[170px] truncate"
                    title={`Connected as ${connectedEmail}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                    <span className="truncate">Connected as {connectedEmail}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                    Not Connected
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Connect your Gmail account to send emails directly from your inbox, track email threads, and sync candidate communications.
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100">
              {googleStatus.connected ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTestEmailModal(true)}
                    className="flex-1 h-8 px-3 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send size={12} />
                    <span>Send Test Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    disabled={disconnecting}
                    title="Disconnect Gmail Account"
                    className="h-8 px-3 text-xs font-medium rounded border border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGoogleSetupModal(true)}
                    title="OAuth Client Configuration"
                    className="h-8 px-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded transition-colors cursor-pointer"
                  >
                    <Settings size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleConnectGoogle()}
                    disabled={connecting}
                    className="flex-1 h-8 px-3 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    {/* Google G logo */}
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path
                        fill="#ffffff"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#ffffff"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#ffffff"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#ffffff"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{connecting ? 'Connecting…' : 'Connect Gmail Account'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGoogleSetupModal(true)}
                    title="OAuth Client Configuration"
                    className="h-8 px-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded transition-colors cursor-pointer"
                  >
                    <Settings size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* CARD 2: INSTAGRAM DM INTEGRATION CARD                               */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'ALL' || activeTab === 'DIRECT') && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/icons/instagram.png"
                    alt="Instagram DM"
                    className="w-8 h-8 rounded-lg object-contain shrink-0"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Instagram DM</h3>
                    <span className="text-[11px] text-slate-400">Direct Message Channel</span>
                  </div>
                </div>

                {/* Clean static status indicator */}
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Active
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Automatically capture leads from Instagram Direct Messages and reply directly from SSA Saleshub.
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInstagramReplyModal(true)}
                className="w-full h-8 px-2.5 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageCircle size={13} />
                <span>Send Outbound DM / Reply</span>
              </button>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* CARD 3: GOOGLE MEET                                                 */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'ALL' || activeTab === 'GOOGLE') && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <img src="/icons/google-meet.png" alt="Google Meet" className="w-8 h-8 object-contain shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Google Meet</h3>
                    <span className="text-[11px] text-slate-400">Video Consultations</span>
                  </div>
                </div>

                {googleStatus.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Connected
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Not connected</span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Automatically generate video meeting links for scheduled consultations and candidate calls.
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100">
              {googleStatus.connected ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-slate-600 truncate max-w-[170px]" title={connectedEmail}>
                    {connectedEmail || 'Connected'}
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    disabled={disconnecting}
                    className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                  >
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnectGoogle()}
                  disabled={connecting}
                  className="w-full h-8 px-3 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {connecting ? <RefreshCw size={12} className="animate-spin" /> : null}
                  <span>Connect Google Meet</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* CARD 4: GOOGLE SHEETS                                               */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'ALL' || activeTab === 'GOOGLE') && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <img src="/icons/google-sheets.png" alt="Google Sheets" className="w-8 h-8 object-contain shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Google Sheets</h3>
                    <span className="text-[11px] text-slate-400">Spreadsheet Export</span>
                  </div>
                </div>

                {googleStatus.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Connected
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Not connected</span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Export candidate inquiries, customer lists, and performance reports directly to Google Sheets.
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100">
              {googleStatus.connected ? (
                <a
                  href="/leads"
                  className="w-full h-8 px-3 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50 text-slate-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <FileSpreadsheet size={13} />
                  <span>Go to Leads to Export</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnectGoogle()}
                  disabled={connecting}
                  className="w-full h-8 px-3 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Connect Google Sheets</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* DIALOG 1: GMAIL TEST EMAIL MODAL                                     */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showTestEmailModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowTestEmailModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Send Test Email</h3>
                  <span className="text-[11px] text-slate-500">
                    From: {connectedEmail || 'Connected Gmail Account'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTestEmailModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder="e.g. counselor@example.com"
                  className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  value={testEmailSubject}
                  onChange={(e) => setTestEmailSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Message Body
                </label>
                <textarea
                  required
                  rows={4}
                  value={testEmailBody}
                  onChange={(e) => setTestEmailBody(e.target.value)}
                  placeholder="Type your test message..."
                  className="w-full p-2 text-xs border border-slate-300 rounded focus:border-slate-900 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTestEmailModal(false)}
                  className="h-8 px-3 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="h-8 px-4 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {sendingEmail ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                  <span>{sendingEmail ? 'Sending…' : 'Send Test Email'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* DIALOG 3: INSTAGRAM DM QUICK REPLY MODAL (InstagramReplyModal)       */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showInstagramReplyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowInstagramReplyModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white">
                  <MessageCircle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Reply to Instagram DM</h3>
                  <span className="text-[11px] text-slate-500">Send outbound message directly to IG user</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstagramReplyModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendInstagramDm} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Instagram User ID / Handle (IGSID)
                </label>
                <input
                  type="text"
                  required
                  value={igRecipientId}
                  onChange={(e) => setIgRecipientId(e.target.value)}
                  placeholder="e.g. 17841400000000000 or username"
                  className="w-full h-8 px-2.5 text-xs font-mono border border-slate-300 rounded focus:border-slate-900 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  The unique Instagram-scoped ID (IGSID) of the recipient.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Message Text
                </label>
                <textarea
                  required
                  rows={4}
                  value={igMessage}
                  onChange={(e) => setIgMessage(e.target.value)}
                  placeholder="Type your reply message..."
                  className="w-full p-2 text-xs border border-slate-300 rounded focus:border-slate-900 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Associated Lead ID (Optional)
                </label>
                <input
                  type="number"
                  value={igLeadId}
                  onChange={(e) => setIgLeadId(e.target.value)}
                  placeholder="e.g. 42"
                  className="w-full h-8 px-2.5 text-xs font-mono border border-slate-300 rounded focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInstagramReplyModal(false)}
                  className="h-8 px-3 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingDm}
                  className="h-8 px-4 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {sendingDm ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                  <span>{sendingDm ? 'Sending…' : 'Send Message'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* DIALOG 4: GOOGLE WORKSPACE OAUTH SETUP MODAL                         */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showGoogleSetupModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowGoogleSetupModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-lg w-full p-5 space-y-4 border border-slate-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-700">
                  <Key size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Google OAuth Configuration</h3>
                  <span className="text-[11px] text-slate-500">Gmail, Meet & Sheets Integration</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleSetupModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-md text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                <AlertCircle size={14} className="shrink-0 text-amber-700" />
                <span>Google OAuth Client ID is required</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900/90">
                Google requires a valid Client ID to initiate authentication. Your client ID is saved below and will be used for authorization.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Google OAuth Client ID:
              </label>
              <input
                type="text"
                value={googleClientIdInput}
                onChange={(e) => setGoogleClientIdInput(e.target.value)}
                placeholder="e.g. 1234567890-abcdefgh.apps.googleusercontent.com"
                className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded focus:border-slate-900 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">
                Stored in your browser and used automatically across this workspace.
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-800">
                Authorized Redirect URI (In Google Cloud Console):
              </span>
              <div className="flex items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-700">
                <span className="truncate flex-1 select-all text-[11px]">
                  https://ssasaleshub.cloud/api/integrations/google/callback
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy('redirect-uri', 'https://ssasaleshub.cloud/api/integrations/google/callback')
                  }
                  className="px-2 py-0.5 text-[11px] font-medium border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                >
                  {copiedId === 'redirect-uri' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-100 space-y-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-800 block text-[11px]">Setup Checklist:</span>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                <li>Go to <span className="font-medium text-slate-800">Google Cloud Console &gt; APIs &amp; Services &gt; Credentials</span>.</li>
                <li>Ensure the redirect URI above is added under <span className="font-medium text-slate-800">Authorized redirect URIs</span>.</li>
                <li>Copy the Client ID and paste it into the field above.</li>
                <li><span className="text-slate-500">(For backend server admin): Also set <code className="font-mono bg-slate-200/70 px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="font-mono bg-slate-200/70 px-1 rounded">GOOGLE_CLIENT_SECRET</code> in the backend server <code className="font-mono">.env</code>.</span></li>
              </ol>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGoogleSetupModal(false)}
                className="h-8 px-3 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAndConnectGoogle}
                disabled={!googleClientIdInput.trim()}
                className="h-8 px-4 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <span>Save &amp; Connect Google</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
