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
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Import Leads & Data Ingestion
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Ingest marketing export files from Facebook & Instagram Ads Manager. 
              The system automatically resolves campaigns, ad sets, ads, creates verified candidate profiles, 
              and links work/study visa preference survey responses.
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <UploadCloud size={18} />
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-100 pt-4">
          <button
            onClick={() => { setActiveTab('file'); setResult(null); setError(null); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'file'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>Excel / CSV File Upload</span>
          </button>

          <button
            onClick={() => { setActiveTab('raw'); setResult(null); setError(null); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'raw'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileText size={14} />
            <span>Paste Raw CSV / TSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
          <AlertCircle size={15} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Import Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Tab 1: File Upload */}
      {activeTab === 'file' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                  <FileUp size={20} />
                </div>
                <p className="text-xs font-medium text-slate-900">
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop Meta spreadsheet'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports .xlsx, .xls, and .csv export files from Meta Ads
                </p>
                {selectedFile && (
                  <span className="mt-2 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {(selectedFile.size / 1024).toFixed(1)} KB selected
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Supported formats: <strong className="text-slate-600">.xlsx, .xls, .csv</strong>
              </span>
              <button
                type="submit"
                disabled={loading || !selectedFile}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
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
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <form onSubmit={handleRawUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Paste Tab-Separated or Comma-Separated Values (CSV/TSV)
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder="id,created_time,ad_id,ad_name,adset_id,campaign_name,form_id,is_organic,platform,full_name,phone_number,city..."
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              ></textarea>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">
                Format: <strong className="text-slate-600">CSV or TSV clipboard text</strong>
              </span>
              <button
                type="submit"
                disabled={loading || !rawText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
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
