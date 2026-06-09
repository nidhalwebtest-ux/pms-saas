"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { REPORT_GROUPS } from "./reports-config";

export default function ReportsSidebar() {
  const pathname = usePathname();
  const t = useTranslations("reports");
  const [q, setQ] = useState("");

  const groups = REPORT_GROUPS.map((g) => ({
    ...g,
    items: q.trim()
      ? g.items.filter((i) => t(`items.${i.slug}`).toLowerCase().includes(q.trim().toLowerCase()))
      : g.items,
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="rsidebar">
      <div className="rs-search">
        <svg className="ic"><use href="#i-search" /></svg>
        <input
          type="search"
          placeholder={t("search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {groups.map((group) => (
        <div className="rs-group" key={group.key}>
          <div className="rs-group-label">
            {t(`groups.${group.key}`)} <span className="count">{group.items.length}</span>
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
                {t(`items.${item.slug}`)}
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
          <strong>{t("newReport")}</strong>
          <div style={{ fontSize: "10.5px", color: "var(--gray-500)", marginTop: "1px" }}>
            {t("newReportHint")}
          </div>
        </div>
        <span className="soon">{t("soon")}</span>
      </button>
    </aside>
  );
}
