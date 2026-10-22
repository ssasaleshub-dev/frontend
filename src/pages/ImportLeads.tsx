import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileUp,
  ArrowRight,
} from 'lucide-react';
import crmService from '../services/api/crmService';

export default function ImportLeads() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'file' | 'raw'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await crmService.importLeadsFile(selectedFile);
      setResult(res);
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to process file import');
    } finally {
      setLoading(false);
    }
  };

  const handleRawUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await crmService.importRawLeads(rawText);
      setResult(res);
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to parse raw data stream');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="ios-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#1c1c1e]">
              Import Candidate Leads & Meta Ingestion
            </h2>
            <p className="text-xs text-[#8e8e93] mt-1 leading-relaxed max-w-2xl">
              Ingest marketing export spreadsheets from Meta Ads Manager (Facebook, Instagram) and WhatsApp. 
              The system resolves campaign telemetry, creates verified candidate profiles, and links work/study visa preference responses.
            </p>
          </div>
          <div className="ios-squircle bg-[#007aff]/10 text-[#007aff] shrink-0">
            <UploadCloud size={20} />
          </div>
        </div>

        {/* Tab switchers as iOS Segmented Control */}
        <div className="mt-5 pt-3.5 border-t border-black/[0.05]">
          <div className="ios-segmented">
            <button
              onClick={() => { setActiveTab('file'); setResult(null); setError(null); }}
              className={`ios-segmented-btn flex items-center gap-2 ${activeTab === 'file' ? 'active' : ''}`}
            >
              <FileSpreadsheet size={14} />
              <span>Excel / CSV File Upload</span>
            </button>

            <button
              onClick={() => { setActiveTab('raw'); setResult(null); setError(null); }}
              className={`ios-segmented-btn flex items-center gap-2 ${activeTab === 'raw' ? 'active' : ''}`}
            >
              <FileText size={14} />
              <span>Paste Raw CSV / TSV</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/25 text-xs text-[#ff9500] flex items-start gap-2.5 font-medium">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#1c1c1e]">Import Error</p>
            <p className="mt-0.5 text-[#ff9500]">{error}</p>
          </div>
        </div>
      )}

      {/* Tab 1: File Upload */}
      {activeTab === 'file' && (
        <div className="ios-card p-6">
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border border-dashed border-black/15 rounded-2xl p-8 text-center hover:bg-[#f2f2f7]/50 transition-colors cursor-pointer relative bg-[#f9f9fa]">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <div className="ios-squircle bg-[#007aff]/10 text-[#007aff] mb-3">
                  <FileUp size={20} />
                </div>
                <p className="text-xs font-semibold text-[#1c1c1e]">
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop Meta spreadsheet'}
                </p>
                <p className="text-[11px] text-[#8e8e93] mt-1">
                  Supports .xlsx, .xls, and .csv export files from Meta Ads
                </p>
                {selectedFile && (
                  <span className="mt-2.5 text-[11px] text-[#007aff] bg-[#007aff]/10 px-3 py-1 rounded-full font-semibold">
                    {(selectedFile.size / 1024).toFixed(1)} KB selected
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#8e8e93]">
                Supported formats: <strong className="text-[#3c3c43]">.xlsx, .xls, .csv</strong>
              </span>
              <button
                type="submit"
                disabled={loading || !selectedFile}
                className="ios-btn-primary text-xs"
              >
                {loading && <RefreshCw size={13} className="animate-spin" />}
                <span>{loading ? 'Uploading...' : 'Upload & Process Leads'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Raw Text Paste */}
      {activeTab === 'raw' && (
        <div className="ios-card p-6">
          <form onSubmit={handleRawUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#3c3c43] mb-1.5">
                Paste Tab-Separated or Comma-Separated Values (CSV/TSV)
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder="id,created_time,ad_id,ad_name,adset_id,campaign_name,form_id,is_organic,platform,full_name,phone_number,city..."
                className="ios-input w-full p-3 font-mono text-xs rounded-2xl"
              ></textarea>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#8e8e93]">
                Format: <strong className="text-[#3c3c43]">CSV or TSV clipboard text</strong>
              </span>
              <button
                type="submit"
                disabled={loading || !rawText.trim()}
                className="ios-btn-primary text-xs"
              >
                {loading && <RefreshCw size={13} className="animate-spin" />}
                <span>{loading ? 'Processing...' : 'Parse & Ingest Leads'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ingestion Results Dialog */}
      {result && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Import Completed</h3>
                <p className="text-xs text-slate-500 font-mono">File: {result.fileName || 'Data stream'}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/leads')}
              className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              <span>View in Pipeline</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
              <span className="text-[11px] text-slate-500">Total Rows</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{result.totalRowsProcessed}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
              <span className="text-[11px] text-slate-500">Successful</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{result.successfulRows}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
              <span className="text-[11px] text-slate-500">Failed</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{result.failedRows}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
              <span className="text-[11px] text-slate-500">Execution Time</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{result.executionTimeMs} ms</p>
            </div>
          </div>

          {result.importedLeadExternalIds && result.importedLeadExternalIds.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-slate-700 mb-1.5">
                Imported Meta Lead External IDs:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.importedLeadExternalIds.map((extId: string) => (
                  <span
                    key={extId}
                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {extId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.errors && result.errors.length > 0 && (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <p className="font-semibold mb-1">Warnings:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {result.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
