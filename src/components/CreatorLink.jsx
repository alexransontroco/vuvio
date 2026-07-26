import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { resolveCreatorProfile } from '../services/profileService.js';

export default function CreatorLink({
  creator,
  className = '',
  compact = false,
  stopPropagation = false,
  showMeta = false,
  metaLabel = '',
}) {
  const { t } = useTranslation();
  const profile = resolveCreatorProfile(creator);
  if (!profile) return null;

  const onClick = (event) => {
    if (stopPropagation) event.stopPropagation();
  };

  return (
    <Link
      to={`/profile/${profile.id}`}
      className={`creator-link ${compact ? 'creator-link--compact' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-label={`${t('common.viewProfile')} ${profile.displayName}`}
    >
      <span className="creator-link__avatar">
        <img src={profile.avatarUrl || '/icons/icon-192.png'} alt="" />
      </span>
      <span className="creator-link__copy">
        <span>
          {profile.displayName}
          {profile.verified ? (
            <i aria-label="Verified creator">
              <Check size={10} strokeWidth={2.4} />
            </i>
          ) : null}
        </span>
        {showMeta ? <small>{metaLabel || profile.profession}</small> : null}
      </span>
    </Link>
  );
}
