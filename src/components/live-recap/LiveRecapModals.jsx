import { Check, Link, X } from 'lucide-react';

export function SimpleModal({ type, onClose, onConfirm }) {
  if (!type) return null;

  const content = {
    share: ['Share Recap', 'Copy a private recap link or use native sharing when available.', 'Copy link'],
    menu: ['More Options', 'Archive replay, edit visibility, or report a playback issue.', 'Done'],
    highlight: ['Create Highlight', 'Draft a clip from the active replay moment and share it with followers.', 'Create draft'],
    download: ['Download Stats', 'A sample CSV export has been prepared for this mock recap.', 'Download sample'],
    feedback: ['How was this live?', 'Rate the debrief quality so Vuvio can improve future recaps.', 'Submit feedback'],
    player: ['Full Player', 'The production version will open the Cloudflare replay with synced chat.', 'Close'],
  }[type];

  return (
    <div className="live-recap-overlay" role="presentation" onMouseDown={onClose}>
      <section className="live-recap-modal" role="dialog" aria-modal="true" aria-label={content[0]} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="live-recap-modal__close" onClick={onClose} aria-label="Close modal"><X size={20} /></button>
        <span className="live-recap-modal__icon">{type === 'share' ? <Link size={22} /> : <Check size={22} />}</span>
        <h2>{content[0]}</h2>
        <p>{content[1]}</p>
        <button type="button" onClick={onConfirm ?? onClose}>{content[2]}</button>
      </section>
    </div>
  );
}
