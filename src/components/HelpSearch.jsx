import { Search } from 'lucide-react';

export default function HelpSearch({ value, onChange }) {
  return (
    <label className="help-search">
      <span>Search a question</span>
      <Search size={17} strokeWidth={1.8} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search a question..."
      />
    </label>
  );
}
