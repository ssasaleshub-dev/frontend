import React, { useState, useRef } from 'react';
import {
  Check,
  Trash2,
} from 'lucide-react';
import { NotificationItem } from '../services/reminderNotificationService';
import { cleanNotificationMessage } from '../utils/dateTimeUtils';

interface SwipeableNotificationCardProps {
  item: NotificationItem;
  cleanTitle: string;
  formattedTimestamp: string;
  onClick: (item: NotificationItem) => void;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SwipeableNotificationCard({
  item,
  cleanTitle,
  formattedTimestamp,
  onClick,
  onMarkAsRead,
  onDelete,
}: SwipeableNotificationCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontalSwipe = useRef(false);
  const isVerticalScroll = useRef(false);
  const hasMoved = useRef(false);

  // --- TOUCH HANDLERS ---
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = false;
    isVerticalScroll.current = false;
    hasMoved.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isVerticalScroll.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // Detect gesture direction early
    if (!isHorizontalSwipe.current && !isVerticalScroll.current) {
      if (Math.abs(diffY) > 8 && Math.abs(diffY) > Math.abs(diffX)) {
        isVerticalScroll.current = true;
        return;
      }
      if (Math.abs(diffX) > 8) {
        isHorizontalSwipe.current = true;
      }
    }

    if (isHorizontalSwipe.current) {
      hasMoved.current = true;
      // Damped rubber-band resistance
      let clamped = diffX;
      if (diffX > 90) clamped = 90 + (diffX - 90) * 0.3;
      if (diffX < -90) clamped = -90 + (diffX + 90) * 0.3;
      setOffsetX(clamped);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (isHorizontalSwipe.current) {
      if (offsetX > 60) {
        // Right swipe: Mark as Read
        onMarkAsRead(item.id);
      } else if (offsetX < -60) {
        // Left swipe: Delete
        onDelete(item.id);
      }
    }
    setOffsetX(0);
    isHorizontalSwipe.current = false;
    isVerticalScroll.current = false;
  };

  // --- MOUSE DRAG HANDLERS (Desktop Drag Support) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    isHorizontalSwipe.current = false;
    hasMoved.current = false;
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diffX = moveEvent.clientX - startX.current;
      if (Math.abs(diffX) > 6) {
        isHorizontalSwipe.current = true;
        hasMoved.current = true;
      }
      if (isHorizontalSwipe.current) {
        let clamped = diffX;
        if (diffX > 90) clamped = 90 + (diffX - 90) * 0.3;
        if (diffX < -90) clamped = -90 + (diffX + 90) * 0.3;
        setOffsetX(clamped);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);
      if (isHorizontalSwipe.current) {
        if (offsetX > 60) {
          onMarkAsRead(item.id);
        } else if (offsetX < -60) {
          onDelete(item.id);
        }
      }
      setOffsetX(0);
      isHorizontalSwipe.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hasMoved.current || Math.abs(offsetX) > 6) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick(item);
  };

  const isSwipingRight = offsetX > 0;
  const isSwipingLeft = offsetX < 0;

  return (
    <div className="relative overflow-hidden rounded-2xl select-none touch-pan-y group">
      {/* BACKGROUND ACTION: Right Swipe = Mark as Read (Apple Blue) */}
      <div
        onClick={() => onMarkAsRead(item.id)}
        className={`absolute inset-y-0 left-0 w-full flex items-center justify-start pl-5 pr-4 bg-[#0071e3] text-white transition-opacity duration-150 cursor-pointer ${
          isSwipingRight ? 'opacity-100 z-0' : 'opacity-0 -z-10'
        }`}
      >
        <div
          className="flex items-center gap-2 font-semibold text-xs tracking-tight transition-transform"
          style={{
            transform: `scale(${Math.min(1.15, Math.max(0.85, Math.abs(offsetX) / 60))})`,
          }}
        >
          <Check size={20} strokeWidth={2.8} />
          <span>Mark Read</span>
        </div>
      </div>

      {/* BACKGROUND ACTION: Left Swipe = Delete (Apple Red) */}
      <div
        onClick={() => onDelete(item.id)}
        className={`absolute inset-y-0 right-0 w-full flex items-center justify-end pr-5 pl-4 bg-[#ff3b30] text-white transition-opacity duration-150 cursor-pointer ${
          isSwipingLeft ? 'opacity-100 z-0' : 'opacity-0 -z-10'
        }`}
      >
        <div
          className="flex items-center gap-2 font-semibold text-xs tracking-tight transition-transform"
          style={{
            transform: `scale(${Math.min(1.15, Math.max(0.85, Math.abs(offsetX) / 60))})`,
          }}
        >
          <span>Delete</span>
          <Trash2 size={18} strokeWidth={2.2} />
        </div>
      </div>

      {/* FOREGROUND CARD: Clean Apple HIG card (NO blue dot, NO cluttered static icons) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.15)',
        }}
        className={`p-4 rounded-2xl border flex flex-col gap-2 relative z-10 cursor-pointer ${
          item.isRead
            ? 'bg-white/80 hover:bg-white border-black/[0.05] shadow-2xs'
            : 'bg-white hover:bg-white border-[#0071e3]/30 shadow-xs ring-1 ring-[#0071e3]/10'
        }`}
      >
        {/* Top Row: Category Badge + Timestamp (Zero Dot, Zero Clutter) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                item.type === 'CALL'
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : item.type === 'REMINDER'
                  ? 'bg-orange-500/10 text-orange-700'
                  : item.type === 'LEAD_ASSIGNED'
                  ? 'bg-purple-500/10 text-purple-700'
                  : 'bg-blue-500/10 text-blue-700'
              }`}
            >
              {item.type === 'CALL'
                ? 'Candidate Callback'
                : item.type === 'REMINDER'
                ? 'Reminder'
                : item.type === 'LEAD_ASSIGNED'
                ? 'Lead Assignment'
                : item.type && item.type.startsWith('CLOSING_MILESTONE_')
                ? 'Milestone'
                : 'SSA Sales Hub'}
            </span>

            <span className="text-[11px] text-[#86868b] font-normal truncate">
              {formattedTimestamp}
            </span>
          </div>

          {/* Desktop Hover Shortcut Pills (Zero Dot) */}
          <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!item.isRead && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(item.id);
                }}
                title="Mark as read (or swipe right)"
                className="p-1 rounded-md text-[#86868b] hover:text-[#0071e3] hover:bg-black/[0.05] transition-colors"
              >
                <Check size={13} strokeWidth={2.5} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="Delete notification (or swipe left)"
              className="p-1 rounded-md text-[#86868b] hover:text-[#ff3b30] hover:bg-black/[0.05] transition-colors"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Content Body - Only displays real user-entered data */}
        {(() => {
          const displayMessage = cleanNotificationMessage(item.message, cleanTitle);
          return (
            <div className="space-y-1">
              <h4
                className={`text-[14px] leading-snug tracking-tight ${
                  item.isRead ? 'font-medium text-[#1d1d1f]' : 'font-semibold text-[#1d1d1f]'
                }`}
              >
                {cleanTitle}
              </h4>
              {displayMessage && (
                <p className="text-[13px] text-[#515154] leading-relaxed font-normal">
                  {displayMessage}
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

