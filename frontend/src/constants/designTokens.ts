/**
 * Design System Tokens
 * 
 * Centralized color and spacing definitions for consistent UI across the application.
 * All components should use these tokens instead of hardcoded values.
 */

export const colors = {
  // Primary actions
  primary: {
    bg: "bg-blue-600 dark:bg-blue-500",
    hover: "hover:bg-blue-700 dark:hover:bg-blue-600",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-600 dark:border-blue-500",
    focus: "focus:ring-blue-500 dark:focus:ring-blue-400",
  },
  
  // Success / Completed
  success: {
    bg: "bg-green-600 dark:bg-green-500",
    hover: "hover:bg-green-700 dark:hover:bg-green-600",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-600 dark:border-green-500",
    light: "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  
  // Warning
  warning: {
    bg: "bg-yellow-600 dark:bg-yellow-500",
    hover: "hover:bg-yellow-700 dark:hover:bg-yellow-600",
    text: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-600 dark:border-yellow-500",
    light: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  },
  
  // Error / Danger
  danger: {
    bg: "bg-red-600 dark:bg-red-500",
    hover: "hover:bg-red-700 dark:hover:bg-red-600",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-600 dark:border-red-500",
    light: "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  
  // Neutral / Secondary
  neutral: {
    bg: "bg-gray-200 dark:bg-gray-700",
    hover: "hover:bg-gray-300 dark:hover:bg-gray-600",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-300 dark:border-gray-600",
    light: "bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700",
  },
} as const;

export const spacing = {
  page: "p-4 sm:p-6 lg:p-8",
  section: "mb-6",
  card: {
    sm: "p-3",
    md: "p-4 sm:p-6",
    lg: "p-6 sm:p-8",
  },
} as const;

export const layout = {
  container: "w-full",
  maxWidth: "max-w-7xl mx-auto",
  grid: {
    cards: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4",
    stats: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4",
  },
} as const;
