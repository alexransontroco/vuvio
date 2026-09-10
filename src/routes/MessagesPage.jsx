import { BellOff, Edit3, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getConversations,
  getMessageLive,
  getOrCreateConversation,
  getOtherParticipant,
  getUnreadConversationCount,
  searchConversations,
  searchUsers,
  subscribeToMessaging,
} from '../services/messagingService.js';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'creators', label: 'Creators' },
  { value: 'requests', label: 'Requests' },
];

function ConstellationSvg() {
  return (
    <svg width="72" height="52" viewBox="0 0 72 52" fill="none" className="messages-empty__constellation" aria-hidden="true">
      <circle cx="12" cy="26" r="3.5" fill="rgba(43,217,200,0.72)" />
      <circle cx="12" cy="26" r="8" fill="rgba(43,217,200,0.1)" />
      <circle cx="60" cy="26" r="3.5" fill="rgba(95,163,255,0.72)" />
      <circle cx="60" cy="26" r="8" fill="rgba(95,163,255,0.1)" />
      <path d="M15.5 26 Q36 8 56.5 26" stroke="rgba(43,217,200,0.28)" strokeWidth="1.2" fill="none" />
      <circle cx="36" cy="14" r="1.5" fill="rgba(43,217,200,0.4)" />
    </svg>
  );
}

function LiveDot({ status }) {
  if (status === 'live') {
    return <span className="conv-avatar__live-ring is-live" aria-label="Live now"><i>LIVE</i></span>;
  }
  if (status === 'upcoming') {
    return <span className="conv-avatar__live-ring is-upcoming" aria-label="Upcoming live" />;
  }
  return null;
}

function ConversationRow({ conversation }) {
  const navigate = useNavigate();
  const participant = getOtherParticipant(conversation);
  const lastMessage = conversation.messages.at(-1);
  const live = conversation.relatedLiveId ? getMessageLive(conversation.relatedLiveId) : null;

  const preview = conversation.previewText ?? (lastMessage?.type === 'live' ? 'Shared a live' : lastMessage?.text ?? '');
  const isUnread = conversation.unreadCount > 0;

  return (
    <button
      type="button"
      className={`conv-row${isUnread ? ' is-unread' : ''}`}
      onClick={() => navigate(`/messages/${conversation.id}`)}
    >
      <span className="conv-row__avatar-wrap">
        <img className="conv-row__avatar" src={participant.avatar} alt="" />
        {participant.online && !participant.liveStatus ? <i className="conv-row__online-dot" aria-hidden="true" /> : null}
        {participant.liveStatus ? <LiveDot status={participant.liveStatus} /> : null}
      </span>
      <span className="conv-row__body">
        <span className="conv-row__top">
          <strong className="conv-row__name">{participant.name}</strong>
          <time className="conv-row__time">{conversation.lastMessageAt}</time>
        </span>
        <span className="conv-row__sub">
          {participant.profession ?? participant.username}
          {participant.isMuted ? <BellOff size={10} strokeWidth={1.8} className="conv-row__muted-icon" /> : null}
        </span>
        <span className="conv-row__preview-row">
          <em className="conv-row__preview">{preview}</em>
          <span className="conv-row__indicators">
            {live ? <img className="conv-row__thumb" src={live.image} alt="" /> : null}
            {isUnread ? <i className="conv-row__unread-dot" aria-hidden="true" /> : null}
          </span>
        </span>
      </span>
    </button>
  );
}

function RequestRow({ conversation, requestCount }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="conv-requests-row"
      onClick={() => navigate('/messages?filter=requests')}
      aria-label={`Message requests · ${requestCount}`}
    >
      <span className="conv-requests-row__label">Message requests</span>
      <span className="conv-requests-row__count">{requestCount}</span>
      <span className="conv-requests-row__arrow" aria-hidden="true">›</span>
    </button>
  );
}

function MessageRequestCard({ conversation }) {
  const participant = getOtherParticipant(conversation);
  const navigate = useNavigate();
  const requestTypeLabel = {
    partnership: 'Partnership',
    collaboration: 'Collaboration request',
  }[conversation.requestType] ?? 'Message request';

  return (
    <article className="conv-request-card">
      <button type="button" className="conv-request-card__main" onClick={() => navigate(`/messages/${conversation.id}`)}>
        <span className="conv-row__avatar-wrap">
          <img className="conv-row__avatar" src={participant.avatar} alt="" />
        </span>
        <span className="conv-request-card__body">
          <span className="conv-request-card__top">
            <strong>{participant.name}</strong>
            <time>{conversation.lastMessageAt}</time>
          </span>
          <span className="conv-request-card__sub">{participant.profession}</span>
          <em className="conv-request-card__preview">{conversation.previewText}</em>
        </span>
        <i className="conv-row__unread-dot" style={{ '--dot-color': conversation.requestType === 'collaboration' ? '#f97316' : '#3b82f6' }} aria-hidden="true" />
      </button>
    </article>
  );
}

