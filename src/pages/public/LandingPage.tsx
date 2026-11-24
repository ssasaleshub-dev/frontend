import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Video,
  Mail,
  FileSpreadsheet,
  Users,
  Calendar,
  Lock,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import brandLogo from '../../assets/brand-logo.jpg';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* ── Top Navigation ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={brandLogo}
              alt="SSA Saleshub Logo"
              className="w-9 h-9 rounded-lg object-contain border border-slate-200"
            />
            <div>
              <span className="font-semibold text-slate-900 tracking-tight text-base block leading-none">
                SSA Saleshub
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Candidate &amp; Sales CRM</span>
            </div>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6">
            <Link
              to="/privacy"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              <span>Sign In</span>
              <ArrowRight size={13} />
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span>Unified Education &amp; Admissions Management CRM</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
          Streamlined Candidate Lifecycle &amp; Admissions CRM
        </h1>

        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          SSA Saleshub empowers counselors and academic institutions to manage inquiries, coordinate student admissions, conduct video consultations, and track multi-channel communications from one centralized platform.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="px-5 py-2.5 text-xs sm:text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            Access CRM Dashboard
          </Link>
          <Link
            to="/privacy"
            className="px-5 py-2.5 text-xs sm:text-sm font-medium rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Review Data Policies
          </Link>
        </div>
      </section>

      {/* ── Key Integrations & Features ── */}
      <section className="py-12 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <h2 className="text-xl font-bold text-slate-900">Platform Features &amp; Integrations</h2>
            <p className="text-xs text-slate-500">
              Integrated with Google Workspace and direct social channels to streamline student engagement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Google Workspace */}
            <div className="p-5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center text-red-600">
                <Video size={18} className="text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Google Meet &amp; Calendar</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Counselors can schedule candidate admissions interviews and generate authenticated Google Meet video consultation links directly onto client calendars.
              </p>
            </div>

            {/* Google Sheets */}
            <div className="p-5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center text-emerald-600">
                <FileSpreadsheet size={18} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Google Sheets Data Sync</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Seamlessly export approved inquiry batches, counselor performance summaries, and student rosters into your organization's Google Drive spreadsheets.
              </p>
            </div>

            {/* Multi-channel Messaging */}
            <div className="p-5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center text-blue-600">
                <Mail size={18} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Direct Candidate Outreach</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Manage admissions inquiries, send status notifications, and communicate with prospective applicants via connected email and social channels.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Compliance & User Data Safeguards ── */}
      <section className="py-12 max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="p-6 rounded-lg bg-white border border-slate-200 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Google User Data Compliance</h3>
              <span className="text-[11px] text-slate-500">Google API Services User Data Policy adherence</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            SSA Saleshub's use and transfer to any other app of information received from Google APIs adheres to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-900 underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>

          <ul className="text-xs text-slate-600 space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>We do not sell Google user data to third parties or advertising brokers.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Google user data is never used for training generalized artificial intelligence or machine learning models.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>OAuth credentials and access tokens are encrypted at rest using industry-standard AES-256 protocols.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Users can revoke Google integration access at any time through their Integrations settings or Google Account Security.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto py-8 bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <img src={brandLogo} alt="SSA" className="w-5 h-5 rounded object-contain" />
            <span>&copy; {new Date().getFullYear()} SSA Saleshub (ssasaleshub.cloud). All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-slate-900 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-slate-900 transition-colors">
              Terms of Service
            </Link>
            <Link to="/login" className="hover:text-slate-900 transition-colors">
              Counselor Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
