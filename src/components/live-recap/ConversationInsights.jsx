import { ArrowRight, Heart, HelpCircle, MessageCircle, Mountain, UsersRound } from 'lucide-react';

const cardIcons = {
  camera: HelpCircle,
  downhill: Heart,
  trail: Mountain,
  unanswered: HelpCircle,
};

function AvatarStack({ avatars }) {
  return (
    <span className="live-recap-avatar-stack" aria-label={`${avatars.length} viewers`}>
      {avatars.map((avatar) => <span key={avatar}>{avatar}</span>)}
    </span>
  );
}

export function ConversationInsightCard({ item, onOpen }) {
  const Icon = cardIcons[item.id] ?? MessageCircle;
  return (
    <article className={`conversation-card conversation-card--${item.tone}`}>
      <div className="conversation-card__icon"><Icon size={25} /></div>
      <div className="conversation-card__body">
        <p>{item.label}</p>
        <strong>{item.text}</strong>
        <div className="conversation-card__meta">
          <AvatarStack avatars={item.avatars} />
          <span>{item.count}</span>
        </div>
      </div>
      <button type="button" onClick={() => onOpen(item)}>
        {item.action}
        {item.action === 'Reply' ? <ArrowRight size={14} /> : null}
      </button>
    </article>
  );
}

export default function ConversationInsights({ conversations, onOpen }) {
  return (
    <section className="live-recap-panel conversation-insights">
      <header className="live-recap-panel__header">
        <div>
          <MessageCircle size={21} />
          <h2>Conversations</h2>
        </div>
        <button type="button" onClick={() => onOpen(conversations[0])}>View all messages</button>
      </header>
      <div className="conversation-insights__list">
        {conversations.map((item) => (
          <ConversationInsightCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
