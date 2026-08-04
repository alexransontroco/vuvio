import { Eye, TrendingUp, Users, MessageSquare, UserPlus } from 'lucide-react';

const iconMap = {
  viewers: Eye,
  peak: TrendingUp,
  followers: UserPlus,
  messages: MessageSquare,
  reactions: MessageSquare,
};

export default function LiveSummaryStats({ liveData }) {
  if (!liveData) return null;

  const stats = [
    {
      id: 'viewers',
      label: 'Total viewers',
      value: liveData.uniqueViewers || liveData.currentViewerCount || 0,
      icon: 'viewers',
    },
    {
      id: 'peak',
      label: 'Peak concurrent',
      value: liveData.peakViewerCount || liveData.peakConcurrentViewers || 0,
      icon: 'peak',
    },
    {
      id: 'followers',
      label: 'New followers',
      value: liveData.followersGained || 0,
      icon: 'followers',
    },
    {
      id: 'messages',
      label: 'Chat messages',
      value: liveData.messagesCount || liveData.chatMessages?.length || 0,
      icon: 'messages',
    },
  ];

  return (
    <section className="live-summary-stats">
      <h2 className="live-summary-stats__title">Session Recap</h2>
      <div className="live-summary-stats__grid">
        {stats.map((stat) => {
          const Icon = iconMap[stat.icon] || Eye;
          return (
            <div key={stat.id} className="live-summary-stat-card">
              <div className="live-summary-stat-card__icon">
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <div className="live-summary-stat-card__content">
                <strong className="live-summary-stat-card__value">{stat.value}</strong>
                <span className="live-summary-stat-card__label">{stat.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
