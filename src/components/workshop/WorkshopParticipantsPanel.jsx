import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  HandHelping,
  Hand,
  Lightbulb,
  Radio,
  Shield,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

/**
 * Creator Workshop panel.
 *
 * Two variants:
 *  - `sheet` (default on mobile / creator phone): 3-state bottom sheet
 *    (closed / peek / expanded), draggable handle + explicit controls.
 *  - `embedded` (desktop /studio): no sheet chrome, just the tabs + rows,
 *    rendered inline in a card.
 *
 * All mutation callbacks match the service shape — the panel never mutates
 * on its own.
 */

/* ──────────────────────────────────────────────────────────────── */

/** Compact spotlight state label for a participant row. */
function spotlightState(session, p) {
  if (!p) return null;
  if (session?.spotlightParticipantId === p.id) return { kind: 'live', label: 'Spotlight live' };
  const req = p.pendingSpotlightRequest;
  if (!req) return null;
  if (req.status === 'pending' && req.origin === 'host') return { kind: 'await', label: 'Awaiting consent' };
  if (req.status === 'pending' && req.origin === 'participant') return { kind: 'raised', label: 'Raised hand' };
  if (req.status === 'declined') return { kind: 'declined', label: 'Declined' };
  return null;
}

/* ──────────────────────────────────────────────────────────────── */

