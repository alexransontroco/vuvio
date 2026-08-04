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
      <aside
        className="reply-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Reply to viewers"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="reply-drawer__handle" aria-hidden="true" />
        <header>
          <div>
            <span className="live-recap-avatar live-recap-avatar--photo">{conversation.avatars[0]}</span>
            <div>
              <p>Reply after live</p>
              <h2>{conversation.label}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
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
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write one reply for everyone…"
            rows={5}
          />
        </label>
        <button
          type="button"
          className="reply-drawer__send"
          onClick={handleSend}
          disabled={!message.trim()}
        >
          <Send size={16} />
          Send reply
        </button>
      </aside>
    </div>
  );
}
