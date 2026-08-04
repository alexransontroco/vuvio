export default function SegmentedControl({ items, value, onChange, className = '' }) {
  return (
    <div className={`segmented ${className}`} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={item.value === value ? 'is-active' : ''}
          onClick={() => onChange(item.value)}
          role="tab"
          aria-selected={item.value === value}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
