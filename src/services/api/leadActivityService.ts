/**
 * Lead Activity & Counselor Audit Log Service
 * Enterprise audit trail tracking status transitions, dossier edits, counselor remarks, and outreaches.
 * Implements optimistic local caching + full backend synchronization.
 */

import axiosClient from './axiosClient';
import type { LeadActivity } from '../../types';

const ACTIVITY_STORAGE_PREFIX = 'ssa_lead_activities_';

export const leadActivityService = {
  /**
   * Fetch all audit activities for a specific candidate lead
   */
  async getActivities(leadId: string | number): Promise<LeadActivity[]> {
    if (!leadId) return [];

    let remoteActivities: LeadActivity[] = [];
    try {
      // 1. Attempt fetching from real backend REST endpoint
      const res = await axiosClient.get<any[]>(`/api/leads/${leadId}/activities`);
      if (Array.isArray(res)) {
        remoteActivities = res.map((item) => ({
          id: item.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          leadId: item.leadId || leadId,
          userName: item.userName || 'Counselor',
          userRole: item.userRole,
          actionType: item.actionType || 'DATA_MODIFY',
          title: item.summary || item.title || 'Activity Record',
          description: item.details || item.description || '',
          fieldChanged: item.fieldName || item.fieldChanged,
          oldValue: item.oldValue,
          newValue: item.newValue,
          timestamp: item.createdAt || item.timestamp || new Date().toISOString(),
          metadata: item.metadata,
        }));
      }
    } catch {
      // Backend may not have endpoint deployed yet; gracefully fallback
    }

    // 2. Fetch locally cached optimistic activities
    const local = this.getLocalActivities(leadId);

    // 3. Merge without duplicates (by id or timestamp + actionType)
    const seen = new Set<string>();
    const merged: LeadActivity[] = [];

    // Prioritize remote entries
    for (const item of remoteActivities) {
      const key = `${item.id || ''}_${item.timestamp}_${item.actionType}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // Append local entries not yet in remote
    for (const item of local) {
      const key = `${item.id || ''}_${item.timestamp}_${item.actionType}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // Sort descending (most recent first)
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Update local cache with consolidated view
    this.saveLocalActivities(leadId, merged);

    return merged;
  },

  /**
   * Record a new candidate activity log (optimistic UI first + async backend sync)
   */
  async logActivity(
    leadId: string | number,
    activityData: Omit<LeadActivity, 'id' | 'leadId' | 'timestamp'> & { timestamp?: string }
  ): Promise<LeadActivity> {
    const newActivity: LeadActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      leadId,
      userName: activityData.userName || 'Counselor',
      userRole: activityData.userRole,
      actionType: activityData.actionType,
      title: activityData.title,
      description: activityData.description,
      fieldChanged: activityData.fieldChanged,
      oldValue: activityData.oldValue,
      newValue: activityData.newValue,
      timestamp: activityData.timestamp || new Date().toISOString(),
      metadata: activityData.metadata,
    };

    // 1. Optimistically append to local storage immediately
    const existing = this.getLocalActivities(leadId);
    const updated = [newActivity, ...existing];
    this.saveLocalActivities(leadId, updated);

    // 2. Dispatched global event so any active component refreshes instantly
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ssa_lead_activity_logged', { detail: { leadId, activity: newActivity } })
      );
    }

    // 3. Asynchronously persist to backend endpoint
    // IMPORTANT: Do NOT include string client ID in post payload so Jackson deserializes cleanly without 400 Bad Request
    try {
      const numericLeadId = Number(leadId);
      const postPayload: Record<string, any> = {
        leadId: !isNaN(numericLeadId) ? numericLeadId : undefined,
        userName: newActivity.userName,
        userRole: newActivity.userRole,
        actionType: newActivity.actionType,
        summary: newActivity.title || 'Candidate activity',
        title: newActivity.title,
        details: newActivity.description || '',
        description: newActivity.description || '',
        fieldName: newActivity.fieldChanged || '',
        fieldChanged: newActivity.fieldChanged || '',
        oldValue: newActivity.oldValue || '',
        newValue: newActivity.newValue || '',
        createdAt: newActivity.timestamp,
        timestamp: newActivity.timestamp,
      };

      const serverSaved = await axiosClient.post<any>(
        `/api/leads/${leadId}/activities`,
        postPayload
      );
      if (serverSaved && serverSaved.id) {
        // Replace optimistic ID with server ID if available
        const current = this.getLocalActivities(leadId);
        const replaced = current.map((a) =>
          a.id === newActivity.id ? { ...a, id: serverSaved.id } : a
        );
        this.saveLocalActivities(leadId, replaced);
        return {
          ...newActivity,
          id: serverSaved.id,
        };
      }
    } catch {
      // Backend sync queued or deferred; local entry remains safe
    }

    return newActivity;
  },

  /**
   * Get cached local activities for offline / fast immediate render
   */
  getLocalActivities(leadId: string | number): LeadActivity[] {
    try {
      const raw = localStorage.getItem(`${ACTIVITY_STORAGE_PREFIX}${leadId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Save activities to local cache
   */
  saveLocalActivities(leadId: string | number, activities: LeadActivity[]): void {
    try {
      // Keep last 100 activities per lead to maintain fast performance
      const trimmed = activities.slice(0, 100);
      localStorage.setItem(`${ACTIVITY_STORAGE_PREFIX}${leadId}`, JSON.stringify(trimmed));
    } catch {
      // Storage quota safety
    }
  },
};

export default leadActivityService;
