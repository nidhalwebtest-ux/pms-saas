"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { toast } from "sonner";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code, Code2, Columns3, Film, Heading2, Heading3, Heading4,
  Highlighter, ImageIcon, Info, Italic, Link2, List, ListOrdered, Loader2, Minus, Palette, Pilcrow, Quote, Redo2,
  Rows3, Strikethrough, Table2, Trash2, Underline, Undo2, Unlink, MonitorPlay,
} from "lucide-react";
import { buildExtensions, CALLOUT_TYPES, type CalloutType } from "./extensions";
import { uploadBlogMedia } from "./upload";
import "@/styles/blog-prose.css";

const TEXT_COLORS = ["#0f172a", "#185FA5", "#0E7C66", "#B45309", "#B91C1C", "#7C3AED", "#64748B"];
const HIGHLIGHTS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA"];
const CALLOUT_LABEL: Record<CalloutType, string> = { info: "Info", tip: "Tip", warning: "Warning", success: "Success" };

export interface RichTextEditorProps {
  initialContent: JSONContent | null;
  dir: "ltr" | "rtl";
  placeholder?: string;
  onChange: (doc: { json: JSONContent; html: string }) => void;
}

export default function RichTextEditor({ initialContent, dir, placeholder = "Start writing…", onChange }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [uploading, setUploading] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);

  async function insertFiles(files: File[], pos?: number) {
    const ed = editorRef.current;
    if (!ed) return;
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      if (!isVideo && !file.type.startsWith("image/")) continue;
      setUploading(isVideo ? "Uploading video…" : "Uploading image…");
      try {
        const url = await uploadBlogMedia(file);
        const chain = ed.chain().focus();
        if (pos != null) chain.setTextSelection(pos);
        if (isVideo) chain.setVideo({ src: url }).run();
        else chain.setImage({ src: url, alt: "" }).run();
        if (!isVideo) toast.info("Image added — describe it in the Alt text field (needed for SEO).");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(null);
      }
    }
  }

  const editor = useEditor({
    extensions: buildExtensions(placeholder),
    content: initialContent ?? "",
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: "blog-prose blog-prose--editor focus:outline-none", dir },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || !files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertFiles(files, pos);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        void insertFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current({ json: editor.getJSON(), html: editor.getHTML() }),
  });
  editorRef.current = editor;

  // Text direction follows the language tab.
  useEffect(() => {
    editor?.setOptions({ editorProps: { ...editor.options.editorProps, attributes: { class: "blog-prose blog-prose--editor focus:outline-none", dir } } });
  }, [editor, dir]);

  if (!editor) {
    return <div className="h-[420px] animate-pulse rounded-xl border border-border-default bg-canvas" />;
  }

  const words = editor.storage.characterCount?.words?.() ?? 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
      <Toolbar editor={editor} onFiles={insertFiles} />
      <ContextBar editor={editor} />
      <div className="relative max-h-[70vh] min-h-[420px] overflow-y-auto px-5 py-6 sm:px-8" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
        {uploading && (
          <div className="sticky bottom-3 mx-auto flex w-max items-center gap-2 rounded-full bg-fg px-3 py-1.5 text-xs text-white shadow-lg">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {uploading}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border-default bg-canvas px-4 py-2 text-[11px] text-fg-tertiary">
        <span>Tip: drag & drop or paste images and videos straight into the text.</span>
        <span className="tabular-nums">{words.toLocaleString()} words</span>
      </div>
    </div>
  );
}

/* ── Toolbar ──────────────────────────────────────────────────────────────── */

