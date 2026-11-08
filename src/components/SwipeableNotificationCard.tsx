import React, { useState, useRef } from 'react';
import {
  Check,
  Trash2,
  Clock,
  Phone,
  User,
  Bell,
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
        onMarkAsRead(item.id);
      } else if (offsetX < -60) {
        onDelete(item.id);
      }
    }
    setOffsetX(0);
    isHorizontalSwipe.current = false;
    isVerticalScroll.current = false;
  };

  // --- MOUSE DRAG HANDLERS ---
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

  const displayMessage = cleanNotificationMessage(item.message, cleanTitle);

  return (
    <div className="relative overflow-hidden bg-white select-none touch-pan-y group">
      {/* BACKGROUND ACTION: Right Swipe = Mark as Read (Apple/Instagram Blue) */}
      <div
        onClick={() => onMarkAsRead(item.id)}
        className={`absolute inset-y-0 left-0 w-full flex items-center justify-start pl-6 pr-4 bg-[#0071e3] text-white transition-opacity duration-150 cursor-pointer ${
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

      {/* BACKGROUND ACTION: Left Swipe = Delete (Instagram Red) */}
      <div
        onClick={() => onDelete(item.id)}
        className={`absolute inset-y-0 right-0 w-full flex items-center justify-end pr-6 pl-4 bg-[#ff3b30] text-white transition-opacity duration-150 cursor-pointer ${
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

      {/* FOREGROUND ROW: Instagram-style Flat White Row (No floating model, no bubble borders) */}
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
        className={`px-4 py-3.5 bg-white hover:bg-[#fafafa] active:bg-[#f5f5f5] flex items-center gap-3.5 border-b border-black/[0.04] relative z-10 cursor-pointer transition-colors ${
          !item.isRead ? 'bg-blue-50/[0.25]' : ''
        }`}
      >
        {/* Left: Instagram-style circular icon avatar */}
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border border-black/[0.04] ${
            item.type === 'CALL'
              ? 'bg-emerald-50 text-emerald-600'
              : item.type === 'REMINDER'
              ? 'bg-orange-50 text-orange-600'
              : item.type === 'LEAD_ASSIGNED'
              ? 'bg-purple-50 text-purple-600'
              : 'bg-blue-50 text-[#0071e3]'
          }`}
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
          <p className="text-[14px] leading-snug text-[#1d1d1f]">
            <span className={item.isRead ? 'font-medium' : 'font-semibold'}>
              {cleanTitle}
            </span>
            {displayMessage && (
              <span className="text-[#515154] font-normal ml-1.5">
                {displayMessage}
              </span>
            )}
          </p>
          <span className="text-[12px] text-[#8e8e93] mt-1 block font-normal">
            {formattedTimestamp}
          </span>
        </div>
      </div>
    </div>
  );
}
