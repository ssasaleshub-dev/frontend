import React, { useState, useEffect } from 'react';
import { crmService } from '../services/api/crmService';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [leadCount, setLeadCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsData, countData] = await Promise.allSettled([
        crmService.getLeadAnalytics(),
        crmService.getLeadsCount(),
      ]);

      if (analyticsData.status === 'fulfilled') {
        setAnalytics(analyticsData.value);
      }
      if (countData.status === 'fulfilled') {
        setLeadCount(countData.value);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load backend metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeedSample = async () => {
    setActionMsg('Seeding sample leads...');
    try {
      await crmService.seedSampleLeads();
      setActionMsg('Sample leads seeded successfully into database!');
      loadData();
    } catch (err) {
      setActionMsg(`Seed failed: ${err?.message || 'Server error'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-xs text-slate-400">
            Logged in as <span className="text-slate-200 font-semibold">{user?.login || user?.username}</span> | Real-time backend metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
          <button
            onClick={handleSeedSample}
            className="px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium"
          >
            Seed Sample Data
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded text-xs text-emerald-400">
          {actionMsg}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Backend Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Total Leads Count</p>
          <p className="text-2xl font-bold text-white mt-1">
            {leadCount !== null ? (typeof leadCount === 'object' ? leadCount?.count || JSON.stringify(leadCount) : leadCount) : (analytics?.totalLeads ?? '0')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">from /api/leads/count</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Converted Leads</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {analytics?.convertedLeads ?? analytics?.converted ?? '0'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">from /api/leads/analytics</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Pipeline Value</p>
          <p className="text-2xl font-bold text-white mt-1">
            {analytics?.pipelineValue ? `₹${analytics.pipelineValue.toLocaleString()}` : (analytics?.totalValue ? `₹${analytics.totalValue}` : '₹0')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Total revenue in pipeline</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Conversion Rate</p>
          <p className="text-2xl font-bold text-teal-400 mt-1">
            {analytics?.conversionRate ? `${analytics.conversionRate}%` : '0%'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Platform conversion</p>
        </div>
      </div>

      {/* Raw Backend Analytics Response viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Raw Analytics Payload (/api/leads/analytics)</h2>
        <pre className="p-3 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-60">
          {analytics ? JSON.stringify(analytics, null, 2) : (loading ? 'Loading...' : 'No data returned yet. Click "Seed Sample Data" or create leads to populate.')}
        </pre>
      </div>
    </div>
  );
}
