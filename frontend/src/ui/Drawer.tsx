import React, { useEffect } from "react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
}

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
      document.body.style.overflow = "hidden";
      // Add class to body to darken sidebar and header
      document.body.classList.add("drawer-open");
    } else {
      document.body.style.overflow = "unset";
      document.body.classList.remove("drawer-open");
    }
    return () => {
      document.body.style.overflow = "unset";
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

  return (
    <>
      {/* Backdrop - covers 100% viewport (fixed positioning, independent of layout) */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[50] transition-opacity"
        onClick={onClose}
        style={{ width: '100vw', height: '100vh' }}
      />

      {/* Drawer - fixed positioning, independent of layout, appears above backdrop but header stays on top */}
      <div
        className={`fixed right-0 top-0 h-full ${widthClasses[width]} bg-white dark:bg-gray-800 shadow-2xl z-[55] flex flex-col transform transition-transform duration-300 ease-in-out`}
        onClick={(e) => e.stopPropagation()}
        style={{ height: '100vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