function Btn({ active, disabled, title, onClick, children }: { active?: boolean; disabled?: boolean; title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-fg-secondary transition-colors hover:bg-subtle hover:text-fg disabled:opacity-35 disabled:hover:bg-transparent ${
        active ? "bg-brand-50 text-brand-700 hover:bg-brand-100 hover:text-brand-800" : ""
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-border-default" aria-hidden="true" />;

function Popover({ trigger, children, open, setOpen }: { trigger: ReactNode; children: ReactNode; open: boolean; setOpen: (v: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open, setOpen]);
  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className="absolute start-0 top-full z-30 mt-1.5 min-w-[240px] rounded-xl border border-border-default bg-surface p-3 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

function UrlPopover({ icon, title, label, placeholder, active, initial, onSubmit, onOpen }: {
  icon: ReactNode; title: string; label: string; placeholder: string; active?: boolean; initial?: string;
  onSubmit: (url: string) => void; onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  return (
    <Popover
      open={open}
      setOpen={setOpen}
      trigger={<Btn title={title} active={active} onClick={() => { setUrl(initial ?? ""); onOpen?.(); setOpen(!open); }}>{icon}</Btn>}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(url.trim()); setOpen(false); }}
        className="space-y-2"
      >
        <label className="block text-xs font-medium text-fg-secondary">{label}</label>
        <input
          autoFocus
          dir="ltr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          className="w-72 rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
        />
        <div className="flex justify-end">
          <button type="submit" className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">Apply</button>
        </div>
      </form>
    </Popover>
  );
}

function SwatchPopover({ icon, title, colors, active, onPick, onClear }: {
  icon: ReactNode; title: string; colors: string[]; active?: boolean; onPick: (c: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} setOpen={setOpen} trigger={<Btn title={title} active={active} onClick={() => setOpen(!open)}>{icon}</Btn>}>
      <div className="flex items-center gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onPick(c); setOpen(false); }}
            className="h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110"
            style={{ background: c }}
          />
        ))}
        <button
          type="button"
          onClick={() => { onClear(); setOpen(false); }}
          className="ms-1 rounded-md px-2 py-1 text-xs text-fg-secondary hover:bg-subtle"
        >
          Clear
        </button>
      </div>
    </Popover>
  );
}

