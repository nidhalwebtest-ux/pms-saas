"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import {
  ArrowUpTrayIcon,
  DocumentIcon,
  XMarkIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../Button";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

export interface FileUploadProps
  extends Omit<BaseFieldProps, "loading" | "success" | "readOnly"> {
  /** Accepted MIME types, in react-dropzone's `Accept` shape (or a simpler array). */
  accept?: Accept | string[];

  /** Maximum file size in bytes. */
  maxSize?: number;

  /** Maximum number of files. Default 1. */
  maxFiles?: number;

  /** Allow multiple selection. Convenience alias for `maxFiles > 1`. */
  multiple?: boolean;

  /**
   * `zone` (default) — dashed dropzone with cloud-up icon and drag-drop.
   * `button` — a Button trigger; file list renders below.
   */
  layout?: "zone" | "button";

  /** Controlled file list. */
  value?: File[];

  /** Uncontrolled initial value (e.g. an empty array). */
  defaultValue?: File[];

  /** Fires whenever the accepted list changes. */
  onChange?: (files: File[]) => void;

  /** Fires when react-dropzone rejects files (size / type / too many). */
  onReject?: (rejections: FileRejection[]) => void;

  /**
   * Per-file upload progress, keyed by `File.name`. Drives the progress bar
   * + success state shown in the file list row. Values are 0 - 100 (no value
   * means "not yet started"). The component does NOT upload anything itself;
   * the consumer calls its upload API and reports progress back.
   */
  progress?: Record<string, number>;

  /** Custom file-type/size hint text rendered inside the zone. */
  hint?: ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeAccept(accept?: Accept | string[]): Accept | undefined {
  if (!accept) return undefined;
  if (Array.isArray(accept)) {
    return accept.reduce<Accept>((acc, mime) => {
      acc[mime] = [];
      return acc;
    }, {});
  }
  return accept;
}

export const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(
  function FileUpload(
    {
      label,
      helperText,
      error,
      required,
      showOptional,
      disabled,
      size = "md",
      id: idProp,
      name,
      className,
      reserveMessageSpace = true,
      accept,
      maxSize,
      maxFiles,
      multiple,
      layout = "zone",
      value,
      defaultValue,
      onChange,
      onReject,
      progress,
      hint,
    },
    _ref,
  ) {
    const { id, messageId, hasError } = useFieldA11y({
      id: idProp,
      error,
      helperText,
      required,
    });

    const isControlled = value !== undefined;
    const [internalFiles, setInternalFiles] = useState<File[]>(
      defaultValue ?? [],
    );
    const files = isControlled ? value ?? [] : internalFiles;

    const [rejections, setRejections] = useState<FileRejection[]>([]);

    const resolvedMaxFiles =
      maxFiles ?? (multiple ? Infinity : 1);

    const commit = useCallback(
      (next: File[]) => {
        if (!isControlled) setInternalFiles(next);
        onChange?.(next);
      },
      [isControlled, onChange],
    );

    const handleDrop = useCallback(
      (accepted: File[], rejected: FileRejection[]) => {
        setRejections(rejected);
        onReject?.(rejected);

        // Merge new accepts with existing, respecting maxFiles.
        const merged =
          resolvedMaxFiles === 1
            ? accepted.slice(0, 1)
            : [...files, ...accepted].slice(0, resolvedMaxFiles);

        commit(merged);
      },
      [files, resolvedMaxFiles, commit, onReject],
    );

    const handleRemove = useCallback(
      (idx: number) => {
        commit(files.filter((_, i) => i !== idx));
      },
      [files, commit],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop: handleDrop,
      accept: normalizeAccept(accept),
      maxSize,
      maxFiles: resolvedMaxFiles === Infinity ? undefined : resolvedMaxFiles,
      multiple: resolvedMaxFiles !== 1,
      disabled,
    });

    return (
      <FormField
        id={id}
        messageId={messageId}
        label={label}
        helperText={helperText}
        error={error}
        required={required}
        showOptional={showOptional}
        className={className}
        reserveMessageSpace={reserveMessageSpace}
      >
        {layout === "zone" ? (
          <div
            {...getRootProps()}
            className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors duration-fast ease-out ${
              isDragActive
                ? "border-brand-500 bg-brand-50"
                : hasError
                ? "border-error-500"
                : "border-border-default hover:border-border-strong"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError || helperText ? messageId : undefined}
          >
            <input id={id} {...getInputProps({ name })} />
            <ArrowUpTrayIcon className="h-6 w-6 text-fg-tertiary" />
            <div className="text-sm text-fg">
              <span className="font-medium text-brand-600">Click to upload</span>{" "}
              <span className="text-fg-tertiary">or drag &amp; drop</span>
            </div>
            {hint && (
              <p className="text-xs text-fg-tertiary">{hint}</p>
            )}
          </div>
        ) : (
          <div {...getRootProps()}>
            <input id={id} {...getInputProps({ name })} />
            <Button
              type="button"
              variant="secondary"
              leftIcon={<ArrowUpTrayIcon className="h-4 w-4" />}
              disabled={disabled}
            >
              Choose file{resolvedMaxFiles === 1 ? "" : "s"}
            </Button>
            {hint && <p className="mt-1 text-xs text-fg-tertiary">{hint}</p>}
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {files.map((file, idx) => {
              const pct = progress?.[file.name];
              const done = pct === 100;
              return (
                <li
                  key={`${file.name}-${idx}`}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                    done
                      ? "border-success-500 bg-success-50"
                      : "border-border-subtle bg-bg-subtle"
                  }`}
                >
                  <DocumentIcon className="h-4 w-4 shrink-0 text-fg-tertiary" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-fg">{file.name}</p>
                    <p className="text-xs text-fg-tertiary">
                      {formatBytes(file.size)}
                      {pct !== undefined && pct < 100 ? ` · ${pct}%` : ""}
                      {done ? " · Uploaded" : ""}
                    </p>
                    {pct !== undefined && pct < 100 && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-bg-muted">
                        <div
                          className="h-full bg-brand-500 transition-all duration-medium ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    aria-label={`Remove ${file.name}`}
                    className="rounded-sm p-1 text-fg-tertiary hover:bg-bg-muted hover:text-fg transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Rejection list */}
        {rejections.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {rejections.map((r, idx) => (
              <li
                key={`reject-${idx}`}
                className="flex items-start gap-2 rounded-md border border-error-500 bg-error-50 px-3 py-2 text-xs text-error-700"
              >
                <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{r.file.name}</p>
                  <p>{r.errors[0]?.message ?? "Rejected"}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRejections(rejections.filter((_, i) => i !== idx))
                  }
                  aria-label="Dismiss"
                  className="rounded-sm p-1 text-error-600 hover:bg-error-100"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </FormField>
    );
  },
);
