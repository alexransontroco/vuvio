import { Send, X } from 'lucide-react';
import { useState } from 'react';

export default function ReplyDrawer({ open, conversation, onClose }) {
  const [message, setMessage] = useState('');

  if (!open || !conversation) return null;

  const handleSend = () => {
    setMessage('');
    onClose();
  };

  return (
    <div className="live-recap-overlay" role="presentation" onMouseDown={onClose}>
      <aside className="reply-drawer" role="dialog" aria-modal="true" aria-label="Reply to viewers" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="live-recap-avatar live-recap-avatar--photo">{conversation.avatars[0]}</span>
            <div>
              <p>Reply after live</p>
              <h2>{conversation.label}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close reply drawer"><X size={20} /></button>
        </header>
        <div className="reply-drawer__question">
          <time>{conversation.timestamp}</time>
          <strong>{conversation.question}</strong>
          <span>{conversation.groupedText}</span>
        </div>
        <label>
          <span>Your reply</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write one answer for the grouped discussion..."
            rows={6}
          />
        </label>
        <button type="button" className="reply-drawer__send" onClick={handleSend} disabled={!message.trim()}>
          <Send size={17} />
          Send reply
        </button>
      </aside>
    </div>
  );
}
