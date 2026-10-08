import React, { useState, useEffect } from 'react';
import { crmService } from '../services/api/crmService';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmService.getCampaigns();
      const list = Array.isArray(res) ? res : res?.content || res?.data || [];
      setCampaigns(list);
    } catch (err) {
      setError(err?.message || 'Failed to fetch campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Marketing Campaigns</h1>
          <p className="text-xs text-slate-400">Endpoint: /api/campaigns</p>
        </div>
        <button
          onClick={fetchCampaigns}
          className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        {campaigns.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            {loading ? 'Loading campaigns from backend...' : 'No marketing campaigns found in database.'}
          </p>
        ) : (
          <div className="space-y-2">
            {campaigns.map((camp) => (
              <div key={camp.id} className="p-3 bg-slate-950 border border-slate-800 rounded flex justify-between text-xs">
                <span className="font-semibold text-white">{camp.name || `Campaign #${camp.id}`}</span>
                <span className="text-emerald-400">{camp.status || 'ACTIVE'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
