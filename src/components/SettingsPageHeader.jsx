import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SettingsPageHeader({ title }) {
  const navigate = useNavigate();

  return (
    <header className="support-page-header">
      <button type="button" onClick={() => navigate(-1)} aria-label="Back">
        <ChevronLeft size={20} strokeWidth={1.9} />
      </button>
      <h1>{title}</h1>
      <span aria-hidden="true" />
    </header>
  );
}
