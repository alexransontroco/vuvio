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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  if (!live) return null;
  const isLive = live.status === 'live';
  const isUpcoming = live.status === 'upcoming';

  return (
    <div className="conv-context-card">
      <button type="button" className="conv-context-card__dismiss" onClick={onDismiss} aria-label={t('conversation.dismiss')}>
        <X size={14} strokeWidth={2} />
      </button>
      <img className="conv-context-card__thumb" src={live.image} alt="" />
      <div className="conv-context-card__body">
        <p className="conv-context-card__status">
          {isLive ? <><i className="conv-context-card__live-dot" />{t('conversation.liveNow')}</> : null}
          {isUpcoming ? live.statusText : null}
          {!isLive && !isUpcoming ? live.statusText : null}
        </p>
        <strong className="conv-context-card__title">{live.title}</strong>
        <div className="conv-context-card__actions">
          <button
            type="button"
            className="conv-context-card__action is-primary"
            onClick={() => live.id ? navigate(`/watch?live=${encodeURIComponent(live.id)}&mode=view`) : navigate('/watch')}
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
  const { t } = useTranslation();
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
            <span className="msg-unavailable">{t('conversation.liveUnavailable')}</span>
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
  const { t } = useTranslation();
  return (
    <div className="msg-sheet" role="dialog" aria-modal="true" aria-label={t('conversation.optionsAria')}>
      <button type="button" className="msg-sheet__backdrop" onClick={onClose} aria-label={t('common.close')} />
      <div className="msg-sheet__panel">
        <button type="button" onClick={onViewProfile}>
          <UserRound size={17} strokeWidth={1.8} />
          {t('common.viewProfile')}
        </button>
        <button type="button" onClick={onMute}>
          {isMuted ? <BellRing size={17} strokeWidth={1.8} /> : <BellOff size={17} strokeWidth={1.8} />}
          {isMuted ? t('conversation.unmuteNotifications') : t('conversation.muteNotifications')}
        </button>
        <div className="msg-sheet__divider" />
        <button type="button" className="is-danger" onClick={onReport}>
          <Flag size={17} strokeWidth={1.8} />
          {t('common.report')}
        </button>
        <button type="button" className="is-danger" onClick={onBlock}>
          <ShieldBan size={17} strokeWidth={1.8} />
          {t('common.block')}
        </button>
        <button type="button" className="is-danger" onClick={onDelete}>
          <Trash2 size={17} strokeWidth={1.8} />
          {t('conversation.deleteConversation')}
        </button>
      </div>
    </div>
  );
}

