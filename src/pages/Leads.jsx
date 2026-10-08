import React, { useState, useEffect } from 'react';
import { crmService } from '../services/api/crmService';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(null); // lead to update
  const [statusForm, setStatusForm] = useState({ status: 'CONTACTED', notes: '' });

  // New Lead form state
  const [newLead, setNewLead] = useState({
    name: '',
    leadType: 'INQUIRY',
    status: 'NEW',
    source: 'DIRECT',
    email: '',
    phone: '',
    estimatedValue: 0,
  });

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmService.getLeads(page, 20);
      const list = Array.isArray(res) ? res : res?.content || res?.data || [];
      setLeads(list);
    } catch (err) {
      setError(err?.message || 'Failed to fetch leads from backend');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      await crmService.createLead(newLead);
      setShowAddModal(false);
      setNewLead({ name: '', leadType: 'INQUIRY', status: 'NEW', source: 'DIRECT', email: '', phone: '', estimatedValue: 0 });
      fetchLeads();
    } catch (err) {
      alert(`Error creating lead: ${err?.message || 'Server error'}`);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!showStatusModal) return;
    try {
      await crmService.updateLeadStatus(showStatusModal.id, statusForm.status, statusForm.notes);
      setShowStatusModal(null);
      fetchLeads();
    } catch (err) {
      alert(`Error updating status: ${err?.message || 'Server error'}`);
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm(`Delete lead #${id}?`)) return;
    try {
      await crmService.deleteLead(id);
      fetchLeads();
    } catch (err) {
      alert(`Delete failed: ${err?.message || 'Server error'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Leads Management</h1>
          <p className="text-xs text-slate-400">Endpoint: /api/leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium"
          >
            + Create Lead
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[11px]">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Name / Customer</th>
                <th className="p-3">Status</th>
                <th className="p-3">Type</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Value</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-500">
                    {loading ? 'Loading leads from backend...' : 'No leads found in database.'}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-slate-400">#{lead.id}</td>
                    <td className="p-3 font-medium text-white">{lead.name || lead.customerName || lead.fullName || '—'}</td>
                    <td className="p-3">
                      <button
                        onClick={() => {
                          setShowStatusModal(lead);
                          setStatusForm({ status: lead.status || 'CONTACTED', notes: lead.notes || '' });
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-emerald-400"
                      >
                        {lead.status || 'NEW'} ✎
                      </button>
                    </td>
                    <td className="p-3 text-slate-400">{lead.leadType || lead.source || '—'}</td>
                    <td className="p-3 text-slate-400">
                      {lead.email || lead.phone || '—'}
                    </td>
                    <td className="p-3 font-mono">
                      {lead.estimatedValue ? `₹${lead.estimatedValue}` : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Page {page + 1}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 bg-slate-800 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={leads.length < 20}
              className="px-2 py-1 bg-slate-800 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Create Lead */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 w-full max-w-md space-y-4">
            <h2 className="text-sm font-bold text-white">Create New Lead (/api/leads)</h2>
            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Lead Name *</label>
                <input
                  type="text"
                  required
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Status</label>
                  <select
                    value={newLead.status}
                    onChange={(e) => setNewLead({ ...newLead, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="NEW">NEW</option>
                    <option value="CONTACTED">CONTACTED</option>
                    <option value="QUALIFIED">QUALIFIED</option>
                    <option value="LOST">LOST</option>
                    <option value="CONVERTED">CONVERTED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Estimated Value</label>
                  <input
                    type="number"
                    value={newLead.estimatedValue}
                    onChange={(e) => setNewLead({ ...newLead, estimatedValue: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-700 text-white rounded font-medium"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Lead Status */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 w-full max-w-sm space-y-4">
            <h2 className="text-sm font-bold text-white">Update Status for Lead #{showStatusModal.id}</h2>
            <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Status</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="LOST">LOST</option>
                  <option value="CONVERTED">CONVERTED</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Notes</label>
                <textarea
                  rows="3"
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  placeholder="Notes on follow-up..."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(null)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-700 text-white rounded font-medium"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
