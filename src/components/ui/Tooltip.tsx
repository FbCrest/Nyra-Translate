import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top',
  className = "",
  delay = 0.2
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top + scrollY - 8;
          left = rect.left + scrollX + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + scrollY + 8;
          left = rect.left + scrollX + rect.width / 2;
          break;
        case 'left':
          top = rect.top + scrollY + rect.height / 2;
          left = rect.left + scrollX - 8;
          break;
        case 'right':
          top = rect.top + scrollY + rect.height / 2;
          left = rect.left + scrollX + rect.width + 8;
          break;
      }
      setCoords({ top, left });
    }
  };

  const show = () => {
    updateCoords();
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay * 1000);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isVisible]);

  const variants = {
    top: { initial: { opacity: 0, y: 10, x: "-50%", scale: 0.95 }, animate: { opacity: 1, y: 0, x: "-50%", scale: 1 } },
    bottom: { initial: { opacity: 0, y: -10, x: "-50%", scale: 0.95 }, animate: { opacity: 1, y: 0, x: "-50%", scale: 1 } },
    left: { initial: { opacity: 0, x: 10, y: "-50%", scale: 0.95 }, animate: { opacity: 1, x: 0, y: "-50%", scale: 1 } },
    right: { initial: { opacity: 0, x: -10, y: "-50%", scale: 0.95 }, animate: { opacity: 1, x: 0, y: "-50%", scale: 1 } },
  };

  const arrows = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-zinc-900 border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-zinc-900 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-zinc-900 border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-zinc-900 border-t-transparent border-b-transparent border-l-transparent",
  };

  const portalContent = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={variants[position].initial}
          animate={variants[position].animate}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{ 
            position: 'absolute', 
            top: coords.top, 
            left: coords.left,
            zIndex: 9999,
          }}
          className="pointer-events-none"
        >
          <div 
            className={`px-3 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl text-[10px] font-medium text-zinc-100 whitespace-nowrap ${
              position === 'left' ? '-translate-x-full' : position === 'top' ? '-translate-y-full' : ''
            }`}
          >
            {content}
            <div className={`absolute border-[6px] ${arrows[position]}`} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div 
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {typeof document !== 'undefined' && createPortal(portalContent, document.body)}
    </div>
  );
};