export default function WorkshopParticipantsPanel({
  session,
  pendingJoinRequests = [],
  pendingFeedback = [],
  onRespondJoin,
  onViewPrivate,
  onAskPrivateView,
  onRequestSpotlight,
  onStartSpotlight,
  onEndSpotlight,
  onRemoveParticipant,
  onResolveFeedback,
  onRespondParticipantSpotlight,
  onClose,
  variant = 'sheet',
  state = 'peek',
  onStateChange,
  anchor = 'inside',
}) {
  const participants = session?.participants || [];
  const spotlightId = session?.spotlightParticipantId || null;

  /* Unified Requests list — joins + feedback asks. */
  const requestItems = useMemo(() => {
    const joins = pendingJoinRequests.map((r) => ({
      id: r.id,
      kind: 'join',
      userId: r.userId,
      userName: r.userName,
      userAvatar: r.userAvatar,
      createdAt: r.createdAt || 0,
    }));
    const fbs = pendingFeedback.map((f) => ({
      id: f.id,
      kind: 'feedback',
      participantId: f.participantId,
      userName: f.userName,
      createdAt: f.createdAt || 0,
      note: f.note || '',
    }));
    return [...joins, ...fbs].sort((a, b) => b.createdAt - a.createdAt);
  }, [pendingJoinRequests, pendingFeedback]);

  const [tab, setTab] = useState(() => (requestItems.length ? 'requests' : 'participants'));

  // If a new request lands while on Participants tab and the tab was empty,
  // nudge to Requests. Never override a user's explicit selection otherwise.
  const prevRequestsCountRef = useRef(requestItems.length);
  useEffect(() => {
    const prev = prevRequestsCountRef.current;
    if (prev === 0 && requestItems.length > 0 && tab === 'participants') setTab('requests');
    prevRequestsCountRef.current = requestItems.length;
  }, [requestItems.length, tab]);

  const activeTab = tab === 'requests' && requestItems.length === 0 ? 'participants' : tab;

  const sortedParticipants = useMemo(() => (
    [...participants].sort((a, b) => {
      if (a.id === spotlightId) return -1;
      if (b.id === spotlightId) return 1;
      const af = a.pendingFeedback ? 0 : 1;
      const bf = b.pendingFeedback ? 0 : 1;
      if (af !== bf) return af - bf;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    })
  ), [participants, spotlightId]);

  /* ─── Sheet drag (only for variant=sheet) ─── */
  const sheetRef = useRef(null);
  const dragStateRef = useRef(null);

  const onHandlePointerDown = useCallback((e) => {
    if (variant !== 'sheet') return;
    const target = sheetRef.current;
    if (!target) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const rect = target.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: rect.height,
      containerHeight: target.parentElement?.getBoundingClientRect().height || rect.height,
    };
    target.classList.add('is-dragging');
  }, [variant]);

  const onHandlePointerMove = useCallback((e) => {
    const ds = dragStateRef.current;
    if (!ds || e.pointerId !== ds.pointerId) return;
    const target = sheetRef.current;
    if (!target) return;
    const dy = e.clientY - ds.startY;
    // Dragging down ↑ shrinks (less height). Up ↓ grows.
    const nextH = Math.max(0, Math.min(ds.containerHeight, ds.startHeight - dy));
    target.style.height = `${nextH}px`;
  }, []);

  const resolveStateFromHeight = useCallback((heightPx, containerPx) => {
    const ratio = heightPx / Math.max(1, containerPx);
    if (ratio < 0.14) return 'closed';
    if (ratio < 0.5) return 'peek';
    return 'expanded';
  }, []);

  const onHandlePointerUp = useCallback((e) => {
    const ds = dragStateRef.current;
    if (!ds || e.pointerId !== ds.pointerId) return;
    const target = sheetRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const next = resolveStateFromHeight(rect.height, ds.containerHeight);
    target.classList.remove('is-dragging');
    target.style.height = '';
    dragStateRef.current = null;
    if (next !== state) onStateChange?.(next);
  }, [state, resolveStateFromHeight, onStateChange]);

  /* ─── Keyboard: Esc closes, arrows cycle states ─── */
  useEffect(() => {
    if (variant !== 'sheet' || state === 'closed') return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { onStateChange?.('closed'); onClose?.(); }
      else if (e.key === 'ArrowUp') onStateChange?.(state === 'peek' ? 'expanded' : 'expanded');
      else if (e.key === 'ArrowDown') onStateChange?.(state === 'expanded' ? 'peek' : 'closed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant, state, onStateChange, onClose]);

  /* ─── Tab header ─── */
  const tabs = (
    <div className="workshop-sheet-v2__tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'requests'}
        className={`workshop-sheet-v2__tab${activeTab === 'requests' ? ' is-active' : ''}`}
        onClick={() => setTab('requests')}
      >
        Requests
        {requestItems.length > 0 ? (
          <span className="workshop-sheet-v2__tab-badge" aria-label={`${requestItems.length} pending`}>
            {requestItems.length}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'participants'}
        className={`workshop-sheet-v2__tab${activeTab === 'participants' ? ' is-active' : ''}`}
        onClick={() => setTab('participants')}
      >
        Participants
        {participants.length > 0 ? (
          <span className="workshop-sheet-v2__tab-badge is-muted">{participants.length}</span>
        ) : null}
      </button>
    </div>
  );

  /* ─── List body ─── */
  const body = (
    <div className="workshop-sheet-v2__list" data-tab={activeTab}>
      {activeTab === 'requests' ? (
        requestItems.length === 0 ? (
          <div className="workshop-sheet-v2__empty">
            <Users size={16} strokeWidth={1.8} />
            <span>No pending requests.</span>
          </div>
        ) : (
          requestItems.map((item) => item.kind === 'join' ? (
            <RequestRowJoin
              key={item.id}
              item={item}
              onAccept={() => onRespondJoin?.(item.id, { accept: true })}
              onDecline={() => onRespondJoin?.(item.id, { accept: false })}
            />
          ) : (
            <RequestRowFeedback
              key={item.id}
              item={item}
              participant={participants.find((p) => p.id === item.participantId)}
              onViewPrivate={() => onViewPrivate?.(item.participantId)}
              onAskPrivate={() => onAskPrivateView?.(item.participantId)}
              onResolve={() => onResolveFeedback?.(item.id)}
            />
          ))
        )
      ) : (
        sortedParticipants.length === 0 ? (
          <div className="workshop-sheet-v2__empty">
            <Users size={16} strokeWidth={1.8} />
            <span>No participants yet.</span>
          </div>
        ) : (
          sortedParticipants.map((p) => (
            <ParticipantRow
              key={p.id}
              p={p}
              isSpotlighted={p.id === spotlightId}
              state={spotlightState(session, p)}
              onViewPrivate={() => onViewPrivate?.(p.id)}
              onAskPrivate={() => onAskPrivateView?.(p.id)}
              onRequestSpotlight={() => onRequestSpotlight?.(p.id)}
              onStartSpotlight={() => onStartSpotlight?.(p.id)}
              onEndSpotlight={() => onEndSpotlight?.()}
              onAcceptRaisedHand={() => onRespondParticipantSpotlight?.(p.id, { accept: true })}
              onDeclineRaisedHand={() => onRespondParticipantSpotlight?.(p.id, { accept: false })}
              onRemove={() => onRemoveParticipant?.(p.id)}
              onResolveFeedback={() => p.pendingFeedback && onResolveFeedback?.(p.pendingFeedback.id)}
            />
          ))
        )
      )}
    </div>
  );

  /* ─── Embedded (desktop studio) ─── */
  if (variant === 'embedded') {
    return (
      <div className="workshop-sheet-v2 workshop-sheet-v2--embedded">
        <header className="workshop-sheet-v2__head">
          <div className="workshop-sheet-v2__title">
            <Users size={14} strokeWidth={2} />
            <strong>Workshop</strong>
            <span className="workshop-sheet-v2__subtitle">{session?.activityTitle || ''}</span>
          </div>
        </header>
        {tabs}
        {body}
      </div>
    );
  }

  /* ─── Bottom sheet ─── */
  const cycleState = () => {
    if (state === 'closed') onStateChange?.('peek');
    else if (state === 'peek') onStateChange?.('expanded');
    else onStateChange?.('peek');
  };

  const toggleUp = () => onStateChange?.(state === 'expanded' ? 'peek' : 'expanded');

  return (
    <section
      ref={sheetRef}
      className={`workshop-sheet-v2 workshop-sheet-v2--sheet is-${state}${anchor === 'inside' ? ' is-anchored' : ''}`}
      aria-label="Workshop participants"
      aria-hidden={state === 'closed'}
    >
      <div
        className="workshop-sheet-v2__handle-zone"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize participants panel"
      >
        <span className="workshop-sheet-v2__handle" aria-hidden="true" />
      </div>
      <header className="workshop-sheet-v2__head">
        <button
          type="button"
          className="workshop-sheet-v2__title-btn"
          onClick={cycleState}
          aria-label={state === 'expanded' ? 'Collapse to peek' : 'Expand panel'}
        >
          <Users size={14} strokeWidth={2} />
          <strong>Workshop</strong>
          {requestItems.length > 0 ? (
            <span className="workshop-sheet-v2__dot" aria-label={`${requestItems.length} pending`} />
          ) : null}
        </button>
        <div className="workshop-sheet-v2__head-actions">
          <button
            type="button"
            className="workshop-sheet-v2__icon-btn"
            onClick={toggleUp}
            aria-label={state === 'expanded' ? 'Collapse panel' : 'Expand panel'}
          >
            {state === 'expanded' ? <ChevronDown size={14} strokeWidth={2.2} /> : <ChevronUp size={14} strokeWidth={2.2} />}
          </button>
          <button
            type="button"
            className="workshop-sheet-v2__icon-btn"
            onClick={() => { onStateChange?.('closed'); onClose?.(); }}
            aria-label="Close panel"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
      </header>
      {tabs}
      {body}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

function Avatar({ name, src, size = 28 }) {
  const initial = (name || '?')[0]?.toUpperCase();
  return (
    <span
      className="workshop-sheet-v2__avatar"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : initial}
    </span>
  );
}

function RequestRowJoin({ item, onAccept, onDecline }) {
  return (
    <div className="workshop-sheet-v2__row" data-kind="join">
      <Avatar name={item.userName} src={item.userAvatar} />
      <div className="workshop-sheet-v2__who">
        <strong>{item.userName}</strong>
        <span className="workshop-sheet-v2__who-sub">
          <UserPlus size={11} strokeWidth={2} />
          Wants to join
        </span>
      </div>
      <div className="workshop-sheet-v2__row-actions">
        <button type="button" className="workshop-sheet-v2__action is-primary" onClick={onAccept}>
          <Check size={13} strokeWidth={2.2} /> Accept
        </button>
        <button type="button" className="workshop-sheet-v2__action is-ghost" onClick={onDecline}>
          <X size={13} strokeWidth={2.2} /> Decline
        </button>
      </div>
    </div>
  );
}

function RequestRowFeedback({ item, participant, onViewPrivate, onAskPrivate, onResolve }) {
  const canView = Boolean(participant?.hostViewAuthorized);
  return (
    <div className="workshop-sheet-v2__row" data-kind="feedback">
      <Avatar name={item.userName} />
      <div className="workshop-sheet-v2__who">
        <strong>{item.userName}</strong>
        <span className="workshop-sheet-v2__who-sub is-warn">
          <HandHelping size={11} strokeWidth={2} />
          Needs feedback
        </span>
      </div>
      <div className="workshop-sheet-v2__row-actions">
        {canView ? (
          <button type="button" className="workshop-sheet-v2__action" onClick={onViewPrivate}>
            <Eye size={13} strokeWidth={2.2} /> View POV
          </button>
        ) : (
          <button type="button" className="workshop-sheet-v2__action is-ghost" onClick={onAskPrivate}>
            <Eye size={13} strokeWidth={2.2} /> Ask POV
          </button>
        )}
        <button type="button" className="workshop-sheet-v2__action is-primary" onClick={onResolve}>
          <CheckCircle2 size={13} strokeWidth={2.2} /> Done
        </button>
      </div>
    </div>
  );
}

function ParticipantRow({
  p,
  isSpotlighted,
  state,
  onViewPrivate,
  onAskPrivate,
  onRequestSpotlight,
  onStartSpotlight,
  onEndSpotlight,
  onAcceptRaisedHand,
  onDeclineRaisedHand,
  onRemove,
  onResolveFeedback,
}) {
  const canStart = p.publicSpotlightAuthorized && p.cameraOn && !isSpotlighted;
  const raisedHand = state?.kind === 'raised';
  const awaitingConsent = state?.kind === 'await';
  const declined = state?.kind === 'declined';
  const needsFeedback = Boolean(p.pendingFeedback);

  return (
    <div className={`workshop-sheet-v2__row${isSpotlighted ? ' is-spotlighted' : ''}`} data-kind="participant">
      <Avatar name={p.userName} src={p.userAvatar} />
      <div className="workshop-sheet-v2__who">
        <strong>{p.userName}</strong>
        <span className="workshop-sheet-v2__who-sub">
          <span className={`workshop-sheet-v2__ping${p.connectionState === 'connected' ? ' is-good' : ''}`} aria-hidden="true" />
          {p.connectionState === 'connected' ? 'Connected' : 'Reconnecting…'}
          <span className="workshop-sheet-v2__sep" aria-hidden="true">·</span>
          {p.cameraOn ? 'cam on' : 'cam off'}
          {p.hostViewAuthorized ? (
            <>
              <span className="workshop-sheet-v2__sep" aria-hidden="true">·</span>
              <Shield size={10} strokeWidth={2.2} />
              <span>private</span>
            </>
          ) : null}
          {isSpotlighted ? (
            <>
              <span className="workshop-sheet-v2__sep" aria-hidden="true">·</span>
              <span className="workshop-sheet-v2__state is-live">
                <Radio size={10} strokeWidth={2.4} />
                LIVE
              </span>
            </>
          ) : state ? (
            <>
              <span className="workshop-sheet-v2__sep" aria-hidden="true">·</span>
              <span className={`workshop-sheet-v2__state is-${state.kind}`}>
                {state.kind === 'await' ? <Lightbulb size={10} strokeWidth={2.2} />
                  : state.kind === 'raised' ? <Hand size={10} strokeWidth={2.2} />
                  : <X size={10} strokeWidth={2.2} />}
                {state.label}
              </span>
            </>
          ) : null}
          {needsFeedback ? (
            <>
              <span className="workshop-sheet-v2__sep" aria-hidden="true">·</span>
              <span className="workshop-sheet-v2__state is-warn">
                <HandHelping size={10} strokeWidth={2.2} />
                feedback
              </span>
            </>
          ) : null}
        </span>
      </div>

      <div className="workshop-sheet-v2__row-actions">
        {p.hostViewAuthorized ? (
          <button type="button" className="workshop-sheet-v2__action" onClick={onViewPrivate} title="View private POV">
            <Eye size={13} strokeWidth={2.2} />
            <span className="workshop-sheet-v2__action-label">View POV</span>
          </button>
        ) : (
          <button type="button" className="workshop-sheet-v2__action is-ghost" onClick={onAskPrivate} title="Ask private POV access">
            <Eye size={13} strokeWidth={2.2} />
            <span className="workshop-sheet-v2__action-label">Ask POV</span>
          </button>
        )}

        {isSpotlighted ? (
          <button type="button" className="workshop-sheet-v2__action is-danger" onClick={onEndSpotlight} title="End spotlight">
            <X size={13} strokeWidth={2.2} />
            <span className="workshop-sheet-v2__action-label">End</span>
          </button>
        ) : canStart ? (
          <button type="button" className="workshop-sheet-v2__action is-primary" onClick={onStartSpotlight} title="Start public spotlight">
            <Radio size={13} strokeWidth={2.2} />
            <span className="workshop-sheet-v2__action-label">Start</span>
          </button>
        ) : raisedHand ? (
          <>
            <button type="button" className="workshop-sheet-v2__action is-primary" onClick={onAcceptRaisedHand} title="Accept spotlight request">
              <Check size={13} strokeWidth={2.2} />
              <span className="workshop-sheet-v2__action-label">Accept</span>
            </button>
            <button type="button" className="workshop-sheet-v2__action is-ghost" onClick={onDeclineRaisedHand} title="Decline spotlight request">
              <X size={13} strokeWidth={2.2} />
            </button>
          </>
        ) : awaitingConsent ? (
          <span className="workshop-sheet-v2__waiting" title="Waiting for participant">
            <Lightbulb size={12} strokeWidth={2.2} />
            Awaiting…
          </span>
        ) : declined ? (
          <button type="button" className="workshop-sheet-v2__action is-ghost" onClick={onRequestSpotlight} title="Retry spotlight request">
            <Lightbulb size={13} strokeWidth={2.2} />
            <span className="workshop-sheet-v2__action-label">Retry</span>
          </button>
        ) : (
          <button type="button" className="workshop-sheet-v2__action" onClick={onRequestSpotlight} title="Request spotlight">
            <Lightbulb size={13} strokeWidth={2.2} />
            <span className="workshop-sheet-v2__action-label">Spotlight</span>
          </button>
        )}

        {needsFeedback ? (
          <button type="button" className="workshop-sheet-v2__action is-ghost" onClick={onResolveFeedback} title="Mark feedback done">
            <CheckCircle2 size={13} strokeWidth={2.2} />
          </button>
        ) : null}

        <button type="button" className="workshop-sheet-v2__action is-ghost workshop-sheet-v2__action--icon" onClick={onRemove} title="Remove from workshop" aria-label="Remove">
          <UserMinus size={13} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
