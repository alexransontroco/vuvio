export default function LegalSection({ id, title, children }) {
  return (
    <section className="legal-section" id={id}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
