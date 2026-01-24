import React, { useEffect } from "react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
}

// Header height - примерно 64px (py-3 sm:py-4 + content)
const HEADER_HEIGHT = 64;

export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = "lg",
}: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      // Блокируем скролл только main контента (через класс)
      document.body.classList.add("drawer-open");
    } else {
      document.body.classList.remove("drawer-open");
    }
    return () => {
      document.body.classList.remove("drawer-open");
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: "w-full sm:w-96",
    md: "w-full sm:w-[28rem]",
    lg: "w-full sm:w-full md:w-[32rem]",
    xl: "w-full sm:w-full md:w-[36rem]",
  };

  const drawerHeight = `calc(100vh - ${HEADER_HEIGHT}px)`;

  return (
    <>
      {/* Backdrop - затемняет только Main Content (начинается под Header, не затрагивает Sidebar) */}
      <div
        className="fixed left-0 md:left-64 right-0 bottom-0 bg-black/50 z-[50] cursor-pointer"
        onClick={onClose}
        style={{
          top: `${HEADER_HEIGHT}px`,
        }}
      />

      {/* Drawer - открывается под Header, фиксированная позиция */}
      <div
        className={`fixed right-0 ${widthClasses[width]} bg-white dark:bg-gray-800 shadow-2xl z-[55] flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out`}
        onClick={(e) => e.stopPropagation()}
        style={{
          top: `${HEADER_HEIGHT}px`,
          height: drawerHeight,
        }}
      >
        {/* Drawer Header с кнопкой закрытия - всегда видна */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content - скроллится */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
