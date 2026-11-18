// Vuvio-Lab permanent UI marker. Rendered once from AppShell.
// Fixed top-left, non-interactive, high z-index. Visible across every route.
// Toggleable via `?nolab=1` query param for screenshots.
import { useMemo } from 'react';

export default function LabBadge() {
  const hidden = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('nolab') === '1';
    } catch {
      return false;
    }
  }, []);
  if (hidden) return null;
  return (
    <div className="lab-badge" role="status" aria-label="Vuvio-Lab experimental environment">
      <span className="lab-badge__dot" aria-hidden="true" />
      <span className="lab-badge__label">LAB</span>
    </div>
  );
}
