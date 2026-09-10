import {
  BellOff,
  BellRing,
  ChevronLeft,
  ChevronDown,
  Ellipsis,
  Flag,
  Plus,
  Radio,
  Send,
  Smile,
  ShieldBan,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  blockUser,
  deleteConversation,
  getConversation,
  getMessageLive,
  getOtherParticipant,
  markConversationAsRead,
  reportUser,
  sendMessage,
  subscribeToMessaging,
  subscribeToConversationMessages,
  toggleMute,
  unblockUser,
} from '../services/messagingService.js';

function LiveContextCard({ live, onDismiss }) {
  const navigate = useNavigate();
  if (!live) return null;
  const isLive = live.status === 'live';
  const isUpcoming = live.status === 'upcoming';

  return (
    <div className="conv-context-card">
      <button type="button" className="conv-context-card__dismiss" onClick={onDismiss} aria-label="Dismiss">
        <X size={14} strokeWidth={2} />
      </button>
      <img className="conv-context-card__thumb" src={live.image} alt="" />
      <div className="conv-context-card__body">
        <p className="conv-context-card__status">
          {isLive ? <><i className="conv-context-card__live-dot" />Live now</> : null}
          {isUpcoming ? live.statusText : null}
          {!isLive && !isUpcoming ? live.statusText : null}
        </p>
        <strong className="conv-context-card__title">{live.title}</strong>
        <div className="conv-context-card__actions">
          <button
            type="button"
            className="conv-context-card__action is-primary"
            onClick={() => navigate('/watch')}
          >
            {live.actionLabel}
          </button>
          {live.secondaryActionLabel ? (
            <button type="button" className="conv-context-card__action">
              {live.secondaryActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SystemNote({ text }) {
  if (!text) return null;
  return <p className="conv-system-note">{text}</p>;
}

function MessageBubble({ message, prevSenderId, participant, currentUid }) {
  const mine = currentUid ? message.senderId === currentUid : message.senderId === 'current-user';
  const live = message.liveId ? getMessageLive(message.liveId) : null;
  const showAvatar = !mine && prevSenderId !== message.senderId;
  const isSystem = message.type === 'system';

  if (isSystem) {
    return <p className="conv-system-note">{message.text}</p>;
  }

  return (
    <div className={`msg-row${mine ? ' is-mine' : ''}`}>
      {!mine ? (
        <span className={`msg-avatar${showAvatar ? '' : ' is-hidden'}`}>
          {showAvatar ? <img src={participant?.avatar} alt="" /> : null}
        </span>
      ) : null}
      <div className={`msg-bubble${mine ? ' is-mine' : ''}`}>
        {message.type === 'live' || message.type === 'replay' ? (
          live ? (
            <div className="msg-live-card">
              <img src={live.image} alt="" />
              <div className="msg-live-card__body">
                <small>{live.statusText}</small>
                <strong>{live.title}</strong>
                <span>{live.creator} · {live.location}</span>
                <b>{live.actionLabel}</b>
              </div>
            </div>
          ) : (
            <span className="msg-unavailable">This live is no longer available.</span>
          )
        ) : (
          <p>{message.text}</p>
        )}
        <small className="msg-time">
          {message.createdAt}
          {mine ? (
            <em className={`msg-status${message.status === 'read' ? ' is-read' : ''}`}>
              {message.status === 'read' ? '✓✓' : '✓'}
            </em>
          ) : null}
        </small>
      </div>
    </div>
  );
}

function ConversationMenu({ participant, isMuted, onClose, onBlock, onDelete, onReport, onMute, onViewProfile }) {
  return (
    <div className="msg-sheet" role="dialog" aria-modal="true" aria-label="Conversation options">
      <button type="button" className="msg-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="msg-sheet__panel">
        <button type="button" onClick={onViewProfile}>
          <UserRound size={17} strokeWidth={1.8} />
          View profile
        </button>
        <button type="button" onClick={onMute}>
          {isMuted ? <BellRing size={17} strokeWidth={1.8} /> : <BellOff size={17} strokeWidth={1.8} />}
          {isMuted ? 'Unmute notifications' : 'Mute notifications'}
        </button>
        <div className="msg-sheet__divider" />
        <button type="button" className="is-danger" onClick={onReport}>
          <Flag size={17} strokeWidth={1.8} />
          Report
        </button>
        <button type="button" className="is-danger" onClick={onBlock}>
          <ShieldBan size={17} strokeWidth={1.8} />
          Block
        </button>
        <button type="button" className="is-danger" onClick={onDelete}>
          <Trash2 size={17} strokeWidth={1.8} />
          Delete conversation
        </button>
      </div>
    </div>
  );
}

function ConfirmSheet({ title, body, confirmLabel, onConfirm, onClose }) {
  return (
    <div className="msg-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="msg-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="msg-sheet__panel">
        <header className="msg-sheet__header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={17} strokeWidth={2} /></button>
        </header>
        {body ? <p className="msg-sheet__desc">{body}</p> : null}
        <button type="button" className="is-danger" onClick={onConfirm}>{confirmLabel}</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function PlusSheet({ onClose }) {
  const actions = [
    { label: 'Share a live', icon: Radio },
  ];
  return (
    <div className="msg-sheet" role="dialog" aria-modal="true" aria-label="Attach content">
      <button type="button" className="msg-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="msg-sheet__panel">
        <p className="msg-sheet__title">Share</p>
        {actions.map((action) => (
          <button key={action.label} type="button" onClick={onClose}>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReportSheet({ onClose, onSubmit }) {
  const reasons = ['Spam', 'Harassment', 'Inappropriate content', 'Fake profile', 'Other'];
  const [reason, setReason] = useState(reasons[0]);

  return (
    <div className="msg-sheet" role="dialog" aria-modal="true" aria-label="Report">
      <button type="button" className="msg-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="msg-sheet__panel">
        <header className="msg-sheet__header">
          <h2>Report</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={17} strokeWidth={2} /></button>
        </header>
        {reasons.map((item) => (
          <button key={item} type="button" className={reason === item ? 'is-selected' : ''} onClick={() => setReason(item)}>
            {item}
          </button>
        ))}
        <button type="button" className="is-primary" onClick={() => onSubmit(reason)}>Send report</button>
      </div>
    </div>
  );
}

function SuggestedQuestions({ questions, onSelect }) {
  const [visible, setVisible] = useState(true);
  if (!visible || !questions?.length) return null;
  return (
    <div className="msg-suggestions">
      <div className="msg-suggestions__chips">
        {questions.map((q) => (
          <button key={q} type="button" className="msg-suggestion-chip" onClick={() => { onSelect(q); setVisible(false); }}>
            {q}
          </button>
        ))}
      </div>
      <button type="button" className="msg-suggestions__collapse" onClick={() => setVisible(false)} aria-label="Collapse suggestions">
        <ChevronDown size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

function MessageComposer({ disabled, onSend, prefill, onPlusOpen }) {
  const [value, setValue] = useState(prefill ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (prefill) setValue(prefill);
  }, [prefill]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <form
      className="msg-composer"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <button type="button" className="msg-composer__plus" aria-label="Attach" onClick={onPlusOpen} disabled={disabled}>
        <Plus size={20} strokeWidth={1.9} />
      </button>
      <div className="msg-composer__input-wrap">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={disabled ? 'You cannot reply.' : 'Write a message'}
          disabled={disabled}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button type="button" className="msg-composer__emoji" aria-label="Emoji" disabled={disabled}>
          <Smile size={18} strokeWidth={1.8} />
        </button>
      </div>
      <button
        type="submit"
        className={`msg-composer__send${value.trim() ? ' is-active' : ''}`}
        disabled={!value.trim() || disabled}
        aria-label="Send"
      >
        <Send size={17} strokeWidth={2} />
      </button>
    </form>
  );
}

export default function ConversationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const myUid = user?.uid ?? 'current-user';
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const [version, setVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contextDismissed, setContextDismissed] = useState(false);
  const [prefillValue, setPrefillValue] = useState(searchParams.get('prefill') ?? '');
  const endRef = useRef(null);

  useEffect(() => subscribeToMessaging(() => setVersion((v) => v + 1)), []);
  useEffect(() => subscribeToConversationMessages(conversationId), [conversationId]);

  const conversation = useMemo(() => getConversation(conversationId), [conversationId, version]);
  const participant = conversation ? getOtherParticipant(conversation) : null;
  const relatedLive = !contextDismissed && conversation?.relatedLiveId ? getMessageLive(conversation.relatedLiveId) : null;

  useEffect(() => {
    if (conversationId) markConversationAsRead(conversationId);
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation?.messages.length]);

  if (!conversation || !participant) {
    return (
      <section className="conversation-screen">
        <div className="messages-empty">
          <h2>Conversation not found</h2>
          <button type="button" onClick={() => navigate('/messages')}>Back to messages</button>
        </div>
      </section>
    );
  }

  const blocked = conversation.blocked;
  const isLive = participant.liveStatus === 'live';
  const userSentMessages = conversation.messages.filter((m) => m.senderId === myUid);
  const showSuggestions = userSentMessages.length === 0 && participant.suggestedQuestions?.length > 0;

  const handleBlock = async () => {
    await blockUser(conversation.id);
    setBlockConfirmOpen(false);
  };

  const handleDelete = async () => {
    await deleteConversation(conversation.id);
    navigate('/messages');
  };

  const handleMute = async () => {
    await toggleMute(conversation.id);
    setMenuOpen(false);
  };

  const handleViewProfile = () => {
    setMenuOpen(false);
    navigate(`/profile/${participant.username || participant.id}`);
  };

  return (
    <section className="conversation-screen" aria-label={`Conversation with ${participant.name}`}>
      <header className="conv-header">
        <button type="button" className="conv-header__back" onClick={() => navigate('/messages')} aria-label="Back">
          <ChevronLeft size={22} strokeWidth={1.9} />
        </button>
        <span className="conv-header__avatar-wrap">
          <img className="conv-header__avatar" src={participant.avatar} alt="" />
          {isLive ? <i className="conv-header__live-ring" aria-hidden="true" /> : null}
        </span>
        <div className="conv-header__info">
          <strong className="conv-header__name">{participant.name}</strong>
          <small className="conv-header__sub">
            {participant.profession}{participant.location ? ` · ${participant.location}` : ''}
          </small>
          <small className="conv-header__status">
            {isLive ? <><i className="conv-header__live-dot" />LIVE now</> : participant.liveStatusText}
          </small>
        </div>
        {isLive ? (
          <button type="button" className="conv-header__watch-live" onClick={() => navigate('/watch')}>
            Watch live
          </button>
        ) : null}
        <button type="button" className="conv-header__menu" onClick={() => setMenuOpen(true)} aria-label="Options">
          <Ellipsis size={19} strokeWidth={1.9} />
        </button>
      </header>

      <main className="conversation-body">
        {relatedLive ? (
          <LiveContextCard live={relatedLive} onDismiss={() => setContextDismissed(true)} />
        ) : null}

        {conversation.contextNote ? (
          <SystemNote text={conversation.contextNote} />
        ) : null}

        {blocked ? (
          <div className="conv-blocked-banner">
            You blocked this user.
            <button type="button" onClick={() => unblockUser(conversation.id)}>Unblock</button>
          </div>
        ) : null}

        {conversation.messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            prevSenderId={conversation.messages[index - 1]?.senderId}
            participant={participant}
            currentUid={myUid}
          />
        ))}
        <div ref={endRef} />
      </main>

      {showSuggestions ? (
        <SuggestedQuestions
          questions={participant.suggestedQuestions}
          onSelect={(q) => setPrefillValue(q)}
        />
      ) : null}

      <MessageComposer
        disabled={blocked}
        prefill={prefillValue}
        onSend={(text) => sendMessage(conversation.id, text)}
        onPlusOpen={() => setPlusOpen(true)}
      />

      {menuOpen ? (
        <ConversationMenu
          participant={participant}
          isMuted={conversation.muted}
          onClose={() => setMenuOpen(false)}
          onBlock={() => { setMenuOpen(false); setBlockConfirmOpen(true); }}
          onDelete={() => { setMenuOpen(false); setDeleteConfirmOpen(true); }}
          onReport={() => { setMenuOpen(false); setReportOpen(true); }}
          onMute={handleMute}
          onViewProfile={handleViewProfile}
        />
      ) : null}

      {blockConfirmOpen ? (
        <ConfirmSheet
          title={`Block ${participant.name}?`}
          body="They won't be able to message you and you won't see their content."
          confirmLabel="Block"
          onConfirm={handleBlock}
          onClose={() => setBlockConfirmOpen(false)}
        />
      ) : null}

      {deleteConfirmOpen ? (
        <ConfirmSheet
          title="Delete conversation?"
          body="This will permanently delete the conversation for you."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirmOpen(false)}
        />
      ) : null}

      {reportOpen ? (
        <ReportSheet
          onClose={() => setReportOpen(false)}
          onSubmit={(reason) => { reportUser(conversation.id, reason); setReportOpen(false); }}
        />
      ) : null}

      {plusOpen ? <PlusSheet onClose={() => setPlusOpen(false)} /> : null}
    </section>
  );
}