function Toolbar({ editor, onFiles }: { editor: Editor; onFiles: (files: File[]) => void }) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const c = () => editor.chain().focus();
  const inTable = editor.isActive("table");

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-border-default bg-surface/95 px-2 py-1.5 backdrop-blur">
      <Btn title="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 className="h-4 w-4" /></Btn>
      <Btn title="Redo (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 className="h-4 w-4" /></Btn>
      <Sep />
      <Btn title="Paragraph" active={editor.isActive("paragraph")} onClick={() => c().setParagraph().run()}><Pilcrow className="h-4 w-4" /></Btn>
      <Btn title="Heading 2 (section)" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Btn>
      <Btn title="Heading 3 (sub-section)" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Btn>
      <Btn title="Heading 4" active={editor.isActive("heading", { level: 4 })} onClick={() => c().toggleHeading({ level: 4 }).run()}><Heading4 className="h-4 w-4" /></Btn>
      <Sep />
      <Btn title="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></Btn>
      <Btn title="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></Btn>
      <Btn title="Underline (Ctrl+U)" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()}><Underline className="h-4 w-4" /></Btn>
      <Btn title="Strikethrough" active={editor.isActive("strike")} onClick={() => c().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Btn>
      <Btn title="Inline code" active={editor.isActive("code")} onClick={() => c().toggleCode().run()}><Code className="h-4 w-4" /></Btn>
      <SwatchPopover
        icon={<Palette className="h-4 w-4" />}
        title="Text colour"
        colors={TEXT_COLORS}
        active={!!editor.getAttributes("textStyle").color}
        onPick={(col) => c().setColor(col).run()}
        onClear={() => c().unsetColor().run()}
      />
      <SwatchPopover
        icon={<Highlighter className="h-4 w-4" />}
        title="Highlight"
        colors={HIGHLIGHTS}
        active={editor.isActive("highlight")}
        onPick={(col) => c().setHighlight({ color: col }).run()}
        onClear={() => c().unsetHighlight().run()}
      />
      <UrlPopover
        icon={<Link2 className="h-4 w-4" />}
        title="Link"
        label="Link URL — use /blog/… or /login?mode=signup for internal links"
        placeholder="https://… or /blog/en/…"
        active={editor.isActive("link")}
        initial={editor.getAttributes("link").href}
        onSubmit={(url) =>
          url ? c().extendMarkRange("link").setLink({ href: url }).run() : c().extendMarkRange("link").unsetLink().run()
        }
      />
      <Sep />
      <Btn title="Align start" active={editor.isActive({ textAlign: "left" })} onClick={() => c().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Btn>
      <Btn title="Align centre" active={editor.isActive({ textAlign: "center" })} onClick={() => c().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Btn>
      <Btn title="Align end" active={editor.isActive({ textAlign: "right" })} onClick={() => c().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Btn>
      <Btn title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => c().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4" /></Btn>
      <Sep />
      <Btn title="Bulleted list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></Btn>
      <Btn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Btn>
      <Btn title="Quote" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Btn>
      <Btn title="Callout box" active={editor.isActive("callout")} onClick={() => c().toggleCallout("info").run()}><Info className="h-4 w-4" /></Btn>
      <Btn title="Code block" active={editor.isActive("codeBlock")} onClick={() => c().toggleCodeBlock().run()}><Code2 className="h-4 w-4" /></Btn>
      <Btn title="Divider" onClick={() => c().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Btn>
      <Sep />
      <Btn title="Upload image" onClick={() => imageInput.current?.click()}><ImageIcon className="h-4 w-4" /></Btn>
      <Btn title="Upload video (MP4/WebM, max 50 MB)" onClick={() => videoInput.current?.click()}><Film className="h-4 w-4" /></Btn>
      <UrlPopover
        icon={<MonitorPlay className="h-4 w-4" />}
        title="Embed YouTube video"
        label="YouTube video URL"
        placeholder="https://www.youtube.com/watch?v=…"
        onSubmit={(url) => {
          if (!url) return;
          if (!c().setYoutubeVideo({ src: url }).run()) toast.error("That doesn't look like a YouTube URL");
        }}
      />
      <Btn title="Insert table" active={inTable} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></Btn>

      {inTable && (
        <>
          <Sep />
          <Btn title="Add row below" onClick={() => c().addRowAfter().run()}><Rows3 className="h-4 w-4" /></Btn>
          <Btn title="Add column after" onClick={() => c().addColumnAfter().run()}><Columns3 className="h-4 w-4" /></Btn>
          <button type="button" onClick={() => c().deleteRow().run()} className="rounded-md px-2 py-1 text-xs text-fg-secondary hover:bg-subtle">− Row</button>
          <button type="button" onClick={() => c().deleteColumn().run()} className="rounded-md px-2 py-1 text-xs text-fg-secondary hover:bg-subtle">− Column</button>
          <button type="button" onClick={() => c().toggleHeaderRow().run()} className="rounded-md px-2 py-1 text-xs text-fg-secondary hover:bg-subtle">Header row</button>
          <Btn title="Delete table" onClick={() => c().deleteTable().run()}><Trash2 className="h-4 w-4 text-red-600" /></Btn>
        </>
      )}

      <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </div>
  );
}

/* ── Context bar: properties of the selected image / callout / link ───────── */

function ContextBar({ editor }: { editor: Editor }) {
  if (editor.isActive("image")) {
    const { alt = "", title = "" } = editor.getAttributes("image") as { alt?: string; title?: string };
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs">
        <span className="font-semibold text-amber-900">Image</span>
        <label className="flex flex-1 items-center gap-1.5">
          <span className="text-amber-900">Alt text*</span>
          <input
            value={alt ?? ""}
            onChange={(e) => editor.chain().updateAttributes("image", { alt: e.target.value }).run()}
            placeholder="Describe the image for Google & screen readers"
            className={`min-w-[220px] flex-1 rounded-md border bg-white px-2 py-1 ${alt ? "border-amber-200" : "border-red-300"}`}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-amber-900">Title</span>
          <input
            value={title ?? ""}
            onChange={(e) => editor.chain().updateAttributes("image", { title: e.target.value }).run()}
            placeholder="Optional tooltip"
            className="w-44 rounded-md border border-amber-200 bg-white px-2 py-1"
          />
        </label>
        <button type="button" onClick={() => editor.chain().focus().deleteSelection().run()} className="rounded-md px-2 py-1 text-red-700 hover:bg-red-50">
          Remove
        </button>
      </div>
    );
  }
  if (editor.isActive("callout")) {
    const type = (editor.getAttributes("callout").type ?? "info") as CalloutType;
    return (
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border-default bg-canvas px-3 py-2 text-xs">
        <span className="me-1 font-semibold text-fg-secondary">Callout style</span>
        {CALLOUT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => editor.chain().focus().setCalloutType(t).run()}
            className={`rounded-full border px-2.5 py-0.5 ${type === t ? "border-brand-400 bg-brand-50 text-brand-700" : "border-border-default text-fg-secondary hover:bg-subtle"}`}
          >
            {CALLOUT_LABEL[t]}
          </button>
        ))}
        <button type="button" onClick={() => editor.chain().focus().toggleCallout(type).run()} className="ms-auto rounded-md px-2 py-1 text-fg-secondary hover:bg-subtle">
          Remove box
        </button>
      </div>
    );
  }
  if (editor.isActive("link")) {
    const href = editor.getAttributes("link").href as string;
    return (
      <div className="flex items-center gap-2 border-b border-border-default bg-canvas px-3 py-2 text-xs">
        <Link2 className="h-3.5 w-3.5 text-fg-tertiary" />
        <a href={href} target="_blank" rel="noreferrer" dir="ltr" className="max-w-[60%] truncate text-brand-600 hover:underline">{href}</a>
        <button type="button" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()} className="ms-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-fg-secondary hover:bg-subtle">
          <Unlink className="h-3.5 w-3.5" /> Remove link
        </button>
      </div>
    );
  }
  return null;
}
