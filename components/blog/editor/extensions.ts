import { Node, mergeAttributes, type Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder, CharacterCount } from "@tiptap/extensions";

export const CALLOUT_TYPES = ["info", "tip", "warning", "success"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Wrap the selection in a callout box, or unwrap it. */
      toggleCallout: (type: CalloutType) => ReturnType;
      setCalloutType: (type: CalloutType) => ReturnType;
    };
    video: {
      setVideo: (attrs: { src: string; title?: string }) => ReturnType;
    };
  }
}

/** Highlighted box: <div data-callout="tip">…</div> (styled in styles/blog-prose.css). */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      type: {
        default: "info",
        parseHTML: (el) => el.getAttribute("data-callout") || "info",
        renderHTML: (attrs) => ({ "data-callout": attrs.type }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleCallout:
        (type) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { type }),
      setCalloutType:
        (type) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { type }),
    };
  },
});

/** Uploaded video file: <div data-video><video src controls></video></div>. */
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, title: { default: null } };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-video]",
        getAttrs: (el) => {
          const v = (el as HTMLElement).querySelector("video");
          return v ? { src: v.getAttribute("src"), title: v.getAttribute("title") } : false;
        },
      },
      { tag: "video[src]", getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute("src"), title: (el as HTMLElement).getAttribute("title") }) },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-video": "" },
      ["video", { src: HTMLAttributes.src, title: HTMLAttributes.title, controls: "true", preload: "metadata", playsinline: "true" }],
    ];
  },
  addCommands() {
    return {
      setVideo:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

export function buildExtensions(placeholder: string): Extensions {
  return [
    StarterKit.configure({
      // H1 is reserved for the article title.
      heading: { levels: [2, 3, 4] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: null, target: null },
      },
    }),
    Image.configure({ allowBase64: false }),
    Youtube.configure({ nocookie: true, modestBranding: true, width: 640, height: 360 }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === "heading" ? "Heading" : placeholder),
    }),
    CharacterCount,
    Callout,
    Video,
  ];
}
