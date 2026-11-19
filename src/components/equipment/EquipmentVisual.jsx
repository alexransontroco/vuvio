import { useState } from 'react';
import { getEquipmentVisual } from '../../data/equipmentVisual.js';
import './equipment-visual.css';

export default function EquipmentVisual({ equipment, className = '', size = 24, priority = false, usage = 'persistent-gear' }) {
  const { imageUrl, icon: Icon, category } = getEquipmentVisual(equipment, usage);
  const [failedUrl, setFailedUrl] = useState(null);
  return (
    <span className={`equipment-visual equipment-visual--${category} ${className}`.trim()} data-visual={imageUrl && failedUrl !== imageUrl ? 'image' : 'icon'}>
      {imageUrl && failedUrl !== imageUrl ? (
        <img src={imageUrl} alt="" loading={priority ? 'eager' : 'lazy'} onError={() => setFailedUrl(imageUrl)} />
      ) : <Icon size={size} strokeWidth={1.65} aria-hidden="true" />}
    </span>
  );
}
