import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Video,
  FileSpreadsheet,
  HardDrive,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  X,
  CreditCard,
  FileText,
  Calendar,
  Globe,
} from 'lucide-react';
import integrationsService, { GoogleIntegrationStatus } from '../services/api/integrationsService';

interface WebhookInfo {
  id: string;
  title: string;
  category: 'WEBHOOKS';
  description: string;
  endpoint: string;
  instructions: string[];
}

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [googleStatus, setGoogleStatus] = useState<GoogleIntegrationStatus>({ connected: false });
  const [loadingGoogle, setLoadingGoogle] = useState<boolean>(true);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);

  // Filter tabs
  const [activeTab, setActiveTab] = useState<'ALL' | 'GOOGLE' | 'WEBHOOKS' | 'PAYMENTS'>('ALL');

  // Copy feedback state (holds provider id)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Webhook Instruction Modal
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookInfo | null>(null);

  // Notification feedback banner
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const status = await integrationsService.getGoogleStatus();
      setGoogleStatus(status);
    } catch {
      setGoogleStatus({ connected: false });
    } finally {
      setLoadingGoogle(false);
    }
  }, []);

  // Handle OAuth callback parameters
  useEffect(() => {
    const connectedParam = searchParams.get('google_connected');
    const errorParam = searchParams.get('google_error');

    if (connectedParam === 'true') {
      setBanner({
        type: 'success',
        text: 'Google Workspace connected successfully.',
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
  const handleConnectGoogle = async () => {
    setConnecting(true);
    try {
      const url = await integrationsService.getGoogleAuthUrl();
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Unable to start Google sign-in. Please try again.',
      });
      setConnecting(false);
    }
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

  // Copy helper
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const WEBHOOK_BASE = 'https://api.ssasaleshub.cloud/api/webhooks/inbound';

  const webhooks: WebhookInfo[] = [
    {
      id: 'wix',
      title: 'Wix Form',
      category: 'WEBHOOKS',
      description: 'Capture leads submitted through Wix website forms.',
      endpoint: `${WEBHOOK_BASE}/wix`,
      instructions: [
        'Open your Wix site dashboard and go to Automations.',
        'Choose "When visitor submits form" as the trigger.',
        'Select "Send via Webhook" as the action.',
        'Paste the Webhook URL and set HTTP Method to POST.',
        'Save and activate the automation.',
      ],
    },
    {
      id: 'jotform',
      title: 'Jotform',
      category: 'WEBHOOKS',
      description: 'Capture form inquiries and student registrations from Jotform.',
      endpoint: `${WEBHOOK_BASE}/jotform`,
      instructions: [
        'In Jotform Builder, go to Settings > Integrations.',
        'Select Webhooks.',
        'Paste the Webhook URL into the Add Webhook field.',
        'Click Complete Integration.',
      ],
    },
    {
      id: 'google-forms',
      title: 'Google Forms',
      category: 'WEBHOOKS',
      description: 'Push responses from Google Forms directly into your pipeline.',
      endpoint: `${WEBHOOK_BASE}/google-forms`,
      instructions: [
        'Open Google Forms > Extensions > Apps Script.',
        'Set up an onFormSubmit trigger pushing responses as JSON to this webhook URL.',
        'Save the script and authorize execution.',
      ],
    },
    {
      id: 'urbanpro',
      title: 'UrbanPro',
      category: 'WEBHOOKS',
      description: 'Capture student course inquiries and tutoring leads from UrbanPro.',
      endpoint: `${WEBHOOK_BASE}/urbanpro`,
      instructions: [
        'In your UrbanPro partner dashboard, open API & Webhook Settings.',
        'Add this webhook URL under Lead Notifications.',
        'Save changes.',
      ],
    },
    {
      id: 'aajjo',
      title: 'AAJJO.com',
      category: 'WEBHOOKS',
      description: 'Receive buyer leads and trade RFQs from aajjo.com.',
      endpoint: `${WEBHOOK_BASE}/aajjo`,
      instructions: [
        'Sign in to your AAJJO seller portal.',
        'Navigate to Lead Settings > Webhooks.',
        'Paste the Webhook URL and activate notifications.',
      ],
    },
    {
      id: 'calendly',
      title: 'Calendly',
      category: 'WEBHOOKS',
      description: 'Sync scheduled appointments and automatically log consultations.',
      endpoint: `${WEBHOOK_BASE}/calendly`,
      instructions: [
        'In your Calendly account, go to Integrations > Webhooks.',
        'Add a webhook subscription for invitee.created events.',
        'Paste the URL and save.',
      ],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto py-2 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Integrations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect Google Workspace and inbound webhooks to your candidate pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtle Google Account Status */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded text-xs text-slate-600">
            <span
              className={`w-2 h-2 rounded-full ${
                googleStatus.connected ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
            />
            <span className="font-medium">
              Google: {googleStatus.connected ? googleStatus.googleEmail || 'Connected' : 'Not connected'}
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
            className="text-slate-400 hover:text-slate-700 ml-3"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Standard Horizontal Tabs ── */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs">
        {[
          { id: 'ALL', label: 'All' },
          { id: 'GOOGLE', label: 'Google Workspace' },
          { id: 'WEBHOOKS', label: 'Inbound Webhooks' },
          { id: 'PAYMENTS', label: 'Payments' },
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

      {/* ── 3-Column Clean Card Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CARD 1: Google Meet */}
        {(activeTab === 'ALL' || activeTab === 'GOOGLE') && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Video size={16} />
                  </div>
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
                  <span className="font-mono text-[11px] text-slate-600 truncate max-w-[170px]" title={googleStatus.googleEmail}>
                    {googleStatus.googleEmail || 'Connected'}
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
                  onClick={handleConnectGoogle}
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

        {/* CARD 2: Google Sheets */}
        {(activeTab === 'ALL' || activeTab === 'GOOGLE') && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
                    <FileSpreadsheet size={16} />
                  </div>
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
                  onClick={handleConnectGoogle}
                  disabled={connecting}
                  className="w-full h-8 px-3 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Connect Google Sheets</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* CARD 3: Google Drive (Coming Soon) */}
        {(activeTab === 'ALL' || activeTab === 'GOOGLE') && (
          <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-slate-200/80 text-slate-600 flex items-center justify-center">
                    <HardDrive size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Google Drive</h3>
                    <span className="text-[11px] text-slate-400">Document Storage</span>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
                  Coming soon
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Export candidate documents, call recordings, and CRM backups to Drive folders.
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-200/70">
              <span className="text-[11px] text-slate-400 block text-center">In development</span>
            </div>
          </div>
        )}

        {/* INBOUND WEBHOOK CARDS */}
        {(activeTab === 'ALL' || activeTab === 'WEBHOOKS') &&
          webhooks.map((hook) => (
            <div
              key={hook.id}
              className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                      {hook.id === 'google-forms' ? 'GF' : hook.id.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{hook.title}</h3>
                      <span className="text-[11px] text-slate-400">Inbound Webhook</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Live
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{hook.description}</p>

                {/* Compact URL Box */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Webhook URL</span>
                    <button
                      type="button"
                      onClick={() => setSelectedWebhook(hook)}
                      className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
                    >
                      Instructions
                    </button>
                  </div>
                  <div className="flex items-center gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-700">
                    <span className="truncate flex-1 select-all">{hook.endpoint}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(hook.id, hook.endpoint)}
                      title="Copy URL"
                      className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                    >
                      {copiedId === hook.id ? (
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
                  onClick={() => handleCopy(hook.id, hook.endpoint)}
                  className="flex-1 h-8 px-3 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50 text-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedId === hook.id ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWebhook(hook)}
                  title="View setup guide"
                  className="h-8 px-2.5 text-xs font-medium rounded border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                >
                  Guide
                </button>
              </div>
            </div>
          ))}

        {/* PAYMENTS CARDS (Coming Soon) */}
        {(activeTab === 'ALL' || activeTab === 'PAYMENTS') && (
          <>
            <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-slate-200/80 text-slate-600 flex items-center justify-center">
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">Razorpay</h3>
                      <span className="text-[11px] text-slate-400">Payment Gateway</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
                    Coming soon
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Generate consultation fee payment links and update lead status upon confirmation.
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-200/70">
                <span className="text-[11px] text-slate-400 block text-center">In development</span>
              </div>
            </div>

            <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-slate-200/80 text-slate-600 flex items-center justify-center">
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">Cashfree</h3>
                      <span className="text-[11px] text-slate-400">Payment Gateway</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
                    Coming soon
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Collect student application fees and recurring installment payments.
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-200/70">
                <span className="text-[11px] text-slate-400 block text-center">In development</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Simple Setup Guide Modal ── */}
      {selectedWebhook && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelectedWebhook(null)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">{selectedWebhook.title} Setup</h3>
              <button
                type="button"
                onClick={() => setSelectedWebhook(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Inbound Webhook URL:</span>
              <div className="flex items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-700">
                <span className="truncate flex-1 select-all">{selectedWebhook.endpoint}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedWebhook.id, selectedWebhook.endpoint)}
                  className="px-2 py-0.5 text-[11px] font-medium border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700"
                >
                  {copiedId === selectedWebhook.id ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-800">Instructions:</span>
              <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1.5 leading-relaxed bg-slate-50 p-3 rounded border border-slate-100">
                {selectedWebhook.instructions.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedWebhook(null)}
                className="h-8 px-4 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
