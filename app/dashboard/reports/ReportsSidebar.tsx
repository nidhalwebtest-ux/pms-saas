"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { REPORT_GROUPS } from "./reports-config";

export default function ReportsSidebar() {
  const pathname = usePathname();
  const [q, setQ] = useState("");

  const groups = REPORT_GROUPS.map((g) => ({
    ...g,
    items: q.trim()
      ? g.items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()))
      : g.items,
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="rsidebar">
      <div className="rs-search">
        <svg className="ic"><use href="#i-search" /></svg>
        <input
          type="search"
          placeholder="Search reports…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {groups.map((group) => (
        <div className="rs-group" key={group.key}>
          <div className="rs-group-label">
            {group.label} <span className="count">{group.items.length}</span>
          </div>
          {group.items.map((item) => {
            const href = `/dashboard/reports/${item.slug}`;
            const active = pathname === href;
            return (
              <Link
                key={item.slug}
                href={href}
                className={`rs-item${active ? " active" : ""}`}
              >
                {item.label}
                {item.starred && (
                  <svg className="ic-xs pin"><use href="#i-star" /></svg>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <button className="rs-new" type="button" disabled>
        <span className="plus">+</span>
        <div>
          <strong>New custom report</strong>
          <div style={{ fontSize: "10.5px", color: "var(--gray-500)", marginTop: "1px" }}>
            Drag dimensions &amp; measures
          </div>
        </div>
        <span className="soon">SOON</span>
      </button>
    </aside>
  );
}
