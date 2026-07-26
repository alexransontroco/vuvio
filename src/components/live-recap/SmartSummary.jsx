import { Bot } from 'lucide-react';

export default function SmartSummary({ summary, tags }) {
  return (
    <section className="smart-summary">
      <header>
        <Bot size={20} />
        <h2>Smart Summary</h2>
      </header>
      <p>{summary}</p>
      <div className="smart-summary__tags">
        {tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
    </section>
  );
}
