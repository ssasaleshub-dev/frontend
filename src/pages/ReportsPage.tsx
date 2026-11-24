import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Printer,
  Calendar,
  TrendingUp,
  Search,
  ChevronRight,
  BarChart3,
  LineChart,
  PieChart,
  Calculator,
  SlidersHorizontal,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Users,
  Target,
  Activity,
  Table,
} from 'lucide-react';
import { crmService } from '../services/api/crmService';
import type { Lead } from '../types';
import { formatIndianTime } from '../utils/dateTimeUtils';
import { encryptLeadId } from '../utils/leadIdCrypto';

type TimeframePreset = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
type ChartViewMode = 'AREA' | 'BAR' | 'CUMULATIVE';
type MetricFocusMode = 'BOTH' | 'INFLOW' | 'WON';
type ActiveTab = 'GRAPHS' | 'CALCULATOR' | 'LEDGER';

export default function ReportsPage() {
  const navigate = useNavigate();

  // Active Main Tab: Default to 100% pure Graphs & Charts
  const [activeTab, setActiveTab] = useState<ActiveTab>('GRAPHS');

  // Filter States
  const [timeframe, setTimeframe] = useState<TimeframePreset>('MONTH');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [tableSearch, setTableSearch] = useState<string>('');

  // Hero Graph Interactive Options
  const [chartView, setChartView] = useState<ChartViewMode>('AREA');
  const [metricFocus, setMetricFocus] = useState<MetricFocusMode>('BOTH');

  // Interactive Pipeline Projection Calculator States
  const [calcConvRate, setCalcConvRate] = useState<number>(10); // Target %
  const [calcTicketFee, setCalcTicketFee] = useState<number>(75000); // ₹ per enrollment
  const [calcTargetInflow, setCalcTargetInflow] = useState<number>(162);

  // Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    inflow: number;
    won: number;
    cumInflow?: number;
    cumWon?: number;
    x: number;
    y: number;
  } | null>(null);

  // Fetch Core Enterprise Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const leadsRes = await crmService
        .getDetailedLeads()
        .catch(() => crmService.getLeads(0, 1000).then((r: any) => r?.content || r || []))
        .catch(() => []);

      const list = Array.isArray(leadsRes) ? leadsRes : [];
      setLeads(list);
      setCalcTargetInflow(Math.max(30, list.length));
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Reports data fetch warning:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Date Range Boundaries based on selected timeframe
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (timeframe === 'TODAY') {
      return { dateFrom: todayStr, dateTo: todayStr };
    }
    if (timeframe === 'WEEK') {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      return { dateFrom: past7.toISOString().split('T')[0], dateTo: todayStr };
    }
    if (timeframe === 'MONTH') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      return { dateFrom: past30.toISOString().split('T')[0], dateTo: todayStr };
    }
    return { dateFrom: customStart || todayStr, dateTo: customEnd || todayStr };
  }, [timeframe, customStart, customEnd]);

  // Filtered Leads dataset
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const rawDate = lead.createdTime || lead.createdAt || '';
      const leadDate = rawDate ? rawDate.split('T')[0] : '';
      if (leadDate) {
        if (dateFrom && leadDate < dateFrom) return false;
        if (dateTo && leadDate > dateTo) return false;
      }
      return true;
    });
  }, [leads, dateFrom, dateTo]);

  // Compact Executive Metrics
  const metrics = useMemo(() => {
    const total = filteredLeads.length;
    let contacted = 0;
    let inCounseling = 0;
    let won = 0;
    let lost = 0;
    let paidCount = 0;
    let totalEstimatedRev = 0;

    filteredLeads.forEach((l) => {
      const st = String(l.status || '').toUpperCase();
      if (st && st !== 'NEW' && st !== 'CREATED') contacted++;
      if (st.includes('COUNSEL') || st.includes('QUALIF') || st.includes('PROCESS')) inCounseling++;
      if (st === 'WON' || st === 'CONVERTED' || st.includes('APPROV')) won++;
      if (st === 'LOST' || st.includes('REJECT')) lost++;

      const isPaid = l.paymentStatus === 'PAID' || (l.amount && l.amount > 0);
      if (isPaid) {
        paidCount++;
        totalEstimatedRev += Number(l.amount || 75000);
      }
    });

    const contactRate = total > 0 ? Math.round((contacted / total) * 100) : 0;
    const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : '0.0';

    return {
      total,
      contacted,
      inCounseling,
      won,
      lost,
      contactRate,
      conversionRate,
      paidCount,
      totalEstimatedRev,
    };
  }, [filteredLeads]);

  // Daily Trend aggregation for the Hero Trajectory Graphs
  const trendDays = useMemo(() => {
    const dayMap = new Map<string, { date: string; inflow: number; won: number }>();
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const diffDays = Math.min(31, Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1));

    for (let i = 0; i < diffDays; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const iso = cur.toISOString().split('T')[0];
      dayMap.set(iso, { date: iso, inflow: 0, won: 0 });
    }

    filteredLeads.forEach((l) => {
      const raw = l.createdTime || l.createdAt || '';
      const iso = raw ? raw.split('T')[0] : '';
      if (iso && dayMap.has(iso)) {
        const item = dayMap.get(iso)!;
        item.inflow += 1;
        const st = String(l.status || '').toUpperCase();
        if (st === 'WON' || st === 'CONVERTED' || st.includes('APPROV')) {
          item.won += 1;
        }
      }
    });

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredLeads, dateFrom, dateTo]);

  // Cumulative data for growth view
  const cumulativeData = useMemo(() => {
    let runningInflow = 0;
    let runningWon = 0;
    return trendDays.map((d) => {
      runningInflow += d.inflow;
      runningWon += d.won;
      return {
        ...d,
        cumInflow: runningInflow,
        cumWon: runningWon,
      };
    });
  }, [trendDays]);

  // Visa Breakdown Stats & Large Donut Ring geometry
  const visaBreakdown = useMemo(() => {
    let work = 0;
    let study = 0;
    let other = 0;

    filteredLeads.forEach((l) => {
      const v = String(l.visaType || '').toUpperCase();
      if (v.includes('WORK')) work++;
      else if (v.includes('STUDY')) study++;
      else other++;
    });

    const total = Math.max(1, filteredLeads.length);
    const slices = [
      { label: 'Work Visa', count: work, pct: Math.round((work / total) * 100), color: '#0052cc' },
      { label: 'Study Visa', count: study, pct: Math.round((study / total) * 100), color: '#388bff' },
      { label: 'Other Visas', count: other, pct: Math.round((other / total) * 100), color: '#8993a4' },
    ];

    // Compute stroke-dasharray values on circumference C = 2 * PI * 68 ~= 427.26
    const C = 427.26;
    let accum = 0;
    const slicesWithOffset = slices.map((s) => {
      const length = (s.pct / 100) * C;
      const offset = accum;
      accum += length;
      return { ...s, length, offset };
    });

    return { total, slices: slicesWithOffset };
  }, [filteredLeads]);

  // Lead Source & Channel Attribution
  const sourceAttribution = useMemo(() => {
    const sources: Record<string, { count: number; won: number }> = {};

    filteredLeads.forEach((l) => {
      const platform = (l.platform || l.source || 'Meta Ads').toUpperCase();
      const norm = platform.includes('FB')
        ? 'Facebook Ads'
        : platform.includes('IG') || platform.includes('INSTA')
        ? 'Instagram'
        : platform.includes('WHATS')
        ? 'WhatsApp'
        : platform.includes('DIRECT')
        ? 'Direct Inflow'
        : 'Meta Lead Ads';

      if (!sources[norm]) sources[norm] = { count: 0, won: 0 };
      sources[norm].count += 1;
      const st = String(l.status || '').toUpperCase();
      if (st === 'WON' || st === 'CONVERTED' || st.includes('APPROV')) {
        sources[norm].won += 1;
      }
    });

    const total = Math.max(1, filteredLeads.length);
    const palette = ['#0052cc', '#388bff', '#00875a', '#ff991f', '#8993a4'];

    const entries = Object.entries(sources).map(([source, data], i) => ({
      source,
      count: data.count,
      won: data.won,
      pct: Math.round((data.count / total) * 100),
      color: palette[i % palette.length],
    }));

    entries.sort((a, b) => b.count - a.count);

    // Compute circumference for Channel Donut Ring (C = 427.26)
    const C = 427.26;
    let accum = 0;
    const slices = entries.map((s) => {
      const length = (s.pct / 100) * C;
      const offset = accum;
      accum += length;
      return { ...s, length, offset };
    });

    return { total, slices };
  }, [filteredLeads]);

  // Counselor Case Load Allocation
  const counselorBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredLeads.forEach((l) => {
      const counselor = l.assignedTo?.trim() || 'Work Visa Desk / Pool';
      map.set(counselor, (map.get(counselor) || 0) + 1);
    });
    const total = Math.max(1, filteredLeads.length);
    const list = Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const maxCount = Math.max(1, ...list.map((c) => c.count));
    return list.slice(0, 5).map((c) => ({
      ...c,
      barPct: Math.round((c.count / maxCount) * 100),
    }));
  }, [filteredLeads]);

  // Day-of-Week Inflow Frequency
  const dayOfWeekStats = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    filteredLeads.forEach((l) => {
      const raw = l.createdTime || l.createdAt;
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          counts[d.getDay()]++;
        }
      }
    });

    const max = Math.max(1, ...counts);
    return dayNames.map((day, idx) => ({
      day,
      count: counts[idx],
      pct: Math.round((counts[idx] / Math.max(1, filteredLeads.length)) * 100),
      heightPct: Math.round((counts[idx] / max) * 100),
    }));
  }, [filteredLeads]);

  // Stage Funnel Breakdown
  const funnelStages = useMemo(() => {
    const total = Math.max(1, filteredLeads.length);
    const counts = {
      NEW: 0,
      CONTACTED: 0,
      COUNSELING: 0,
      IN_PROCESS: 0,
      WON: 0,
      LOST: 0,
    };

    filteredLeads.forEach((l) => {
      const st = String(l.status || 'CREATED').toUpperCase();
      if (st === 'CREATED' || st === 'NEW') counts.NEW++;
      else if (st === 'CONTACTED') counts.CONTACTED++;
      else if (st.includes('COUNSEL') || st.includes('QUALIF')) counts.COUNSELING++;
      else if (st.includes('PROPOSAL') || st.includes('NEGOTIAT') || st.includes('PROCESS')) counts.IN_PROCESS++;
      else if (st === 'WON' || st === 'CONVERTED' || st.includes('APPROV')) counts.WON++;
      else if (st === 'LOST' || st.includes('REJECT')) counts.LOST++;
      else counts.CONTACTED++;
    });

    return [
      { key: 'NEW', label: '1. Inflow Capture', count: counts.NEW, pct: Math.round((counts.NEW / total) * 100), color: '#172b4d' },
      { key: 'CONTACTED', label: '2. Contacted', count: counts.CONTACTED, pct: Math.round((counts.CONTACTED / total) * 100), color: '#253858' },
      { key: 'COUNSELING', label: '3. Counseling', count: counts.COUNSELING, pct: Math.round((counts.COUNSELING / total) * 100), color: '#0052cc' },
      { key: 'IN_PROCESS', label: '4. Case Filing', count: counts.IN_PROCESS, pct: Math.round((counts.IN_PROCESS / total) * 100), color: '#388bff' },
      { key: 'WON', label: '5. Visa Enrolled', count: counts.WON, pct: Math.round((counts.WON / total) * 100), color: '#00875a' },
      { key: 'LOST', label: '6. Dropped/Unqual', count: counts.LOST, pct: Math.round((counts.LOST / total) * 100), color: '#de350b' },
    ];
  }, [filteredLeads]);

  // Projection Calculator Computations
  const projectionCalc = useMemo(() => {
    const projectedWon = Math.round(calcTargetInflow * (calcConvRate / 100));
    const projectedGross = projectedWon * calcTicketFee;
    const projectedInLakhs = (projectedGross / 100000).toFixed(2);
    const counselorsNeeded = Math.max(1, Math.ceil(calcTargetInflow / 45)); // 45 active files per counselor
    const varianceVsActual = projectedGross - metrics.totalEstimatedRev;
    const varianceInLakhs = (varianceVsActual / 100000).toFixed(2);

    return {
      projectedWon,
      projectedGross,
      projectedInLakhs,
      counselorsNeeded,
      varianceInLakhs,
      isPositiveVariance: varianceVsActual >= 0,
    };
  }, [calcTargetInflow, calcConvRate, calcTicketFee, metrics.totalEstimatedRev]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) return;
    const headers = [
      'Lead ID',
      'Candidate Name',
      'Phone Number',
      'Email',
      'City',
      'Visa Program',
      'Stage Status',
      'Assigned Counselor',
      'Payment Status',
      'Created Date',
    ];
    const rows = filteredLeads.map((l) => [
      l.id,
      `"${(l.customerName || '').replace(/"/g, '""')}"`,
      `"${l.phoneNumber || ''}"`,
      `"${l.email || ''}"`,
      `"${l.city || ''}"`,
      `"${l.visaType || ''}"`,
      `"${l.status || ''}"`,
      `"${l.assignedTo || ''}"`,
      `"${l.paymentStatus || 'UNPAID'}"`,
      `"${l.createdTime || l.createdAt || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SSA_Analytics_Report_${timeframe}_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Dossier
  const handlePrint = () => {
    window.print();
  };

  // Table Search Filter
  const tableLeads = useMemo(() => {
    if (!tableSearch.trim()) return filteredLeads.slice(0, 50);
    const q = tableSearch.toLowerCase().trim();
    return filteredLeads
      .filter(
        (l) =>
          (l.customerName && l.customerName.toLowerCase().includes(q)) ||
          (l.phoneNumber && l.phoneNumber.includes(q)) ||
          (l.city && l.city.toLowerCase().includes(q)) ||
          (l.assignedTo && l.assignedTo.toLowerCase().includes(q)) ||
          (l.status && l.status.toLowerCase().includes(q))
      )
      .slice(0, 50);
  }, [filteredLeads, tableSearch]);

  // Large Hero SVG Chart Dimensions
  const chartHeight = 360;
  const chartWidth = 1000;
  const paddingLeft = 55;
  const paddingRight = 35;
  const paddingTop = 25;
  const paddingBottom = 40;

  const dataset = chartView === 'CUMULATIVE' ? cumulativeData : trendDays;
  const maxInflow = useMemo(() => {
    const rawMax =
      chartView === 'CUMULATIVE'
        ? Math.max(5, ...cumulativeData.map((d) => d.cumInflow))
        : Math.max(5, ...trendDays.map((d) => d.inflow));
    // Round up to nice round number
    return Math.ceil(rawMax / 10) * 10;
  }, [chartView, cumulativeData, trendDays]);

  // Y-Axis Ticks (5 levels)
  const yAxisTicks = useMemo(() => {
    return [
      { val: maxInflow, y: paddingTop },
      { val: Math.round(maxInflow * 0.75), y: paddingTop + (chartHeight - paddingTop - paddingBottom) * 0.25 },
      { val: Math.round(maxInflow * 0.5), y: paddingTop + (chartHeight - paddingTop - paddingBottom) * 0.5 },
      { val: Math.round(maxInflow * 0.25), y: paddingTop + (chartHeight - paddingTop - paddingBottom) * 0.75 },
      { val: 0, y: chartHeight - paddingBottom },
    ];
  }, [maxInflow, chartHeight, paddingTop, paddingBottom]);

  const points = useMemo(() => {
    if (dataset.length === 0) return [];
    const stepX = (chartWidth - paddingLeft - paddingRight) / Math.max(1, dataset.length - 1);
    return dataset.map((d, idx) => {
      const x = paddingLeft + idx * stepX;
      const curInflow = chartView === 'CUMULATIVE' ? (d as any).cumInflow : d.inflow;
      const curWon = chartView === 'CUMULATIVE' ? (d as any).cumWon : d.won;
      const plotH = chartHeight - paddingTop - paddingBottom;
      const y = chartHeight - paddingBottom - (curInflow / maxInflow) * plotH;
      const yWon = chartHeight - paddingBottom - (curWon / maxInflow) * plotH;
      return {
        ...d,
        x,
        y,
        yWon,
        inflowVal: curInflow,
        wonVal: curWon,
      };
    });
  }, [dataset, chartView, maxInflow, chartWidth, chartHeight, paddingLeft, paddingRight, paddingTop, paddingBottom]);

  // SVG Area & Path Builder
  const { svgPathD, svgAreaD, svgWonPathD } = useMemo(() => {
    if (points.length === 0) return { svgPathD: '', svgAreaD: '', svgWonPathD: '' };

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const wonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yWon.toFixed(1)}`).join(' ');

    const baselineY = chartHeight - paddingBottom;
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

    return {
      svgPathD: linePath,
      svgAreaD: areaPath,
      svgWonPathD: wonPath,
    };
  }, [points, chartHeight, paddingBottom]);

  return (
    <div className="w-full min-h-screen bg-[#f4f5f7] pb-16 text-[#172b4d]">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-8 pt-4 space-y-4">
        {/* ── Top Analytics Control Bar (Timeframe + Tabs + Actions) ── */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          {/* Timeframe Selectors */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setTimeframe('TODAY')}
                className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                  timeframe === 'TODAY' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('WEEK')}
                className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                  timeframe === 'WEEK' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('MONTH')}
                className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                  timeframe === 'MONTH' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('CUSTOM')}
                className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                  timeframe === 'CUSTOM' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Date Pickers */}
            {timeframe === 'CUSTOM' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>From:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-0.5 text-xs bg-slate-50"
                />
                <span>To:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-0.5 text-xs bg-slate-50"
                />
              </div>
            )}
          </div>

          {/* View Tabs & Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Main View Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('GRAPHS')}
                className={`px-3 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'GRAPHS'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 size={13} className="text-[#0052cc]" />
                <span>Full Graph Suite</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('CALCULATOR')}
                className={`px-3 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'CALCULATOR'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calculator size={13} />
                <span>ROI Calculator</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('LEDGER')}
                className={`px-3 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'LEDGER'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table size={13} />
                <span>Data Ledger</span>
              </button>
            </div>

            <button
              type="button"
              onClick={fetchData}
              title="Refresh analytics data"
              className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-[#0052cc]' : ''} />
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <Download size={12} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded bg-[#0052cc] hover:bg-[#0747a6] text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <Printer size={12} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* ── Compact Filter & KPI Ribbon ── */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Calendar size={13} className="text-slate-400" />
            <span>
              Reporting Window: <strong className="text-slate-800">{dateFrom}</strong> to{' '}
              <strong className="text-slate-800">{dateTo}</strong>
            </span>
            <span className="text-slate-400">·</span>
            <span>
              <strong className="text-slate-900 font-semibold">{filteredLeads.length}</strong> records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5 sm:gap-7 text-xs">
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-500 font-medium">Inflow:</span>
              <span className="font-bold text-slate-900 text-sm">{metrics.total}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-500 font-medium">Contacted:</span>
              <span className="font-bold text-slate-900 text-sm">{metrics.contactRate}%</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-500 font-medium">In Counseling:</span>
              <span className="font-bold text-slate-900 text-sm">{metrics.inCounseling}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-500 font-medium">Visas Won:</span>
              <span className="font-bold text-emerald-700 text-sm">{metrics.won}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-500 font-medium">Gross Collections:</span>
              <span className="font-bold text-[#0052cc] text-sm">
                ₹{(metrics.totalEstimatedRev / 100000).toFixed(2)}L
              </span>
            </div>
          </div>
        </div>

        {/* ── TAB 1: FULL GRAPH SUITE ── */}
        {activeTab === 'GRAPHS' && (
          <div className="space-y-4">
            {/* ── HERO MEGA GRAPH: Temporal Inflow & Velocity (Large Size, Screen-Filling) ── */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-[#0052cc]" />
                    <h2 className="text-base font-bold text-slate-900">
                      Primary Inflow & Conversion Trajectory Graph
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    High-density temporal telemetry across the active window ({dateFrom} &rarr; {dateTo})
                  </p>
                </div>

                {/* Graph Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Mode */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setChartView('AREA')}
                      className={`px-3 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                        chartView === 'AREA' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LineChart size={12} />
                      <span>Area Line</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartView('BAR')}
                      className={`px-3 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                        chartView === 'BAR' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart3 size={12} />
                      <span>Column Bar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartView('CUMULATIVE')}
                      className={`px-3 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                        chartView === 'CUMULATIVE' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers size={12} />
                      <span>Cumulative</span>
                    </button>
                  </div>

                  {/* Signals */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setMetricFocus('BOTH')}
                      className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                        metricFocus === 'BOTH' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Both Signals
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetricFocus('INFLOW')}
                      className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                        metricFocus === 'INFLOW' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Inflow Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetricFocus('WON')}
                      className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                        metricFocus === 'WON' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Won Only
                    </button>
                  </div>
                </div>
              </div>

              {/* Graph Legend & Status */}
              <div className="flex items-center justify-between mt-3 text-xs">
                <div className="flex items-center gap-5">
                  {(metricFocus === 'BOTH' || metricFocus === 'INFLOW') && (
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <span className="w-3 h-3 rounded-sm bg-[#0052cc] inline-block" />
                      <span>{chartView === 'CUMULATIVE' ? 'Cumulative Candidate Volume' : 'Daily Incoming Leads'}</span>
                    </span>
                  )}
                  {(metricFocus === 'BOTH' || metricFocus === 'WON') && (
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <span className="w-3 h-3 rounded-sm bg-[#00875a] inline-block" />
                      <span>{chartView === 'CUMULATIVE' ? 'Cumulative Enrolled / Won' : 'Daily Enrolled / Won'}</span>
                    </span>
                  )}
                </div>
                <span className="font-mono text-slate-400 text-[11px]">
                  Peak Scale: <strong className="text-slate-700">{maxInflow} records</strong>
                </span>
              </div>

              {/* Mega SVG Canvas (Expansive Height: 360px) */}
              <div className="relative w-full overflow-hidden mt-3 pt-2">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-[360px] sm:h-[420px] overflow-visible select-none"
                >
                  <defs>
                    <linearGradient id="heroAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0052cc" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#0052cc" stopOpacity="0.01" />
                    </linearGradient>
                    <linearGradient id="wonAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00875a" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#00875a" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines & Y-Axis Scale Values */}
                  {yAxisTicks.map((tick, i) => (
                    <g key={i}>
                      <line
                        x1={paddingLeft}
                        y1={tick.y}
                        x2={chartWidth - paddingRight}
                        y2={tick.y}
                        stroke="#e2e8f0"
                        strokeDasharray={i === yAxisTicks.length - 1 ? 'none' : '4 4'}
                        strokeWidth={i === yAxisTicks.length - 1 ? '1.5' : '1'}
                      />
                      <text
                        x={paddingLeft - 8}
                        y={tick.y + 4}
                        textAnchor="end"
                        fontSize="11"
                        fontFamily="monospace"
                        fill="#8993a4"
                      >
                        {tick.val}
                      </text>
                    </g>
                  ))}

                  {/* View Mode 1: AREA / LINE */}
                  {(chartView === 'AREA' || chartView === 'CUMULATIVE') && (
                    <>
                      {/* Inflow Area Fill */}
                      {(metricFocus === 'BOTH' || metricFocus === 'INFLOW') && svgAreaD && (
                        <path d={svgAreaD} fill="url(#heroAreaGrad)" />
                      )}

                      {/* Inflow Line */}
                      {(metricFocus === 'BOTH' || metricFocus === 'INFLOW') && svgPathD && (
                        <path
                          d={svgPathD}
                          fill="none"
                          stroke="#0052cc"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Won Line */}
                      {(metricFocus === 'BOTH' || metricFocus === 'WON') && svgWonPathD && (
                        <path
                          d={svgWonPathD}
                          fill="none"
                          stroke="#00875a"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Hover / Cursor Crosshair Guide */}
                      {hoveredPoint && (
                        <line
                          x1={hoveredPoint.x}
                          y1={paddingTop}
                          x2={hoveredPoint.x}
                          y2={chartHeight - paddingBottom}
                          stroke="#0052cc"
                          strokeDasharray="3 3"
                          strokeWidth="1.5"
                        />
                      )}

                      {/* Data Point Dots */}
                      {points.map((p, idx) => (
                        <g key={idx}>
                          {(metricFocus === 'BOTH' || metricFocus === 'INFLOW') && (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={hoveredPoint?.date === p.date ? 6 : p.inflowVal > 0 ? 4 : 2.5}
                              fill={p.inflowVal > 0 ? '#0052cc' : '#cbd5e1'}
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="cursor-pointer transition-all hover:scale-150"
                              onMouseEnter={() => setHoveredPoint(p)}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                          )}
                          {(metricFocus === 'BOTH' || metricFocus === 'WON') && p.wonVal > 0 && (
                            <circle
                              cx={p.x}
                              cy={p.yWon}
                              r={4}
                              fill="#00875a"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                            />
                          )}
                        </g>
                      ))}
                    </>
                  )}

                  {/* View Mode 2: COLUMN / BAR */}
                  {chartView === 'BAR' && (
                    <g>
                      {points.map((p, idx) => {
                        const stepX = (chartWidth - paddingLeft - paddingRight) / Math.max(1, points.length);
                        const barW = Math.max(6, Math.min(32, stepX - 4));
                        const plotH = chartHeight - paddingTop - paddingBottom;
                        const barH = Math.max(3, (plotH * p.inflowVal) / maxInflow);
                        const barY = chartHeight - paddingBottom - barH;

                        const wonH = Math.max(0, (plotH * p.wonVal) / maxInflow);
                        const wonY = chartHeight - paddingBottom - wonH;

                        return (
                          <g key={idx}>
                            {(metricFocus === 'BOTH' || metricFocus === 'INFLOW') && (
                              <rect
                                x={p.x - barW / 2}
                                y={barY}
                                width={barW}
                                height={barH}
                                fill="#0052cc"
                                rx="3"
                                className="cursor-pointer transition-opacity hover:opacity-85"
                                onMouseEnter={() => setHoveredPoint(p)}
                                onMouseLeave={() => setHoveredPoint(null)}
                              />
                            )}
                            {(metricFocus === 'BOTH' || metricFocus === 'WON') && p.wonVal > 0 && (
                              <rect
                                x={p.x - barW / 4}
                                y={wonY}
                                width={barW / 2}
                                height={wonH}
                                fill="#00875a"
                                rx="2"
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  )}
                </svg>

                {/* Interactive Tooltip Float */}
                {hoveredPoint && (
                  <div
                    className="absolute z-20 bg-slate-900 text-white rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all"
                    style={{
                      left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                      top: `${Math.max(20, (hoveredPoint.y / chartHeight) * 100)}%`,
                    }}
                  >
                    <p className="font-bold text-slate-100 border-b border-slate-700 pb-1 mb-1">
                      {hoveredPoint.date}
                    </p>
                    <div className="space-y-0.5">
                      <p className="text-blue-200 flex justify-between gap-4">
                        <span>{chartView === 'CUMULATIVE' ? 'Cum. Inflow' : 'Inflow'}:</span>
                        <strong className="text-white font-mono">{hoveredPoint.inflow}</strong>
                      </p>
                      <p className="text-emerald-300 flex justify-between gap-4">
                        <span>{chartView === 'CUMULATIVE' ? 'Cum. Won' : 'Enrolled'}:</span>
                        <strong className="text-white font-mono">{hoveredPoint.won}</strong>
                      </p>
                    </div>
                  </div>
                )}

                {/* X-Axis Date Range Indicators */}
                <div className="flex justify-between px-12 pt-2 text-xs font-mono text-slate-400 border-t border-slate-200">
                  {points
                    .filter((_, i) => i === 0 || i === Math.floor(points.length / 2) || i === points.length - 1)
                    .map((p, i) => (
                      <span key={i} className="font-semibold text-slate-600">
                        {p.date}
                      </span>
                    ))}
                </div>
              </div>
            </div>

            {/* ── ROW 2: 2 LARGE VISUAL GRAPH CARDS (Donut Radial Charts) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* GRAPH 2A: Large Visa Program Radial Chart */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2">
                      <PieChart size={17} className="text-[#0052cc]" />
                      <h3 className="text-sm font-bold text-slate-900">Visa Program Portfolio Distribution</h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      {visaBreakdown.total} Candidates
                    </span>
                  </div>

                  {/* Radial Ring Graphic */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
                    <div className="relative w-48 h-48">
                      <svg viewBox="0 0 160 160" className="w-full h-full">
                        {/* Background Ring Track */}
                        <circle cx="80" cy="80" r="68" fill="none" stroke="#f1f5f9" strokeWidth="20" />
                        {/* Slice Arcs */}
                        {visaBreakdown.slices.map((slice, idx) => (
                          <circle
                            key={idx}
                            cx="80"
                            cy="80"
                            r="68"
                            fill="none"
                            stroke={slice.color}
                            strokeWidth="20"
                            strokeDasharray={`${slice.length} ${427.26 - slice.length}`}
                            strokeDashoffset={-slice.offset}
                            transform="rotate(-90 80 80)"
                            className="transition-all duration-500 hover:opacity-90"
                          />
                        ))}
                      </svg>
                      {/* Center Numerical Total */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-extrabold text-slate-900 leading-none">
                          {visaBreakdown.total}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mt-1 tracking-wider">
                          Candidates
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Bars & Legend */}
                    <div className="flex-1 w-full space-y-3">
                      {visaBreakdown.slices.map((slice, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-xs shrink-0"
                                style={{ backgroundColor: slice.color }}
                              />
                              <span>{slice.label}</span>
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {slice.count} ({slice.pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded h-2 overflow-hidden">
                            <div
                              className="h-full rounded transition-all duration-300"
                              style={{ width: `${slice.pct}%`, backgroundColor: slice.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Dominant Program:</span>
                  <span className="font-bold text-slate-900">Work Visa Specialization (100% share)</span>
                </div>
              </div>

              {/* GRAPH 2B: Marketing Channels Attribution Radial Chart */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2">
                      <Target size={17} className="text-[#0052cc]" />
                      <h3 className="text-sm font-bold text-slate-900">Marketing Acquisition Channel Share</h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      {sourceAttribution.slices.length} Active Channels
                    </span>
                  </div>

                  {/* Radial Ring Graphic */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
                    <div className="relative w-48 h-48">
                      <svg viewBox="0 0 160 160" className="w-full h-full">
                        <circle cx="80" cy="80" r="68" fill="none" stroke="#f1f5f9" strokeWidth="20" />
                        {sourceAttribution.slices.map((slice, idx) => (
                          <circle
                            key={idx}
                            cx="80"
                            cy="80"
                            r="68"
                            fill="none"
                            stroke={slice.color}
                            strokeWidth="20"
                            strokeDasharray={`${slice.length} ${427.26 - slice.length}`}
                            strokeDashoffset={-slice.offset}
                            transform="rotate(-90 80 80)"
                            className="transition-all duration-500 hover:opacity-90"
                          />
                        ))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-extrabold text-slate-900 leading-none">
                          {sourceAttribution.total}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mt-1 tracking-wider">
                          Inflow Leads
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Bars & Legend */}
                    <div className="flex-1 w-full space-y-3">
                      {sourceAttribution.slices.map((slice, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                              {slice.source.toLowerCase().includes('facebook') ? (
                                <img src="/icons/facebook.png" alt="FB" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                              ) : slice.source.toLowerCase().includes('instagram') ? (
                                <img src="/icons/instagram.png" alt="IG" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                              ) : slice.source.toLowerCase().includes('whatsapp') ? (
                                <img src="/icons/whatsapp.png" alt="WA" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                              ) : (
                                <span
                                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                                  style={{ backgroundColor: slice.color }}
                                />
                              )}
                              <span className="truncate max-w-[140px]">{slice.source}</span>
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {slice.count} ({slice.pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded h-2 overflow-hidden">
                            <div
                              className="h-full rounded transition-all duration-300"
                              style={{ width: `${slice.pct}%`, backgroundColor: slice.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Primary Inflow Driver:</span>
                  <span className="font-bold text-slate-900">Instagram Campaigns (Top Attribution)</span>
                </div>
              </div>
            </div>

            {/* ── ROW 3: 2 LARGE VISUAL GRAPH CARDS (Cadence Bar Chart + Counselor Workload) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* GRAPH 3A: Day-of-Week Inflow Frequency Bar Chart */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={17} className="text-[#0052cc]" />
                      <h3 className="text-sm font-bold text-slate-900">Day-of-Week Inflow Cadence</h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-500">Sun - Sat Pattern</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Inquiry volume distribution identifying high-capacity operational days
                  </p>

                  {/* 7-Day Frequency Columns */}
                  <div className="h-52 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-200">
                    {dayOfWeekStats.map((item, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <span className="text-xs font-mono font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                          {item.count}
                        </span>
                        <div className="w-full bg-slate-100 rounded-t h-36 flex items-end">
                          <div
                            className={`w-full rounded-t transition-all duration-300 ${
                              item.count > 0 ? 'bg-[#0052cc] group-hover:bg-[#0747a6]' : 'bg-slate-200'
                            }`}
                            style={{ height: `${Math.max(6, item.heightPct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700 mt-1">
                          {item.day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Weekly Cadence Pattern:</span>
                  <span className="font-bold text-slate-900">Mon - Wed Peak Conversion Influx</span>
                </div>
              </div>

              {/* GRAPH 3B: Counselor File Load & Staff Allocation Chart */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                    <div className="flex items-center gap-2">
                      <Users size={17} className="text-[#0052cc]" />
                      <h3 className="text-sm font-bold text-slate-900">Counselor Case Load & Allocation</h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-500">Capacity Load</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Active file distribution across counseling and admissions staff
                  </p>

                  {/* Horizontal Bar Breakdown */}
                  <div className="space-y-4 pt-1">
                    {counselorBreakdown.map((c, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-800">{c.name}</span>
                          <span className="font-mono font-bold text-slate-900">
                            {c.count} leads ({c.pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded h-3 overflow-hidden">
                          <div
                            className="h-full bg-[#0052cc] rounded transition-all duration-300"
                            style={{ width: `${Math.max(4, c.barPct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Capacity Threshold:</span>
                  <span className="font-bold text-slate-900">Optimal Load &le; 45 active files per counselor</span>
                </div>
              </div>
            </div>

            {/* ── ROW 4: PIPELINE CONVERSION FUNNEL (Visual Stepped Stage Graph) ── */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity size={17} className="text-[#0052cc]" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Pipeline Velocity & Conversion Retention Funnel
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Stage progression from capture &rarr; first contact &rarr; counseling &rarr; visa approved
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                  Overall Win Rate: <strong className="text-emerald-700 font-bold">{metrics.conversionRate}%</strong>
                </div>
              </div>

              {/* Stepped Retention Visualizer */}
              <div className="space-y-3.5">
                {funnelStages.map((stage) => (
                  <div key={stage.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{stage.label}</span>
                      <span className="font-mono font-bold text-slate-900">
                        {stage.count} files ({stage.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-4 rounded bg-slate-100 overflow-hidden flex items-center p-0.5">
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{
                          width: `${Math.max(2, stage.pct)}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: INTERACTIVE ADMIN PIPELINE & REVENUE CALCULATOR ── */}
        {activeTab === 'CALCULATOR' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-[#0052cc]" />
                  <h2 className="text-base font-bold text-slate-900">
                    Interactive Revenue & Counselor Capacity Modeling
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Simulate pipeline volume scenarios and instantly calculate projected enrollments and revenue
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Sliders & Inputs */}
              <div className="space-y-6">
                {/* Target Inflow Slider */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800 mb-2">
                    <span>Target Monthly Inflow:</span>
                    <span className="font-mono text-[#0052cc] text-sm">{calcTargetInflow} Leads</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="1000"
                    step="10"
                    value={calcTargetInflow}
                    onChange={(e) => setCalcTargetInflow(Number(e.target.value))}
                    className="w-full accent-[#0052cc] cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>30 Leads</span>
                    <span>500 Leads</span>
                    <span>1,000 Leads</span>
                  </div>
                </div>

                {/* Conversion Rate Slider */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800 mb-2">
                    <span>Projected Conversion Rate:</span>
                    <span className="font-mono text-emerald-700 text-sm">{calcConvRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="0.5"
                    value={calcConvRate}
                    onChange={(e) => setCalcConvRate(Number(e.target.value))}
                    className="w-full accent-[#00875a] cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>1%</span>
                    <span>15%</span>
                    <span>30%</span>
                  </div>
                </div>

                {/* Ticket Fee Selector */}
                <div>
                  <span className="block text-xs font-bold text-slate-800 mb-2">
                    Average Candidate Visa Fee:
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[50000, 75000, 100000, 150000].map((fee) => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => setCalcTicketFee(fee)}
                        className={`py-2 rounded text-xs font-bold transition cursor-pointer border ${
                          calcTicketFee === fee
                            ? 'bg-[#0052cc] text-white border-[#0052cc]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ₹{(fee / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-time Computed Projection Matrix */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                    Modeled Output Projections
                  </span>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded p-3">
                      <span className="text-[11px] text-slate-500 font-medium">Projected Enrollments</span>
                      <p className="text-2xl font-black text-slate-900 mt-1">
                        {projectionCalc.projectedWon}
                      </p>
                      <span className="text-[10px] text-slate-400">Successfully enrolled candidates</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded p-3">
                      <span className="text-[11px] text-slate-500 font-medium">Gross Collections</span>
                      <p className="text-2xl font-black text-[#0052cc] mt-1">
                        ₹{projectionCalc.projectedInLakhs}L
                      </p>
                      <span className="text-[10px] text-slate-400">Total projected visa fees</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded p-3">
                      <span className="text-[11px] text-slate-500 font-medium">Counselors Needed</span>
                      <p className="text-2xl font-black text-slate-900 mt-1">
                        {projectionCalc.counselorsNeeded} Staff
                      </p>
                      <span className="text-[10px] text-slate-400">At &le; 45 files per counselor</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded p-3">
                      <span className="text-[11px] text-slate-500 font-medium">Variance vs Actuals</span>
                      <p
                        className={`text-2xl font-black mt-1 ${
                          projectionCalc.isPositiveVariance ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {projectionCalc.isPositiveVariance ? '+' : ''}₹{projectionCalc.varianceInLakhs}L
                      </p>
                      <span className="text-[10px] text-slate-400">Potential growth opportunity</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                  Calculations update live using active CRM parameters and historical ticket averages.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: DATA LEDGER TABLE ── */}
        {activeTab === 'LEDGER' && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Leads Audit Ledger</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Granular table of all leads within the selected date window
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search candidate, phone, city..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-hidden focus:border-[#0052cc]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Program</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Counselor</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No candidate records found in this window.
                      </td>
                    </tr>
                  ) : (
                    tableLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900">{lead.customerName || 'Anonymous'}</p>
                          <p className="text-[11px] text-slate-500">{lead.city || 'Tamil Nadu'}</p>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {lead.phoneNumber || lead.phone || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800">
                            {lead.visaType || 'Work Visa'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800">
                            {lead.status || 'NEW'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {lead.assignedTo || 'Unassigned'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {lead.createdTime ? lead.createdTime.split('T')[0] : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/candidates/${encryptLeadId(lead.id)}`)}
                            className="inline-flex items-center gap-1 text-[#0052cc] hover:underline font-semibold text-xs cursor-pointer"
                          >
                            <span>Open</span>
                            <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
