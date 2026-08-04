import { ChevronRight, Download, MessageCircle, WandSparkles } from 'lucide-react';

const actions = [
  { id: 'reply', title: 'Reply to messages', text: '12 unanswered', icon: MessageCircle },
  { id: 'highlight', title: 'Create Highlight', text: 'Share your best moment', icon: WandSparkles },
  { id: 'download', title: 'Download Stats', text: 'PDF / CSV', icon: Download },
];

export default function PostLiveActions({ onAction, onFeedback }) {
  return (
    <section className="post-live-actions" aria-label="Post-live actions">
      <div className="post-live-actions__grid">
        {actions.map(({ id, title, text, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onAction(id)}>
            <span><Icon size={22} /></span>
            <strong>{title}</strong>
            <small>{text}</small>
          </button>
        ))}
      </div>
      <button type="button" className="post-live-actions__feedback" onClick={onFeedback}>
        <span>How was this live?</span>
        <ChevronRight size={21} />
      </button>
    </section>
  );
}
