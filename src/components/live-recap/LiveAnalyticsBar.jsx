import { BarChart3, MessageCircle, Star, UserPlus, UsersRound } from 'lucide-react';

const iconMap = {
  users: UsersRound,
  chart: BarChart3,
  star: Star,
  userPlus: UserPlus,
  message: MessageCircle,
};

export default function LiveAnalyticsBar({ stats }) {
  return (
    <section className="live-analytics-bar" aria-label="Live analytics summary">
      {stats.map((stat) => {
        const Icon = iconMap[stat.icon] ?? BarChart3;
        return (
          <article key={stat.id} className="live-analytics-bar__item">
            <div className="live-analytics-bar__icon"><Icon size={18} /></div>
            <div>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              {stat.trend ? <span>↗ {stat.trend}</span> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
