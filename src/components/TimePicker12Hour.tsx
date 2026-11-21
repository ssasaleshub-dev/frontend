import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Clock, X } from 'lucide-react';
import { format12HourTime } from '../utils/dateTimeUtils';

export interface TimePicker12HourProps {
  /**
   * 24-hour time format string, e.g. "22:00", "09:30", "14:15"
   */
  value?: string;
  onChange: (value24: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}

// 12 Clock positions on a 200x200 SVG canvas (radius = 70px, center = 100, 100)
const CLOCK_RADIUS = 68;
const CENTER = 100;

export const TimePicker12Hour: React.FC<TimePicker12HourProps> = ({
  value = '10:00',
  onChange,
  className = '',
  id,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const clockRef = useRef<SVGSVGElement | null>(null);

  // Parse incoming 24h value into 12h parts
  const { minute, hour12, hour12Str, minuteStr, period } = useMemo(() => {
    const clean = (value || '10:00').trim();
    const parts = clean.split(':');
    let h24 = parseInt(parts[0], 10);
    if (isNaN(h24) || h24 < 0 || h24 > 23) h24 = 10;

    let m = parseInt(parts[1], 10);
    if (isNaN(m) || m < 0 || m > 59) m = 0;

    const p: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;

    return {
      hour24: h24,
      minute: m,
      hour12: h12,
      hour12Str: String(h12).padStart(2, '0'),
      minuteStr: String(m).padStart(2, '0'),
      period: p,
    };
  }, [value]);

  // Emit 24h formatted string back to parent
  const emitChange = useCallback(
    (newHour12: number, newMinute: number, newPeriod: 'AM' | 'PM') => {
      const h24 = newPeriod === 'PM' ? (newHour12 % 12) + 12 : newHour12 % 12;
      const res24 = `${String(h24).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
      onChange(res24);
    },
    [onChange]
  );

  const handleHourSelect = (newH12: number) => {
    emitChange(newH12, minute, period);
    // Smooth auto-advance to minute selection
    setMode('minute');
  };

  const handleMinuteSelect = (newMin: number) => {
    emitChange(hour12, newMin, period);
  };

  const handlePeriodChange = (newP: 'AM' | 'PM') => {
    if (newP === period) return;
    emitChange(hour12, minute, newP);
  };

  const handleMinuteStep = (delta: number) => {
    const nextMin = (minute + delta + 60) % 60;
    emitChange(hour12, nextMin, period);
  };

  const applyPreset = (preset24: string) => {
    onChange(preset24);
  };

  // Calculate clock hand coordinates on 200x200 canvas
  const { handX, handY } = useMemo(() => {
    const angleDeg = mode === 'hour' ? hour12 * 30 : minute * 6;
    const rad = (angleDeg * Math.PI) / 180;
    const x = Math.round(CENTER + CLOCK_RADIUS * Math.sin(rad));
    const y = Math.round(CENTER - CLOCK_RADIUS * Math.cos(rad));
    return { handX: x, handY: y };
  }, [mode, hour12, minute]);

  // Click on SVG face to pick angle
  const handleSvgClockClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left - rect.width / 2;
    const clickY = e.clientY - rect.top - rect.height / 2;

    let angleDeg = (Math.atan2(clickX, -clickY) * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;

    if (mode === 'hour') {
      let h = Math.round(angleDeg / 30);
      if (h === 0) h = 12;
      handleHourSelect(h);
    } else {
      let m = Math.round(angleDeg / 6);
      if (m === 60) m = 0;
      handleMinuteSelect(m);
    }
  };

  // Precomputed 12 item positions
  const clockItems = useMemo(() => {
    if (mode === 'hour') {
      return Array.from({ length: 12 }, (_, i) => {
        const h = i + 1;
        const rad = (h * 30 * Math.PI) / 180;
        const x = Math.round(CENTER + CLOCK_RADIUS * Math.sin(rad));
        const y = Math.round(CENTER - CLOCK_RADIUS * Math.cos(rad));
        return { value: h, label: String(h), x, y };
      });
    } else {
      // 12 minute tick positions (00, 05, 10, ... 55)
      return Array.from({ length: 12 }, (_, i) => {
        const m = i * 5;
        const rad = (m * 6 * Math.PI) / 180;
        const x = Math.round(CENTER + CLOCK_RADIUS * Math.sin(rad));
        const y = Math.round(CENTER - CLOCK_RADIUS * Math.cos(rad));
        return { value: m, label: String(m).padStart(2, '0'), x, y };
      });
    }
  }, [mode]);

  const display12h = format12HourTime(value) || `${hour12Str}:${minuteStr} ${period}`;

  return (
    <>
      {/* ── Sleek Trigger Button (Replaces clumsy select dropdown) ── */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          setMode('hour');
          setIsOpen(true);
        }}
        className={`w-full flex items-center justify-between px-3 py-1.5 bg-[#f5f5f7] hover:bg-[#ebebed] border border-black/[0.06] rounded-[12px] text-[12px] text-[#1d1d1f] font-medium transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        } ${className}`}
      >
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-[#0071e3] shrink-0 group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-[13px] tracking-tight">{display12h}</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/[0.05] text-[#515154] group-hover:bg-[#0071e3]/10 group-hover:text-[#0071e3] transition-colors">
          Clock ▾
        </span>
      </button>

      {/* ── Interactive Visual Clock Modal Dialog ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-[24px] shadow-2xl border border-black/[0.08] p-4 sm:p-5 w-full max-w-[290px] flex flex-col items-center animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between w-full mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93]">
                Time Picker (IST)
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-full bg-black/[0.05] hover:bg-black/[0.1] flex items-center justify-center text-[#8e8e93] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                aria-label="Close Clock"
              >
                <X size={13} strokeWidth={2.4} />
              </button>
            </div>

            {/* Digital Time & AM/PM Banner */}
            <div className="flex items-center justify-between w-full bg-[#f5f5f7] rounded-[16px] p-2 mb-2 border border-black/[0.04]">
              <div className="flex items-center gap-1 pl-1">
                <button
                  type="button"
                  onClick={() => setMode('hour')}
                  className={`text-2xl font-bold px-2 py-1 rounded-[10px] transition-all cursor-pointer ${
                    mode === 'hour'
                      ? 'bg-white text-[#0071e3] shadow-xs'
                      : 'text-[#1d1d1f] hover:bg-black/[0.04]'
                  }`}
                  title="Click to adjust hour"
                >
                  {hour12Str}
                </button>
                <span className="text-2xl font-bold text-[#8e8e93]">:</span>
                <button
                  type="button"
                  onClick={() => setMode('minute')}
                  className={`text-2xl font-bold px-2 py-1 rounded-[10px] transition-all cursor-pointer ${
                    mode === 'minute'
                      ? 'bg-white text-[#0071e3] shadow-xs'
                      : 'text-[#1d1d1f] hover:bg-black/[0.04]'
                  }`}
                  title="Click to adjust minute"
                >
                  {minuteStr}
                </button>
              </div>

              {/* AM / PM Segmented Control */}
              <div className="flex flex-col rounded-[10px] bg-black/[0.06] p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => handlePeriodChange('AM')}
                  className={`px-2.5 py-1 rounded-[8px] transition-all cursor-pointer ${
                    period === 'AM'
                      ? 'bg-white text-[#0071e3] shadow-xs font-bold'
                      : 'text-[#8e8e93] hover:text-[#1d1d1f]'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange('PM')}
                  className={`px-2.5 py-1 rounded-[8px] transition-all cursor-pointer ${
                    period === 'PM'
                      ? 'bg-white text-[#0071e3] shadow-xs font-bold'
                      : 'text-[#8e8e93] hover:text-[#1d1d1f]'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 mb-2 bg-[#f2f2f7] p-0.5 rounded-full text-[11px] font-medium text-[#8e8e93] w-full justify-center">
              <button
                type="button"
                onClick={() => setMode('hour')}
                className={`flex-1 py-1 rounded-full transition-all text-center cursor-pointer ${
                  mode === 'hour' ? 'bg-white text-[#0071e3] font-bold shadow-xs' : 'hover:text-[#1d1d1f]'
                }`}
              >
                1. Pick Hour
              </button>
              <button
                type="button"
                onClick={() => setMode('minute')}
                className={`flex-1 py-1 rounded-full transition-all text-center cursor-pointer ${
                  mode === 'minute' ? 'bg-white text-[#0071e3] font-bold shadow-xs' : 'hover:text-[#1d1d1f]'
                }`}
              >
                2. Pick Minute
              </button>
            </div>

            {/* Interactive Visual Clock Face */}
            <div className="relative w-[200px] h-[200px] my-1 select-none">
              <svg
                ref={clockRef}
                viewBox="0 0 200 200"
                className="w-full h-full cursor-pointer touch-none"
                onClick={handleSvgClockClick}
              >
                {/* Clock face disk */}
                <circle cx={CENTER} cy={CENTER} r="96" fill="#f5f5f7" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />

                {/* Outer minute tick ring dots */}
                {Array.from({ length: 60 }, (_, i) => {
                  if (i % 5 === 0) return null;
                  const rad = (i * 6 * Math.PI) / 180;
                  const dotX = CENTER + 86 * Math.sin(rad);
                  const dotY = CENTER - 86 * Math.cos(rad);
                  return (
                    <circle
                      key={i}
                      cx={dotX}
                      cy={dotY}
                      r="1"
                      fill="rgba(0,0,0,0.15)"
                    />
                  );
                })}

                {/* Clock Hand Pointer */}
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={handX}
                  y2={handY}
                  stroke="#0071e3"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Hand Head Circle Highlighter */}
                <circle cx={handX} cy={handY} r="14" fill="#0071e3" />

                {/* Center Pin */}
                <circle cx={CENTER} cy={CENTER} r="3.5" fill="#0071e3" />
              </svg>

              {/* 12 Clickable Number Badges (Overlayed for pixel-perfect tap hitboxes) */}
              {clockItems.map((item) => {
                const isSelected = mode === 'hour' ? item.value === hour12 : item.value === minute;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mode === 'hour') handleHourSelect(item.value);
                      else handleMinuteSelect(item.value);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${item.x}px`,
                      top: `${item.y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-[12px] font-semibold transition-transform active:scale-90 cursor-pointer ${
                      isSelected
                        ? 'text-white font-bold pointer-events-none'
                        : 'text-[#1d1d1f] hover:bg-black/[0.08]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Minute Fine Tuning Step Buttons */}
            {mode === 'minute' && (
              <div className="flex items-center justify-between w-full px-2 mt-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleMinuteStep(-1)}
                  className="px-2 py-0.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f] font-medium cursor-pointer"
                >
                  -1 min
                </button>
                <span className="text-[#8e8e93]">Exact minute: <strong>{minuteStr}</strong></span>
                <button
                  type="button"
                  onClick={() => handleMinuteStep(1)}
                  className="px-2 py-0.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f] font-medium cursor-pointer"
                >
                  +1 min
                </button>
              </div>
            )}

            {/* Quick 1-Click Time Presets */}
            <div className="grid grid-cols-4 gap-1.5 w-full mt-2.5 pt-2 border-t border-black/[0.05]">
              <button
                type="button"
                onClick={() => applyPreset('10:00')}
                className={`py-1 text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer ${
                  value === '10:00' ? 'bg-[#0071e3] text-white' : 'bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f]'
                }`}
              >
                10 AM
              </button>
              <button
                type="button"
                onClick={() => applyPreset('14:30')}
                className={`py-1 text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer ${
                  value === '14:30' ? 'bg-[#0071e3] text-white' : 'bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f]'
                }`}
              >
                2:30 PM
              </button>
              <button
                type="button"
                onClick={() => applyPreset('17:00')}
                className={`py-1 text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer ${
                  value === '17:00' ? 'bg-[#0071e3] text-white' : 'bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f]'
                }`}
              >
                5 PM
              </button>
              <button
                type="button"
                onClick={() => applyPreset('19:00')}
                className={`py-1 text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer ${
                  value === '19:00' ? 'bg-[#0071e3] text-white' : 'bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f]'
                }`}
              >
                7 PM
              </button>
            </div>

            {/* Confirmation Action Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full mt-3 py-2 rounded-full bg-[#0071e3] hover:bg-[#0077ED] text-white text-[12px] font-semibold shadow-xs transition-all active:scale-98 cursor-pointer"
            >
              Done • {display12h}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TimePicker12Hour;
