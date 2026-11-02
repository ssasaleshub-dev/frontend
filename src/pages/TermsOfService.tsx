import React from 'react';
import { FileText, ArrowLeft, Shield, Globe, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
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
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700">
              <FileText size={12} />
              Legal Terms
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1c1c1e] mb-2">
            Terms of Service
          </h1>
          <p className="text-xs text-[#86868b] pb-6 border-b border-black/[0.06] mb-6">
            Platform: SSA Sales Hub &bull; Effective Date: November 2, 2026
          </p>

          <div className="space-y-6 text-sm text-[#3c3c43] leading-relaxed">
            <p>
              Welcome to <strong>SSA Sales Hub</strong> and <strong>SSA CRM</strong> (&quot;Platform&quot;, &quot;Service&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) govern your access to and use of our web platform, mobile applications, CRM infrastructure, lead synchronization integrations (including Meta / Facebook Lead Ads), and consultancy counseling services.
            </p>

            <h2 className="text-lg font-bold text-[#1c1c1e] pt-2">1. Acceptance of Terms</h2>
            <p className="text-xs text-[#636366]">
              By accessing or using SSA Sales Hub or submitting inquiries through our promotional channels, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, do not access or use our Service.
            </p>

            <h2 className="text-lg font-bold text-[#1c1c1e] pt-2">2. Description of Service</h2>
            <p className="text-xs text-[#636366]">
              SSA Sales Hub is an enterprise CRM and candidate consultation platform providing lead management, visa consultancy counseling, documentation intake, and outreach communication workflows (including SMS, phone, and WhatsApp).
            </p>

            <h2 className="text-lg font-bold text-[#1c1c1e] pt-2">3. User Accounts &amp; Authorized Access</h2>
            <p className="text-xs text-[#636366]">
              Access to internal CRM pipelines is strictly restricted to authorized staff. Candidates submitting contact information via our Lead Ads or intake forms authorize our certified counselors to contact them regarding education, work visa, and travel documentation assistance.
            </p>

            <h2 className="text-lg font-bold text-[#1c1c1e] pt-2">4. Third-Party Integrations &amp; Meta Platform</h2>
            <p className="text-xs text-[#636366]">
              Our service integrates with third-party platforms such as Meta (Facebook / Instagram Lead Ads), Google Cloud / Firebase, and WhatsApp Business. Use of these services is governed by the respective platform policies. You can revoke permissions or request data deletion at any time via our Data Deletion page.
            </p>

            <h2 className="text-lg font-bold text-[#1c1c1e] pt-2">5. Disclaimer &amp; Liability</h2>
            <p className="text-xs text-[#636366]">
              Consultancy guidance is provided on an &quot;as is&quot; basis. Final visa decisions rest exclusively with foreign government embassies and immigration authorities. SSA Sales Hub is not liable for visa rejections or indirect damages.
            </p>

            <div className="mt-8 p-4 rounded-2xl bg-blue-500/[0.08] border border-blue-500/20 text-xs text-blue-950 space-y-1">
              <p className="font-semibold text-sm mb-1">Contact &amp; Legal Notice</p>
              <p>Email: <a href="mailto:support@ssasaleshub.cloud" className="underline font-medium">support@ssasaleshub.cloud</a></p>
              <p>Portal: <a href="https://www.ssasaleshub.cloud" className="underline font-medium">https://www.ssasaleshub.cloud</a></p>
              <p>Privacy Policy: <a href="https://www.ssasaleshub.cloud/privacy" className="underline font-medium">https://www.ssasaleshub.cloud/privacy</a></p>
              <p>Data Deletion: <a href="https://www.ssasaleshub.cloud/data-deletion" className="underline font-medium">https://www.ssasaleshub.cloud/data-deletion</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
