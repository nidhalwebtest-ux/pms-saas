"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  CameraIcon,
  EyeIcon,
  XMarkIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

export interface ImageUploadProps
  extends Omit<BaseFieldProps, "loading" | "success" | "readOnly"> {
  /** Maximum file size in bytes. Default 5 MB. */
  maxSize?: number;

  /** Maximum number of images. Default 1. */
  maxFiles?: number;

  /** Allow multiple selection. Convenience alias for `maxFiles > 1`. */
  multiple?: boolean;

  /** Controlled list of File objects. */
  value?: File[];

  /** Uncontrolled initial value. */
  defaultValue?: File[];

  /** Fires whenever the accepted list changes. */
  onChange?: (files: File[]) => void;

  /** Fires when react-dropzone rejects images. */
  onReject?: (rejections: FileRejection[]) => void;

  /**
   * Capture-mode hint for mobile: "user" (front camera) or "environment"
   * (back camera). Adds the `capture` attribute to the underlying input.
   */
  capture?: "user" | "environment";

  /** Hint text inside the dropzone. */
  hint?: ReactNode;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export const ImageUpload = forwardRef<HTMLInputElement, ImageUploadProps>(
  function ImageUpload(
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
      maxSize = DEFAULT_MAX_SIZE,
      maxFiles,
      multiple,
      value,
      defaultValue,
      onChange,
      onReject,
      capture,
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
    const [previews, setPreviews] = useState<string[]>([]);

    // Generate object-URL previews and clean up on unmount / change.
    useEffect(() => {
      const urls = files.map((f) => URL.createObjectURL(f));
      setPreviews(urls);
      return () => urls.forEach((u) => URL.revokeObjectURL(u));
    }, [files]);

    const resolvedMaxFiles = maxFiles ?? (multiple ? Infinity : 1);

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
      accept: { "image/*": [] },
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
          <input
            id={id}
            {...getInputProps({
              name,
              capture: capture as "user" | "environment" | undefined,
            })}
          />
          <CameraIcon className="h-6 w-6 text-fg-tertiary" />
          <div className="text-sm text-fg">
            <span className="font-medium text-brand-600">Click to upload</span>{" "}
            <span className="text-fg-tertiary">or drag &amp; drop</span>
          </div>
          {hint && <p className="text-xs text-fg-tertiary">{hint}</p>}
        </div>

        {/* Thumbnail grid */}
        {files.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((file, idx) => (
              <figure
                key={`${file.name}-${idx}`}
                className="group relative aspect-square overflow-hidden rounded-md border border-border-subtle"
              >
                {previews[idx] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previews[idx]}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-fast ease-out group-hover:bg-black/40" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 p-1 opacity-0 transition-opacity duration-fast ease-out group-hover:opacity-100">
                  <a
                    href={previews[idx]}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-fg shadow-sm hover:bg-white"
                    aria-label="View image"
                  >
                    <EyeIcon className="h-3 w-3" /> View
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(idx);
                    }}
                    aria-label={`Remove ${file.name}`}
                    className="inline-flex items-center justify-center rounded-sm bg-white/90 p-1 text-fg hover:bg-white"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </figure>
            ))}
          </div>
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
