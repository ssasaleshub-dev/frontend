import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';

interface PullToRefreshProps {
  children?: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  /** Whether pull-to-refresh is enabled (defaults to true) */
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
}) => {
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef<boolean>(false);
  const threshold = 70;

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(60);

    // Haptic feedback for Android
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch {
        // Safe fallback
      }
    }

    try {
      // 1. Dispatch custom event for current active screen
      window.dispatchEvent(new CustomEvent('app:pull-to-refresh'));

      // 2. Call optional callback
      if (onRefresh) {
        await onRefresh();
      } else {
        // Minimum visual feedback duration
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } catch (err) {
      console.warn('Pull-to-refresh error:', err);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 300);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull if user is at the very top of the page
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      if (scrollTop <= 1 && !isRefreshing) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        startYRef.current = null;
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || startYRef.current === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const rawDelta = currentY - startYRef.current;

      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;

      if (rawDelta > 0 && scrollTop <= 0) {
        // Apply physics damping curve
        const damped = Math.min(85, Math.pow(rawDelta, 0.82));
        setPullDistance(damped);
      } else {
        setPullDistance(0);
        isPullingRef.current = false;
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;
      startYRef.current = null;

      if (pullDistance >= threshold && !isRefreshing) {
        triggerRefresh();
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [disabled, isRefreshing, pullDistance, triggerRefresh]);

  const progress = Math.min(1, pullDistance / threshold);
  const isTriggerable = pullDistance >= threshold;

  return (
    <>
      {/* Floating Material Pull-to-refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="ptr-indicator"
          style={{
            top: isRefreshing ? '24px' : `${Math.max(12, pullDistance - 20)}px`,
            opacity: isRefreshing ? 1 : Math.max(0.2, progress),
            transform: `translateX(-50%) scale(${isRefreshing ? 1 : 0.6 + progress * 0.4})`,
          }}
        >
          {isRefreshing ? (
            <RefreshCw size={20} className="animate-spin text-[#029757]" />
          ) : (
            <ArrowDown
              size={18}
              className={`transition-transform duration-200 text-[#029757] ${
                isTriggerable ? 'rotate-180 scale-110' : ''
              }`}
              style={{
                transform: isTriggerable
                  ? 'rotate(180deg)'
                  : `rotate(${pullDistance * 3}deg)`,
              }}
            />
          )}
        </div>
      )}

      {children}
    </>
  );
};

export default PullToRefresh;
