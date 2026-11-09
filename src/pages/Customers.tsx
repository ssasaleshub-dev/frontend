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
import { formatIndianDate, formatIndianTime } from '../utils/dateTimeUtils';
import type { Customer } from '../types';

function WhatsAppIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const hasLoadedRef = useRef<boolean>(false);
  const pageRef = useRef<number>(0);
  const hasMoreRef = useRef<boolean>(true);
  const loadingMoreRef = useRef<boolean>(false);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

  // Sync refs so callbacks/observers never suffer from stale closures
  pageRef.current = page;
  hasMoreRef.current = hasMore;
  loadingMoreRef.current = loadingMore;

  // Stale-while-revalidate cache key
  const CACHE_KEY = 'ssa_customers_cache_v2';

  const loadFromCache = () => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.list) && parsed.list.length > 0) {
          setCustomers(parsed.list);
          if (typeof parsed.total === 'number') setTotalElements(parsed.total);
          if (typeof parsed.hasMore === 'boolean') {
            setHasMore(parsed.hasMore);
            hasMoreRef.current = parsed.hasMore;
          }
          setLoading(false);
          return true;
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomers(parsed);
          setLoading(false);
          return true;
        }
      }
    } catch {}
    return false;
  };

  const saveToCache = (data: { list: Customer[]; total: number; hasMore: boolean }) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {}
  };

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

  const fetchInitialCustomers = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await crmService.getCustomers(0, 25, true, 'id,desc');
      const list: Customer[] = Array.isArray(res) ? res : res?.content || [];
      const total = typeof res?.totalElements === 'number' ? res.totalElements : list.length;
      const more = typeof res?.hasMore === 'boolean' ? res.hasMore : list.length === 25;

      setCustomers(list);
      setTotalElements(total);
      setPage(0);
      pageRef.current = 0;
      setHasMore(more);
      hasMoreRef.current = more;
      saveToCache({ list, total, hasMore: more });
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch customer directory');
      if (!isBackground) setCustomers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadNextPage = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    const nextPage = pageRef.current + 1;
    try {
      const res = await crmService.getCustomers(nextPage, 25, true, 'id,desc');
      const newItems: Customer[] = Array.isArray(res) ? res : res?.content || [];
      const total = typeof res?.totalElements === 'number' ? res.totalElements : totalElements;
      const more = typeof res?.hasMore === 'boolean' ? res.hasMore : newItems.length === 25;

      setCustomers((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const unique = newItems.filter((c: Customer) => !existingIds.has(c.id));
        const updated = [...prev, ...unique];
        saveToCache({ list: updated, total, hasMore: more });
        return updated;
      });

      setPage(nextPage);
      pageRef.current = nextPage;
      setHasMore(more);
      hasMoreRef.current = more;
      if (typeof res?.totalElements === 'number') {
        setTotalElements(res.totalElements);
      }
    } catch (err: any) {
      console.error('Failed to load next page of customers:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [loading, totalElements]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      const hasCached = loadFromCache();
      fetchInitialCustomers(hasCached);
    }
  }, [fetchInitialCustomers]);

  // Infinite Scroll IntersectionObserver on bottom sentinel
  useEffect(() => {
    const sentinel = loadMoreTriggerRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreRef.current && !loadingMoreRef.current && !loading) {
          loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: '250px',
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadNextPage, loading, hasMore]);

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
      try { sessionStorage.removeItem(CACHE_KEY); } catch {}
      await fetchInitialCustomers(false);
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
      const updated = await crmService.updateCustomer(editingCustomer.id, {
        id: editingCustomer.id,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        location: formData.location,
        createdAt: editingCustomer.createdAt,
      });
      setEditingCustomer(null);
      setFormData({ fullName: '', phoneNumber: '', location: '' });
      // Update local state in place for immediate responsive feel
      setCustomers((prev) =>
        prev.map((c) => (c.id === editingCustomer.id ? { ...c, ...updated } : c))
      );
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
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setTotalElements((prev) => Math.max(0, prev - 1));
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
    return formatIndianDate(isoStr, { fallback: isoStr });
  };

  return (
    <div className="space-y-4 pb-24">
      {error && (
        <div className="p-3.5 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-xs text-[#ff3b30] flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchInitialCustomers(false)} className="underline font-semibold hover:opacity-80">
            Retry
          </button>
        </div>
      )}

      {/* Search Bar + Quick Actions */}
      <div className="ios-card p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8e8e93]">
              <Search size={15} />
            </div>
            <input
              type="text"
              placeholder="Search contacts by name, phone, or location..."
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

          <div className="flex items-center gap-2 shrink-0">
            {totalElements > 0 && (
              <span className="text-[11px] text-[#8e8e93] font-medium hidden sm:inline px-2">
                {searchTerm
                  ? `${filteredCustomers.length} of ${totalElements}`
                  : `${totalElements} contacts`}
              </span>
            )}

            <button
              onClick={() => {
                try { sessionStorage.removeItem(CACHE_KEY); } catch {}
                fetchInitialCustomers(false);
              }}
              disabled={loading || refreshing}
              title="Refresh contacts"
              className="p-2 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] active:scale-95 text-[#8e8e93] hover:text-[#007aff] transition-all"
            >
              <RefreshCw size={14} className={loading || refreshing ? 'animate-spin text-[#007aff]' : ''} />
            </button>
          </div>
        </div>

        {searchTerm && (
          <div className="text-[11px] text-[#8e8e93] font-medium mt-2 sm:hidden">
            Found <strong className="text-[#1c1c1e]">{filteredCustomers.length}</strong> matching contact{filteredCustomers.length === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {/* Customers List / Table Container */}
      <div className="ios-card overflow-hidden">
        {/* Background refresh indicator */}
        {refreshing && (
          <div className="px-4 py-1.5 bg-[#007aff]/[0.06] border-b border-[#007aff]/10 flex items-center gap-2 text-[11px] text-[#007aff] font-medium">
            <RefreshCw size={11} className="animate-spin shrink-0" />
            Syncing latest data...
          </div>
        )}

        {/* Mobile View: Zero Side-Scroll iOS Grouped List (md:hidden) */}
        <div className="md:hidden divide-y divide-black/[0.06]">
          {filteredCustomers.length === 0 ? (
            <div className="py-12 px-4 text-center text-[#8e8e93]">
              {loading ? (
                <span className="flex items-center justify-center gap-2 text-xs">
                  <RefreshCw size={16} className="animate-spin text-[#007aff]" />
                  Loading contacts...
                </span>
              ) : (
                <div>
                  <p className="text-[#1c1c1e] font-semibold text-sm">No contacts found</p>
                  <p className="text-[#8e8e93] text-xs mt-1">
                    Click "New Contact" to register contacts or import leads.
                  </p>
                </div>
              )}
            </div>
          ) : (
            filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                className="p-3.5 hover:bg-black/[0.02] active:bg-black/[0.04] transition-colors space-y-2.5"
              >
                {/* Header row: Name, ID, Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[#1c1c1e] truncate">
                        {cust.fullName || 'Unnamed Contact'}
                      </h3>
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#f2f2f7] text-[#8e8e93]">
                        #{cust.id}
                      </span>
                    </div>

                    {cust.location && (
                      <div className="flex items-center gap-1 text-[11px] text-[#8e8e93] mt-0.5">
                        <MapPin size={11} className="text-[#8e8e93] shrink-0" />
                        <span className="truncate capitalize">{cust.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Apple iOS Grouped Action Capsule */}
                  <div className="inline-flex items-center rounded-full bg-[#f2f2f7] p-0.5 border border-black/[0.04] shadow-2xs shrink-0">
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
                          title="WhatsApp"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#25D366] hover:bg-white active:scale-90 transition-all cursor-pointer"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`tel:${cust.phoneNumber}`}
                          title="Call"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#007aff] hover:bg-white active:scale-90 transition-all cursor-pointer"
                        >
                          <Phone size={13} strokeWidth={2.2} />
                        </a>
                        <div className="w-[1px] h-3.5 bg-black/[0.08] mx-0.5" />
                      </>
                    )}
                    <button
                      onClick={() => startEdit(cust)}
                      title="Edit"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#3a3a3c] hover:bg-white hover:text-[#1c1c1e] active:scale-90 transition-all cursor-pointer"
                    >
                      <Edit3 size={12.5} strokeWidth={2.2} />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(cust.id, cust.fullName)}
                      title="Delete"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#8e8e93] hover:bg-white hover:text-[#ff3b30] active:scale-90 transition-all cursor-pointer"
                    >
                      <Trash2 size={12.5} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>

                {/* Info row: Phone & Created Date */}
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-black/[0.04]">
                  <div className="min-w-0 pr-2">
                    {cust.phoneNumber ? (
                      <a
                        href={`tel:${cust.phoneNumber}`}
                        className="font-semibold text-[#1c1c1e] hover:text-[#007aff] transition-colors"
                      >
                        {cust.phoneNumber}
                      </a>
                    ) : (
                      <span className="text-[#8e8e93] text-xs">No phone number</span>
                    )}
                    {cust.rawPhoneNumber && cust.rawPhoneNumber !== cust.phoneNumber && (
                      <span className="text-[10px] text-[#8e8e93] font-mono ml-1.5">
                        (Raw: {cust.rawPhoneNumber})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] shrink-0 font-medium">
                    {formatDate(cust.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
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
                      <div className="flex items-center justify-end">
                        <div className="inline-flex items-center rounded-full bg-[#f2f2f7] p-0.5 border border-black/[0.04] shadow-2xs">
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
                                title="WhatsApp"
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[#25D366] hover:bg-white active:scale-90 transition-all cursor-pointer"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`tel:${cust.phoneNumber}`}
                                title="Call"
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[#007aff] hover:bg-white active:scale-90 transition-all cursor-pointer"
                              >
                                <Phone size={13} strokeWidth={2.2} />
                              </a>
                              <div className="w-[1px] h-3.5 bg-black/[0.08] mx-0.5" />
                            </>
                          )}
                          <button
                            onClick={() => startEdit(cust)}
                            title="Edit"
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[#3a3a3c] hover:bg-white hover:text-[#1c1c1e] active:scale-90 transition-all cursor-pointer"
                          >
                            <Edit3 size={12.5} strokeWidth={2.2} />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(cust.id, cust.fullName)}
                            title="Delete"
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[#8e8e93] hover:bg-white hover:text-[#ff3b30] active:scale-90 transition-all cursor-pointer"
                          >
                            <Trash2 size={12.5} strokeWidth={2.2} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sentinel for IntersectionObserver to trigger next page */}
        <div ref={loadMoreTriggerRef} className="h-4 w-full pointer-events-none" />

        {/* Lazy Loading Activity Indicator */}
        {loadingMore && (
          <div className="py-3.5 border-t border-black/[0.04] bg-slate-50/50 flex items-center justify-center gap-2 text-xs text-[#007aff] font-medium">
            <RefreshCw size={14} className="animate-spin text-[#007aff]" />
            <span>Loading more contacts...</span>
          </div>
        )}

        {/* Manual Load More Button fallback if observer hasn't fired yet */}
        {hasMore && !loadingMore && !loading && customers.length > 0 && (
          <div className="py-2.5 border-t border-black/[0.04] text-center bg-slate-50/30">
            <button
              onClick={() => loadNextPage()}
              className="text-xs text-[#007aff] font-semibold py-1.5 px-4 rounded-full bg-[#007aff]/10 hover:bg-[#007aff]/15 active:scale-95 transition-all"
            >
              Load More Contacts
            </button>
          </div>
        )}

        {/* End of list reached */}
        {!hasMore && customers.length > 0 && (
          <div className="py-3 border-t border-black/[0.04] text-center text-[11px] text-[#8e8e93] bg-slate-50/30">
            All {totalElements || customers.length} contacts loaded
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) at Bottom Right Corner */}
      <button
        type="button"
        onClick={() => {
          setFormData({ fullName: '', phoneNumber: '', location: '' });
          setShowAddModal(true);
        }}
        title="Create New Contact"
        aria-label="Create New Contact"
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-14 h-14 rounded-full bg-[#007aff] hover:bg-[#0062cc] active:scale-90 text-white shadow-[0_10px_25px_rgba(0,122,255,0.45)] hover:shadow-[0_14px_30px_rgba(0,122,255,0.55)] flex items-center justify-center transition-all duration-200 group focus:outline-none cursor-pointer"
      >
        <Plus size={28} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-200" />
      </button>

      {/* Add / Edit Customer Modal (Zoho CRM Modal & Field UI) */}
      {(showAddModal || editingCustomer) && (
        <div className="ios-modal-backdrop">
          <div className="ios-modal-card max-w-lg animate-in zoom-in-95">
            <div className="ios-sheet-grabber" />
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="text-base font-semibold text-[#1c1c1e] tracking-tight">
                {editingCustomer ? `Edit Customer #${editingCustomer.id}` : 'Customer Information'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCustomer(null);
                }}
                className="w-7 h-7 rounded-full bg-black/[0.05] text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/[0.1] flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X size={15} />
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
                    {formatIndianDate(new Date())}
                  </div>
                  <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                    {formatIndianTime(new Date())}
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
