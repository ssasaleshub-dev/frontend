import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Plus,
  RefreshCw,
  Phone,
  MessageCircle,
  MapPin,
  Trash2,
  Edit3,
  X,
  AlertCircle
} from 'lucide-react';
import crmService from '../services/api/crmService';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const hasLoadedRef = useRef(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    location: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmService.getCustomers(0, 100);
      const list = Array.isArray(res) ? res : res?.content || [];
      setCustomers(list);
    } catch (err) {
      setError(err?.message || 'Failed to fetch customer directory');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchCustomers();
    }
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const query = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        (c.fullName || '').toLowerCase().includes(query) ||
        (c.phoneNumber || '').toLowerCase().includes(query) ||
        (c.location || '').toLowerCase().includes(query) ||
        String(c.id).includes(query)
    );
  }, [customers, searchTerm]);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await crmService.createCustomer(formData);
      setShowAddModal(false);
      setFormData({ fullName: '', phoneNumber: '', location: '' });
      await fetchCustomers();
    } catch (err) {
      alert(`Failed to add customer: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setSubmitting(true);
    try {
      await crmService.updateCustomer(editingCustomer.id, {
        id: editingCustomer.id,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        location: formData.location,
        createdAt: editingCustomer.createdAt,
      });
      setEditingCustomer(null);
      setFormData({ fullName: '', phoneNumber: '', location: '' });
      await fetchCustomers();
    } catch (err) {
      alert(`Update failed: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete customer "${name || id}"?`)) return;
    try {
      await crmService.deleteCustomer(id);
      await fetchCustomers();
    } catch (err) {
      alert(`Delete failed: ${err?.message || 'Server error'}`);
    }
  };

  const startEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      fullName: customer.fullName || '',
      phoneNumber: customer.phoneNumber || '',
      location: customer.location || '',
    });
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Customer Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Managing <strong className="text-slate-800">{customers.length}</strong> customer records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 rounded-md border border-slate-300 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setFormData({ fullName: '', phoneNumber: '', location: '' });
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors"
          >
            <Plus size={14} />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchCustomers} className="underline font-medium hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer by name, phone, or location..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Phone Number</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">Account Created</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-blue-600" />
                        Loading customers...
                      </span>
                    ) : (
                      <div>
                        <p className="text-slate-600 font-semibold text-sm">No customers found</p>
                        <p className="text-slate-400 text-xs mt-1">
                          Click "New Customer" to register buyers or import Meta leads.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{cust.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Cust ID: #{cust.id}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{cust.phoneNumber}</div>
                      {cust.rawPhoneNumber && cust.rawPhoneNumber !== cust.phoneNumber && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Raw: {cust.rawPhoneNumber}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 font-medium text-slate-700 capitalize">
                        <MapPin size={12} className="text-slate-400" />
                        <span>{cust.location || '—'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {formatDate(cust.createdAt)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {cust.phoneNumber && (
                          <>
                            <a
                              href={`https://wa.me/${cust.phoneNumber.replace(
                                /\D/g,
                                ''
                              )}?text=Hello%20${encodeURIComponent(
                                cust.fullName || ''
                              )},%20reaching%20out%20from%20SSA%20Sales%20Hub.`}
                              target="_blank"
                              rel="noreferrer"
                              title="WhatsApp Customer"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors shadow-2xs"
                            >
                              <MessageCircle size={14} />
                            </a>
                            <a
                              href={`tel:${cust.phoneNumber}`}
                              title="Call Customer"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors shadow-2xs"
                            >
                              <Phone size={14} />
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => startEdit(cust)}
                          title="Edit Customer"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(cust.id, cust.fullName)}
                          title="Delete Customer"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors shadow-2xs"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {(showAddModal || editingCustomer) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingCustomer ? `Edit Customer #${editingCustomer.id}` : 'Create Customer'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCustomer(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter customer full name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="Enter phone number"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Location / District</label>
                <input
                  type="text"
                  placeholder="City / Region (optional)"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCustomer(null);
                  }}
                  className="px-3.5 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md font-medium bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
