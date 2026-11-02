import React from 'react';
import { ShieldCheck, Mail, ArrowLeft, CheckCircle2, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DataDeletion() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1c1c1e] py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007aff] hover:underline mb-6 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>

        <div className="bg-white rounded-3xl shadow-sm border border-black/[0.06] p-6 sm:p-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700">
              <ShieldCheck size={12} />
              Compliance &amp; GDPR / Meta
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1c1c1e] mb-2">
            User Data Deletion Instructions
          </h1>
          <p className="text-xs text-[#86868b] pb-6 border-b border-black/[0.06] mb-6">
            Platform: SSA Sales Hub &amp; SSA CRM &bull; Effective Date: November 2, 2026
          </p>

          <div className="space-y-6 text-sm text-[#3c3c43] leading-relaxed">
            <p>
              At <strong>SSA Sales Hub</strong>, we respect your privacy and uphold your right to full control over your personal data in accordance with Meta (Facebook) Platform terms, GDPR, and international data protection laws.
            </p>

            <p>
              If you have submitted inquiries through our Meta Lead Ads (Facebook / Instagram), WhatsApp outreach campaigns, or accessed our CRM portal, you have the right to request permanent deletion of all your records.
            </p>

            <h2 className="text-lg font-bold text-[#1c1c1e] pt-4">
              How to Request Deletion of Your Data
            </h2>

            <div className="p-5 rounded-2xl bg-[#f2f2f7] border border-black/[0.04] space-y-3">
              <div className="flex items-center gap-2 text-[#1c1c1e] font-bold text-base">
                <Mail size={18} className="text-[#007aff]" />
                <span>Method 1: Direct Deletion Request via Email (Fastest)</span>
              </div>
              <p className="text-xs text-[#636366]">
                You can submit an immediate erasure request to our dedicated Data Protection Officer:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-[#1c1c1e] pl-1">
                <li>
                  <strong>Send Email To:</strong>{' '}
                  <a href="mailto:support@ssasaleshub.cloud" className="text-[#007aff] font-semibold underline">
                    support@ssasaleshub.cloud
                  </a>
                </li>
                <li>
                  <strong>Subject Line:</strong> <code className="bg-white px-2 py-0.5 rounded border border-black/10">User Data Deletion Request - [Your Name / Phone]</code>
                </li>
                <li>
                  <strong>Required Information:</strong> Your full name, registered phone number (with country code), and email address used during inquiry.
                </li>
              </ul>
              <div className="p-3 bg-white rounded-xl border border-black/5 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Turnaround Time:</strong> Requests are verified and completely expunged from our production databases within <strong>48 to 72 business hours</strong>. You will receive an official confirmation email.
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#f2f2f7] border border-black/[0.04] space-y-3">
              <div className="flex items-center gap-2 text-[#1c1c1e] font-bold text-base">
                <Trash2 size={18} className="text-rose-600" />
                <span>Method 2: Remove SSA CRM from Your Facebook Account</span>
              </div>
              <p className="text-xs text-[#636366]">
                To revoke Facebook application permissions and stop future data synchronization:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-[#1c1c1e] pl-1">
                <li>Log in to your <strong>Facebook</strong> account.</li>
                <li>Go to <strong>Settings &amp; Privacy</strong> &gt; <strong>Settings</strong>.</li>
                <li>Select <strong>Apps and Websites</strong> on the left-hand menu.</li>
                <li>Locate <strong>SSA CRM</strong> or <strong>SSA Sales Hub</strong> and click <strong>Remove</strong>.</li>
              </ol>
            </div>

            <h2 className="text-lg font-bold text-[#1c1c1e] pt-4">
              What Data is Permanently Erased?
            </h2>
            <ul className="list-disc list-inside space-y-1 text-xs text-[#636366] pl-2">
              <li>Candidate identity details (Name, Educational Background, City/Location)</li>
              <li>Contact details (Phone Number, Email Address)</li>
              <li>Counselor interaction logs, consultation notes, and status milestones</li>
              <li>Push notification tokens (Firebase Cloud Messaging FCM tokens)</li>
              <li>Ad attribution data (Campaign ID, AdSet ID, Form ID)</li>
            </ul>

            <div className="mt-8 p-4 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 text-xs text-emerald-950">
              <p className="font-semibold mb-1">SSA Sales Hub Data Protection Office</p>
              <p>Email: <a href="mailto:support@ssasaleshub.cloud" className="underline font-medium">support@ssasaleshub.cloud</a></p>
              <p>Portal: <a href="https://www.ssasaleshub.cloud" className="underline font-medium">https://www.ssasaleshub.cloud</a></p>
              <p>Privacy Policy: <a href="https://www.ssasaleshub.cloud/privacy" className="underline font-medium">https://www.ssasaleshub.cloud/privacy</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

