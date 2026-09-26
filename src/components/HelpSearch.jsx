import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HelpSearch({ value, onChange }) {
  const { t } = useTranslation();

  return (
    <label className="help-search">
      <span>{t('help.search.label')}</span>
      <Search size={17} strokeWidth={1.8} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('help.search.placeholder')}
      />
    </label>
  );
}
