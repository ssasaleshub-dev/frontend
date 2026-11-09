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
    <div className="max-w-xl mx-auto space-y-4">
      {/* Upload Card */}
      <div className="ios-card p-5 sm:p-6 space-y-4">
        {/* Top Header: Title, Tabs & Template Button */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-black/[0.05]">
          {/* Segmented Control */}
          <div className="flex items-center p-0.5 rounded-xl bg-black/[0.05]">
            <button
              type="button"
              onClick={() => { setActiveTab('file'); setResult(null); setError(null); }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'file'
                  ? 'bg-white text-[#1c1c1e] shadow-2xs'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e]'
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('raw'); setResult(null); setError(null); }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'raw'
                  ? 'bg-white text-[#1c1c1e] shadow-2xs'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e]'
              }`}
            >
              Paste CSV
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 text-xs text-[#007aff] hover:text-[#0062cc] font-medium py-1 px-2.5 rounded-lg hover:bg-[#007aff]/[0.06] transition-colors"
          >
            <Download size={13} />
            <span>Template</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-xs text-[#ff3b30] flex items-center gap-2 font-medium">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: File Dropzone */}
        {activeTab === 'file' && (
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border-2 border-dashed border-[#d1d1d6] hover:border-[#007aff] rounded-2xl p-8 sm:p-10 text-center transition-colors cursor-pointer relative bg-slate-50/50 hover:bg-[#007aff]/[0.02]">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-[#007aff]/10 text-[#007aff] flex items-center justify-center mb-2.5">
                  <UploadCloud size={22} />
                </div>
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#1c1c1e]">{selectedFile.name}</p>
                    <p className="text-[11px] text-[#8e8e93]">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#1c1c1e]">
                      Choose file or drag & drop
                    </p>
                    <p className="text-[11px] text-[#8e8e93]">
                      Excel or CSV (.xlsx, .csv)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="px-3 py-2 text-xs text-[#8e8e93] hover:text-[#ff3b30] font-medium transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !selectedFile}
                className="ios-btn-primary text-xs px-5 py-2.5 w-full sm:w-auto"
              >
                {loading && <RefreshCw size={13} className="animate-spin" />}
                <span>{loading ? 'Uploading...' : 'Upload File'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Raw Text Paste */}
        {activeTab === 'raw' && (
          <form onSubmit={handleRawUpload} className="space-y-4">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={6}
              placeholder="Paste CSV or TSV data here..."
              className="ios-input w-full p-3 font-mono text-xs"
            ></textarea>

            <div className="flex items-center justify-end gap-2.5">
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  className="px-3 py-2 text-xs text-[#8e8e93] hover:text-[#ff3b30] font-medium transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !rawText.trim()}
                className="ios-btn-primary text-xs px-5 py-2.5 w-full sm:w-auto"
              >
                {loading && <RefreshCw size={13} className="animate-spin" />}
                <span>{loading ? 'Processing...' : 'Upload Leads'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Ingestion Results Dialog */}
      {result && (
        <div className="ios-card p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#34c759]/10 text-[#34c759] flex items-center justify-center">
                <CheckCircle2 size={15} />
              </div>
              <h3 className="text-xs font-bold text-[#1c1c1e]">Import Complete</h3>
            </div>
            <button
              onClick={() => navigate('/leads')}
              className="flex items-center gap-1 text-xs font-semibold text-[#007aff] hover:underline"
            >
              <span>View Candidates</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-black/[0.02] rounded-xl text-center">
              <span className="text-[11px] text-[#8e8e93]">Total</span>
              <p className="text-base font-bold text-[#1c1c1e] mt-0.5">{result.totalRowsProcessed || 0}</p>
            </div>
            <div className="p-3 bg-[#34c759]/[0.08] rounded-xl text-center">
              <span className="text-[11px] text-[#34c759] font-medium">Imported</span>
              <p className="text-base font-bold text-[#34c759] mt-0.5">{result.successfulRows || 0}</p>
            </div>
            <div className="p-3 bg-[#ff3b30]/[0.08] rounded-xl text-center">
              <span className="text-[11px] text-[#ff3b30] font-medium">Failed</span>
              <p className="text-base font-bold text-[#ff3b30] mt-0.5">{result.failedRows || 0}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
