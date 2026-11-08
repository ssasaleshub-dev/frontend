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

      {/* FOREGROUND ROW: Pure Apple iOS Clean List Item */}
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
        className="px-4 py-3.5 bg-white hover:bg-[#fafafa] active:bg-[#f2f2f7] border-b border-[#e5e5ea]/70 relative z-10 cursor-pointer transition-colors flex flex-col justify-center"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h4
            className={`text-[15px] leading-snug tracking-tight truncate ${
              item.isRead ? 'font-normal text-[#1c1c1e]' : 'font-semibold text-[#000000]'
            }`}
          >
            {cleanTitle}
          </h4>
          <span className="text-[12px] text-[#8e8e93] shrink-0 font-normal">
            {formattedTimestamp}
          </span>
        </div>

        {displayMessage && (
          <p className="text-[13px] text-[#636366] leading-normal font-normal mt-0.5 line-clamp-2">
            {displayMessage}
          </p>
        )}
      </div>
    </div>
  );
}
