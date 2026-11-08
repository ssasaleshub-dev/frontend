import React, { useState, useRef } from 'react';
import {
  Check,
  Trash2,
  Clock,
  Phone,
  User,
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
  const currentDiffX = useRef(0);
  const isHorizontalSwipe = useRef(false);
  const isVerticalScroll = useRef(false);
  const hasMoved = useRef(false);

  // --- TOUCH HANDLERS ---
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentDiffX.current = 0;
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
      if (Math.abs(diffX) > 6) {
        isHorizontalSwipe.current = true;
      }
    }

    if (isHorizontalSwipe.current) {
      hasMoved.current = true;
      currentDiffX.current = diffX;

      let clamped = diffX;
      if (diffX > 100) clamped = 100 + (diffX - 100) * 0.25;
      if (diffX < -100) clamped = -100 + (diffX + 100) * 0.25;
      setOffsetX(clamped);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const finalDiff = currentDiffX.current;

    if (isHorizontalSwipe.current && hasMoved.current) {
      if (finalDiff > 35) {
        // Right swipe: Toggle/Mark as Read
        onMarkAsRead(item.id);
      } else if (finalDiff < -35) {
        // Left swipe: Delete
        onDelete(item.id);
      }
    }

    currentDiffX.current = 0;
    setOffsetX(0);
    isHorizontalSwipe.current = false;
    isVerticalScroll.current = false;
  };

  // --- MOUSE DRAG HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    currentDiffX.current = 0;
    isHorizontalSwipe.current = false;
    hasMoved.current = false;
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diffX = moveEvent.clientX - startX.current;
      if (Math.abs(diffX) > 4) {
        isHorizontalSwipe.current = true;
        hasMoved.current = true;
      }
      if (isHorizontalSwipe.current) {
        currentDiffX.current = diffX;
        let clamped = diffX;
        if (diffX > 100) clamped = 100 + (diffX - 100) * 0.25;
        if (diffX < -100) clamped = -100 + (diffX + 100) * 0.25;
        setOffsetX(clamped);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);

      const finalDiff = currentDiffX.current;
      if (isHorizontalSwipe.current && hasMoved.current) {
        if (finalDiff > 35) {
          onMarkAsRead(item.id);
        } else if (finalDiff < -35) {
          onDelete(item.id);
        }
      }

      currentDiffX.current = 0;
      setOffsetX(0);
      isHorizontalSwipe.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hasMoved.current || Math.abs(currentDiffX.current) > 5 || Math.abs(offsetX) > 5) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick(item);
  };

  const isSwipingRight = offsetX > 0;
  const isSwipingLeft = offsetX < 0;

  const displayMessage = cleanNotificationMessage(item.message, cleanTitle);

  return (
    <div className="relative overflow-hidden bg-white select-none touch-pan-y group">
      {/* BACKGROUND ACTION: Right Swipe = Mark as Read / Unread (Apple/Instagram Blue) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onMarkAsRead(item.id);
        }}
        className={`absolute inset-y-0 left-0 w-full flex items-center justify-start pl-6 pr-4 bg-[#0071e3] text-white transition-opacity duration-150 cursor-pointer ${
          isSwipingRight ? 'opacity-100 z-0' : 'opacity-0 -z-10'
        }`}
      >
        <div
          className="flex items-center gap-2 font-semibold text-xs tracking-tight transition-transform"
          style={{
            transform: `scale(${Math.min(1.2, Math.max(0.85, Math.abs(offsetX) / 45))})`,
          }}
        >
          <Check size={20} strokeWidth={2.8} />
          <span>{item.isRead ? 'Mark Unread' : 'Mark Read'}</span>
        </div>
      </div>

      {/* BACKGROUND ACTION: Left Swipe = Delete (Instagram Red) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
        className={`absolute inset-y-0 right-0 w-full flex items-center justify-end pr-6 pl-4 bg-[#ff3b30] text-white transition-opacity duration-150 cursor-pointer ${
          isSwipingLeft ? 'opacity-100 z-0' : 'opacity-0 -z-10'
        }`}
      >
        <div
          className="flex items-center gap-2 font-semibold text-xs tracking-tight transition-transform"
          style={{
            transform: `scale(${Math.min(1.2, Math.max(0.85, Math.abs(offsetX) / 45))})`,
          }}
        >
          <span>Delete</span>
          <Trash2 size={18} strokeWidth={2.2} />
        </div>
      </div>

      {/* FOREGROUND ROW: Instagram-style Flat White Row with Clear Visual Feedback */}
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
        className={`px-4 py-3.5 flex items-center gap-3.5 border-b border-black/[0.04] relative z-10 cursor-pointer transition-colors duration-200 ${
          !item.isRead
            ? 'bg-[#0071e3]/[0.05] hover:bg-[#0071e3]/[0.08]'
            : 'bg-white hover:bg-[#fafafa]'
        }`}
      >
        {/* Left: Circular icon avatar with active indicator */}
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border transition-all ${
            item.type === 'CALL'
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50'
              : item.type === 'REMINDER'
              ? 'bg-orange-50 text-orange-600 border-orange-200/50'
              : item.type === 'LEAD_ASSIGNED'
              ? 'bg-purple-50 text-purple-600 border-purple-200/50'
              : 'bg-blue-50 text-[#0071e3] border-blue-200/50'
          } ${!item.isRead ? 'ring-2 ring-[#0071e3]/20 shadow-xs' : ''}`}
        >
          {item.type === 'CALL' ? (
            <Phone size={18} strokeWidth={2.2} />
          ) : item.type === 'LEAD_ASSIGNED' ? (
            <User size={18} strokeWidth={2.2} />
          ) : (
            <Clock size={18} strokeWidth={2.2} />
          )}
        </div>

        {/* Center: Instagram-style inline notification text */}
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-[14px] leading-snug">
            <span
              className={`transition-colors ${
                !item.isRead ? 'font-bold text-[#1d1d1f]' : 'font-normal text-[#515154]'
              }`}
            >
              {cleanTitle}
            </span>
            {displayMessage && (
              <span className="text-[#515154] font-normal ml-1.5">
                {displayMessage}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-[12px] block font-normal transition-colors ${
                !item.isRead ? 'text-[#0071e3] font-medium' : 'text-[#8e8e93]'
              }`}
            >
              {formattedTimestamp}
            </span>
            {!item.isRead && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0071e3] bg-[#0071e3]/10 px-1.5 py-0.2 rounded-md">
                Unread
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
