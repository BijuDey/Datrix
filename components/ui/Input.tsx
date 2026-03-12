"use client";
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, prefix, suffix, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[12px] font-medium text-[#8a8a8a]">
            {label}
            {props.required && <span className="text-amber-400 ml-0.5">*</span>}
          </label>
        )}
        <div
          className={cn(
            "flex items-center gap-2 h-9 rounded-md border bg-[#111111] px-3",
            "transition-all duration-150",
            error
              ? "border-red-500/50 focus-within:border-red-500"
              : "border-[#2a2a2a] focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/20"
          )}
        >
          {prefix && <span className="text-[#8a8a8a] shrink-0">{prefix}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "flex-1 bg-transparent text-[13px] text-[#f0f0f0] placeholder:text-[#444] outline-none min-w-0",
              className
            )}
            {...props}
          />
          {suffix && <span className="text-[#8a8a8a] shrink-0">{suffix}</span>}
        </div>
        {(error || hint) && (
          <p className={cn("text-[11px]", error ? "text-red-400" : "text-[#8a8a8a]")}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-[12px] font-medium text-[#8a8a8a]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-9 rounded-md border bg-[#111111] px-3",
            "text-[13px] text-[#f0f0f0] outline-none",
            "transition-all duration-150",
            error
              ? "border-red-500/50"
              : "border-[#2a2a2a] focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-[12px] font-medium text-[#8a8a8a]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            "rounded-md border bg-[#111111] px-3 py-2",
            "text-[13px] text-[#f0f0f0] placeholder:text-[#444] outline-none resize-none",
            "transition-all duration-150",
            error
              ? "border-red-500/50"
              : "border-[#2a2a2a] focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors duration-200",
          checked ? "bg-amber-500" : "bg-[#2a2a2a]"
        )}
        onClick={() => onChange(!checked)}
      >
        <div
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </div>
      {(label || description) && (
        <div>
          {label && <p className="text-[13px] text-[#f0f0f0] font-medium">{label}</p>}
          {description && <p className="text-[11px] text-[#8a8a8a]">{description}</p>}
        </div>
      )}
    </label>
  );
}