function ConfirmSheet({ title, body, confirmLabel, onConfirm, onClose }) {
  const { t } = useTranslation();
  return (
    <div className="msg-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="msg-sheet__backdrop" onClick={onClose} aria-label={t('common.close')} />
      <div className="msg-sheet__panel">
        <header className="msg-sheet__header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X size={17} strokeWidth={2} /></button>
        </header>
        {body ? <p className="msg-sheet__desc">{body}</p> : null}
        <button type="button" className="is-danger" onClick={onConfirm}>{confirmLabel}</button>
        <button type="button" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

function PlusSheet({ onClose }) {
  const { t } = useTranslation();
  const actions = [
    { key: 'shareLive', label: t('conversation.shareALive'), icon: Radio },
  ];
  return (
    <div className="msg-sheet" role="dialog" aria-modal="true" aria-label={t('conversation.attachContent')}>
      <button type="button" className="msg-sheet__backdrop" onClick={onClose} aria-label={t('common.close')} />
      <div className="msg-sheet__panel">
        <p className="msg-sheet__title">{t('common.share')}</p>
        {actions.map((action) => (
          <button key={action.key} type="button" onClick={onClose}>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReportSheet({ onClose, onSubmit }) {
  const { t } = useTranslation();
  const reasons = [
    { key: 'spam', label: t('conversation.reportReasons.spam') },
    { key: 'harassment', label: t('conversation.reportReasons.harassment') },
    { key: 'inappropriate', label: t('conversation.reportReasons.inappropriate') },
    { key: 'fakeProfile', label: t('conversation.reportReasons.fakeProfile') },
    { key: 'other', label: t('conversation.reportReasons.other') },
  ];
  const [reasonKey, setReasonKey] = useState(reasons[0].key);

  return (
    <div className="msg-sheet" role="dialog" aria-modal="true" aria-label={t('common.report')}>
      <button type="button" className="msg-sheet__backdrop" onClick={onClose} aria-label={t('common.close')} />
      <div className="msg-sheet__panel">
        <header className="msg-sheet__header">
          <h2>{t('common.report')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X size={17} strokeWidth={2} /></button>
        </header>
        {reasons.map((item) => (
          <button key={item.key} type="button" className={reasonKey === item.key ? 'is-selected' : ''} onClick={() => setReasonKey(item.key)}>
            {item.label}
          </button>
        ))}
        <button type="button" className="is-primary" onClick={() => onSubmit(reasons.find((r) => r.key === reasonKey)?.label)}>{t('conversation.sendReport')}</button>
      </div>
    </div>
  );
}

function SuggestedQuestions({ questions, onSelect }) {
  const { t } = useTranslation();
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
      <button type="button" className="msg-suggestions__collapse" onClick={() => setVisible(false)} aria-label={t('conversation.collapseSuggestions')}>
        <ChevronDown size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

function MessageComposer({ disabled, onSend, prefill, onPlusOpen }) {
  const { t } = useTranslation();
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
      <button type="button" className="msg-composer__plus" aria-label={t('conversation.attach')} onClick={onPlusOpen} disabled={disabled}>
        <Plus size={20} strokeWidth={1.9} />
      </button>
      <div className="msg-composer__input-wrap">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={disabled ? t('conversation.cannotReply') : t('conversation.writeMessage')}
          disabled={disabled}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button type="button" className="msg-composer__emoji" aria-label={t('conversation.emoji')} disabled={disabled}>
          <Smile size={18} strokeWidth={1.8} />
        </button>
      </div>
      <button
        type="submit"
        className={`msg-composer__send${value.trim() ? ' is-active' : ''}`}
        disabled={!value.trim() || disabled}
        aria-label={t('common.send')}
      >
        <Send size={17} strokeWidth={2} />
      </button>
    </form>
  );
}

export default function ConversationPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  }, [conversation?.messages?.length]);

  if (!conversation || !participant) {
    return (
      <section className="conversation-screen">
        <div className="messages-empty">
          <h2>{t('conversation.notFound')}</h2>
          <button type="button" onClick={() => navigate('/messages')}>{t('conversation.backToMessages')}</button>
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
    <section className="conversation-screen" aria-label={t('conversation.withPerson', { name: participant.name })}>
      <header className="conv-header">
        <button type="button" className="conv-header__back" onClick={() => navigate('/messages')} aria-label={t('common.back')}>
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
            {isLive ? <><i className="conv-header__live-dot" />{t('conversation.liveNowUpper')}</> : participant.liveStatusText}
          </small>
        </div>
        {isLive ? (
          <button type="button" className="conv-header__watch-live" onClick={() => conversation?.relatedLiveId ? navigate(`/watch?live=${encodeURIComponent(conversation.relatedLiveId)}&mode=view`) : navigate('/watch')}>
            {t('conversation.watchLive')}
          </button>
        ) : null}
        <button type="button" className="conv-header__menu" onClick={() => setMenuOpen(true)} aria-label={t('conversation.options')}>
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
            {t('conversation.blockedBanner')}
            <button type="button" onClick={() => unblockUser(conversation.id)}>{t('conversation.unblock')}</button>
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
          title={t('conversation.blockConfirmTitle', { name: participant.name })}
          body={t('conversation.blockConfirmBody')}
          confirmLabel={t('common.block')}
          onConfirm={handleBlock}
          onClose={() => setBlockConfirmOpen(false)}
        />
      ) : null}

      {deleteConfirmOpen ? (
        <ConfirmSheet
          title={t('conversation.deleteConfirmTitle')}
          body={t('conversation.deleteConfirmBody')}
          confirmLabel={t('common.delete')}
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
