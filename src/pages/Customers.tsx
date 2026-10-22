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
  AlertCircle,
} from 'lucide-react';
import crmService from '../services/api/crmService';
import type { Customer } from '../types';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const hasLoadedRef = useRef<boolean>(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<{
    fullName: string;
    phoneNumber: string;
    location: string;
  }>({
    fullName: '',
    phoneNumber: '',
    location: '',
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmService.getCustomers(0, 100);
      const list = Array.isArray(res) ? res : res?.content || [];
      setCustomers(list);
    } catch (err: any) {
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

  const handleCreateCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await crmService.createCustomer(formData);
      setShowAddModal(false);
      setFormData({ fullName: '', phoneNumber: '', location: '' });
      await fetchCustomers();
    } catch (err: any) {
      alert(`Failed to add customer: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
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
    } catch (err: any) {
      alert(`Update failed: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: number | string, name?: string) => {
    if (!window.confirm(`Are you sure you want to delete customer "${name || id}"?`)) return;
    try {
      await crmService.deleteCustomer(id);
      await fetchCustomers();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || 'Server error'}`);
    }
  };

  const startEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      fullName: customer.fullName || '',
      phoneNumber: customer.phoneNumber || '',
      location: customer.location || '',
    });
  };

  const formatDate = (isoStr?: string) => {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ios-card p-4 sm:p-5">
        <div>
          <h2 className="text-base font-bold text-[#1c1c1e]">
            Contacts
          </h2>
          <p className="text-xs text-[#8e8e93] mt-0.5">
            Managing <strong className="text-[#1c1c1e]">{customers.length}</strong> contact records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="ios-btn-gray text-xs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#007aff]' : 'text-[#8e8e93]'} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setFormData({ fullName: '', phoneNumber: '', location: '' });
              setShowAddModal(true);
            }}
            className="ios-btn-primary text-xs"
          >
            <Plus size={14} />
            <span>New Contact</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-xs text-[#ff3b30] flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={fetchCustomers} className="underline font-semibold hover:opacity-80">
            Retry
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="ios-card p-3 sm:p-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8e8e93]">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ios-input w-full pl-9 pr-8 py-2 text-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8e8e93] hover:text-[#1c1c1e]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Customers Table */}
      <div className="ios-card overflow-hidden">
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
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-slate-600" />
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
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                            >
                              <MessageCircle size={14} />
                            </a>
                            <a
                              href={`tel:${cust.phoneNumber}`}
                              title="Call Customer"
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs"
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
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs"
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

      {/* Add / Edit Customer Modal (Zoho CRM Modal & Field UI) */}
      {(showAddModal || editingCustomer) && (
        <div className="zoho-modal-backdrop">
          <div className="zoho-modal-card max-w-lg animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {editingCustomer ? `Edit Customer #${editingCustomer.id}` : 'Customer Information'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCustomer(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-500 mt-3 mb-4">
              Order Information
            </div>

            <form
              onSubmit={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
              className="text-xs"
            >
              {/* Full Name (Required: Red Left Accent Bar) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Name of the Customer">
                  Name of the Cus...
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="ios-input ios-input-required w-full font-medium"
                  />
                </div>
              </div>

              {/* Customer Phone (Required: Red Left Accent Bar) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Customer Phone">
                  Customer Phone
                </label>
                <div className="flex-1">
                  <input
                    type="tel"
                    required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="ios-input ios-input-required w-full font-medium"
                  />
                </div>
              </div>

              {/* Location / District */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Customer Location">
                  Location / City
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="ios-input w-full"
                  />
                </div>
              </div>

              {/* Date & Time of Record (Compound Field matching screenshot) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Date and Time">
                  Date and Time of ...
                </label>
                <div className="flex-1 flex rounded-md overflow-hidden border border-[#d0dcf0] bg-[#edf2f9]">
                  <div className="flex-1 px-3 py-2 border-r border-[#d0dcf0] text-xs text-slate-800 bg-[#edf2f9]">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Footer Action */}
              <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="zoho-btn-done"
                >
                  {submitting ? 'Saving...' : 'Done'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
