import {
  Bell,
  BellRing,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Globe2,
  MessageCircle,
  Play,
  Settings,
  Share2,
  Sparkles,
} from 'lucide-react';

function IconInstagram({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-grad)" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-grad)" />
      <defs>
        <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f9ce34" />
          <stop offset="30%" stopColor="#ee2a7b" />
          <stop offset="65%" stopColor="#9b27af" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconYouTube({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" fill="#FF0000" />
      <polygon points="9.75,15.02 15.5,12 9.75,8.98" fill="white" />
    </svg>
  );
}
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import {
  EquipmentCategoryCard,
  EquipmentDisclosure,
  EquipmentItemRow,
  GearInLive,
} from '../components/equipment/EquipmentKit.jsx';
import { EQUIPMENT_CATEGORIES, demoLiveEquipmentIds } from '../data/equipmentModel.js';
import PlaylistsSection from '../components/profile/PlaylistsSection.jsx';
import { getCreatorProfile } from '../services/profileService.js';
import { isFollowingCreator, setFollowingCreator } from '../services/followService.js';
import { followCreator, unfollowCreator, setLiveNotifications } from '../services/creatorService.js';
import { getOrCreateConversation } from '../services/messagingService.js';
import { useMessaging } from '../context/MessagingContext.jsx';
import { analyticsService } from '../services/analytics/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getEquipmentLibrary,
  getEquipmentLibraryWithProducts,
  getEquipmentSelection,
  groupEquipmentByCategory,
  enrichEquipmentWithProducts,
  normalizeEquipmentItem,
  subscribeToEquipment,
} from '../services/equipmentService.js';
import { getMyScheduledStreams, getScheduledStreams, cancelScheduledStream } from '../services/streamApi.ts';
import ScheduleLiveSheet from '../components/ScheduleLiveSheet.jsx';
import { ACTIVITY_CATEGORIES } from '../data/activityCategories.js';
import NotifPopover from '../components/NotifPopover.jsx';
import { useNotifications } from '../hooks/useNotifications.js';
import SEO, { SITE_URL } from '../components/SEO.jsx';
import { profileDescription, profileUrl } from '../utils/seoData.js';
import { shareVuvioContent } from '../platform/sharing.js';

function formatCompact(value = 0) {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  }

  return String(value);
}

