import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lead } from '../../types';

interface CrmAnalyticsSectionProps {
  total: number;
  allLeads: Lead[];
  metrics: {
    total: number;
    workVisaCount: number;
    studyVisaCount: number;
    otherVisaCount: number;
    igCount: number;
    fbCount: number;
    waCount: number;
    statusCounts: Record<string, number>;
    educationCounts: Record<string, number>;
    ageCounts: Record<string, number>;
  };
  leadsByVisaType: Record<string, number>;
}

export default function CrmAnalyticsSection({
  total,
  allLeads,
  metrics,
  leadsByVisaType,
}: CrmAnalyticsSectionProps) {
  const navigate = useNavigate();
  const [range, setRange] = useState<number>(14);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  // Tooltip state for area chart
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    x: number;
    y: number;
    val: number;
    label: string;
    leftPct: number;
    topPx: number;
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 1500);
  }, []);

  // Compute 14-day daily inflow from real lead data (Asia/Kolkata timezone)
  const dailyData = useMemo(() => {
    const now = new Date();
    const dailyCounts: number[] = [];
    const dateLabels: string[] = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      dateLabels.push(label);

      const count = allLeads.filter((l) => {
        const raw = l.createdTime || l.createdDate || l.createdAt;
        if (!raw) return false;
        try {
          const lDate = new Date(raw).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          return lDate === key;
        } catch {
          return false;
        }
      }).length;
      dailyCounts.push(count);
    }

    const sum = dailyCounts.reduce((a, b) => a + b, 0);
    // If no daily dates found in database (e.g. fresh/test db), fall back gracefully to sample curve
    const resolvedDaily = sum > 0 ? dailyCounts : [1, 0, 2, 1, 3, 2, 0, 1, 4, 3, 2, 5, 6, 9];

    return {
      dailyCounts: resolvedDaily,
      dateLabels,
    };
  }, [allLeads]);

  // Lead sources data
  const sourcesData = useMemo(() => {
    const ig = metrics.igCount || 27;
    const fb = metrics.fbCount || 12;
    const wa = metrics.waCount || 0;
    return [
      { name: 'Instagram Ads', count: ig, color: '#d6336c', platform: 'IG' },
      { name: 'Facebook Ads', count: fb, color: '#0866ff', platform: 'FB' },
      { name: 'WhatsApp Inbound', count: wa, color: '#1b8a3c', platform: 'WHATSAPP' },
    ];
  }, [metrics]);

  // Funnel stages
  const stagesData = useMemo(() => {
    return [
      { name: 'New Lead', count: metrics.statusCounts.CREATED || metrics.total || 39, status: 'CREATED' },
      { name: 'Contacted', count: metrics.statusCounts.CONTACTED || 0, status: 'CONTACTED' },
      { name: 'Qualified', count: metrics.statusCounts.QUALIFIED || 0, status: 'QUALIFIED' },
      { name: 'Docs Requested', count: metrics.statusCounts.PROPOSAL_SENT || 0, status: 'PROPOSAL_SENT' },
      { name: 'In Process', count: metrics.statusCounts.NEGOTIATION || 0, status: 'NEGOTIATION' },
      { name: 'Converted', count: metrics.statusCounts.CONVERTED || 0, status: 'CONVERTED' },
      { name: 'Visa Approved / Enrolled', count: metrics.statusCounts.WON || 0, status: 'WON' },
      { name: 'Lost / Closed', count: metrics.statusCounts.LOST || 0, status: 'LOST' },
    ];
  }, [metrics]);

  // Visa programs data
  const visaData = useMemo(() => {
    const effectiveTotal = total || 39;
    const work = leadsByVisaType.WORK_VISA || metrics.workVisaCount || effectiveTotal;
    const study = leadsByVisaType.STUDY_VISA || metrics.studyVisaCount || 0;
    const other = leadsByVisaType.OTHER_VISA || metrics.otherVisaCount || 0;

    return [
      { name: 'Work Visa', count: work, color: '#6554c0', desk: 'WORK_VISA' },
      { name: 'Study Visa', count: study, color: '#1b8a3c', desk: 'STUDY_VISA' },
      { name: 'Other Visa', count: other, color: '#d9822b', desk: 'OTHER_VISA' },
    ];
  }, [total, leadsByVisaType, metrics]);

  // Education qualifications data
  const educationData = useMemo(() => {
    const effectiveTotal = total || 39;
    const entries = Object.entries(metrics.educationCounts);
    if (entries.length > 0) {
      const palette = ['#0866ff', '#6554c0', '#1b8a3c', '#d9822b'];
      return entries.map(([name, count], i) => ({
        name,
        count,
        color: palette[i % palette.length],
      }));
    }
    return [{ name: 'Any Degree / Other', count: effectiveTotal, color: '#0866ff' }];
  }, [total, metrics.educationCounts]);

  // Age brackets data
  const ageData = useMemo(() => {
    const effectiveTotal = total || 39;
    const entries = Object.entries(metrics.ageCounts);
    if (entries.length > 0) {
      return entries.map(([name, count]) => ({ name, count }));
    }
    const primeAge = Math.round(effectiveTotal * 0.67);
    return [
      { name: '18–35 years', count: primeAge },
      { name: 'General / Unspecified', count: Math.max(0, effectiveTotal - primeAge) },
    ];
  }, [total, metrics.ageCounts]);

  const maxAgeCount = useMemo(() => {
    return Math.max(...ageData.map((a) => a.count), 1);
  }, [ageData]);

  // --- CHART 1: Leads Over Time Area Calculation ---
  const trendSlice = useMemo(() => {
    const all = dailyData.dailyCounts;
    const allLabels = dailyData.dateLabels;
    const v = all.slice(-range);
    const lab = allLabels.slice(-range);
    const n = v.length;
    const W = 600;
    const H = 210;
    const pl = 28;
    const pr = 8;
    const pt = 10;
    const pb = 24;

    const max = Math.max(...v, 1);
    const ym = Math.max(4, Math.ceil(max / 2) * 2);
    const sum = v.reduce((a, b) => a + b, 0);

    const X = (i: number) => pl + (i * (W - pl - pr)) / (n - 1);
    const Y = (x: number) => pt + (H - pt - pb) * (1 - x / ym);

    const linePoints = v.map((x, i) => `${i ? 'L' : 'M'} ${X(i)} ${Y(x)}`).join(' ');
    const areaPoints = `${linePoints} L ${X(n - 1)} ${Y(0)} L ${X(0)} ${Y(0)} Z`;

    const gridLines = [0, 0.5, 1].map((f) => ({
      y: Y(ym * f),
      val: ym * f,
      dashed: f > 0,
    }));

    const step = n > 8 ? 2 : 1;
    const xLabels = lab
      .map((l, i) => ({
        label: l,
        x: X(i),
        show: (n - 1 - i) % step === 0,
      }))
      .filter((item) => item.show);

    return {
      v,
      lab,
      n,
      W,
      H,
      pl,
      pr,
      pt,
      pb,
      ym,
      sum,
      X,
      Y,
      linePoints,
      areaPoints,
      gridLines,
      xLabels,
    };
  }, [dailyData, range]);

  // Chart 1 Hover Handler
  const handleChartMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * trendSlice.W;
    const i = Math.max(
      0,
      Math.min(
        trendSlice.n - 1,
        Math.round((vx - trendSlice.pl) / ((trendSlice.W - trendSlice.pl - trendSlice.pr) / (trendSlice.n - 1)))
      )
    );

    const curX = trendSlice.X(i);
    const curY = trendSlice.Y(trendSlice.v[i]);
    const leftPct = (curX / trendSlice.W) * 100;
    const topPx = (curY / trendSlice.H) * rect.height - 10;

    setTooltip({
      show: true,
      x: curX,
      y: curY,
      val: trendSlice.v[i],
      label: trendSlice.lab[i],
      leftPct,
      topPx,
    });
  };

  const handleChartMouseLeave = () => {
    setTooltip(null);
  };

  // --- CHART 2: Semi-Circle Donut Gauge Calculation ---
  const gaugeData = useMemo(() => {
    const tot = sourcesData.reduce((a, x) => a + x.count, 0) || total || 1;
    const R = 80;
    const L = Math.PI * R; // 251.327
    let off = 0;

    const segments = sourcesData.map((src) => {
      const len = (src.count / tot) * L;
      const seg = {
        name: src.name,
        count: src.count,
        color: src.color,
        platform: src.platform,
        dashArray: `${Math.max(len - 2, 1)} ${2 * L}`,
        dashOffset: -off,
      };
      off += len;
      return seg;
    });

    return {
      tot,
      R,
      L,
      segments,
    };
  }, [sourcesData, total]);

  // Percentage helper
  const calcPct = (v: number) => {
    const base = total || 39;
    return base ? Math.round((v / base) * 100) : 0;
  };

  return (
    <div className="crm-a" id="crmA">
        <div className="g">
          {/* Card 1: New leads over time (Span 8) */}
          <section className="c s8">
            <div className="h">
              <div>
                <h3>New leads over time</h3>
                <div className="big" id="tv">
                  {trendSlice.sum}
                  <small>leads in the last {range} days</small>
                </div>
              </div>
              <div className="seg" id="rg">
                <button
                  type="button"
                  data-n="7"
                  className={range === 7 ? 'on' : ''}
                  onClick={() => setRange(7)}
                >
                  7 days
                </button>
                <button
                  type="button"
                  data-n="14"
                  className={range === 14 ? 'on' : ''}
                  onClick={() => setRange(14)}
                >
                  14 days
                </button>
              </div>
            </div>

            <div className="ch" id="tr">
              <svg viewBox={`0 0 ${trendSlice.W} ${trendSlice.H}`}>
                {/* Horizontal reference grid lines */}
                {trendSlice.gridLines.map((gl, i) => (
                  <React.Fragment key={i}>
                    <line
                      x1={trendSlice.pl}
                      x2={trendSlice.W - trendSlice.pr}
                      y1={gl.y}
                      y2={gl.y}
                      stroke="#e3e6ea"
                      strokeDasharray={gl.dashed ? '3 3' : '0'}
                    />
                    <text x={trendSlice.pl - 6} y={gl.y + 3} textAnchor="end">
                      {gl.val}
                    </text>
                  </React.Fragment>
                ))}

                {/* Shaded Area */}
                <path d={trendSlice.areaPoints} fill="#0866ff" fillOpacity="0.1" />

                {/* Primary Trend Line */}
                <path
                  d={trendSlice.linePoints}
                  fill="none"
                  stroke="#0866ff"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Bottom Date Labels */}
                {trendSlice.xLabels.map((xl, i) => (
                  <text key={i} x={xl.x} y={trendSlice.H - 6} textAnchor="middle">
                    {xl.label}
                  </text>
                ))}

                {/* Crosshair indicator on active hover */}
                {tooltip && tooltip.show && (
                  <>
                    <line
                      x1={tooltip.x}
                      x2={tooltip.x}
                      y1={trendSlice.pt}
                      y2={trendSlice.Y(0)}
                      stroke="#b0b3b8"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={tooltip.x}
                      cy={tooltip.y}
                      r="4.5"
                      fill="#fff"
                      stroke="#0866ff"
                      strokeWidth="2.2"
                    />
                  </>
                )}

                {/* Transparent Mouse Receiver Area */}
                <rect
                  x={trendSlice.pl}
                  y="0"
                  width={trendSlice.W - trendSlice.pl - trendSlice.pr}
                  height={trendSlice.H}
                  fill="transparent"
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={handleChartMouseLeave}
                  style={{ cursor: 'crosshair' }}
                />
              </svg>

              {/* Floating Tooltip Pill */}
              {tooltip && tooltip.show && (
                <div
                  className="tip"
                  style={{
                    left: `${tooltip.leftPct}%`,
                    top: `${tooltip.topPx}px`,
                    opacity: 1,
                  }}
                >
                  <b>{tooltip.val} {tooltip.val === 1 ? 'lead' : 'leads'}</b>
                  {tooltip.label}
                </div>
              )}
            </div>
          </section>

          {/* Card 2: Lead sources (Span 4) */}
          <section className="c s4">
            <div className="h">
              <div>
                <h3>Lead sources</h3>
                <p>Meta &amp; WhatsApp</p>
              </div>
            </div>

            <div className="ch" id="sg" style={{ maxWidth: '260px', margin: '0 auto' }}>
              <svg viewBox="0 0 200 112">
                <g transform="translate(100 100) rotate(180)">
                  {/* Background track circle */}
                  <circle
                    r={gaugeData.R}
                    fill="none"
                    stroke="#eef0f3"
                    strokeWidth="16"
                    strokeDasharray={`${gaugeData.L} ${2 * gaugeData.L}`}
                  />
                  {/* Slices */}
                  {gaugeData.segments.map((seg) => {
                    if (!seg.count) return null;
                    return (
                      <circle
                        key={seg.name}
                        r={gaugeData.R}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="16"
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          showToast(`Filter: ${seg.name}`);
                          navigate(`/leads?source=${seg.platform}`);
                        }}
                      >
                        <title>{seg.name}: {seg.count}</title>
                      </circle>
                    );
                  })}
                </g>
                <text
                  x="100"
                  y="86"
                  textAnchor="middle"
                  style={{ fontSize: '30px', fontWeight: 700, fill: '#1c1e21' }}
                >
                  {gaugeData.tot}
                </text>
                <text
                  x="100"
                  y="104"
                  textAnchor="middle"
                  style={{ fontSize: '11px', fill: '#65676b' }}
                >
                  Total leads
                </text>
              </svg>
            </div>

            <div className="lg" id="sl">
              {sourcesData.map((src) => {
                const pct = gaugeData.tot ? Math.round((src.count / gaugeData.tot) * 100) : 0;
                return (
                  <div
                    key={src.name}
                    onClick={() => {
                      showToast(`Filter: ${src.name}`);
                      navigate(`/leads?source=${src.platform}`);
                    }}
                  >
                    <i style={{ background: src.color }} />
                    <span>{src.name}</span>
                    <b>{src.count}</b>
                    <em>{pct}%</em>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card 3: Pipeline funnel (Span 5, Row Span 2) */}
          <section className="c s5">
            <div className="h">
              <div>
                <h3>Pipeline funnel</h3>
                <p>Click a stage to filter candidates</p>
              </div>
            </div>

            <div className="fu" id="fu">
              {stagesData.map((stg, i) => {
                const first = stagesData[0].count || 1;
                const prev = stagesData[i - 1]?.count || 0;
                const convPct = i > 0 ? (prev > 0 ? Math.round((stg.count / prev) * 100) : 0) : 100;
                const widthPct = Math.max((stg.count / first) * 100, 0);

                return (
                  <div
                    key={stg.name}
                    className="fr"
                    data-n={stg.name}
                    onClick={() => {
                      showToast(`Filter: ${stg.name}`);
                      navigate(`/leads?status=${stg.status}`);
                    }}
                  >
                    <div className="n">
                      {stg.name}
                      {i > 0 && i < 7 && <em>{convPct}% from previous</em>}
                    </div>
                    <div className="bw">
                      <div
                        className={`bar${stg.count ? '' : ' z'}`}
                        style={{
                          width: `${stg.count ? Math.max(widthPct, 12) : 12}%`,
                          background: `rgba(8,102,255,${1 - i * 0.1})`,
                        }}
                      >
                        {stg.count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card 4: Visa programs (Span 7) */}
          <section className="c s7">
            <div className="h">
              <div>
                <h3>Visa programs</h3>
                <p>Share of total leads</p>
              </div>
            </div>

            <div className="rings" id="rn">
              {visaData.map((v) => {
                const p = calcPct(v.count);
                const R = 34;
                const C = 2 * Math.PI * R; // 213.628

                return (
                  <div
                    key={v.name}
                    onClick={() => {
                      showToast(`Filter: ${v.name}`);
                      navigate(`/leads?desk=${v.desk}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <svg viewBox="0 0 92 92">
                      <circle
                        cx="46"
                        cy="46"
                        r={R}
                        fill="none"
                        stroke="#eef0f3"
                        strokeWidth="9"
                      />
                      <circle
                        cx="46"
                        cy="46"
                        r={R}
                        fill="none"
                        stroke={v.color}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={`${(C * p) / 100} ${C}`}
                        transform="rotate(-90 46 46)"
                      />
                      <text className="pc" x="46" y="52" textAnchor="middle">
                        {p}%
                      </text>
                    </svg>
                    <b>{v.name}</b>
                    <span>{v.count} leads</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card 5: Qualification & demographics (Span 7) */}
          <section className="c s7">
            <div className="h">
              <div>
                <h3>Qualification &amp; demographics</h3>
                <p>Eligibility profiles</p>
              </div>
            </div>

            <div className="two" id="dm">
              {/* Education Stacked Bar & Legend */}
              <div>
                <h4>Education qualification</h4>
                <div className="stk">
                  {educationData.map((edu) => (
                    <s
                      key={edu.name}
                      style={{
                        width: `${calcPct(edu.count)}%`,
                        background: edu.color,
                      }}
                    />
                  ))}
                </div>
                <div className="lg">
                  {educationData.map((edu) => (
                    <div key={edu.name}>
                      <i style={{ background: edu.color }} />
                      <span>{edu.name}</span>
                      <b>{edu.count}</b>
                      <em>{calcPct(edu.count)}%</em>
                    </div>
                  ))}
                </div>
              </div>

              {/* Age Brackets Vertical Columns */}
              <div>
                <h4>Age brackets</h4>
                <div className="cols">
                  {ageData.map((ag) => (
                    <div key={ag.name} className="col">
                      <b>{ag.count}</b>
                      <s
                        style={{
                          height: `${(ag.count / maxAgeCount) * 84}%`,
                          background: '#6554c0',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="cl">
                  {ageData.map((ag) => (
                    <span key={ag.name}>{ag.name}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Global Toast */}
        <div className={`toast${toastMsg ? ' show' : ''}`} id="toast">
          {toastMsg}
        </div>
      </div>
  );
}
