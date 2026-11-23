import { Trash2, Edit, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCategoryById, getActivityById, formatGearItem } from '../../services/gearService';
import './gear-item-card.css';

/**
 * Display card for a user's gear item
 * Shows brand, model, activity, category, and actions
 */
export function GearItemCard({
  item,
  compact = false,
  onEdit = null,
  onRemove = null,
}) {
  const { t } = useTranslation();
  const category = getCategoryById(item.categoryId);
  const activity = getActivityById(item.activityId);
  const displayName = formatGearItem(item);

  return (
    <article className={`gear-item-card ${compact ? 'is-compact' : ''}`}>
      <div className="gear-item-card__content">
        <div className="gear-item-card__header">
          <h3 className="gear-item-card__title">{displayName}</h3>
          {item.source === 'manual' && (
            <span className="gear-item-card__badge">{t('gearManager.custom')}</span>
          )}
        </div>

        <div className="gear-item-card__meta">
          {activity && (
            <span className="gear-item-card__meta-item">
            <span className="gear-item-card__meta-label">{t(`gearManager.activities.${activity.id}`, { defaultValue: activity.label })}</span>
            </span>
          )}
          {category && (
            <span className="gear-item-card__meta-item">
            <span className="gear-item-card__meta-label">{t(`gearManager.categories.${category.id}`, { defaultValue: category.label })}</span>
            </span>
          )}
          {item.year && (
            <span className="gear-item-card__meta-item">
              <span className="gear-item-card__meta-label">{item.year}</span>
            </span>
          )}
        </div>

        {item.notes && !compact && (
          <p className="gear-item-card__notes">{item.notes}</p>
        )}
      </div>

      <div className="gear-item-card__actions">
        {item.productUrl && (
          <a
            href={item.productUrl}
            target="_blank"
            rel="noreferrer"
            className="gear-item-card__action gear-item-card__action--link"
            title={t('gearManager.viewProduct')}
            aria-label={t('gearManager.viewProduct')}
          >
            <LinkIcon size={16} strokeWidth={1.8} />
          </a>
        )}

        {onEdit && (
          <button
            type="button"
            className="gear-item-card__action gear-item-card__action--edit"
            onClick={onEdit}
            title={t('gearManager.edit')}
            aria-label={t('gearManager.editGear')}
          >
            <Edit size={16} strokeWidth={1.8} />
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            className="gear-item-card__action gear-item-card__action--remove"
            onClick={onRemove}
            title={t('gearManager.remove')}
            aria-label={t('gearManager.removeGear')}
          >
            <Trash2 size={16} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </article>
  );
}

export default GearItemCard;
