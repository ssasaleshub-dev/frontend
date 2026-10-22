import React, { useState, useEffect, useRef } from 'react';
import {
  Megaphone,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';
import crmService from '../services/api/crmService';
import type { Campaign, Ad } from '../types';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCampaign, setNewCampaign] = useState<{
    name: string;
    externalId: string;
    status: string;
  }>({
    name: '',
    externalId: '',
    status: 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchMarketingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [campRes, adsRes] = await Promise.allSettled([
        crmService.getCampaigns(),
        crmService.getAds(),
      ]);

      if (campRes.status === 'fulfilled') {
        setCampaigns(Array.isArray(campRes.value) ? campRes.value : campRes.value?.content || []);
      }
      if (adsRes.status === 'fulfilled') {
        setAds(Array.isArray(adsRes.value) ? adsRes.value : adsRes.value?.content || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load marketing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchMarketingData();
    }

    const handleUpdate = () => fetchMarketingData();
    window.addEventListener('crm-data-updated', handleUpdate);
    return () => window.removeEventListener('crm-data-updated', handleUpdate);
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCampaign.name.trim()) return;
    setSubmitting(true);
    try {
      await crmService.createCampaign({
        name: newCampaign.name.trim(),
        externalId: newCampaign.externalId.trim() || `c:${Date.now()}`,
        status: newCampaign.status || 'ACTIVE',
      });
      setShowAddModal(false);
      setNewCampaign({ name: '', externalId: '', status: 'ACTIVE' });
      await fetchMarketingData();
    } catch (err: any) {
      alert(`Failed to create campaign: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ios-card p-4 sm:p-5">
        <div>
          <h2 className="text-base font-bold text-[#1c1c1e]">
            Marketing Campaigns & Attribution
          </h2>
          <p className="text-xs text-[#8e8e93] mt-0.5">
            Tracking <strong className="text-[#1c1c1e]">{campaigns.length}</strong> campaigns and{' '}
            <strong className="text-[#1c1c1e]">{ads.length}</strong> Meta Ad creatives
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMarketingData}
            disabled={loading}
            className="ios-btn-gray text-xs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#007aff]' : 'text-[#8e8e93]'} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="ios-btn-primary text-xs"
          >
            <Plus size={14} />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchMarketingData} className="underline font-medium hover:text-amber-900">
            Retry
          </button>
        </div>
      )}

      {/* Campaigns Grid */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">Active Meta Campaigns</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.length === 0 ? (
            <div className="col-span-full ios-card p-8 text-center text-slate-400">
              <Megaphone size={22} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium text-slate-500">No campaigns recorded yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Import Meta Ads spreadsheet or click "New Campaign"
              </p>
            </div>
          ) : (
            campaigns.map((camp) => (
              <div
                key={camp.id}
                className="ios-card ios-card-hover p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Megaphone size={15} />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                    {camp.status || 'ACTIVE'}
                  </span>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{camp.name}</h4>
                  <p className="font-mono text-[11px] text-slate-400 mt-1">
                    ID: {camp.externalId || `#${camp.id}`}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Created: {formatDate(camp.createdAt)}</span>
                  <span className="font-medium text-slate-700">Meta Ads</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tracked Meta Ads Table */}
      <div className="ios-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tracked Ad Creatives</h3>
            <p className="text-xs text-slate-500">Tracked ads and associated Ad Sets</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full">
            {ads.length} Ads
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Ad Creative Name</th>
                <th className="py-3 px-4">Ad External ID</th>
                <th className="py-3 px-4">Ad Set Container</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No ads recorded yet in database.
                  </td>
                </tr>
              ) : (
                ads.map((ad: any) => (
                  <tr key={ad.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {ad.name || `Ad #${ad.id}`}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {ad.externalId || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {ad.adSet?.name || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                        {ad.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {formatDate(ad.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Campaign Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="ios-glass-modal max-w-sm w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.06]">
              <h3 className="text-sm font-bold text-[#1c1c1e]">Create Meta Campaign</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-[#8e8e93] hover:text-[#1c1c1e] rounded-full hover:bg-black/[0.05]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#3c3c43] mb-1.5">Campaign Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter campaign name"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="ios-input w-full font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#3c3c43] mb-1.5">External Meta Campaign ID</label>
                <input
                  type="text"
                  placeholder="Meta Campaign ID (optional)"
                  value={newCampaign.externalId}
                  onChange={(e) => setNewCampaign({ ...newCampaign, externalId: e.target.value })}
                  className="ios-input w-full"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#3c3c43] mb-1.5">Status</label>
                <select
                  value={newCampaign.status}
                  onChange={(e) => setNewCampaign({ ...newCampaign, status: e.target.value })}
                  className="ios-input w-full font-medium"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="ios-btn-gray text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ios-btn-primary text-xs"
                >
                  {submitting ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
