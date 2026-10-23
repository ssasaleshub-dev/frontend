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
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import crmService from '../services/api/crmService';

export default function ImportLeads() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'file' | 'raw'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        id: '1282110291197702',
        created_time: '10-18-24 12:52:17',
        ad_id: '120203712472010612',
        ad_name: 'SSA_A01_SSA-01_feed_PVC_G110203712472010612',
        adset_id: '120203712472010612',
        adset_name: 'SSA_A01_WorkPermit_20-30_TN',
        campaign_id: '120203712472010612',
        campaign_name: 'SSA_LeadGen_USA+UK_TN_12',
        form_id: '10000017290030499',
        form_name: 'SSA_Form_A01_UG/USM-CG',
        is_organic: 'false',
        platform: 'ig',
        'what_is_your_current_status?': 'completed_ug',
        'what_is_your_cgpa_or_current_percentage?': '60-70% /6.0-7.0 CGPA',
        full_name: 'Bhuvanesh R',
        email: 'bhuvanesh.sample@gmail.com',
        phone_number: '+919025099944',
        city: 'Coimbatore',
        lead_status: 'complete',
      },
      {
        id: '21773179453315223',
        created_time: '10-18-24 12:47:20',
        ad_id: '120203712472010612',
        ad_name: 'SSA_A01_SSA-01_feed_PVC_G110203712472010612',
        adset_id: '120203712472010612',
        adset_name: 'SSA_A01_WorkPermit_20-30_TN',
        campaign_id: '120203712472010612',
        campaign_name: 'SSA_LeadGen_USA+UK_TN_12',
        form_id: '10000017290030499',
        form_name: 'SSA_Form_A01_UG/USM-CG',
        is_organic: 'false',
        platform: 'ig',
        'what_is_your_current_status?': 'completed_ug',
        'what_is_your_cgpa_or_current_percentage?': '70% and above /7.0+ cgpa',
        full_name: 'Kavitha R',
        email: 'kavitha.sample@gmail.com',
        phone_number: '+919788057933',
        city: 'Chennai',
        lead_status: 'complete',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MetaLeadAds');
    XLSX.writeFile(wb, 'meta_lead_ads_import_template.xlsx');
  };

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
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-md p-5 shadow-2xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Import Candidate Leads & Meta Ingestion
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
              Ingest marketing export spreadsheets from Meta Ads Manager (Facebook, Instagram) and WhatsApp. 
              The system resolves campaign telemetry, creates verified candidate profiles, and links work/study visa preference responses.
            </p>
          </div>
          <div className="w-9 h-9 rounded bg-blue-50 text-[#1e88e5] border border-blue-100 flex items-center justify-center shrink-0">
            <UploadCloud size={18} />
          </div>
        </div>

        {/* Tab switchers as Zoho CRM Underline Tabs */}
        <div className="mt-4 pt-2 border-t border-slate-200 flex items-center gap-6">
          <button
            onClick={() => { setActiveTab('file'); setResult(null); setError(null); }}
            className={`py-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'file'
                ? 'text-[#1e88e5] border-[#1e88e5]'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>Excel / CSV File Upload</span>
          </button>

          <button
            onClick={() => { setActiveTab('raw'); setResult(null); setError(null); }}
            className={`py-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'raw'
                ? 'text-[#1e88e5] border-[#1e88e5]'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <FileText size={14} />
            <span>Paste Raw CSV / TSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5 font-medium">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-700" />
          <div>
            <p className="font-semibold text-slate-900">Import Error</p>
            <p className="mt-0.5 text-amber-800">{error}</p>
          </div>
        </div>
      )}

      {/* Tab 1: File Upload */}
      {activeTab === 'file' && (
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-2xs">
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-md p-8 text-center hover:bg-blue-50/20 hover:border-blue-400 transition-colors cursor-pointer relative bg-slate-50/50">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded bg-blue-50 text-[#1e88e5] border border-blue-100 flex items-center justify-center mb-2.5">
                  <FileUp size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-900">
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop Meta spreadsheet'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports .xlsx, .xls, and .csv export files from Meta Ads
                </p>
                {selectedFile && (
                  <span className="mt-2 text-[11px] text-[#1e88e5] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded font-medium">
                    {(selectedFile.size / 1024).toFixed(1)} KB selected
                  </span>
                )}
              </div>
            </div>

            {/* Template Download Option */}
            <div className="flex items-center justify-between p-3 rounded bg-slate-50 border border-slate-200">
              <div>
                <p className="text-xs font-semibold text-slate-900">Sample Meta Ads Template</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Spreadsheet with sample columns matching Meta Ads Manager exports (ID, Campaign, Questions, Full Name, Phone, City).
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-300 text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 ml-3"
              >
                <Download size={13} className="text-[#1e88e5]" />
                <span>Download Template</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Supported formats: <strong className="text-slate-700">.xlsx, .xls, .csv</strong>
              </span>
              <button
                type="submit"
                disabled={loading || !selectedFile}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e88e5] hover:bg-[#1565c0] text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
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
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-2xs">
          <form onSubmit={handleRawUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Paste Tab-Separated or Comma-Separated Values (CSV/TSV)
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                className="w-full p-3 font-mono text-xs rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
              ></textarea>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Format: <strong className="text-slate-700">CSV or TSV clipboard text</strong>
              </span>
              <button
                type="submit"
                disabled={loading || !rawText.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e88e5] hover:bg-[#1565c0] text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
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
