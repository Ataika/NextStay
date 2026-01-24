import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export default function Card({
  children,
  className = "",
  padding = "md",
  hover = false,
}: CardProps) {
  const baseClasses = "bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700";
  
  const paddingClasses = {
    none: "",
    sm: "p-2.5",
    md: "p-3 sm:p-4",
    lg: "p-4 sm:p-6",
  };

  const hoverClass = hover ? "hover:shadow-md transition-shadow" : "";

  return (
    <div className={`${baseClasses} ${paddingClasses[padding]} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
}