function formatHours(value = 0) {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k h`;
  }

  return `${value} h`;
}

function formatCreatedAt(createdAt) {
  if (!createdAt) return '';
  if (typeof createdAt === 'string') return createdAt;
  if (createdAt.toDate && typeof createdAt.toDate === 'function') {
    try {
      return createdAt.toDate().getFullYear().toString();
    } catch {
      return '';
    }
  }
  if (createdAt instanceof Date) return createdAt.getFullYear().toString();
  return '';
}

function scheduledTimestampToDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  return null;
}

function toProfileUpcomingLive(raw, fallbackLocation = 'Location to be confirmed', fallbackTitle = 'Scheduled live') {
  const date = scheduledTimestampToDate(raw.scheduledStartAt);
  if (!date || !Number.isFinite(date.getTime())) return null;
  const location = [raw.city, raw.countryCode].filter(Boolean).join(', ') || fallbackLocation;
  return {
    id: raw.id,
    status: 'scheduled',
    title: raw.title || fallbackTitle,
    location,
    scheduledAt: date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    thumbnailUrl: null,
    category: raw.category ?? null,
  };
}

function ProfileSkeleton() {
  const { t } = useTranslation();
  return (
    <section className="screen-scroll creator-profile-screen" aria-label={t('profile.loading')}>
      <div className="profile-skeleton profile-skeleton__cover" />
      <div className="creator-profile-content">
        <div className="profile-skeleton profile-skeleton__avatar" />
        <div className="profile-skeleton profile-skeleton__line" />
        <div className="profile-skeleton profile-skeleton__line is-short" />
        <div className="profile-skeleton profile-skeleton__card" />
      </div>
    </section>
  );
}

function ProfileState({ title, children }) {
  return (
    <section className="screen-scroll creator-profile-screen profile-state">
      <h1>{title}</h1>
      <p>{children}</p>
    </section>
  );
}

function ProfileCover({ profile, isOwnProfile, onShare, notifUnread, notifications, notifsLoading, markRead, markAllRead }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const hasCover = Boolean(profile.coverUrl);
  const { unreadCount: msgUnread } = useMessaging();
  const [notifOpen, setNotifOpen] = useState(false);

  const handleNotifNavigate = (target) => { setNotifOpen(false); navigate(target); };

  return (
    <header className={`creator-cover${hasCover ? '' : ' creator-cover--empty'}`}>
      {hasCover ? <img src={profile.coverUrl} alt={t('profile.coverAlt')} /> : null}
      <div className="creator-cover__shade" />
      <div className="creator-cover__topbar">
        <button type="button" className="creator-icon-button" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ChevronLeft size={20} strokeWidth={1.9} />
        </button>
        <div className="creator-cover__actions">
          <Link to="/messages" className="creator-icon-button creator-icon-button--msg" aria-label={t('navigation.messages')}>
            <MessageCircle size={20} strokeWidth={2} />
            {msgUnread > 0 ? (
              <span className="creator-icon-button__badge" aria-label={t('profile.unreadCount', { count: msgUnread })}>
                {msgUnread > 9 ? '9+' : msgUnread}
              </span>
            ) : null}
          </Link>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="creator-icon-button"
              aria-label={t('home.notifications')}
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell size={18} strokeWidth={1.8} />
              {notifUnread > 0 ? (
                <span className="creator-icon-button__badge">
                  {notifUnread > 9 ? '9+' : notifUnread}
                </span>
              ) : null}
            </button>
            {notifOpen ? (
              <NotifPopover
                notifications={notifications}
                loading={notifsLoading}
                unreadCount={notifUnread}
                markRead={markRead}
                markAllRead={markAllRead}
                onClose={() => setNotifOpen(false)}
                onNavigate={handleNotifNavigate}
              />
            ) : null}
          </div>
          <button type="button" className="creator-icon-button" onClick={onShare} aria-label={t('profile.shareProfile')}>
            <Share2 size={18} strokeWidth={1.8} />
          </button>
          {isOwnProfile ? (
            <button type="button" className="creator-icon-button" onClick={() => navigate('/settings')} aria-label={t('common.settings')}>
              <Settings size={18} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

const ADMIN_UIDS = new Set(['22IcpmDqxVeBXHxy3YqdaJ0tJKj1', 'WgovGMq4dFfM6OXwYbtwY1LgHHJ2', 'KIOTxdpPdARO7gDiCCcTWsZYpgD2']);

function ProfileIdentity({ profile, isOwnProfile, userId }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const bioNeedsToggle = profile.bio.length > 145;
  const avatarUrl = profile.avatarUrl || '/assets/icons/icon-192.png';
  const showAdminBadge = isOwnProfile && ADMIN_UIDS.has(userId);

  return (
    <section className="creator-identity" aria-label={t('profile.creatorIdentity')}>
      <div className="creator-identity__avatar-wrap">
        <img className="creator-identity__avatar" src={avatarUrl} alt={t('profile.portraitOf', { name: profile.displayName })} />
      </div>

      <div className="creator-identity__body">
        <h1 className="creator-identity__name">
          {profile.displayName}
          {profile.verified ? (
            <span className="creator-identity__verified" aria-label={t('profile.verifiedCreator')}>
              <Check size={11} strokeWidth={2.6} />
            </span>
          ) : null}
        </h1>
        {showAdminBadge ? (
          <Link to="/admin" className="profile-admin-badge" aria-label={t('profile.adminPanel')}>
            <svg width="13" height="13" viewBox="0 0 96 96" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="pb-grad" x1="16" y1="34" x2="80" y2="34" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#168EF5" />
                  <stop offset="48%" stopColor="#2BD9C8" />
                  <stop offset="100%" stopColor="#1EC8BA" />
                </linearGradient>
              </defs>
              <path d="M16 34 L34 66 L48 44 L62 66 L80 34" stroke="url(#pb-grad)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="48" cy="24" r="9" fill="#3B82F6" />
            </svg>
            {t('profile.admin')}
          </Link>
        ) : null}
        <p className="creator-identity__meta">
          {profile.profession} · {profile.city}, {profile.country}
        </p>
        {isOwnProfile ? (
          <small className="creator-identity__own-note">
            <Eye size={11} aria-hidden="true" />
            {t('profile.visibleToOthers')}
          </small>
        ) : null}
        <p className={expanded ? 'creator-identity__bio is-expanded' : 'creator-identity__bio'}>{profile.bio}</p>
        {bioNeedsToggle ? (
          <button type="button" className="creator-identity__more" onClick={() => setExpanded((value) => !value)}>
            {expanded ? t('common.showLess') : t('common.showMore')}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ProfileActions({
  isOwnProfile,
  isFollowing,
  notificationsEnabled,
  onToggleFollow,
  onToggleNotifications,
  onShare,
  onMessage,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (isOwnProfile) {
    return (
      <section className="creator-identity__actions" aria-label={t('profile.personalActions')}>
        <button type="button" className="creator-follow-button creator-follow-button--primary" onClick={() => navigate('/profile/edit')}>
          {t('profile.editProfile')}
        </button>
        <button type="button" className="creator-secondary-icon" onClick={onShare} aria-label={t('profile.shareMyProfile')}>
          <Share2 size={18} strokeWidth={1.8} />
        </button>
        <button type="button" className="creator-secondary-icon" onClick={() => navigate('/settings')} aria-label={t('profile.openSettings')}>
          <Settings size={18} strokeWidth={1.8} />
        </button>
      </section>
    );
  }

  return (
    <section className="creator-identity__actions" aria-label={t('profile.creatorActions')}>
      <button type="button" className={isFollowing ? 'creator-follow-button is-active' : 'creator-follow-button'} onClick={onToggleFollow}>
        {isFollowing ? t('common.following') : t('common.follow')}
      </button>
      <button type="button" className="creator-follow-button creator-follow-button--message" onClick={onMessage}>
        {t('common.sendMessage')}
      </button>
      <button
        type="button"
        className={notificationsEnabled ? 'creator-notify-button is-active' : 'creator-notify-button'}
        onClick={onToggleNotifications}
        aria-label={notificationsEnabled ? t('profile.disableLiveNotifications') : t('profile.enableLiveNotifications')}
      >
        {notificationsEnabled ? <BellRing size={18} strokeWidth={1.8} /> : <Bell size={18} strokeWidth={1.8} />}
      </button>
      <button type="button" className="creator-secondary-icon" onClick={onShare} aria-label={t('profile.shareProfile')}>
        <Share2 size={18} strokeWidth={1.8} />
      </button>
    </section>
  );
}

function ProfileImageSheet({ type, previewUrl, error, onClose, onSelectFile, onRemove, onSave }) {
  const inputId = `profile-${type}-file`;
  const isAvatar = type === 'avatar';
  const { t } = useTranslation();

  return (
    <div className="profile-image-sheet" role="dialog" aria-modal="true" aria-label={isAvatar ? t('profile.avatarDialog') : t('profile.coverDialog')}>
      <button type="button" className="profile-image-sheet__backdrop" onClick={onClose} aria-label={t('common.close')} />
      <div className="profile-image-sheet__panel">
        <h2>{isAvatar ? t('profile.profilePhoto') : t('profile.cover')}</h2>
        {previewUrl ? (
          <img className={isAvatar ? 'profile-image-sheet__preview is-avatar' : 'profile-image-sheet__preview'} src={previewUrl} alt={t('profile.localPreview')} />
        ) : null}
        {error ? <p className="profile-image-sheet__error">{error}</p> : null}
        <label htmlFor={inputId}>{t('profile.takePhoto')}</label>
        <label htmlFor={inputId}>{t('profile.chooseFromLibrary')}</label>
        <button type="button" onClick={onRemove}>{isAvatar ? t('profile.removePhoto') : t('profile.removeCover')}</button>
        <button type="button" className="is-primary" disabled={!previewUrl} onClick={onSave}>{t('common.save')}</button>
        <button type="button" onClick={onClose}>{t('common.cancel')}</button>
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" onChange={onSelectFile} />
      </div>
    </div>
  );
}

function ProfileStats({ profile, isOwnProfile, onViewFollowing }) {
  const { t } = useTranslation();
  const followingCount = Array.isArray(profile.followedCreators)
    ? profile.followedCreators.length
    : (profile.followingCount ?? 0);
  const isStreamer = (profile.liveCount ?? 0) > 0;
  const mainStats = [
    { value: profile.liveCount, key: 'lives', label: t('profile.statsLives') },
    { value: formatCompact(profile.followersCount), key: 'followers', label: t('profile.statsFollowers') },
    { value: formatCompact(followingCount), key: 'following', label: t('profile.statsFollowing'), clickable: isOwnProfile },
  ];
  const streamerStats = [
    { value: formatCompact(profile.totalViews), key: 'views', label: t('profile.statsViews') },
    { value: formatHours(profile.totalLiveHours), key: 'hours', label: t('profile.statsHours') },
  ];

  return (
    <section className="creator-stats-wrap" aria-label={t('profile.creatorStats')}>
      <div className="creator-stats">
        {mainStats.map((stat) => (
          <article
            key={stat.key}
            className={stat.clickable ? 'creator-stats__clickable' : ''}
            onClick={stat.clickable ? onViewFollowing : undefined}
            role={stat.clickable ? 'button' : undefined}
            tabIndex={stat.clickable ? 0 : undefined}
          >
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>
      {isStreamer && (
        <div className="creator-stats creator-stats--secondary">
          {streamerStats.map((stat) => (
            <article key={stat.key}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturedLiveCard({ profile, isOwnProfile, notified, onJoin, onNotify, onManage }) {
  const { t } = useTranslation();
  const featured = profile.currentLive?.status !== 'ended' ? profile.currentLive : null;
  const fallback = featured ? null : profile.upcomingLives?.[0];

  if (!featured && !fallback) {
    if (!isOwnProfile) return null;
    return (
      <section className="featured-live featured-live--none" aria-label={t('profile.noScheduledLive')}>
        <div className="featured-live__empty">
          <p className="featured-live__none-text">{t('profile.noLiveScheduled')}</p>
          <button type="button" onClick={onManage}>{t('profile.scheduleLive')}</button>
        </div>
      </section>
    );
  }

  const displayLive = featured ?? fallback;
  const isLive = displayLive.status === 'live';

  return (
    <section className={isLive ? 'featured-live is-live' : 'featured-live'} aria-label={isLive ? t('globe.liveNow') : t('profile.upcomingLive')}>
      <div className={displayLive.thumbnailUrl ? 'featured-live__thumb' : 'featured-live__thumb featured-live__thumb--empty'}>
        {displayLive.thumbnailUrl ? <img src={displayLive.thumbnailUrl} alt="" /> : null}
        {isLive ? <span className="featured-live__live-dot" aria-hidden="true" /> : <Clock3 size={18} strokeWidth={1.8} />}
      </div>
      <div className="featured-live__content">
        {isLive && <span className="featured-live__label">{t('profile.liveNowLabel')}</span>}
        <h2>{displayLive.title}</h2>
        <p>
          {isLive
            ? `${displayLive.location}${displayLive.viewers ? ` · ${t('profile.viewersCount', { count: formatCompact(displayLive.viewers) })}` : ''}`
            : [displayLive.scheduledAt && displayLive.time ? `${displayLive.scheduledAt} · ${displayLive.time}` : null, displayLive.location].filter(Boolean).join(' · ')}
        </p>
      </div>
      <button type="button" onClick={isLive ? (isOwnProfile ? onManage : onJoin) : isOwnProfile ? onManage : onNotify}>
        {isLive ? (isOwnProfile ? t('profile.manageLive') : t('profile.join')) : isOwnProfile ? t('common.edit') : notified ? t('profile.notificationOn') : t('common.notifyMe')}
      </button>
    </section>
  );
}

function ProfileTabs({ activeTab, onChange }) {
  const { t } = useTranslation();
  const tabs = [
    { id: 'lives', label: t('profile.tabsLives') },
    { id: 'about', label: t('profile.tabsAbout') },
    { id: 'equipment', label: t('profile.equipment') },
    { id: 'highlights', label: t('profile.tabsHighlights'), comingSoon: true },
  ];

  return (
    <div className="creator-tabs" role="tablist" aria-label={t('profile.profileContent')}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? 'is-active' : ''}
          onClick={() => onChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
        >
          {tab.label}
          {tab.comingSoon ? <span className="creator-tab__soon">Bientôt</span> : null}
        </button>
      ))}
    </div>
  );
}

function FavoritesTab({ lives, onOpenLive }) {
  const { t } = useTranslation();
  if (!lives?.length) {
    return (
      <div className="profile-empty-state">
        <p>{t('profile.emptyFavorites')}</p>
      </div>
    );
  }

  return (
    <section className="recent-live-list" aria-label={t('profile.tabs.favorites')}>
      {lives.map((live) => (
        <RecentLiveCard
          key={`favorite-${live.id}`}
          live={live}
          onOpen={() => onOpenLive(live)}
        />
      ))}
    </section>
  );
}

function ProfilePageHeader() {
  return null;
}

function RecentLiveCard({ live, onOpen }) {
  const { t } = useTranslation();
  return (
    <article className="recent-live-card">
      <button type="button" className="recent-live-card__main" onClick={onOpen}>
        <span className="recent-live-card__thumb">
          <img src={live.thumbnailUrl} alt="" />
          <span className="recent-live-card__play">
            <Play size={15} strokeWidth={2} fill="currentColor" />
          </span>
          <span className="recent-live-card__viewers">
            <Eye size={11} strokeWidth={1.8} />
            {formatCompact(live.views)}
          </span>
        </span>
        <span className="recent-live-card__copy">
          <strong>{live.title}</strong>
          <small>{live.location}</small>
          <span>
            {live.relativeDate} · {t('profile.viewsCount', { count: formatCompact(live.views) })}
          </span>
        </span>
        <span className="recent-live-card__duration">{live.duration}</span>
      </button>
    </article>
  );
}

function RecentLivesTab({ lives, isOwnProfile, onOpenLive }) {
  const { t } = useTranslation();
  if (!lives?.length) {
    return (
      <div className="profile-empty-state">
        <p>{t('profile.emptyReplays')}</p>
        {isOwnProfile ? <small>{t('profile.ownReplayHint')}</small> : null}
      </div>
    );
  }

  return (
    <section className="recent-live-list" aria-label={t('profile.tabs.replays')}>
      {lives.map((live) => (
        <RecentLiveCard
          key={live.id}
          live={live}
          onOpen={() => onOpenLive(live)}
        />
      ))}
    </section>
  );
}

function LivesTab({ profile, isOwnProfile, notified, onJoin, onNotify, onManage }) {
  const { t } = useTranslation();
  if (!profile.currentLive || profile.currentLive.status === 'ended') {
    return (
      <div className="profile-empty-state">
        <p>{t('profile.notLiveRightNow', { name: profile.displayName })}</p>
        {!isOwnProfile && profile.upcomingLives?.length ? (
          <button type="button" onClick={onNotify}>
            {t('profile.enableNotifications')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <FeaturedLiveCard
      profile={{ ...profile, upcomingLives: [] }}
      isOwnProfile={isOwnProfile}
      notified={notified}
      onJoin={onJoin}
      onNotify={onNotify}
      onManage={onManage}
    />
  );
}

function UpcomingLiveCard({ live, isOwnProfile, notified, onNotify, onManage, onCancel }) {
  const { t } = useTranslation();
  return (
    <article className="upcoming-live-card">
      {live.thumbnailUrl ? (
        <img src={live.thumbnailUrl} alt="" />
      ) : (() => {
        const cat = ACTIVITY_CATEGORIES.find((c) => c.id === live.category);
        const Icon = cat?.icon;
        return (
          <div className="upcoming-live-card__cat-thumb" style={{ '--cat-color': cat?.color ?? 'var(--vuvio-cyan)' }}>
            {Icon ? <Icon size={22} strokeWidth={1.6} /> : <Clock3 size={22} strokeWidth={1.6} />}
          </div>
        );
      })()}
      <div className="upcoming-live-card__info">
        <strong className="upcoming-live-card__title">{live.title}</strong>
        <span className="upcoming-live-card__meta">{live.scheduledAt} · {live.time}</span>
      </div>
      <div className="upcoming-live-card__actions">
        {isOwnProfile ? (
          <>
            <button type="button" onClick={() => onManage(live)}>{t('common.edit')}</button>
            <button type="button" className="is-danger" onClick={() => onCancel?.(live.id)}>{t('common.cancel')}</button>
          </>
        ) : (
          <button type="button" className={notified ? 'is-active' : ''} onClick={() => onNotify(live.id)}>
            {notified ? t('profile.notificationOn') : t('common.notifyMe')}
          </button>
        )}
      </div>
    </article>
  );
}

function UpcomingLivesTab({ lives, isOwnProfile, notifiedIds, onNotify, onManage, onCancel }) {
  const { t } = useTranslation();
  if (!lives?.length) {
    return (
      <div className="profile-empty-state">
        <p>{isOwnProfile ? t('profile.noOwnUpcoming') : t('profile.noPublicUpcoming')}</p>
        {isOwnProfile ? <button type="button" onClick={onManage}>{t('profile.scheduleLive')}</button> : null}
      </div>
    );
  }

  return (
    <section className="upcoming-live-list" aria-label={t('profile.upcomingLives')}>
      {lives.map((live) => (
        <UpcomingLiveCard key={live.id} live={live} isOwnProfile={isOwnProfile} notified={!!notifiedIds[live.id]} onNotify={onNotify} onManage={onManage} onCancel={onCancel} />
      ))}
    </section>
  );
}

function AboutTab({ profile }) {
  const { t } = useTranslation();
  const links = [
    profile.websiteUrl ? {
      icon: <Globe2 size={18} strokeWidth={1.8} />,
      href: profile.websiteUrl.startsWith('http') ? profile.websiteUrl : `https://${profile.websiteUrl}`,
      value: profile.websiteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''),
    } : null,
    profile.instagramUrl ? {
      icon: <IconInstagram size={18} />,
      href: profile.instagramUrl.startsWith('http') ? profile.instagramUrl : `https://instagram.com/${profile.instagramUrl.replace(/^@/, '')}`,
      value: '@' + profile.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/^@/, '').replace(/[/?#].*$/, '').replace(/\/$/, ''),
    } : null,
    profile.youtubeUrl ? {
      icon: <IconYouTube size={18} />,
      href: profile.youtubeUrl.startsWith('http') ? profile.youtubeUrl.replace(/[?#].*$/, '') : `https://youtube.com/@${profile.youtubeUrl.replace(/^@/, '')}`,
      value: '@' + profile.youtubeUrl.replace(/^https?:\/\/(www\.)?youtube\.com\/@?/, '').replace(/[?#].*$/, '').replace(/\/$/, '').replace(/^@/, ''),
    } : null,
  ].filter(Boolean);

  return (
    <>
      <section className="about-section" aria-label={t('profile.aboutCreator')}>
        <article>
          <span>{t('profile.activity')}</span>
          <strong>{profile.profession}</strong>
        </article>
        <article>
          <span>{t('profile.location')}</span>
          <strong>{profile.city}, {profile.country}</strong>
        </article>
        {profile.languages?.length ? (
          <article>
            <span>{t('profile.spokenLanguages')}</span>
            <strong>{profile.languages.join(' · ')}</strong>
          </article>
        ) : null}
        {profile.categories?.length ? (
          <article>
            <span>{t('profile.categories')}</span>
            <strong>{profile.categories.join(' · ')}</strong>
          </article>
        ) : null}
        {formatCreatedAt(profile.createdAt) ? (
          <article>
            <span>{t('profile.memberSince')}</span>
            <strong>{formatCreatedAt(profile.createdAt)}</strong>
          </article>
        ) : null}
      </section>
      {links.length ? (
        <div className="about-section__links">
          <span className="about-section__links-label">{t('profile.links')}</span>
          {links.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="about-section__link">
              {link.icon}
              <span>{link.value}</span>
            </a>
          ))}
        </div>
      ) : null}
    </>
  );
}

function EquipmentTab({ equipment, liveEquipment, isOwnProfile, displayName, onManage, onViewLive }) {
  const { t } = useTranslation();
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const publicEquipment = equipment.filter((item) => item.isPublic);
  const groups = groupEquipmentByCategory(publicEquipment);
  const selectedGroup = groups.find((group) => group.id === activeCategoryId);

  return (
    <section className="equipment-tab" aria-label={t('profile.creatorEquipment')}>
      <div className="equipment-tab__header">
        <div>
          <h2>{isOwnProfile ? t('equipment.myEquipment') : t('equipment.creatorEquipment', { name: displayName })}</h2>
          <p>{isOwnProfile ? t('equipment.ownDescription') : t('equipment.creatorDescription', { name: displayName })}</p>
        </div>
      </div>

      {isOwnProfile && !publicEquipment.length ? (
        <div className="equipment-nudge">
          <p className="equipment-nudge__text">{t('equipment.nudgeText')}</p>
          <button type="button" className="equipment-nudge__cta" onClick={onManage}>{t('equipment.nudgeCta')}</button>
        </div>
      ) : null}

      <div className="equipment-category-list">
        {groups.map((category) => (
          <React.Fragment key={category.id}>
            <EquipmentCategoryCard
              category={category}
              count={category.items.length}
              onClick={() => setActiveCategoryId((current) => (current === category.id ? null : category.id))}
            />
            {activeCategoryId === category.id && category.items.length > 0 ? (
              <section className="equipment-detail-panel" aria-label={t('equipment.categoryEquipment', { label: category.label })}>
                <header>
                  <h3>{category.label}</h3>
                  <button type="button" onClick={() => setActiveCategoryId(null)}>{t('common.close')}</button>
                </header>
                {category.items.map((item) => (
                  <EquipmentItemRow key={item.id} item={item} />
                ))}
              </section>
            ) : null}
          </React.Fragment>
        ))}
      </div>

      <GearInLive items={liveEquipment} onViewLive={onViewLive} />
      <EquipmentDisclosure items={publicEquipment} />

      {isOwnProfile ? (
        <button type="button" className="equipment-manage-link" onClick={onManage}>{t('profile.manageEquipment')}</button>
      ) : null}
    </section>
  );
}

function OwnProfileShortcuts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const shortcuts = [
    { key: 'favorites', label: t('profile.myFavorites'), icon: Bookmark, action: null },
    { key: 'following', label: t('common.following'), icon: Check, action: () => navigate('/profile/following') },
    { key: 'notifications', label: t('profile.myNotifications'), icon: Bell, action: null },
    { key: 'stats', label: t('profile.stats'), icon: Sparkles, action: () => navigate('/profile/stats') },
    { key: 'settings', label: t('common.settings'), icon: Settings, action: () => navigate('/settings') },
  ];

  return (
    <section className="profile-shortcuts" aria-label={t('profile.personalShortcuts')}>
      {shortcuts.map(({ key, label, icon: Icon, action }) => (
        <button key={key} type="button" onClick={action ?? (() => {})}>
          <span>
            <Icon size={17} strokeWidth={1.8} />
            {label}
          </span>
          <ChevronRight size={16} strokeWidth={1.8} />
        </button>
      ))}
    </section>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { creatorId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, userProfile, profileLoading } = useAuth();
  const toastTimer = useRef(null);
  const [state, setState] = useState({ loading: true, currentUser: null, viewedProfile: null });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStatus, setFollowStatus] = useState('idle');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'equipment' ? 'equipment' : 'lives');
  const [notifiedIds, setNotifiedIds] = useState({});
  const [toast, setToast] = useState('');
  const [equipmentLibrary, setEquipmentLibrary] = useState(() => getEquipmentLibrary());
  const [profileEquipmentEnriched, setProfileEquipmentEnriched] = useState([]);
  const [scheduledProfileLives, setScheduledProfileLives] = useState([]);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [editingLive, setEditingLive] = useState(null);
  const [scheduledRefreshKey, setScheduledRefreshKey] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const { notifications, unreadCount: notifUnread, loading: notifsLoading, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });

    // For own profile: use cached userProfile from AuthContext
    if (!creatorId && user && userProfile) {
      const viewedProfile = userProfile;
      setState({ loading: false, currentUser: viewedProfile, viewedProfile });
      setIsFollowing(Boolean(viewedProfile?.isFollowing || isFollowingCreator(viewedProfile?.id)));
      setFollowStatus('idle');
      setNotificationsEnabled(Boolean(viewedProfile?.notificationsEnabled));
      return;
    }

    // For own profile while loading: show skeleton
    if (!creatorId && profileLoading) {
      setState({ loading: true, currentUser: null, viewedProfile: null });
      return;
    }

    // For other creators' profiles
    if (creatorId) {
      setState({ loading: true, currentUser: userProfile || null, viewedProfile: null });
      loadCreatorFromFirestore(creatorId);
    }
  }, [creatorId, user, userProfile, profileLoading]);

  const loadCreatorFromFirestore = async (uid) => {
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        let viewedProfile = { id: uid, ...docSnap.data() };

        // Load active live from activeLives collection
        try {
          const livesQ = query(collection(db, 'activeLives'), where('creatorUid', '==', uid), where('publicSafe', '==', true));
          const livesSnap = await getDocs(livesQ);
          const activeLives = livesSnap.docs
            .map(doc => doc.data())
            .filter(live => live.creatorUid === uid && live.status === 'live')
            .sort((a, b) => {
              const aTime = new Date(a.createdAt || 0).getTime();
              const bTime = new Date(b.createdAt || 0).getTime();
              return bTime - aTime;
            });
          if (activeLives.length > 0) {
            viewedProfile.currentLive = activeLives[0];
          }
        } catch (err) {
          console.warn('[ProfilePage] Failed to load live:', err.message);
        }

        setState({ loading: false, currentUser: userProfile || null, viewedProfile });
        setIsFollowing(Boolean(viewedProfile?.isFollowing || isFollowingCreator(viewedProfile?.id)));
        setFollowStatus('idle');
        setNotificationsEnabled(Boolean(userProfile?.liveNotifications?.includes(uid)));
      } else {
        const localProfile = getCreatorProfile(uid);
        setState({ loading: false, currentUser: userProfile || null, viewedProfile: localProfile });
        setIsFollowing(Boolean(localProfile?.id && isFollowingCreator(localProfile.id)));
        setFollowStatus('idle');
        setNotificationsEnabled(Boolean(userProfile?.liveNotifications?.includes(uid)));
      }
    } catch (err) {
      console.error('[ProfilePage] Failed to load creator:', err.message);
      const localProfile = getCreatorProfile(uid);
      setState({ loading: false, currentUser: userProfile || null, viewedProfile: localProfile });
      setIsFollowing(Boolean(localProfile?.id && isFollowingCreator(localProfile.id)));
      setFollowStatus('idle');
      setNotificationsEnabled(Boolean(userProfile?.liveNotifications?.includes(uid)));
    }
  };

  useEffect(() => {
    if (searchParams.get('tab') === 'equipment') setActiveTab('equipment');
  }, [searchParams]);

  useEffect(() => {
    if (creatorId && state.viewedProfile) {
      analyticsService.trackCreatorProfileOpened(creatorId, undefined, 'profile');
    }
  }, [creatorId]);

  useEffect(() => {
    // Track profile open from stream
    const streamId = searchParams.get('stream');
    if (streamId && creatorId && state.viewedProfile) {
      analyticsService.trackCreatorProfileOpened(
        creatorId,
        streamId,
        'watch'
      );
    }
  }, [creatorId, state.viewedProfile, searchParams]);

  useEffect(() => {
    let active = true;
    getEquipmentLibraryWithProducts().then((items) => {
      if (active) setEquipmentLibrary(items);
    }).catch(() => {});
    const unsubscribe = subscribeToEquipment((items) => {
      setEquipmentLibrary(items);
      enrichEquipmentWithProducts(items).then((enriched) => {
        if (active) setEquipmentLibrary(enriched);
      }).catch(() => {});
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const sourceItems = state.viewedProfile?.equipment?.length
      ? state.viewedProfile.equipment.map(normalizeEquipmentItem).filter(Boolean)
      : [];

    if (!sourceItems.length) {
      setProfileEquipmentEnriched([]);
      return () => {
        active = false;
      };
    }

    enrichEquipmentWithProducts(sourceItems)
      .then((items) => {
        if (active) setProfileEquipmentEnriched(items);
      })
      .catch(() => {
        if (active) setProfileEquipmentEnriched(sourceItems);
      });

    return () => {
      active = false;
    };
  }, [state.viewedProfile?.id, state.viewedProfile?.equipment]);

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1800);
  };

  const isOwnProfile = useMemo(() => {
    if (!state.currentUser || !state.viewedProfile) return false;
    if (user && state.viewedProfile.id === user.uid) return true;
    return !creatorId || state.currentUser.id === state.viewedProfile.id;
  }, [state.currentUser, state.viewedProfile, user, creatorId]);

  useEffect(() => {
    const profileId = state.viewedProfile?.id;
    if (!profileId) {
      setScheduledProfileLives([]);
      return;
    }

    let active = true;
    const request = isOwnProfile
      ? getMyScheduledStreams({ limit: 12 })
      : getScheduledStreams({ creatorId: profileId, limit: 12 });

    request
      .then(({ streams }) => {
        if (!active) return;
        const lives = (Array.isArray(streams) ? streams : [])
          .map((raw) => toProfileUpcomingLive(raw, t('profile.locationTBD'), t('profile.scheduledLiveFallback')))
          .filter(Boolean);
        setScheduledProfileLives(lives);
      })
      .catch(() => {
        if (active) setScheduledProfileLives([]);
      });

    return () => { active = false; };
  }, [isOwnProfile, state.viewedProfile?.id, scheduledRefreshKey]);

  const notifyLive = (id) => {
    if (!id) return;
    setNotifiedIds((current) => {
      const next = { ...current, [id]: !current[id] };
      showToast(next[id] ? t('profile.notificationOn') : t('profile.notificationRemoved'));
      return next;
    });
  };

  const toggleFollow = async () => {
    const profile = state.viewedProfile;
    if (!profile || isOwnProfile || followStatus === 'loading') return;
    if (isFollowing && !window.confirm(t('profile.unfollowConfirm'))) return;

    const previous = isFollowing;
    const next = !previous;
    setFollowStatus('loading');
    setIsFollowing(next);

    try {
      await setFollowingCreator(profile.id, next);
      if (user?.uid && (profile.uid || profile.id)) {
        const creatorUid = profile.uid || profile.id;
        (next ? followCreator : unfollowCreator)(user.uid, creatorUid).catch(() => {});
      }
      showToast(next ? t('profile.nowFollowing') : t('profile.stoppedFollowing'));
      setFollowStatus('idle');
    } catch {
      setIsFollowing(previous);
      setFollowStatus('error');
      showToast(t('profile.followingUpdateError'));
    }
  };

  if (state.loading) return <ProfileSkeleton />;
  if (!state.viewedProfile) {
    return (
      <>
        <SEO title="Profil introuvable | Vuvio" description="Ce profil Vuvio n existe pas ou n est pas public." canonical={location.pathname} robots="noindex,follow" />
        <ProfileState title={t('profile.notFound')}>{t('profile.notFoundBody')}</ProfileState>
      </>
    );
  }

  const profile = {
    ...state.viewedProfile,
    upcomingLives: scheduledProfileLives.length
      ? scheduledProfileLives
      : state.viewedProfile.upcomingLives,
  };
  const profileEquipment = isOwnProfile
    ? equipmentLibrary
    : (profile.equipment?.length ? profileEquipmentEnriched : equipmentLibrary.filter((item) => item.isPublic));
  const liveEquipmentIds = profile.currentLive?.equipment?.map((item) => item.equipmentId) ?? demoLiveEquipmentIds;
  const liveEquipment = profile.currentLive
    ? getEquipmentSelection(profileEquipment, liveEquipmentIds)
    : [];
  const shareProfile = async () => {
    const result = await shareVuvioContent({
      title: profile.displayName,
      url: profileUrl(profile),
    });
    if (result.fallback === 'copied') showToast(t('profile.linkCopied'));
    else if (!result.success && !result.cancelled) showToast(t('profile.shareError'));
  };
  const manageLive = (live = null) => { setEditingLive(live); setShowScheduleSheet(true); };
  const canonical = profileUrl(profile);
  const description = profileDescription(profile);
  const image = profile.coverUrl || profile.avatarUrl || '/assets/icons/icon-512.png';
  const profileJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: `${profile.displayName} - Vuvio`,
      url: `${SITE_URL}${canonical}`,
      mainEntity: {
        '@type': 'Person',
        name: profile.displayName,
        description,
        jobTitle: profile.profession || undefined,
        image: image.startsWith('http') ? image : `${SITE_URL}${image}`,
        homeLocation: [profile.city, profile.country].filter(Boolean).length ? {
          '@type': 'Place',
          name: [profile.city, profile.country].filter(Boolean).join(', '),
        } : undefined,
        knowsAbout: profile.categories?.length ? profile.categories : undefined,
      },
    },
  ];

  const handleCancelLive = async (liveId) => {
    try {
      await cancelScheduledStream(liveId);
      setScheduledRefreshKey((k) => k + 1);
      showToast(t('profile.liveCancelled'));
    } catch {
      showToast(t('profile.cancelLiveError'));
    }
  };

  return (
    <section className="screen-scroll creator-profile-screen" aria-label={t('profile.profileOf', { name: profile.displayName })}>
      <SEO
        title={`${profile.displayName} - Activites et Lives | Vuvio`}
        description={description}
        canonical={canonical}
        image={image}
        type="profile"
        jsonLd={profileJsonLd}
      />
      <ProfilePageHeader isOwnProfile={isOwnProfile} />
      <ProfileCover
        profile={profile}
        isOwnProfile={isOwnProfile}
        onShare={shareProfile}
        notifUnread={notifUnread}
        notifications={notifications}
        notifsLoading={notifsLoading}
        markRead={markRead}
        markAllRead={markAllRead}
      />
      <div className="creator-profile-content">
        <ProfileIdentity
          profile={profile}
          isOwnProfile={isOwnProfile}
          userId={user?.uid}
        />

        <ProfileActions
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowing}
          notificationsEnabled={notificationsEnabled}
          onToggleFollow={toggleFollow}
          onToggleNotifications={() => {
            const next = !notificationsEnabled;
            setNotificationsEnabled(next);
            showToast(next ? t('profile.notificationsEnabledToast') : t('profile.notificationsDisabledToast'));
            if (user?.uid && state.viewedProfile) {
              const targetUid = state.viewedProfile.uid || state.viewedProfile.id;
              if (targetUid) setLiveNotifications(user.uid, targetUid, next).catch(() => {});
            }
          }}
          onShare={shareProfile}
          onMessage={async () => {
            if (!user?.uid || !profile?.id) return;
            const conv = await getOrCreateConversation(user.uid, profile.id);
            navigate(`/messages/${conv.id}`);
          }}
        />

        <ProfileStats
          profile={profile}
          isOwnProfile={isOwnProfile}
          onViewFollowing={() => isOwnProfile && navigate('/profile/following')}
        />

        {profile.currentLive && profile.currentLive.status !== 'ended' ? (
          <FeaturedLiveCard
            profile={profile}
            isOwnProfile={isOwnProfile}
            notified={notificationsEnabled}
            onJoin={() => profile.currentLive && navigate(`/watch?live=${encodeURIComponent(profile.currentLive.id)}&mode=view`)}
            onNotify={() => notifyLive(profile.currentLive?.id)}
            onManage={manageLive}
          />
        ) : (
          <UpcomingLivesTab
            lives={profile.upcomingLives}
            isOwnProfile={isOwnProfile}
            notifiedIds={notifiedIds}
            onNotify={notifyLive}
            onManage={manageLive}
            onCancel={handleCancelLive}
          />
        )}

        <ProfileTabs activeTab={activeTab} onChange={(tab) => {
          setActiveTab(tab);
        }} />

        <div className="profile-tab-panel">
          {activeTab === 'lives' ? (
            <RecentLivesTab
              lives={profile.recentLives}
              isOwnProfile={isOwnProfile}
              onOpenLive={(live) => navigate(`/watch?live=${encodeURIComponent(live.id)}`)}
            />
          ) : null}
          {activeTab === 'about' ? (
            <>
              <AboutTab profile={profile} />
              <PlaylistsSection playlists={profile.playlists} />
            </>
          ) : null}
          {activeTab === 'equipment' ? (
            <EquipmentTab
              equipment={profileEquipment}
              liveEquipment={liveEquipment}
              isOwnProfile={isOwnProfile}
              displayName={profile.displayName}
              onManage={() => navigate('/profile/equipment')}
              onViewLive={() => navigate(`/watch?live=${encodeURIComponent(profile.currentLive?.id ?? '')}`)}
            />
          ) : null}
          {activeTab === 'highlights' ? (
            <div className="profile-coming-soon">
              <p>Les highlights arrivent bientôt.</p>
            </div>
          ) : null}
        </div>
        {isOwnProfile ? <OwnProfileShortcuts /> : null}
      </div>

      {showScheduleSheet ? (
        <ScheduleLiveSheet
          existingLive={editingLive}
          onClose={() => { setShowScheduleSheet(false); setEditingLive(null); }}
          onScheduled={() => setScheduledRefreshKey((k) => k + 1)}
          onCancel={async (liveId) => { await handleCancelLive(liveId); setShowScheduleSheet(false); setEditingLive(null); }}
        />
      ) : null}
      {toast ? <div className="profile-toast" role="status">{toast}</div> : null}
    </section>
  );
}
