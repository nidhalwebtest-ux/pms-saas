import { escHtml } from "../html";

export interface TimelineStep {
  label: string;
  sublabel?: string;
  state: "done" | "current" | "pending" | "rejected";
}

/** Generalization of expense's .steps workflow timeline (submitted -> reviewed -> processed) to N steps. */
export function renderWorkflowTimeline(steps: TimelineStep[]): string {
  const items = steps
    .map(
      (s) => `
    <div class="step state-${s.state}">
      <div class="dot"></div>
      <div>
        <div class="step-label">${escHtml(s.label)}</div>
        ${s.sublabel ? `<div class="step-sublabel">${escHtml(s.sublabel)}</div>` : ""}
      </div>
    </div>`,
    )
    .join("");
  return `<div class="timeline">${items}</div>`;
}
