import { ChevronDown } from 'lucide-react';

const colors = ['#50a8ff', '#65d8c4', '#f8c751', '#ff9863', '#7fb7ff'];

export default function SynchronizedChat({ messages, activeTime }) {
  return (
    <aside className="synchronized-chat" aria-label="Synchronized live chat">
      <header>
        <h2>Live Chat (during this moment)</h2>
        <button type="button" aria-label="Collapse chat"><ChevronDown size={18} /></button>
      </header>
      <div className="synchronized-chat__messages">
        {messages.map(([time, user, message], index) => (
          <div key={`${time}-${user}-${message}`} className="synchronized-chat__row">
            <time>{time}</time>
            <span className="live-recap-avatar" style={{ '--avatar-bg': colors[index % colors.length] }}>{user.slice(0, 1)}</span>
            <p><strong>{user}</strong><span>•</span>{message}</p>
          </div>
        ))}
      </div>
      <button type="button" className="synchronized-chat__more">+ 38 more messages near {activeTime}</button>
    </aside>
  );
}
