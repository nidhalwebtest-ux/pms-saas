export default function ComingSoon({ title }: { title: string }) {
  return (
    <main className="rpage">
      <div className="crumbs">
        <span>Reports</span>
        <svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{title}</span>
      </div>
      <div className="rhead">
        <div className="title-block">
          <h1>{title}</h1>
          <p className="sub">This report is being built.</p>
        </div>
      </div>
      <div className="state-card">
        <div className="glyph">
          <svg width="28" height="28"><use href="#i-empty" /></svg>
        </div>
        <h3>Coming soon</h3>
        <p>
          The <strong>{title}</strong> report isn’t available yet. We’re building the
          reports one by one — check back shortly.
        </p>
      </div>
    </main>
  );
}
