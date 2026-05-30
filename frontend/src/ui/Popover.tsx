import { useEffect, useRef, useState } from "react";

interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  placement?: "bottom-end" | "bottom-start" | "top-end" | "top-start";
  gap?: number;
  className?: string;
}

export default function Popover({
  isOpen,
  onClose,
  anchorRef,
  children,
  placement = "bottom-end",
  gap = 6,
  className = "",
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  // Keep popover mounted a bit after close to play exit animation
  useEffect(() => {
    if (isOpen && !render) {
      setRender(true);
      return;
    }
    if (!isOpen && render) {
      const timeout = setTimeout(() => setRender(false), 150);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, render]);

  if (!render || !anchorRef.current) return null;

  const anchorRect = anchorRef.current.getBoundingClientRect();

  const positionStyles: React.CSSProperties = (() => {
    switch (placement) {
      case "bottom-end":
        return {
          top: anchorRect.bottom + gap,
          right: window.innerWidth - anchorRect.right,
          left: "auto",
        };
      case "bottom-start":
        return {
          top: anchorRect.bottom + gap,
          left: anchorRect.left,
          right: "auto",
        };
      case "top-end":
        return {
          bottom: window.innerHeight - anchorRect.top + gap,
          right: window.innerWidth - anchorRect.right,
          left: "auto",
        };
      case "top-start":
        return {
          bottom: window.innerHeight - anchorRect.top + gap,
          left: anchorRect.left,
          right: "auto",
        };
      default:
        return {};
    }
  })();

  const open = isOpen;

  return (
    <div
      ref={popoverRef}
      className={`fixed z-[100] min-w-[200px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg transform transition duration-150 ease-out origin-top ${
        open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-1 scale-95"
      } ${className}`}
      style={positionStyles}
    >
      {children}
    </div>
  );
}