function NewConversationSheet({ onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const found = await searchUsers(query);
      setResults(found);
      setLoading(false);
    }, 280);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const handleSelect = async (user) => {
    const conv = await getOrCreateConversation(user.id);
    onClose();
    navigate(`/messages/${conv.id}`);
  };

  return (
    <div className="msg-sheet" role="dialog" aria-modal="true" aria-label="New conversation">
      <button type="button" className="msg-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="msg-sheet__panel">
        <header className="msg-sheet__header">
          <h2>New message</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={17} strokeWidth={2} /></button>
        </header>
        <div className="messages-search" style={{ margin: '4px 0 8px' }}>
          <Search size={15} strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or username"
            type="search"
          />
          {query ? (
            <button type="button" className="messages-search__clear" onClick={() => setQuery('')} aria-label="Clear">
              <X size={13} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
        {loading ? (
          <span className="conv-skeleton" style={{ margin: '4px 0' }} />
        ) : results.length > 0 ? (
          results.map((user) => (
            <button key={user.id} type="button" className="new-conv-user-row" onClick={() => handleSelect(user)}>
              <img src={user.avatar} alt="" className="new-conv-user-row__avatar" />
              <span className="new-conv-user-row__info">
                <strong>{user.name}</strong>
                {user.profession ? <small>{user.profession}</small> : <small>@{user.username}</small>}
              </span>
            </button>
          ))
        ) : query.trim() ? (
          <p className="new-conv-empty">No users found</p>
        ) : (
          <p className="new-conv-empty">Start typing a name or username</p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filter, hasQuery, onExplore }) {
  const title = hasQuery
    ? 'No results found'
    : filter === 'unread'
      ? 'No unread messages'
      : filter === 'creators'
        ? 'No creator conversations yet'
        : filter === 'requests'
          ? 'No message requests'
          : 'No conversations yet';

  const text = hasQuery
    ? 'Try another creator name or live title.'
    : 'Ask creators about their work, equipment or upcoming live experiences.';

  return (
    <div className="messages-empty">
      <ConstellationSvg />
      <h2>{title}</h2>
      <p>{text}</p>
      {filter === 'all' && !hasQuery ? (
        <button type="button" onClick={onExplore}>Explore live perspectives</button>
      ) : null}
    </div>
  );
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => subscribeToMessaging(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const f = params.get('filter');
    if (f && FILTERS.some((x) => x.value === f)) setFilter(f);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const allConversations = useMemo(() => searchConversations(query, filter), [filter, query, version]);
  const requestConversations = useMemo(() => {
    if (filter === 'requests') return [];
    const all = getConversations();
    return all.filter((c) => c.request);
  }, [version, filter]);
  const activeConversations = useMemo(
    () => (filter === 'requests' ? [] : allConversations),
    [allConversations, filter],
  );
  const requestCount = useMemo(() => requestConversations.length, [requestConversations.length]);
  const unreadCount = useMemo(() => getUnreadConversationCount(), [version]);

  const filterCounts = useMemo(() => ({
    requests: requestCount,
  }), [requestCount]);

  return (
    <section className="messages-screen" aria-label="Messages">
      <header className="messages-home-header">
        <div className="messages-title-row">
          <h1>Messages</h1>
          <div className="messages-header-actions">
            <button type="button" className="messages-icon-btn" aria-label="Search" onClick={() => setSearchOpen((o) => !o)}>
              <Search size={19} strokeWidth={1.8} />
            </button>
            <button type="button" className="messages-icon-btn" aria-label="New conversation" onClick={() => setNewConvOpen(true)}>
              <Edit3 size={19} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="messages-search">
          <Search size={15} strokeWidth={1.8} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            type="search"
          />
          {query ? (
            <button type="button" className="messages-search__clear" onClick={() => setQuery('')} aria-label="Clear">
              <X size={13} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      )}

      <div className="messages-filter-row" role="tablist" aria-label="Message filters">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filter === item.value}
            className={filter === item.value ? 'is-active' : ''}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
            {filterCounts[item.value] > 0 ? <span>{filterCounts[item.value]}</span> : null}
          </button>
        ))}
      </div>

      <div className="conv-list" aria-busy={loading}>
        {loading ? (
          <>
            <span className="conv-skeleton" />
            <span className="conv-skeleton" />
            <span className="conv-skeleton" />
          </>
        ) : filter === 'requests' ? (
          allConversations.length ? (
            allConversations.map((c) => <MessageRequestCard key={c.id} conversation={c} />)
          ) : (
            <EmptyState filter={filter} hasQuery={query.trim().length > 0} onExplore={() => navigate('/discover')} />
          )
        ) : activeConversations.length || requestConversations.length ? (
          <>
            {activeConversations.length > 0 && (
              <>
                <p className="conv-section-label">Active conversations</p>
                {activeConversations.map((c) => <ConversationRow key={c.id} conversation={c} />)}
              </>
            )}
            {requestConversations.length > 0 && !query && (
              <>
                <RequestRow requestCount={requestCount} />
                {requestConversations.map((c) => <MessageRequestCard key={c.id} conversation={c} />)}
              </>
            )}
          </>
        ) : (
          <EmptyState filter={filter} hasQuery={query.trim().length > 0} onExplore={() => navigate('/discover')} />
        )}
      </div>

      {newConvOpen ? <NewConversationSheet onClose={() => setNewConvOpen(false)} /> : null}
    </section>
  );
}

