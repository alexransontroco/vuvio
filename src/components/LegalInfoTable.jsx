export default function LegalInfoTable({ rows }) {
  return (
    <div className="legal-info-table">
      {rows.map((row) => (
        <article key={`${row.label}-${row.value}`}>
          <strong>{row.label}</strong>
          <span>{row.value}</span>
          {row.basis ? <small>{row.basis}</small> : null}
        </article>
      ))}
    </div>
  );
}
