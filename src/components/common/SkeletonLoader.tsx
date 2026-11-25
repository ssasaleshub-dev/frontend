import React from 'react';

/**
 * Universal atomic skeleton block with shimmer animation
 */
export const SkeletonBlock: React.FC<{
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: string;
  dark?: boolean;
}> = ({ className = '', width, height, rounded = 'rounded-md', dark = false }) => (
  <span
    style={{ width, height }}
    className={`${dark ? 'crm-skeleton-dark' : 'crm-skeleton'} ${rounded} ${className}`}
  />
);

/**
 * Circle skeleton for avatars and rounded action buttons
 */
export const SkeletonCircle: React.FC<{
  size?: number | string;
  className?: string;
}> = ({ size = 40, className = '' }) => (
  <span
    style={{ width: size, height: size }}
    className={`crm-skeleton crm-skeleton-circle shrink-0 ${className}`}
  />
);

/**
 * Screen 1: Dashboard Skeleton (Admin & Staff)
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 animate-fadeIn p-1">
      {/* Greeting & Date Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-black/[0.06] shadow-xs">
        <div className="space-y-2">
          <SkeletonBlock className="w-48 h-6 rounded-md" />
          <SkeletonBlock className="w-72 h-4 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-24 h-8 rounded-lg" />
          <SkeletonBlock className="w-28 h-8 rounded-lg" />
        </div>
      </div>

      {/* 4 KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="w-20 h-3.5 rounded" />
              <SkeletonCircle size={32} />
            </div>
            <SkeletonBlock className="w-28 h-7 rounded-md" />
            <SkeletonBlock className="w-36 h-3 rounded" />
          </div>
        ))}
      </div>

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-black/[0.06] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="w-36 h-5 rounded-md" />
            <SkeletonBlock className="w-24 h-4 rounded" />
          </div>
          <div className="h-64 w-full flex items-end gap-3 pt-6 px-2">
            {[40, 65, 30, 85, 55, 90, 70, 45, 80, 60, 75, 95].map((h, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <SkeletonBlock
                  className="w-full rounded-t-md"
                  height={`${h}%`}
                />
                <SkeletonBlock className="w-4 h-2 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Secondary Distribution Card */}
        <div className="bg-white p-5 rounded-xl border border-black/[0.06] shadow-xs space-y-4">
          <SkeletonBlock className="w-32 h-5 rounded-md" />
          <div className="flex justify-center py-4">
            <SkeletonCircle size={150} />
          </div>
          <div className="space-y-2.5 pt-2">
            {[1, 2, 3].map((k) => (
              <div key={k} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SkeletonCircle size={10} />
                  <SkeletonBlock className="w-24 h-3.5 rounded" />
                </div>
                <SkeletonBlock className="w-12 h-3.5 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity / Candidate Workspace */}
      <div className="bg-white p-5 rounded-xl border border-black/[0.06] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.05]">
          <SkeletonBlock className="w-40 h-5 rounded-md" />
          <SkeletonBlock className="w-20 h-4 rounded" />
        </div>
        {[1, 2, 3, 4].map((j) => (
          <div key={j} className="flex items-center justify-between py-2.5 border-b border-black/[0.03]">
            <div className="flex items-center gap-3">
              <SkeletonCircle size={36} />
              <div className="space-y-1.5">
                <SkeletonBlock className="w-32 h-4 rounded" />
                <SkeletonBlock className="w-48 h-3 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBlock className="w-20 h-6 rounded-full" />
              <SkeletonBlock className="w-16 h-3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Screen 2A: Mobile Leads List Skeleton (.crm-k mobile view)
 */
export const LeadsMobileSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="divide-y divide-[#e6e8eb] animate-fadeIn">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5 bg-white">
          <SkeletonCircle size={44} />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="w-32 h-4 rounded" />
              <SkeletonBlock className="w-16 h-3 rounded" />
            </div>
            <SkeletonBlock className="w-44 h-3 rounded" />
            <div className="flex items-center gap-2 pt-0.5">
              <SkeletonBlock className="w-20 h-3.5 rounded-full" />
              <SkeletonBlock className="w-24 h-3 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <SkeletonCircle size={38} />
            <SkeletonCircle size={38} />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Screen 2B: Desktop Leads Table Skeleton (Table view)
 */
export const LeadsTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => {
  return (
    <div className="bg-white border border-[#e6e8eb] rounded-xl overflow-hidden shadow-xs animate-fadeIn">
      <div className="p-4 border-b border-[#e6e8eb] flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="w-48 h-8 rounded-lg" />
          <SkeletonBlock className="w-28 h-8 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-24 h-8 rounded-lg" />
          <SkeletonBlock className="w-32 h-8 rounded-lg" />
        </div>
      </div>
      <div className="divide-y divide-[#f0f2f5]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50/50">
            <SkeletonBlock className="w-4 h-4 rounded" />
            <SkeletonCircle size={34} />
            <div className="w-48 space-y-1">
              <SkeletonBlock className="w-32 h-4 rounded" />
              <SkeletonBlock className="w-20 h-3 rounded" />
            </div>
            <div className="w-40 space-y-1">
              <SkeletonBlock className="w-28 h-3.5 rounded" />
              <SkeletonBlock className="w-36 h-3 rounded" />
            </div>
            <div className="w-28">
              <SkeletonBlock className="w-24 h-6 rounded-full" />
            </div>
            <div className="w-32">
              <SkeletonBlock className="w-20 h-6 rounded-md" />
            </div>
            <div className="w-28">
              <SkeletonBlock className="w-16 h-3 rounded" />
            </div>
            <div className="flex-1 flex justify-end gap-2">
              <SkeletonCircle size={28} />
              <SkeletonCircle size={28} />
              <SkeletonCircle size={28} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Screen 3: Campaigns Skeleton (Mobile & Desktop)
 */
export const CampaignsSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 max-w-5xl mx-auto animate-fadeIn">
      {/* Header & Stats Shimmer */}
      <div className="bg-white p-5 rounded-xl border border-black/[0.06] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="w-36 h-7 rounded-md" />
          <SkeletonCircle size={38} />
        </div>
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-black/[0.05]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <SkeletonBlock className="w-12 h-6 rounded" />
              <SkeletonBlock className="w-16 h-3 rounded" />
            </div>
          ))}
        </div>
        <SkeletonBlock className="w-full h-2 rounded-full" />
      </div>

      {/* Campaign List Items */}
      <div className="bg-white rounded-xl border border-black/[0.06] shadow-xs divide-y divide-black/[0.05] overflow-hidden">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div key={idx} className="flex items-center gap-3.5 p-4">
            <SkeletonCircle size={42} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <SkeletonBlock className="w-3/4 h-4 rounded" />
              <SkeletonBlock className="w-1/2 h-3 rounded" />
              <SkeletonBlock className="w-1/3 h-3 rounded" />
            </div>
            <div className="text-right space-y-1">
              <SkeletonBlock className="w-10 h-6 rounded" />
              <SkeletonBlock className="w-14 h-3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Screen 4: Reports Skeleton
 */
export const ReportsSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 max-w-[1440px] mx-auto animate-fadeIn">
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-28 h-8 rounded-lg" />
          <SkeletonBlock className="w-32 h-8 rounded-lg" />
          <SkeletonBlock className="w-24 h-8 rounded-lg" />
        </div>
        <SkeletonBlock className="w-28 h-8 rounded-lg" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-xs space-y-2">
            <SkeletonBlock className="w-20 h-3 rounded" />
            <SkeletonBlock className="w-16 h-7 rounded-md" />
            <SkeletonBlock className="w-24 h-3 rounded" />
          </div>
        ))}
      </div>

      {/* 2 Big Analysis Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white p-5 rounded-xl border border-black/[0.06] shadow-xs space-y-4">
          <SkeletonBlock className="w-48 h-5 rounded-md" />
          <div className="h-48 w-full flex items-end gap-3 pt-4">
            {[40, 70, 50, 90, 60, 80, 45].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <SkeletonBlock className="w-full rounded-t-md" height={`${h}%`} />
                <SkeletonBlock className="w-8 h-2.5 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-black/[0.06] shadow-xs space-y-4">
          <SkeletonBlock className="w-48 h-5 rounded-md" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="space-y-1.5">
                <div className="flex justify-between">
                  <SkeletonBlock className="w-32 h-3.5 rounded" />
                  <SkeletonBlock className="w-12 h-3.5 rounded" />
                </div>
                <SkeletonBlock className="w-full h-3 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Screen 5: Candidate Detail Dossier Skeleton
 */
export const CandidateDetailSkeleton: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn p-4 sm:p-6">
      {/* Back button & top bar */}
      <div className="flex items-center justify-between">
        <SkeletonBlock className="w-24 h-8 rounded-lg" />
        <div className="flex items-center gap-2">
          <SkeletonCircle size={36} />
          <SkeletonBlock className="w-28 h-8 rounded-lg" />
        </div>
      </div>

      {/* Top Banner Card */}
      <div className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <SkeletonCircle size={64} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="w-48 h-6 rounded-md" />
              <SkeletonBlock className="w-20 h-5 rounded-full" />
            </div>
            <SkeletonBlock className="w-64 h-3.5 rounded" />
            <div className="flex items-center gap-3 pt-1">
              <SkeletonBlock className="w-28 h-4 rounded" />
              <SkeletonBlock className="w-24 h-4 rounded" />
            </div>
          </div>
          <div className="flex sm:flex-col gap-2">
            <SkeletonBlock className="w-28 h-9 rounded-xl" />
            <SkeletonBlock className="w-28 h-9 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Tabbed details */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs p-5 space-y-4">
        <div className="flex gap-2 border-b border-black/[0.06] pb-3">
          <SkeletonBlock className="w-28 h-8 rounded-lg" />
          <SkeletonBlock className="w-28 h-8 rounded-lg" />
          <SkeletonBlock className="w-28 h-8 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="p-3.5 bg-slate-50/70 rounded-xl space-y-2 border border-black/[0.04]">
              <SkeletonBlock className="w-24 h-3 rounded" />
              <SkeletonBlock className="w-40 h-4 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Screen 6: Attendance & Staff Roster Skeleton
 */
export const AttendanceSkeleton: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-fadeIn p-4">
      <div className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-xs flex items-center justify-between">
        <div className="space-y-1.5">
          <SkeletonBlock className="w-40 h-6 rounded-md" />
          <SkeletonBlock className="w-60 h-3.5 rounded" />
        </div>
        <SkeletonBlock className="w-28 h-8 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-xs space-y-2">
            <SkeletonBlock className="w-20 h-3 rounded" />
            <SkeletonBlock className="w-16 h-6 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-black/[0.06] shadow-xs divide-y divide-black/[0.05] overflow-hidden">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div key={idx} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <SkeletonCircle size={40} />
              <div className="space-y-1.5">
                <SkeletonBlock className="w-32 h-4 rounded" />
                <SkeletonBlock className="w-24 h-3 rounded" />
              </div>
            </div>
            <SkeletonBlock className="w-20 h-6 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Screen 7: Staff Profile Skeleton
 */
export const StaffProfileSkeleton: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn p-4 sm:p-6">
      <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-xs flex flex-col sm:flex-row items-center gap-5">
        <SkeletonCircle size={80} />
        <div className="space-y-2 text-center sm:text-left flex-1">
          <SkeletonBlock className="w-44 h-6 rounded-md" />
          <SkeletonBlock className="w-32 h-4 rounded" />
          <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
            <SkeletonBlock className="w-24 h-6 rounded-full" />
            <SkeletonBlock className="w-28 h-6 rounded-full" />
          </div>
        </div>
        <SkeletonBlock className="w-32 h-9 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-xs space-y-3">
            <SkeletonBlock className="w-36 h-4 rounded" />
            <div className="space-y-2">
              <SkeletonBlock className="w-full h-10 rounded-lg" />
              <SkeletonBlock className="w-full h-10 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Universal Modal Form Skeleton ("All Models")
 */
export const ModalSkeleton: React.FC<{ fields?: number }> = ({ fields = 5 }) => {
  return (
    <div className="space-y-4 animate-fadeIn p-2">
      {/* Modal Title shimmer */}
      <div className="space-y-1.5 pb-2 border-b border-black/[0.06]">
        <SkeletonBlock className="w-48 h-5 rounded-md" />
        <SkeletonBlock className="w-72 h-3.5 rounded" />
      </div>

      {/* Form Fields shimmer */}
      <div className="space-y-3.5 py-1">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <SkeletonBlock className="w-28 h-3 rounded" />
            <SkeletonBlock className="w-full h-10 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Action Buttons shimmer */}
      <div className="pt-3 border-t border-black/[0.06] flex items-center justify-end gap-3">
        <SkeletonBlock className="w-20 h-9 rounded-lg" />
        <SkeletonBlock className="w-32 h-9 rounded-lg" />
      </div>
    </div>
  );
};
