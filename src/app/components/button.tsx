import { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../lib/ts/cn";

type ButtonProps = {
  variant: "link" | "button";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "onClick" | "disabled" | "type">;

export function Button({
  children,
  variant,
  onClick,
  disabled = false,
  type = "button",
  className,
  ...rest
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={cn(
        "cursor-pointer transition-all duration-200",
        disabled && "opacity-50 cursor-not-allowed",
        variant === "link" 
          ? "text-sm font-medium text-indigo-600 hover:text-indigo-500 underline-offset-2 hover:underline"
          : "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 active:translate-y-0.5 active:shadow-none",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
