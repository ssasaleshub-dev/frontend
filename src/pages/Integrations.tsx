import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Check,
  Copy,
  RefreshCw,
  X,
  Settings,
  AlertCircle,
  Key,
  Mail,
  Send,
  MessageCircle,
  Video,
  Code,
  Globe,
  ExternalLink,
} from 'lucide-react';
import integrationsService, {
  GoogleIntegrationStatus,
  InstagramIntegrationStatus,
  DEFAULT_GOOGLE_CLIENT_ID,
} from '../services/api/integrationsService';

interface InboundWebhookPortal {
  id: string;
  name: string;
  category: 'WEBHOOK';
  description: string;
  endpoint: string;
  logoLetter: string;
  logoBg: string;
  logoColor: string;
  customIcon?: string;
}

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Google status & action states
  const [googleStatus, setGoogleStatus] = useState<GoogleIntegrationStatus>({ connected: false });
  const [loadingGoogle, setLoadingGoogle] = useState<boolean>(true);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [creatingMeet, setCreatingMeet] = useState<boolean>(false);

  // Instagram status
  const [instagramStatus, setInstagramStatus] = useState<InstagramIntegrationStatus>({
    configured: true,
    webhookUrl: 'https://ssasaleshub.cloud/api/webhooks/instagram',
    cachedProfilesCount: 0,
  });

  // Filter tabs: ALL, GOOGLE, INSTAGRAM, WEBHOOKS
  const [activeTab, setActiveTab] = useState<'ALL' | 'GOOGLE' | 'INSTAGRAM' | 'WEBHOOKS'>('ALL');

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal dialog states
  const [showGoogleSetupModal, setShowGoogleSetupModal] = useState<boolean>(false);
  const [showTestEmailModal, setShowTestEmailModal] = useState<boolean>(false);
  const [showInstagramReplyModal, setShowInstagramReplyModal] = useState<boolean>(false);
  const [showPayloadModal, setShowPayloadModal] = useState<boolean>(false);
  const [selectedPortal, setSelectedPortal] = useState<InboundWebhookPortal | null>(null);

  // Form states
  const [googleClientIdInput, setGoogleClientIdInput] = useState<string>(() => {
    return (
      localStorage.getItem('ssa_google_client_id') ||
      ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '') ||
      DEFAULT_GOOGLE_CLIENT_ID
    );
  });

  // Test Email form
  const [testEmailTo, setTestEmailTo] = useState<string>('');
  const [testEmailSubject, setTestEmailSubject] = useState<string>('SSA SalesHub - Verification Email');
  const [testEmailBody, setTestEmailBody] = useState<string>(
    'Hello from SSA SalesHub!\n\nYour Google Workspace integration is connected and sending messages successfully.'
  );
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);

  // Instagram DM form
  const [igRecipientId, setIgRecipientId] = useState<string>('');
  const [igMessage, setIgMessage] = useState<string>('Hello! Thanks for contacting SSA Saleshub.');
  const [igLeadId, setIgLeadId] = useState<string>('10');
  const [sendingDm, setSendingDm] = useState<boolean>(false);

  // Feedback notification banner
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
        text: 'Completing Google Workspace authorization…',
      });
      integrationsService
        .exchangeGoogleCode(codeParam)
        .then(() => {
          setBanner({
            type: 'success',
            text: 'Google Workspace connected successfully!',
          });
          fetchStatus();
        })
        .catch((err: any) => {
          console.error('Code exchange failed:', err);
          setBanner({
            type: 'error',
            text: 'Authorization code exchange failed. Please verify credentials or try again.',
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
        text: 'Google Workspace connected successfully!',
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
    if (!window.confirm('Disconnect your Google account from SSA SalesHub?')) return;
    setDisconnecting(true);
    try {
      await integrationsService.disconnectGoogle();
      setGoogleStatus({ connected: false });
      setBanner({
        type: 'success',
        text: 'Google account disconnected.',
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

  // Quick Meet generator
  const handleQuickMeet = async () => {
    setCreatingMeet(true);
    try {
      const res = await integrationsService.createGoogleMeet('Client Consultation');
      const meetLink = res?.meetUrl || res?.url || res?.hangoutsLink;
      if (meetLink) {
        await navigator.clipboard.writeText(meetLink);
        setBanner({
          type: 'success',
          text: `Google Meet created and copied to clipboard: ${meetLink}`,
        });
      } else {
        setBanner({
          type: 'success',
          text: 'Google Meet consultation event scheduled.',
        });
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to generate Google Meet link. Verify account permissions.',
      });
    } finally {
      setCreatingMeet(false);
    }
  };

  // Send Test Email submit
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

  // Send Instagram DM submit
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

  const WEBHOOK_BASE = 'https://api.ssasaleshub.cloud/api/webhooks/inbound';

  const inboundPortals: InboundWebhookPortal[] = [
    {
      id: 'wix',
      name: 'Wix Contact Form',
      category: 'WEBHOOK',
      description: 'Capture inbound lead inquiries submitted through your Wix website.',
      endpoint: `${WEBHOOK_BASE}/wix`,
      logoLetter: 'WI',
      logoBg: 'bg-slate-100',
      logoColor: 'text-slate-800',
    },
    {
      id: 'jotform',
      name: 'Jotform',
      category: 'WEBHOOKS' as any,
      description: 'Capture student registrations and custom admission forms from Jotform.',
      endpoint: `${WEBHOOK_BASE}/jotform`,
      logoLetter: 'JO',
      logoBg: 'bg-orange-50',
      logoColor: 'text-orange-600',
    },
    {
      id: 'google-forms',
      name: 'Google Forms',
      category: 'WEBHOOK',
      description: 'Push responses from Google Forms directly into your candidate CRM pipeline.',
      endpoint: `${WEBHOOK_BASE}/google-forms`,
      logoLetter: 'GF',
      logoBg: 'bg-purple-50',
      logoColor: 'text-purple-600',
      customIcon: '/icons/google-forms.png',
    },
    {
      id: 'google-ads',
      name: 'Google Ads Lead Form',
      category: 'WEBHOOK',
      description: 'Receive real-time candidate leads from Google Search and Display Lead Extensions.',
      endpoint: `${WEBHOOK_BASE}/google-ads`,
      logoLetter: 'GA',
      logoBg: 'bg-blue-50',
      logoColor: 'text-blue-600',
    },
    {
      id: 'urbanpro',
      name: 'UrbanPro',
      category: 'WEBHOOK',
      description: 'Automatically capture tutoring and test-prep inquiry leads from UrbanPro.',
      endpoint: `${WEBHOOK_BASE}/urbanpro`,
      logoLetter: 'UP',
      logoBg: 'bg-emerald-50',
      logoColor: 'text-emerald-700',
    },
    {
      id: 'aajjo',
      name: 'AAJJO.com',
      category: 'WEBHOOK',
      description: 'Receive trade RFQs and buyer candidate inquiries from aajjo.com.',
      endpoint: `${WEBHOOK_BASE}/aajjo`,
      logoLetter: 'AJ',
      logoBg: 'bg-amber-50',
      logoColor: 'text-amber-700',
    },
    {
      id: 'calendly',
      name: 'Calendly',
      category: 'WEBHOOK',
      description: 'Sync scheduled appointments and log consultation meetings into the CRM.',
      endpoint: `${WEBHOOK_BASE}/calendly`,
      logoLetter: 'CA',
      logoBg: 'bg-sky-50',
      logoColor: 'text-sky-600',
    },
  ];

  const samplePayloadJson = JSON.stringify(
    {
      name: 'Candidate Name',
      phone: '+91 9876543210',
      email: 'candidate@example.com',
      city: 'Chennai',
      notes: 'Course Inquiry',
    },
    null,
    2
  );

  const connectedEmail = googleStatus.email || googleStatus.googleEmail;

  return (
    <div className="max-w-6xl mx-auto py-2 space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Integrations Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect communication channels, Google Workspace, and inbound webhooks to your candidate pipeline.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                googleStatus.connected ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            />
            <span>{googleStatus.connected ? `Google: ${connectedEmail || 'Connected'}` : 'Google: Not connected'}</span>
          </div>

          <button
            type="button"
            onClick={fetchStatus}
            disabled={loadingGoogle}
            title="Refresh status"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loadingGoogle ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Status Feedback Banner ── */}
      {banner && (
        <div
          className={`flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium border ${
            banner.type === 'success'
              ? 'bg-emerald-50/90 text-emerald-900 border-emerald-200'
              : 'bg-rose-50/90 text-rose-900 border-rose-200'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-slate-600 ml-3 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Simple Category Tabs ── */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs">
        {[
          { id: 'ALL', label: 'All Integrations' },
          { id: 'GOOGLE', label: 'Google Workspace' },
          { id: 'INSTAGRAM', label: 'Instagram DM' },
          { id: 'WEBHOOKS', label: 'Inbound Webhooks' },
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

      {/* ── Card Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* CATEGORY 1: GOOGLE WORKSPACE CARD                                   */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'ALL' || activeTab === 'GOOGLE') && (
          <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  {/* Google Workspace Official Multi-color Logo */}
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Google Workspace</h3>
                    <span className="text-[11px] text-slate-400">Gmail &bull; Meet &bull; Sheets &bull; Calendar</span>
                  </div>
                </div>

                {/* Status Badge */}
                {googleStatus.connected ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Connected
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Not Connected</span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Send candidate emails via Gmail, schedule instant Google Meet video consultations, and export CRM leads to Google Sheets.
              </p>

              {googleStatus.connected && connectedEmail && (
                <div className="p-2 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-600 font-mono truncate">
                  Account: {connectedEmail}
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100">
              {googleStatus.connected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleQuickMeet}
                      disabled={creatingMeet}
                      className="flex-1 h-8 px-3 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {creatingMeet ? <RefreshCw size={12} className="animate-spin" /> : <Video size={13} />}
                      <span>Quick Meet Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTestEmailModal(true)}
                      className="h-8 px-3 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Mail size={12} />
                      <span>Test Email</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowGoogleSetupModal(true)}
                      className="text-slate-500 hover:text-slate-800 underline text-[11px] cursor-pointer"
                    >
                      OAuth Settings
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectGoogle}
                      disabled={disconnecting}
                      className="text-rose-600 hover:text-rose-800 text-[11px] font-medium cursor-pointer"
                    >
                      {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleConnectGoogle()}
                    disabled={connecting}
                    className="flex-1 h-8 px-3 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {connecting ? <RefreshCw size={12} className="animate-spin" /> : null}
                    <span>Connect Google Workspace</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGoogleSetupModal(true)}
                    title="OAuth Client Configuration"
                    className="h-8 px-2 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded transition-colors cursor-pointer"
                  >
                    <Settings size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* CATEGORY 2: INSTAGRAM DIRECT MESSAGE (DM) CARD                      */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'ALL' || activeTab === 'INSTAGRAM') && (
          <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center shrink-0 text-white">
                    <MessageCircle size={17} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Instagram DM</h3>
                    <span className="text-[11px] text-slate-400">Direct Message Capture &amp; Reply</span>
                  </div>
                </div>

                {/* Clean, quiet status: Plain dot + Active */}
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Active
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Automatically capture leads from Instagram DMs and reply directly from SSA Saleshub.
              </p>

              <div className="p-2 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-600 font-mono truncate">
                Status: Connected &amp; Listening to messages
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowInstagramReplyModal(true)}
                className="w-full h-8 px-3 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageCircle size={13} />
                <span>Send Outbound DM / Reply</span>
              </button>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* CATEGORY 3: INBOUND WEBHOOKS & PORTALS CARDS                         */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'ALL' || activeTab === 'WEBHOOKS') &&
          inboundPortals.map((portal) => (
            <div
              key={portal.id}
              className="bg-white border border-slate-200 rounded-md p-4 flex flex-col justify-between shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    {portal.customIcon ? (
                      <img src={portal.customIcon} alt={portal.name} className="w-8 h-8 object-contain shrink-0" />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded ${portal.logoBg} ${portal.logoColor} flex items-center justify-center font-bold text-xs uppercase shrink-0 border border-slate-100`}
                      >
                        {portal.logoLetter}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{portal.name}</h3>
                      <span className="text-[11px] text-slate-400">Inbound Webhook</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Live
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{portal.description}</p>

                {/* Compact URL Box */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Webhook URL</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPortal(portal);
                        setShowPayloadModal(true);
                      }}
                      className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
                    >
                      Sample Payload
                    </button>
                  </div>
                  <div className="flex items-center gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-700">
                    <span className="truncate flex-1 select-all">{portal.endpoint}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(portal.id, portal.endpoint)}
                      title="Copy URL"
                      className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                    >
                      {copiedId === portal.id ? (
                        <Check size={13} className="text-emerald-600" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(portal.id, portal.endpoint)}
                  className="flex-1 h-8 px-3 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50 text-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedId === portal.id ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Webhook URL</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPortal(portal);
                    setShowPayloadModal(true);
                  }}
                  title="View JSON Payload Structure"
                  className="h-8 px-2.5 text-xs font-medium rounded border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer flex items-center gap-1"
                >
                  <Code size={13} />
                  <span>Payload</span>
                </button>
              </div>
            </div>
          ))}
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
                <div className="w-8 h-8 rounded bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Send Test Email</h3>
                  <span className="text-[11px] text-slate-500">
                    From: {connectedEmail || 'Connected Google Workspace'}
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
      {/* DIALOG 2: INSTAGRAM DM REPLY MODAL                                   */}
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
                <div className="w-8 h-8 rounded bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white">
                  <MessageCircle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Send Instagram Direct Message</h3>
                  <span className="text-[11px] text-slate-500">Outbound reply directly to candidate</span>
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
                  Recipient ID (IGSID)
                </label>
                <input
                  type="text"
                  required
                  value={igRecipientId}
                  onChange={(e) => setIgRecipientId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full h-8 px-2.5 text-xs font-mono border border-slate-300 rounded focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Message
                </label>
                <textarea
                  required
                  rows={4}
                  value={igMessage}
                  onChange={(e) => setIgMessage(e.target.value)}
                  placeholder="Type your message..."
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
                  placeholder="e.g. 10"
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
                  <span>{sendingDm ? 'Sending…' : 'Send DM'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* DIALOG 3: SAMPLE INBOUND PAYLOAD MODAL                               */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showPayloadModal && selectedPortal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowPayloadModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Code size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{selectedPortal.name} Payload</h3>
                  <span className="text-[11px] text-slate-500">Inbound JSON Structure</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayloadModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Webhook URL:</span>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-800 truncate select-all">
                {selectedPortal.endpoint}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Expected JSON Schema (POST):</span>
                <button
                  type="button"
                  onClick={() => handleCopy('sample-payload', samplePayloadJson)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  {copiedId === 'sample-payload' ? 'Copied!' : 'Copy JSON'}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded text-xs font-mono overflow-x-auto leading-relaxed">
                {samplePayloadJson}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPayloadModal(false)}
                className="h-8 px-4 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
              >
                Done
              </button>
            </div>
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
                  <span className="text-[11px] text-slate-500">Google Workspace Client Credentials</span>
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

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Google OAuth Client ID:
              </label>
              <input
                type="text"
                value={googleClientIdInput}
                onChange={(e) => setGoogleClientIdInput(e.target.value)}
                placeholder="e.g. 644951238009-xxx.apps.googleusercontent.com"
                className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded focus:border-slate-900 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">
                Stored in this browser workspace for automatic authorization.
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-800">
                Authorized Redirect URI (Google Cloud Console):
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
