import {
  Bell,
  BellRing,
  Bookmark,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  MessageCircle,
  MoreHorizontal,
  Play,
  Settings,
  Share2,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import {
  EquipmentCategoryCard,
  EquipmentDisclosure,
  EquipmentItemRow,
  GearInLive,
} from '../components/equipment/EquipmentKit.jsx';
import { EQUIPMENT_CATEGORIES, demoLiveEquipmentIds } from '../data/equipmentModel.js';
import {
  getCreatorProfile,
  readImageFile,
  saveOwnCreatorProfile,
} from '../services/profileService.js';
import { isFollowingCreator, setFollowingCreator } from '../services/followService.js';
import { getUnreadConversationCount, subscribeToMessaging } from '../services/messagingService.js';
import { analyticsService } from '../services/analytics/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getEquipmentLibrary,
  getEquipmentSelection,
  groupEquipmentByCategory,
  normalizeEquipmentItem,
  subscribeToEquipment,
} from '../services/equipmentService.js';

function formatCompact(value = 0) {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  }

  return String(value);
}

function ProfileSkeleton() {
  return (
    <section className="screen-scroll creator-profile-screen" aria-label="Loading profile">
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

function ProfileCover({ profile, isOwnProfile, onShare, onEditCover }) {
  const navigate = useNavigate();
  const hasCover = Boolean(profile.coverUrl);
  const [msgUnread, setMsgUnread] = useState(() => getUnreadConversationCount());

  useEffect(() => subscribeToMessaging(() => setMsgUnread(getUnreadConversationCount())), []);

  return (
    <header className="creator-cover" style={!hasCover ? { background: 'linear-gradient(135deg, #0f1419 0%, #1a2332 100%)' } : undefined}>
      {hasCover ? <img src={profile.coverUrl} alt="Creator profile cover" /> : null}
      <div className="creator-cover__shade" />
      <div className="creator-cover__topbar">
        <button type="button" className="creator-icon-button" onClick={() => (isOwnProfile ? navigate('/discover') : navigate(-1))} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={1.9} />
        </button>
        <div className="creator-cover__actions">
          <Link to="/messages" className="creator-icon-button creator-icon-button--msg" aria-label="Messages">
            <MessageCircle size={20} strokeWidth={2} />
            {msgUnread > 0 ? (
              <span className="creator-icon-button__badge" aria-label={`${msgUnread} unread`}>
                {msgUnread > 9 ? '9+' : msgUnread}
              </span>
            ) : null}
          </Link>
          <button type="button" className="creator-icon-button" aria-label="Notifications">
            <Bell size={18} strokeWidth={1.8} />
          </button>
          <button type="button" className="creator-icon-button" onClick={onShare} aria-label="Share profile">
            <Share2 size={18} strokeWidth={1.8} />
          </button>
          {isOwnProfile ? (
            <button type="button" className="creator-icon-button" onClick={() => navigate('/settings')} aria-label="Settings">
              <Settings size={18} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </div>
      {isOwnProfile ? (
        <button type="button" className="creator-cover__edit" onClick={onEditCover} aria-label="Edit cover">
          <Camera size={15} strokeWidth={1.9} />
          <span>Edit cover</span>
        </button>
      ) : null}
    </header>
  );
}

function ProfileIdentity({ profile, isOwnProfile, onEditAvatar }) {
  const [expanded, setExpanded] = useState(false);
  const bioNeedsToggle = profile.bio.length > 145;
  const avatarUrl = profile.avatarUrl || '/icons/icon-192.png';

  return (
    <section className="creator-identity" aria-label="Creator identity">
      <div className="creator-identity__avatar-wrap">
        <img className="creator-identity__avatar" src={avatarUrl} alt={`Portrait of ${profile.displayName}`} />
        {isOwnProfile ? (
          <button type="button" className="creator-identity__edit-avatar" onClick={onEditAvatar} aria-label="Edit my profile photo">
            <Camera size={13} strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <div className="creator-identity__body">
        <h1 className="creator-identity__name">
          {profile.displayName}
          {profile.verified ? (
            <span className="creator-identity__verified" aria-label="Verified creator">
              <Check size={11} strokeWidth={2.6} />
            </span>
          ) : null}
        </h1>
        <p className="creator-identity__username">@{profile.username}</p>
        <p className="creator-identity__meta">
          {profile.profession} · {profile.city}, {profile.country}
        </p>
        {isOwnProfile ? (
          <small className="creator-identity__own-note">
            <Eye size={11} aria-hidden="true" />
            Visible to others
          </small>
        ) : null}
        <p className={expanded ? 'creator-identity__bio is-expanded' : 'creator-identity__bio'}>{profile.bio}</p>
        {bioNeedsToggle ? (
          <button type="button" className="creator-identity__more" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Show less' : 'Show more'}
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
}) {
  const navigate = useNavigate();

  if (isOwnProfile) {
    return (
      <section className="creator-identity__actions" aria-label="Personal profile actions">
        <button type="button" className="creator-follow-button creator-follow-button--primary" onClick={() => navigate('/profile/edit')}>
          Edit my profile
        </button>
        <button type="button" className="creator-secondary-icon" onClick={onShare} aria-label="Share my profile">
          <Share2 size={18} strokeWidth={1.8} />
        </button>
        <button type="button" className="creator-secondary-icon" onClick={() => navigate('/settings')} aria-label="Open settings">
          <Settings size={18} strokeWidth={1.8} />
        </button>
      </section>
    );
  }

  return (
    <section className="creator-identity__actions" aria-label="Creator profile actions">
      <button type="button" className={isFollowing ? 'creator-follow-button is-active' : 'creator-follow-button'} onClick={onToggleFollow}>
        {isFollowing ? 'Following' : 'Follow'}
      </button>
      <button type="button" className="creator-follow-button creator-follow-button--message" onClick={() => navigate('/messages/lena-rousseau')}>
        Send message
      </button>
      <button
        type="button"
        className={notificationsEnabled ? 'creator-notify-button is-active' : 'creator-notify-button'}
        onClick={onToggleNotifications}
        aria-label={notificationsEnabled ? 'Disable live notifications' : 'Enable live notifications'}
      >
        {notificationsEnabled ? <BellRing size={18} strokeWidth={1.8} /> : <Bell size={18} strokeWidth={1.8} />}
      </button>
      <button type="button" className="creator-secondary-icon" onClick={onShare} aria-label="Share profile">
        <Share2 size={18} strokeWidth={1.8} />
      </button>
    </section>
  );
}

function ProfileImageSheet({ type, previewUrl, error, onClose, onSelectFile, onRemove, onSave }) {
  const inputId = `profile-${type}-file`;
  const isAvatar = type === 'avatar';

  return (
    <div className="profile-image-sheet" role="dialog" aria-modal="true" aria-label={isAvatar ? 'Edit profile photo' : 'Edit cover'}>
      <button type="button" className="profile-image-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="profile-image-sheet__panel">
        <h2>{isAvatar ? 'Profile photo' : 'Cover'}</h2>
        {previewUrl ? (
          <img className={isAvatar ? 'profile-image-sheet__preview is-avatar' : 'profile-image-sheet__preview'} src={previewUrl} alt="Local preview" />
        ) : null}
        {error ? <p className="profile-image-sheet__error">{error}</p> : null}
        <label htmlFor={inputId}>Prendre une photo</label>
        <label htmlFor={inputId}>Choose from photo library</label>
        <button type="button" onClick={onRemove}>{isAvatar ? 'Delete la photo' : 'Delete la couverture'}</button>
        <button type="button" className="is-primary" disabled={!previewUrl} onClick={onSave}>Save</button>
        <button type="button" onClick={onClose}>Cancel</button>
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" onChange={onSelectFile} />
      </div>
    </div>
  );
}

function ProfileStats({ profile, isOwnProfile, onViewFollowing }) {
  const stats = [
    { value: profile.liveCount, label: 'lives' },
    { value: formatCompact(profile.followersCount), label: 'followers' },
    { value: formatCompact(profile.followingCount), label: 'following', clickable: isOwnProfile },
  ];

  return (
    <section className="creator-stats" aria-label="Creator stats">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className={stat.clickable ? 'creator-stats__clickable' : ''}
          onClick={stat.clickable ? onViewFollowing : undefined}
          role={stat.clickable ? 'button' : undefined}
          tabIndex={stat.clickable ? 0 : undefined}
        >
          <strong>{stat.value}</strong>
          <span>{stat.label}</span>
        </article>
      ))}
    </section>
  );
}

function FeaturedLiveCard({ profile, isOwnProfile, notified, onJoin, onNotify, onManage }) {
  const featured = profile.currentLive?.status !== 'ended' ? profile.currentLive : null;
  const fallback = featured ? null : profile.upcomingLives?.[0];

  if (!featured && !fallback) {
    if (!isOwnProfile) return null;
    return (
      <section className="featured-live featured-live--none" aria-label="No scheduled live">
        <div className="featured-live__empty">
          <p className="featured-live__none-text">No live scheduled</p>
          <button type="button" onClick={onManage}>Schedule a live</button>
        </div>
      </section>
    );
  }

  const displayLive = featured ?? fallback;
  const isLive = displayLive.status === 'live';

  return (
    <section className={isLive ? 'featured-live is-live' : 'featured-live'} aria-label={isLive ? 'Live now' : 'Upcoming live'}>
      <div className="featured-live__thumb">
        <img src={displayLive.thumbnailUrl} alt="" />
        {isLive ? <span className="featured-live__live-dot" aria-hidden="true" /> : <Clock3 size={18} strokeWidth={1.8} />}
      </div>
      <div className="featured-live__content">
        <span className="featured-live__label">{isLive ? 'LIVE NOW' : 'UPCOMING LIVE'}</span>
        <h2>{displayLive.title}</h2>
        <p>{displayLive.location}</p>
        {isLive ? <time>{formatCompact(displayLive.viewers)} viewers</time> : null}
        {!isLive && displayLive.scheduledAt ? (
          <time>
            {displayLive.scheduledAt} · {displayLive.time}
          </time>
        ) : null}
      </div>
      <button type="button" onClick={isLive ? (isOwnProfile ? onManage : onJoin) : isOwnProfile ? onManage : onNotify}>
        {isLive ? (isOwnProfile ? 'Manage live' : 'Join') : isOwnProfile ? 'Edit' : notified ? 'Notification on' : 'Notify me'}
      </button>
    </section>
  );
}

function ProfileTabs({ activeTab, onChange }) {
  const tabs = [
    { id: 'lives', label: 'Lives' },
    { id: 'about', label: 'About' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'highlights', label: 'Highlights' },
  ];

  return (
    <div className="creator-tabs" role="tablist" aria-label="Profile content">
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
        </button>
      ))}
    </div>
  );
}

function FavoritesTab({ lives, onOpenLive }) {
  if (!lives?.length) {
    return (
      <div className="profile-empty-state">
        <p>No saved favorite yet.</p>
      </div>
    );
  }

  return (
    <section className="recent-live-list" aria-label="Favorites">
      {lives.map((live) => (
        <RecentLiveCard
          key={`favorite-${live.id}`}
          live={live}
          isOwnProfile={false}
          menuOpen={false}
          onOpen={() => onOpenLive(live)}
          onMenu={() => {}}
        />
      ))}
    </section>
  );
}

function ProfilePageHeader() {
  return null;
}

function RecentLiveCard({ live, isOwnProfile, menuOpen, onOpen, onMenu }) {
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
            {live.relativeDate} · {formatCompact(live.views)} views
          </span>
        </span>
        <span className="recent-live-card__duration">{live.duration}</span>
      </button>
      <button type="button" className="recent-live-card__menu" onClick={onMenu} aria-label={`Options for ${live.title}`}>
        <MoreHorizontal size={18} strokeWidth={1.8} />
      </button>
      {menuOpen ? (
        <div className="recent-live-card__popover" role="menu">
          {isOwnProfile ? (
            <>
              <button type="button" role="menuitem">Edit details</button>
              <button type="button" role="menuitem">Hide from profile</button>
              <button type="button" role="menuitem">Delete</button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem">Share</button>
              <button type="button" role="menuitem">Report</button>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function RecentLivesTab({ lives, isOwnProfile, openMenuId, onOpenLive, onMenu }) {
  if (!lives?.length) {
    return (
      <div className="profile-empty-state">
        <p>No replay published yet.</p>
        {isOwnProfile ? <small>Your saved replays will appear here.</small> : null}
      </div>
    );
  }

  return (
    <section className="recent-live-list" aria-label="Replays">
      {lives.map((live) => (
        <RecentLiveCard
          key={live.id}
          live={live}
          isOwnProfile={isOwnProfile}
          menuOpen={openMenuId === live.id}
          onOpen={() => onOpenLive(live)}
          onMenu={() => onMenu(live.id)}
        />
      ))}
    </section>
  );
}

function LivesTab({ profile, isOwnProfile, notified, onJoin, onNotify, onManage }) {
  if (!profile.currentLive || profile.currentLive.status === 'ended') {
    return (
      <div className="profile-empty-state">
        <p>{profile.displayName} is not live right now.</p>
        {!isOwnProfile && profile.upcomingLives?.length ? (
          <button type="button" onClick={onNotify}>
            Enable notifications
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

function UpcomingLiveCard({ live, isOwnProfile, notified, onNotify, onManage }) {
  return (
    <article className="upcoming-live-card">
      {live.thumbnailUrl ? <img src={live.thumbnailUrl} alt="" /> : null}
      <div>
        <span>Upcoming</span>
        <h3>{live.title}</h3>
        <p>{live.scheduledAt}</p>
        <small>
          {live.time} · {live.location}
        </small>
      </div>
      <div className="upcoming-live-card__actions">
        {isOwnProfile ? (
          <>
            <button type="button" onClick={onManage}>Edit</button>
            <button type="button" onClick={onManage}>Cancel</button>
            <button type="button" onClick={onManage}>View details</button>
          </>
        ) : (
          <button type="button" className={notified ? 'is-active' : ''} onClick={() => onNotify(live.id)}>
            {notified ? 'Notification on' : 'Notify me'}
          </button>
        )}
      </div>
    </article>
  );
}

function UpcomingLivesTab({ lives, isOwnProfile, notifiedIds, onNotify, onManage }) {
  if (!lives?.length) {
    return (
      <div className="profile-empty-state">
        <p>{isOwnProfile ? 'No scheduled live.' : 'No upcoming live.'}</p>
        {isOwnProfile ? <button type="button" onClick={onManage}>Schedule a live</button> : null}
      </div>
    );
  }

  return (
    <section className="upcoming-live-list" aria-label="Upcoming lives">
      {lives.map((live) => (
        <UpcomingLiveCard key={live.id} live={live} isOwnProfile={isOwnProfile} notified={!!notifiedIds[live.id]} onNotify={onNotify} onManage={onManage} />
      ))}
    </section>
  );
}

function AboutTab({ profile }) {
  const links = [
    profile.websiteUrl ? { label: 'Website', value: profile.websiteUrl } : null,
    profile.instagramUrl ? { label: 'Instagram', value: profile.instagramUrl.startsWith('http') ? profile.instagramUrl : `@${profile.instagramUrl}` } : null,
    profile.youtubeUrl ? { label: 'YouTube', value: profile.youtubeUrl } : null,
  ].filter(Boolean);

  return (
    <section className="about-section" aria-label="About the creator">
      <article>
        <span>Activity</span>
        <strong>{profile.profession}</strong>
      </article>
      <article>
        <span>Location</span>
        <strong>{profile.city}, {profile.country}</strong>
      </article>
      {profile.languages?.length ? (
        <article>
          <span>Spoken languages</span>
          <strong>{profile.languages.join(' · ')}</strong>
        </article>
      ) : null}
      {profile.categories?.length ? (
        <article>
          <span>Categories</span>
          <strong>{profile.categories.join(' · ')}</strong>
        </article>
      ) : null}
      {profile.createdAt ? (
        <article>
          <span>Member since</span>
          <strong>{profile.createdAt}</strong>
        </article>
      ) : null}
      {links.length ? (
        <article>
          <span>Links</span>
          <div className="about-section__links">
            {links.map((link) => (
              <button key={link.label} type="button">{link.label} · {link.value}</button>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}

function EquipmentTab({ equipment, liveEquipment, isOwnProfile, displayName, onManage, onViewLive }) {
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [sponsorshipOpen, setSponsorshipOpen] = useState(false);
  const publicEquipment = equipment.filter((item) => item.isPublic);
  const groups = groupEquipmentByCategory(publicEquipment);
  const selectedGroup = groups.find((group) => group.id === activeCategoryId);

  if (!publicEquipment?.length) {
    return (
      <section className="equipment-tab">
        <div className="profile-empty-state">
          <p>No equipment added yet</p>
          <small>Add the gear you use to create your POV experiences.</small>
          {isOwnProfile ? <button type="button" onClick={onManage}>Add equipment</button> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="equipment-tab" aria-label="Creator equipment">
      <div className="equipment-tab__header">
        <div>
          <h2>{isOwnProfile ? 'My Equipment' : `${displayName}'s Equipment`}</h2>
          <p>{isOwnProfile ? 'The gear I use to capture and stream my POV experiences.' : `The gear ${displayName} uses to capture and stream POV experiences.`}</p>
        </div>
        <button type="button" onClick={() => setSponsorshipOpen(true)}>About sponsorships</button>
      </div>

      <div className="equipment-category-list">
        {groups.map((category) => (
          <EquipmentCategoryCard
            key={category.id}
            category={category}
            count={category.items.length}
            onClick={() => setActiveCategoryId((current) => (current === category.id ? null : category.id))}
          />
        ))}
      </div>

      {selectedGroup ? (
        <section className="equipment-detail-panel" aria-label={`${selectedGroup.label} equipment`}>
          <header>
            <h3>{selectedGroup.label}</h3>
            <button type="button" onClick={() => setActiveCategoryId(null)}>Close</button>
          </header>
          {selectedGroup.items.map((item) => (
            <EquipmentItemRow key={item.id} item={item} />
          ))}
        </section>
      ) : null}

      <GearInLive items={liveEquipment} onViewLive={onViewLive} />
      <EquipmentDisclosure items={publicEquipment} />

      <section className="equipment-partnership-card">
        <div>
          <h2>Interested in partnering with this creator?</h2>
          <p>Partnership requests are reviewed by Vuvio before being shared.</p>
        </div>
        <button type="button" onClick={() => setSponsorshipOpen(true)}>Partnership inquiries</button>
      </section>

      {isOwnProfile ? (
        <button type="button" className="equipment-manage-link" onClick={onManage}>Manage my equipment</button>
      ) : null}

      {sponsorshipOpen ? (
        <div className="equipment-info-modal" role="dialog" aria-modal="true" aria-label="About sponsorships">
          <button type="button" className="equipment-info-modal__backdrop" onClick={() => setSponsorshipOpen(false)} aria-label="Close" />
          <div className="equipment-info-modal__panel">
            <h2>About sponsorships</h2>
            <p>Creators can mark gear as Sponsored, Affiliate link, or Provided by a brand. Vuvio keeps those labels visible for transparency.</p>
            <button type="button" onClick={() => setSponsorshipOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OwnProfileShortcuts() {
  const navigate = useNavigate();
  const shortcuts = [
    { label: 'My favorites', icon: Bookmark, action: null },
    { label: 'Following', icon: Check, action: null },
    { label: 'My notifications', icon: Bell, action: null },
    { label: 'Stats', icon: Sparkles, action: null },
    { label: 'Settings', icon: Settings, action: () => navigate('/settings') },
  ];

  return (
    <section className="profile-shortcuts" aria-label="Personal profile shortcuts">
      {shortcuts.map(({ label, icon: Icon, action }) => (
        <button key={label} type="button" onClick={action ?? (() => {})}>
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
  console.count('[ProfilePage] render');
  const navigate = useNavigate();
  const { creatorId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, userProfile, profileLoading } = useAuth();
  const toastTimer = useRef(null);
  const [state, setState] = useState({ loading: true, currentUser: null, viewedProfile: null });

  console.log('[ProfilePage] viewing:', creatorId ? `creator ${creatorId}` : 'own profile', {
    userLoaded: !!user,
    profileLoaded: !!userProfile,
    profileLoading,
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStatus, setFollowStatus] = useState('idle');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'equipment' ? 'equipment' : 'lives');
  const [notifiedIds, setNotifiedIds] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);
  const [toast, setToast] = useState('');
  const [imageSheet, setImageSheet] = useState(null);
  const [equipmentLibrary, setEquipmentLibrary] = useState(() => getEquipmentLibrary());

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
          const livesQ = query(collection(db, 'activeLives'), where('creatorUid', '==', uid));
          const livesSnap = await getDocs(livesQ);
          const activeLives = livesSnap.docs
            .map(doc => doc.data())
            .filter(live => live.status === 'live')
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
        setNotificationsEnabled(Boolean(viewedProfile?.notificationsEnabled));
      } else {
        const localProfile = getCreatorProfile(uid);
        setState({ loading: false, currentUser: userProfile || null, viewedProfile: localProfile });
        setIsFollowing(Boolean(localProfile?.id && isFollowingCreator(localProfile.id)));
        setFollowStatus('idle');
        setNotificationsEnabled(Boolean(localProfile?.notificationsEnabled));
      }
    } catch (err) {
      console.error('[ProfilePage] Failed to load creator:', err.message);
      const localProfile = getCreatorProfile(uid);
      setState({ loading: false, currentUser: userProfile || null, viewedProfile: localProfile });
      setIsFollowing(Boolean(localProfile?.id && isFollowingCreator(localProfile.id)));
      setFollowStatus('idle');
      setNotificationsEnabled(Boolean(localProfile?.notificationsEnabled));
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

  useEffect(() => subscribeToEquipment(setEquipmentLibrary), []);

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

  const notifyLive = (id) => {
    if (!id) return;
    setNotifiedIds((current) => {
      const next = { ...current, [id]: !current[id] };
      showToast(next[id] ? 'Notification on' : 'Notification removed');
      return next;
    });
  };

  const toggleFollow = async () => {
    const profile = state.viewedProfile;
    if (!profile || isOwnProfile || followStatus === 'loading') return;
    if (isFollowing && !window.confirm('Unfollow this creator?')) return;

    const previous = isFollowing;
    const next = !previous;
    setFollowStatus('loading');
    setIsFollowing(next);

    try {
      await setFollowingCreator(profile.id, next);
      showToast(next ? 'You are following this creator' : 'You are no longer following this creator');
      setFollowStatus('idle');
    } catch {
      setIsFollowing(previous);
      setFollowStatus('error');
      showToast('Could not update following status');
    }
  };

  const updateOwnProfileImage = async (field, value) => {
    if (!isOwnProfile) return;
    const updated = await saveOwnCreatorProfile({ [field]: value });
    setState((current) => ({ ...current, currentUser: updated, viewedProfile: updated }));
    showToast('Profile updated');
  };

  const onSelectImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !imageSheet) return;
    try {
      const previewUrl = await readImageFile(file);
      setImageSheet((current) => ({ ...current, previewUrl, error: '' }));
    } catch (error) {
      setImageSheet((current) => ({ ...current, error: error.message }));
    } finally {
      event.target.value = '';
    }
  };

  const saveImageSheet = async () => {
    if (!imageSheet?.previewUrl) return;
    await updateOwnProfileImage(imageSheet.type === 'avatar' ? 'avatarUrl' : 'coverUrl', imageSheet.previewUrl);
    setImageSheet(null);
  };

  if (state.loading) return <ProfileSkeleton />;
  if (!state.currentUser) return <ProfileState title="Sign-in required">Sign in to view your profile.</ProfileState>;
  if (!state.viewedProfile) return <ProfileState title="Profile not found">This creator does not exist or is no longer available.</ProfileState>;

  const profile = state.viewedProfile;
  const profileEquipment = isOwnProfile
    ? equipmentLibrary
    : (profile.equipment?.length ? profile.equipment.map(normalizeEquipmentItem).filter(Boolean) : getEquipmentLibrary().filter((item) => item.isPublic));
  const liveEquipmentIds = profile.currentLive?.equipment?.map((item) => item.equipmentId) ?? demoLiveEquipmentIds;
  const liveEquipment = profile.currentLive
    ? getEquipmentSelection(profileEquipment, liveEquipmentIds)
    : [];
  const shareProfile = () => showToast('Profile link copied');
  const manageLive = () => showToast('Live management coming soon');

  return (
    <section className="screen-scroll creator-profile-screen" aria-label={`Profile of ${profile.displayName}`}>
      <ProfilePageHeader isOwnProfile={isOwnProfile} />
      <ProfileCover
        profile={profile}
        isOwnProfile={isOwnProfile}
        onShare={shareProfile}
        onEditCover={() => setImageSheet({ type: 'cover', previewUrl: '', error: '' })}
      />
      <div className="creator-profile-content">
        <ProfileIdentity
          profile={profile}
          isOwnProfile={isOwnProfile}
          onEditAvatar={() => setImageSheet({ type: 'avatar', previewUrl: '', error: '' })}
        />

        <ProfileActions
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowing}
          notificationsEnabled={notificationsEnabled}
          onToggleFollow={toggleFollow}
          onToggleNotifications={() => {
            setNotificationsEnabled((value) => !value);
            showToast(notificationsEnabled ? 'Notifications disabled' : 'Notifications enabled');
          }}
          onShare={shareProfile}
        />

        <ProfileStats
          profile={profile}
          isOwnProfile={isOwnProfile}
          onViewFollowing={() => isOwnProfile && navigate('/profile/following')}
        />

        <FeaturedLiveCard
          profile={profile}
          isOwnProfile={isOwnProfile}
          notified={notificationsEnabled}
          onJoin={() => profile.currentLive && navigate(`/watch?live=${encodeURIComponent(profile.currentLive.id)}&mode=view`)}
          onNotify={() => notifyLive(profile.currentLive?.id)}
          onManage={manageLive}
        />

        <ProfileTabs activeTab={activeTab} onChange={(tab) => {
          setActiveTab(tab);
          setOpenMenuId(null);
        }} />

        <div className="profile-tab-panel">
          {activeTab === 'lives' ? (
            <RecentLivesTab
              lives={profile.recentLives}
              isOwnProfile={isOwnProfile}
              openMenuId={openMenuId}
              onOpenLive={(live) => navigate(`/discover?live=${encodeURIComponent(live.id)}`)}
              onMenu={(id) => setOpenMenuId((current) => (current === id ? null : id))}
            />
          ) : null}
          {activeTab === 'about' ? (
            <>
              <AboutTab profile={profile} />
              <UpcomingLivesTab lives={profile.upcomingLives} isOwnProfile={isOwnProfile} notifiedIds={notifiedIds} onNotify={notifyLive} onManage={manageLive} />
            </>
          ) : null}
          {activeTab === 'equipment' ? (
            <EquipmentTab
              equipment={profileEquipment}
              liveEquipment={liveEquipment}
              isOwnProfile={isOwnProfile}
              displayName={profile.displayName}
              onManage={() => navigate('/profile/equipment')}
              onViewLive={() => navigate(`/discover?live=${encodeURIComponent(profile.currentLive?.id ?? '')}`)}
            />
          ) : null}
          {activeTab === 'highlights' ? (
            <FavoritesTab
              lives={profile.recentLives.slice(0, 4)}
              onOpenLive={(live) => navigate(`/discover?live=${encodeURIComponent(live.id)}`)}
            />
          ) : null}
        </div>
        {isOwnProfile ? <OwnProfileShortcuts /> : null}
      </div>

      {toast ? <div className="profile-toast" role="status">{toast}</div> : null}
      {imageSheet ? (
        <ProfileImageSheet
          type={imageSheet.type}
          previewUrl={imageSheet.previewUrl}
          error={imageSheet.error}
          onClose={() => setImageSheet(null)}
          onSelectFile={onSelectImage}
          onSave={saveImageSheet}
          onRemove={() => {
            setImageSheet((current) => ({
              ...current,
              previewUrl: current.type === 'avatar' ? '/icons/icon-192.png' : null,
              error: '',
            }));
          }}
        />
      ) : null}
    </section>
  );
}
