import { ReactNode } from "react";
import clsx from "clsx"; // You might need to install clsx: npm install clsx

// 1. The White Card Wrapper
export function FormCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
      <div className="px-4 py-6 sm:p-8">
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// 2. The Form Page Header
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="md:flex md:items-center md:justify-between mb-8">
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

// 3. Standard Text Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  colSpan?: string; // e.g., "sm:col-span-3"
}

export function FormInput({
  label,
  colSpan = "col-span-full",
  className,
  ...props
}: InputProps) {
  return (
    <div className={colSpan}>
      <label
        htmlFor={props.id || props.name}
        className="block text-sm font-medium leading-6 text-gray-900"
      >
        {label}
      </label>
      <div className="mt-2">
        <input
          {...props}
          className={clsx(
            "block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all duration-200",
            className,
          )}
        />
      </div>
    </div>
  );
}

// 4. Standard Select Input
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { label: string; value: string }[];
  colSpan?: string;
}

export function FormSelect({
  label,
  options,
  colSpan = "col-span-full",
  ...props
}: SelectProps) {
  return (
    <div className={colSpan}>
      <label
        htmlFor={props.id || props.name}
        className="block text-sm font-medium leading-6 text-gray-900"
      >
        {label}
      </label>
      <div className="mt-2">
        <select
          {...props}
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// 5. Action Buttons (Save/Cancel)
export function FormActions({ cancelHref }: { cancelHref: string }) {
  // Use a standard link for cancel to avoid form submission
  const Link = require("next/link").default;

  return (
    <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8 bg-gray-50/50 sm:rounded-b-xl">
      <Link
        href={cancelHref}
        className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700"
      >
        Cancel
      </Link>
      <button
        type="submit"
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
      >
        Save Changes
      </button>
    </div>
  );
}
