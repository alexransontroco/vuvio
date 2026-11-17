/**
 * /workshop-demo — WORKSHOP UX PLAYGROUND
 * ---------------------------------------
 * Desktop-first harness for the Workshop / Join Activity feature. Lets you
 * walk the complete Viewer → Participant → Creator journey on a single
 * device, driven by the in-memory mock service (no Firestore, no real
 * multi-point video). The state is shared across role switches: the same
 * session persists as you flip tabs.
 *
 * All media pipes are SIMULATED (data-sim attribute). Camera preview uses
 * local getUserMedia only after an explicit toggle; nothing is transmitted.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  Check,
  Hand,
  HandHelping,
  LogOut,
  Lightbulb,
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  Rows3,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { isWorkshopEnabled } from '../config/workshop.js';
import * as mockSvc from '../services/workshopService.mock.js';
import { useWorkshopSession } from '../hooks/useWorkshopSession.js';
import { classifyViewer, statusBadge } from '../utils/workshopViewerStatus.js';
import WorkshopJoinCTA from '../components/workshop/WorkshopJoinCTA.jsx';
import WorkshopJoinSheet from '../components/workshop/WorkshopJoinSheet.jsx';
import WorkshopParticipantHUD from '../components/workshop/WorkshopParticipantHUD.jsx';
import WorkshopParticipantsPanel from '../components/workshop/WorkshopParticipantsPanel.jsx';
import WorkshopSpotlightConsentSheet from '../components/workshop/WorkshopSpotlightConsentSheet.jsx';
import WorkshopSpotlightPip from '../components/workshop/WorkshopSpotlightPip.jsx';
import WorkshopToast from '../components/workshop/WorkshopToast.jsx';
import '../styles/pages/workshop.css';

const DEMO_LIVE_ID = 'demo-workshop-live';
const DEMO_HOST = { userId: 'host-malo', userName: 'Malo', userAvatar: null };
const DEMO_SELF = { userId: 'viewer-me', userName: 'You', userAvatar: null };
const DEMO_SIM_VIEWERS = [
  { userId: 'viewer-emma', userName: 'Emma', userAvatar: null },
  { userId: 'viewer-tom',  userName: 'Tom',  userAvatar: null },
  { userId: 'viewer-lea',  userName: 'Léa',  userAvatar: null },
  { userId: 'viewer-sam',  userName: 'Sam',  userAvatar: null },
];

const ROLES = /** @type {const} */ (['viewer', 'participant', 'creator']);
const COMPARE_MIN_WIDTH = 1400;

function initialHostConfig() {
  return {
    mode: 'workshop',
    maxParticipants: 6,
    audience: 'everyone',
    activityTitle: 'Cook With Me — The 20-minute pan sauce',
    hostId: DEMO_HOST.userId,
    hostName: DEMO_HOST.userName,
  };
}

function humanizeLog(session, entry) {
  const nameOf = (id) => session?.participants.find((p) => p.id === id)?.userName
    || session?.joinRequests.find((r) => r.userId === id)?.userName
    || id;
  const { kind } = entry;
  switch (kind) {
    case 'session.configured': return 'Session configured';
    case 'session.updated': return `Session updated (${Object.keys(entry.changed || {}).join(', ') || 'config'})`;
    case 'join.requested': return `${nameOf(entry.userId)} requested to join`;
    case 'join.accepted': return `Host accepted ${nameOf(entry.userId)}`;
    case 'join.declined': return `Host declined ${nameOf(entry.userId)}`;
    case 'join.declined.full': return `Workshop full — request declined`;
    case 'join.cancelled': return 'Join request cancelled';
    case 'participant.left': return `${entry.userName || 'Participant'} left`;
    case 'participant.removed': return `Host removed ${nameOf(entry.participantId)}`;
    case 'participant.media': return `${nameOf(entry.participantId)} · camera ${entry.cameraOn ? 'on' : 'off'} · mic ${entry.micOn ? 'on' : 'off'}`;
    case 'hostView.updated': return `Private-view permission: ${entry.allow ? 'granted' : 'revoked'}`;
    case 'feedback.requested': return `${nameOf(entry.participantId)} asked for feedback`;
    case 'feedback.resolved': return 'Feedback resolved';
    case 'spotlight.host.requested': return `Host requested spotlight for ${nameOf(entry.participantId)}`;
    case 'spotlight.participant.requested': return `${nameOf(entry.participantId)} raised hand for spotlight`;
    case 'spotlight.consent.granted': return `${nameOf(entry.participantId)} granted public broadcast`;
    case 'spotlight.consent.declined': return `${nameOf(entry.participantId)} declined spotlight`;
    case 'spotlight.consent.set': return `Public consent updated for ${nameOf(entry.participantId)} (${entry.allow ? 'yes' : 'no'})`;
    case 'spotlight.host.accepted': return `Host accepted spotlight for ${nameOf(entry.participantId)}`;
    case 'spotlight.host.declined': return `Host declined spotlight for ${nameOf(entry.participantId)}`;
    case 'spotlight.started': return `${nameOf(entry.participantId)} is now featured (public spotlight live)`;
    case 'spotlight.ended': return `Spotlight ended${entry.by ? ` by ${entry.by}` : ''}`;
    case 'spotlight.ended.leave': return 'Spotlight ended — participant left';
    case 'spotlight.ended.cameraOff': return 'Spotlight ended — camera off';
    case 'spotlight.ended.revoked': return 'Spotlight ended — consent revoked';
    case 'spotlight.start.blocked.noConsent': return 'Blocked — participant has not granted public consent';
    case 'spotlight.start.blocked.cameraOff': return 'Blocked — participant camera is off';
    case 'spotlight.layout.swapped': return `POV layout swapped (${entry.swapped ? 'participant main' : 'host main'})`;
    default: return kind;
  }
}

function timeLabel(at) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// classifyViewer + statusBadge live in src/utils/workshopViewerStatus.js so
// they can be unit-tested without a bundler.

/* ───────────────────────────────────────────────────────────────────────── */

/**
 * Phone frame — a genuine ~400×720 container (no transform scale) so that
 * every workshop component renders at native mobile size and remains fully
 * clickable. Workshop overlays (CTA, HUD, sheets, PiP) all use
 * `position: absolute` relative to this stage.
 */
function PhoneFrame({ children, title = 'Cook With Me', subtitle = 'Lyon · Malo' }) {
  return (
    <div className="workshop-pg-phone" aria-label="Simulated mobile preview">
      <div className="workshop-pg-phone__stage">
        <img
          className="workshop-pg-phone__bg"
          src="/pov/used/chef-pov.jpg"
          alt=""
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="workshop-pg-phone__overlay" />
        <span className="workshop-pg-phone__sim">Simulated POV · Mock video</span>
        <span className="workshop-pg-phone__badge">LIVE</span>
        <div className="workshop-pg-phone__meta">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

export default function WorkshopDemoPage() {
  const navigate = useNavigate();
  const flagOn = isWorkshopEnabled();

  // Fresh session on first mount. We DO NOT reset on unmount — leaving the
  // tab should not blow state away mid-test; only the Reset button does.
  useEffect(() => {
    mockSvc.resetSession(DEMO_LIVE_ID, initialHostConfig());
  }, []);

  // Preserve each participant's local MediaStream across role switches so
  // that leaving the Participant tab doesn't kill the camera. Stored by
  // participantId; the Participant HUD and the Spotlight PiP both read it.
  const streamRefs = useRef(new Map());
  const getStreamRef = useCallback((id) => {
    if (!streamRefs.current.has(id)) streamRefs.current.set(id, { current: null });
    return streamRefs.current.get(id);
  }, []);

  const [role, setRole] = useState('viewer');
  const [compare, setCompare] = useState(false);
  const [canCompare, setCanCompare] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const check = () => setCanCompare(window.innerWidth >= COMPARE_MIN_WIDTH);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { if (!canCompare) setCompare(false); }, [canCompare]);

  // Single shared hook — the mock service is keyed by liveId, so all
  // mutations through this hook are reflected to every role instance.
  const self = useWorkshopSession({
    liveId: DEMO_LIVE_ID,
    viewer: DEMO_SELF,
    hostConfig: initialHostConfig(),
  });
  const host = useWorkshopSession({ liveId: DEMO_LIVE_ID, viewer: DEMO_HOST });

  const session = self.session;
  const participants = session?.participants || [];

  // Impersonation is bound to a USER identity (stable), not a participantId
  // (which disappears when the user leaves). We resolve the viewer's status
  // from the session so Pending / Active / Left / Declined / NotJoined all
  // remain representable.
  const personas = useMemo(() => [DEMO_SELF, ...DEMO_SIM_VIEWERS], []);
  const [impersonatedUserId, setImpersonatedUserId] = useState(DEMO_SIM_VIEWERS[0].userId);

  const impersonatedPersona = useMemo(
    () => personas.find((p) => p.userId === impersonatedUserId) || null,
    [personas, impersonatedUserId],
  );

  const viewerStatus = useMemo(
    () => classifyViewer(session, impersonatedUserId),
    [session, impersonatedUserId],
  );
  const focusedParticipant = viewerStatus.kind === 'active' ? viewerStatus.participant : null;

  /* ── Mobile: simulation panel drawer ──────────────────────── */
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  /* ── Creator sheet state (closed / peek / expanded) ───────── */
  const [creatorSheetState, setCreatorSheetState] = useState('closed');

  /* ── Discrete creator notification (non-blocking) ─────────── */
  const [creatorIncoming, setCreatorIncoming] = useState(null);
  const prevRequestIdsRef = useRef(new Set());
  const prevFeedbackIdsRef = useRef(new Set());

  useEffect(() => {
    const currentRequestIds = new Set(host.pendingJoinRequests.map((r) => r.id));
    const currentFeedbackIds = new Set(host.pendingFeedback.map((f) => f.id));
    // Fire only on brand-new entries.
    let fresh = null;
    for (const r of host.pendingJoinRequests) {
      if (!prevRequestIdsRef.current.has(r.id)) {
        fresh = { kind: 'join', id: r.id, userName: r.userName };
        break;
      }
    }
    if (!fresh) {
      for (const f of host.pendingFeedback) {
        if (!prevFeedbackIdsRef.current.has(f.id)) {
          fresh = { kind: 'feedback', id: f.id, userName: f.userName };
          break;
        }
      }
    }
    prevRequestIdsRef.current = currentRequestIds;
    prevFeedbackIdsRef.current = currentFeedbackIds;
    if (fresh) setCreatorIncoming(fresh);
  }, [host.pendingJoinRequests, host.pendingFeedback]);

  // Auto-dismiss after 5s; also clear if the request is no longer pending.
  useEffect(() => {
    if (!creatorIncoming) return undefined;
    const stillPending = creatorIncoming.kind === 'join'
      ? host.pendingJoinRequests.some((r) => r.id === creatorIncoming.id)
      : host.pendingFeedback.some((f) => f.id === creatorIncoming.id);
    if (!stillPending) { setCreatorIncoming(null); return undefined; }
    const timer = window.setTimeout(() => setCreatorIncoming(null), 5200);
    return () => window.clearTimeout(timer);
  }, [creatorIncoming, host.pendingJoinRequests, host.pendingFeedback]);

  /* ── Viewer toasts (self-centric) ─────────────────────────── */
  const [toast, setToast] = useState(null);
  const prevJoinStatus = useRef(self.myJoinRequest?.status);
  useEffect(() => {
    const status = self.myJoinRequest?.status;
    if (prevJoinStatus.current !== 'accepted' && status === 'accepted') {
      setToast({ icon: 'join', title: 'You joined the workshop' });
    } else if (prevJoinStatus.current !== 'declined' && status === 'declined') {
      setToast({ icon: 'join', title: 'Host declined your request' });
    }
    prevJoinStatus.current = status;
  }, [self.myJoinRequest?.status]);

  /* ── Consent sheets in the phone preview ──────────────────── */
  const [viewerJoinSheetOpen, setViewerJoinSheetOpen] = useState(false);
  const [participantConsentOpen, setParticipantConsentOpen] = useState(false);
  const [hostConsentOpen, setHostConsentOpen] = useState(false);

  // Participant-side: show consent sheet when host initiates a spotlight req.
  useEffect(() => {
    const pending = focusedParticipant?.pendingSpotlightRequest;
    setParticipantConsentOpen(
      pending?.status === 'pending' && pending.origin === 'host',
    );
  }, [focusedParticipant?.pendingSpotlightRequest?.id, focusedParticipant?.pendingSpotlightRequest?.status]);

  // Host-side: show consent sheet when a participant raises their hand.
  const hostIncomingSpotlight = useMemo(() => (
    participants.find((p) => p.pendingSpotlightRequest?.origin === 'participant' && p.pendingSpotlightRequest.status === 'pending')
  ), [participants]);
  useEffect(() => {
    setHostConsentOpen(Boolean(hostIncomingSpotlight));
  }, [hostIncomingSpotlight?.id, hostIncomingSpotlight?.pendingSpotlightRequest?.id]);

  /* ── Reset / Exit ─────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    streamRefs.current.forEach((ref) => {
      if (ref.current) {
        ref.current.getTracks().forEach((track) => track.stop());
        ref.current = null;
      }
    });
    streamRefs.current = new Map();
    setViewerJoinSheetOpen(false);
    setParticipantConsentOpen(false);
    setHostConsentOpen(false);
    setImpersonatedUserId(DEMO_SIM_VIEWERS[0].userId);
    setToast(null);
    setCreatorIncoming(null);
    setCreatorSheetState('closed');
    prevRequestIdsRef.current = new Set();
    prevFeedbackIdsRef.current = new Set();
    mockSvc.resetSession(DEMO_LIVE_ID, initialHostConfig());
  }, []);

  const handleExit = useCallback(() => {
    navigate('/watch');
  }, [navigate]);

  /* ── Spotlight stream lookup ──────────────────────────────── */
  const spotlightParticipant = self.spotlightParticipant;
  const spotlightStream = spotlightParticipant ? getStreamRef(spotlightParticipant.id).current : null;

  if (!flagOn) {
    return (
      <main className="workshop-pg">
        <header className="workshop-pg-header">
          <div className="workshop-pg-header__brand">
            <span className="workshop-pg-header__eyebrow">Vuvio</span>
            <h1>Workshop Playground</h1>
          </div>
        </header>
        <section className="workshop-pg-flag-off">
          <strong>Feature flag is OFF.</strong>
          <p>Enable the workshop flag to use the Playground. In the browser console:</p>
          <pre><code>localStorage.setItem('vuvio_workshop_flag', '1'); location.reload();</code></pre>
        </section>
      </main>
    );
  }

  const rolesToRender = compare ? ['viewer', 'creator'] : [role];

  return (
    <main className="workshop-pg">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="workshop-pg-header">
        <div className="workshop-pg-header__brand">
          <span className="workshop-pg-header__eyebrow">Vuvio</span>
          <h1>Workshop Playground</h1>
          <p>Test the complete Workshop experience across different roles. All video and state are simulated.</p>
        </div>
        <div className="workshop-pg-header__actions">
          <span className="workshop-pg-pill workshop-pg-pill--ok" title="Mock session">
            <span className="workshop-pg-pill__dot" /> Simulation active
          </span>
          <button type="button" className="workshop-pg-btn" onClick={handleReset}>
            <RefreshCw size={14} strokeWidth={2.2} />
            Reset session
          </button>
          <button type="button" className="workshop-pg-btn workshop-pg-btn--ghost" onClick={handleExit}>
            <LogOut size={14} strokeWidth={2.2} />
            Exit demo
          </button>
        </div>
      </header>

      {/* ── Role tabs ──────────────────────────────────────── */}
      <nav className="workshop-pg-tabs" role="tablist" aria-label="Role selector">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={!compare && role === r}
            className={`workshop-pg-tab${!compare && role === r ? ' is-active' : ''}`}
            disabled={compare}
            onClick={() => { setRole(r); setCompare(false); }}
          >
            {r === 'viewer' ? <Users size={15} strokeWidth={2.2} />
              : r === 'participant' ? <Hand size={15} strokeWidth={2.2} />
              : <Radio size={15} strokeWidth={2.2} />}
            {r === 'viewer' ? 'Viewer' : r === 'participant' ? 'Participant' : 'Creator'}
          </button>
        ))}
        <button
          type="button"
          className={`workshop-pg-tab workshop-pg-tab--compare${compare ? ' is-active' : ''}`}
          disabled={!canCompare}
          onClick={() => setCompare((v) => !v)}
          title={canCompare ? 'Toggle side-by-side Viewer + Creator' : 'Window too narrow for compare mode'}
        >
          <Rows3 size={15} strokeWidth={2.2} />
          Compare roles
        </button>
      </nav>

      {/* ── Participant picker (only in participant role) ──── */}
      {!compare && role === 'participant' ? (
        <div className="workshop-pg-picker">
          <label className="workshop-pg-picker__label">Impersonate</label>
          <div className="workshop-pg-picker__chips" role="radiogroup">
            {personas.map((persona) => {
              const status = classifyViewer(session, persona.userId);
              const active = impersonatedUserId === persona.userId;
              const isSpotlit = status.kind === 'active'
                && session?.spotlightParticipantId === status.participant.id;
              return (
                <button
                  key={persona.userId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`workshop-pg-chip${active ? ' is-active' : ''} workshop-pg-chip--${status.kind}`}
                  onClick={() => setImpersonatedUserId(persona.userId)}
                >
                  <span className="workshop-pg-chip__avatar">{(persona.userName || '?')[0]?.toUpperCase()}</span>
                  <span className="workshop-pg-chip__name">{persona.userName}</span>
                  <span className="workshop-pg-chip__state">{statusBadge(status.kind)}</span>
                  {isSpotlit ? <span className="workshop-pg-chip__flag">live</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── Main grid: preview(s) + simulation panel ───────── */}
      <div className={`workshop-pg-grid${compare ? ' is-compare' : ''}`}>
        <div className="workshop-pg-stage">
          {rolesToRender.map((currentRole) => (
            <RolePreview
              key={currentRole}
              role={currentRole}
              session={session}
              self={self}
              host={host}
              focusedParticipant={focusedParticipant}
              viewerStatus={viewerStatus}
              impersonatedPersona={impersonatedPersona}
              viewerJoinSheetOpen={!compare && viewerJoinSheetOpen}
              setViewerJoinSheetOpen={setViewerJoinSheetOpen}
              participantConsentOpen={!compare && participantConsentOpen}
              setParticipantConsentOpen={setParticipantConsentOpen}
              hostConsentOpen={!compare && hostConsentOpen}
              setHostConsentOpen={setHostConsentOpen}
              hostIncomingSpotlight={hostIncomingSpotlight}
              getStreamRef={getStreamRef}
              spotlightStream={spotlightStream}
              toast={toast}
              onDismissToast={() => setToast(null)}
              compact={compare}
              creatorSheetState={creatorSheetState}
              onCreatorSheetStateChange={setCreatorSheetState}
              creatorIncoming={creatorIncoming}
              onDismissCreatorIncoming={() => setCreatorIncoming(null)}
            />
          ))}
        </div>

        <aside className={`workshop-pg-controls${mobilePanelOpen ? ' is-open' : ''}`} aria-label="Simulation controls">
          <button
            type="button"
            className="workshop-pg-controls__mobile-toggle"
            onClick={() => setMobilePanelOpen((v) => !v)}
            aria-expanded={mobilePanelOpen}
          >
            {mobilePanelOpen ? 'Hide controls' : 'Simulation Controls'}
          </button>
          <SimulationControls
            role={compare ? 'creator' : role}
            session={session}
            self={self}
            host={host}
            focusedParticipant={focusedParticipant}
            impersonatedPersona={impersonatedPersona}
            viewerStatus={viewerStatus}
            personas={personas}
            onPickPersona={setImpersonatedUserId}
          />
          <ActivityLog session={session} />
        </aside>
      </div>
    </main>
  );
}

/* ═════════════════════════════════════════════════════════════════════════ */

/**
 * Renders one role's phone preview. Kept separate so the Compare view can
 * mount two at once without duplicating absolute positioning tricks.
 */
function RolePreview({
  role,
  session,
  self,
  host,
  focusedParticipant,
  viewerStatus,
  impersonatedPersona,
  viewerJoinSheetOpen,
  setViewerJoinSheetOpen,
  participantConsentOpen,
  setParticipantConsentOpen,
  hostConsentOpen,
  setHostConsentOpen,
  hostIncomingSpotlight,
  getStreamRef,
  spotlightStream,
  toast,
  onDismissToast,
  compact,
  creatorSheetState,
  onCreatorSheetStateChange,
  creatorIncoming,
  onDismissCreatorIncoming,
}) {
  const pendingCount = host.pendingJoinRequests.length + host.pendingFeedback.length;
  const participantsCount = session?.participants.length || 0;
  const personaLabel = impersonatedPersona?.userName;
  const stateLabel = role === 'participant'
    ? (personaLabel ? `${personaLabel} · ${statusBadge(viewerStatus?.kind || 'absent')}` : '—')
    : null;
  return (
    <div className={`workshop-pg-preview${compact ? ' is-compact' : ''}`}>
      <header className="workshop-pg-preview__header">
        {role === 'viewer' ? <Users size={14} strokeWidth={2.2} />
          : role === 'participant' ? <Hand size={14} strokeWidth={2.2} />
          : <Radio size={14} strokeWidth={2.2} />}
        <strong>
          {role === 'viewer' ? 'Viewer' : role === 'participant' ? 'Participant' : 'Creator'}
        </strong>
        <span>
          {role === 'viewer' ? 'You (not joined yet)'
            : role === 'participant' ? stateLabel
            : 'Malo (host)'}
        </span>
      </header>

      <PhoneFrame>
        {/* Toast is only shown on the current main phone (not in compare view). */}
        {!compact && toast ? <WorkshopToast {...toast} onDismiss={onDismissToast} /> : null}

        {/* Spotlight PiP is a cross-role element: anyone seeing the public
            POV should see the spotlighted participant. */}
        {session?.spotlightParticipantId
          && (role !== 'participant' || session.spotlightParticipantId !== focusedParticipant?.id) ? (
          <WorkshopSpotlightPip
            participant={self.spotlightParticipant}
            mediaStream={spotlightStream}
            onEnd={() => host.actions.endSpotlight({ by: role === 'creator' ? 'host' : 'viewer' })}
          />
        ) : null}

        {role === 'viewer' ? (
          <>
            {!self.myParticipant ? (
              <WorkshopJoinCTA
                mode={session?.mode}
                participationConfig={{ activityTitle: session?.activityTitle }}
                myParticipant={self.myParticipant}
                myJoinRequest={self.myJoinRequest}
                participantCount={session?.participants.length || 0}
                maxParticipants={session?.maxParticipants || 0}
                onOpen={() => setViewerJoinSheetOpen(true)}
              />
            ) : null}
            {viewerJoinSheetOpen ? (
              <WorkshopJoinSheet
                participationConfig={{ activityTitle: session?.activityTitle }}
                participantCount={session?.participants.length || 0}
                maxParticipants={session?.maxParticipants || 0}
                myParticipant={self.myParticipant}
                myJoinRequest={self.myJoinRequest}
                onRequestJoin={() => self.actions.requestJoin()}
                onCancel={(id) => self.actions.cancelJoinRequest(id)}
                onOpenParticipantHUD={() => setViewerJoinSheetOpen(false)}
                onClose={() => setViewerJoinSheetOpen(false)}
              />
            ) : null}
          </>
        ) : role === 'participant' ? (
          <ParticipantView
            session={session}
            self={self}
            impersonatedPersona={impersonatedPersona}
            viewerStatus={viewerStatus}
            focusedParticipant={focusedParticipant}
            participantConsentOpen={participantConsentOpen}
            setParticipantConsentOpen={setParticipantConsentOpen}
            getStreamRef={getStreamRef}
          />
        ) : role === 'creator' ? (
          <>
            {/* Compact trigger — Participants (N) with pending dot. */}
            <button
              type="button"
              className="workshop-creator-trigger"
              onClick={() => onCreatorSheetStateChange?.(
                creatorSheetState === 'closed' ? 'peek'
                  : creatorSheetState === 'peek' ? 'expanded'
                  : 'closed',
              )}
              aria-expanded={creatorSheetState !== 'closed'}
            >
              <Users size={15} strokeWidth={2.2} />
              <span>Participants ({participantsCount})</span>
              {pendingCount > 0 ? (
                <span className="workshop-creator-trigger__count">{pendingCount}</span>
              ) : null}
              {pendingCount > 0 && creatorSheetState === 'closed' ? (
                <span className="workshop-creator-trigger__dot" aria-hidden="true" />
              ) : null}
            </button>

            {/* Discrete incoming notification — non-blocking, auto-dismiss. */}
            {creatorIncoming && creatorSheetState === 'closed' ? (
              <div className="workshop-creator-incoming" role="status" aria-live="polite">
                <span className="workshop-creator-incoming__icon">
                  {creatorIncoming.kind === 'join'
                    ? <UserPlus size={13} strokeWidth={2.2} />
                    : <HandHelping size={13} strokeWidth={2.2} />}
                </span>
                <div className="workshop-creator-incoming__body">
                  <strong>
                    {creatorIncoming.userName} {creatorIncoming.kind === 'join' ? 'wants to join' : 'needs feedback'}
                  </strong>
                  <span>Tap to open requests</span>
                </div>
                <div className="workshop-creator-incoming__actions">
                  {creatorIncoming.kind === 'join' ? (
                    <>
                      <button
                        type="button"
                        className="workshop-creator-incoming__btn is-primary"
                        onClick={() => {
                          host.actions.respondJoinRequest(creatorIncoming.id, { accept: true });
                          onDismissCreatorIncoming?.();
                        }}
                      >
                        <Check size={11} strokeWidth={2.2} />
                        Accept
                      </button>
                      <button
                        type="button"
                        className="workshop-creator-incoming__btn"
                        onClick={() => {
                          host.actions.respondJoinRequest(creatorIncoming.id, { accept: false });
                          onDismissCreatorIncoming?.();
                        }}
                      >
                        <X size={11} strokeWidth={2.2} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="workshop-creator-incoming__btn is-primary"
                      onClick={() => {
                        onCreatorSheetStateChange?.('peek');
                        onDismissCreatorIncoming?.();
                      }}
                    >
                      Open
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            <WorkshopParticipantsPanel
              variant="sheet"
              state={creatorSheetState}
              onStateChange={onCreatorSheetStateChange}
              anchor="inside"
              session={session}
              pendingJoinRequests={host.pendingJoinRequests}
              pendingFeedback={host.pendingFeedback}
              onRespondJoin={(id, opts) => host.actions.respondJoinRequest(id, opts)}
              onAskPrivateView={(pid) => host.actions.setHostViewAuthorization(pid, true)}
              onViewPrivate={() => { /* no-op in sim */ }}
              onRequestSpotlight={(pid) => host.actions.hostRequestSpotlight(pid)}
              onRespondParticipantSpotlight={(pid, opts) => {
                host.actions.hostRespondSpotlight(pid, opts);
                if (opts.accept) host.actions.startSpotlight(pid);
              }}
              onStartSpotlight={(pid) => host.actions.startSpotlight(pid)}
              onEndSpotlight={() => host.actions.endSpotlight({ by: 'host' })}
              onRemoveParticipant={(pid) => host.actions.removeParticipant(pid)}
              onResolveFeedback={(fid) => host.actions.resolveFeedback(fid)}
              onClose={() => onCreatorSheetStateChange?.('closed')}
            />
            {hostConsentOpen && hostIncomingSpotlight ? (
              <WorkshopSpotlightConsentSheet
                variant="host-incoming"
                participantName={hostIncomingSpotlight.userName}
                onAccept={() => {
                  host.actions.hostRespondSpotlight(hostIncomingSpotlight.id, { accept: true });
                  host.actions.startSpotlight(hostIncomingSpotlight.id);
                }}
                onDecline={() => host.actions.hostRespondSpotlight(hostIncomingSpotlight.id, { accept: false })}
                onClose={() => setHostConsentOpen(false)}
              />
            ) : null}
          </>
        ) : null}
      </PhoneFrame>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════ */

/**
 * Participant phone view — renders a state-matched UI for the impersonated
 * viewer. Resolves against `viewerStatus` so Pending / Declined / Left all
 * stay representable even when the user is not in session.participants.
 */
function ParticipantView({
  session,
  self,
  impersonatedPersona,
  viewerStatus,
  focusedParticipant,
  participantConsentOpen,
  setParticipantConsentOpen,
  getStreamRef,
}) {
  if (!impersonatedPersona) {
    return (
      <EmptyPhoneState
        tone="muted"
        title="No participant selected"
        body="Pick a persona in the Impersonate picker above to preview their experience."
      />
    );
  }
  const kind = viewerStatus?.kind || 'absent';
  const viewerName = impersonatedPersona.userName;

  if (kind === 'active' && focusedParticipant) {
    return (
      <>
        <WorkshopParticipantHUD
          myParticipant={focusedParticipant}
          session={session}
          spotlightParticipant={self.spotlightParticipant}
          pendingSpotlight={
            focusedParticipant.pendingSpotlightRequest?.status === 'pending'
              ? focusedParticipant.pendingSpotlightRequest
              : null
          }
          localStreamRef={getStreamRef(focusedParticipant.id)}
          onToggleCamera={(on) => mockSvc.setParticipantMedia(DEMO_LIVE_ID, focusedParticipant.id, { cameraOn: on })}
          onToggleMic={(on) => mockSvc.setParticipantMedia(DEMO_LIVE_ID, focusedParticipant.id, { micOn: on })}
          onNeedFeedback={() => mockSvc.requestFeedback(DEMO_LIVE_ID, focusedParticipant.id)}
          onRequestSpotlight={() => {
            mockSvc.setPublicSpotlightConsent(DEMO_LIVE_ID, focusedParticipant.id, true);
            mockSvc.participantRequestSpotlight(DEMO_LIVE_ID, focusedParticipant.id);
          }}
          onStopSharing={() => mockSvc.endSpotlight(DEMO_LIVE_ID, { by: 'participant' })}
          onLeave={() => mockSvc.leaveWorkshop(DEMO_LIVE_ID, focusedParticipant.id)}
        />
        {participantConsentOpen ? (
          <WorkshopSpotlightConsentSheet
            variant="participant-incoming"
            participantName={focusedParticipant.userName}
            onAccept={() => mockSvc.participantRespondSpotlight(DEMO_LIVE_ID, focusedParticipant.id, { accept: true })}
            onDecline={() => mockSvc.participantRespondSpotlight(DEMO_LIVE_ID, focusedParticipant.id, { accept: false })}
            onClose={() => setParticipantConsentOpen(false)}
          />
        ) : null}
      </>
    );
  }

  if (kind === 'pending') {
    return (
      <EmptyPhoneState
        tone="pending"
        title="Waiting for host approval"
        body={`${viewerName}'s join request is in the host queue.`}
        primary={{
          label: 'Cancel request',
          onClick: () => mockSvc.cancelJoinRequest(DEMO_LIVE_ID, viewerStatus.request.id),
        }}
      />
    );
  }

  if (kind === 'declined') {
    return (
      <EmptyPhoneState
        tone="warn"
        title="Your request was declined"
        body={`${viewerName} can try again. The host will see a new request.`}
        primary={{
          label: 'Request again',
          onClick: () => mockSvc.requestJoin(DEMO_LIVE_ID, impersonatedPersona),
        }}
      />
    );
  }

  if (kind === 'left') {
    return (
      <EmptyPhoneState
        tone="muted"
        title="You left the workshop"
        body={`${viewerName} is no longer in the session.`}
        primary={{
          label: 'Request to rejoin',
          onClick: () => mockSvc.requestJoin(DEMO_LIVE_ID, impersonatedPersona),
        }}
      />
    );
  }

  // 'absent'
  return (
    <EmptyPhoneState
      tone="neutral"
      title="Join the workshop to participate"
      body={`${viewerName} is watching the live. Request to join to get a POV slot.`}
      primary={{
        label: 'Request to join',
        onClick: () => mockSvc.requestJoin(DEMO_LIVE_ID, impersonatedPersona),
      }}
    />
  );
}

function EmptyPhoneState({ tone = 'neutral', title, body, primary }) {
  return (
    <div className={`workshop-pg-phone__state workshop-pg-phone__state--${tone}`} role="status">
      <div className="workshop-pg-phone__state-card">
        <span className="workshop-pg-phone__state-dot" aria-hidden="true" />
        <strong>{title}</strong>
        <span>{body}</span>
        {primary ? (
          <button type="button" className="workshop-pg-phone__state-btn" onClick={primary.onClick}>
            {primary.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════ */

/**
 * Right-side simulation controls. State-aware: every button is enabled only
 * when its action is legal in the current session state. Buttons that would
 * no-op are hidden or disabled with a reason.
 */
function SimulationControls({
  role,
  session,
  self,
  host,
  focusedParticipant,
  impersonatedPersona,
  viewerStatus,
  personas,
  onPickPersona,
}) {
  const scopeSuffix = role === 'participant' && impersonatedPersona
    ? ` · ${impersonatedPersona.userName} — ${statusBadge(viewerStatus?.kind || 'absent')}`
    : '';
  return (
    <section className="workshop-pg-panel">
      <header className="workshop-pg-panel__head">
        <h2>Simulation Controls</h2>
        <span>Scope: {role}{scopeSuffix}</span>
      </header>

      {role === 'viewer' ? (
        <ViewerControls self={self} session={session} />
      ) : role === 'participant' ? (
        <ParticipantControls
          session={session}
          focusedParticipant={focusedParticipant}
          impersonatedPersona={impersonatedPersona}
          viewerStatus={viewerStatus}
          personas={personas}
          onPickPersona={onPickPersona}
        />
      ) : (
        <CreatorControls session={session} host={host} />
      )}

      <SimulatedViewers session={session} />
    </section>
  );
}

function ViewerControls({ self, session }) {
  const joined = Boolean(self.myParticipant);
  const pending = self.myJoinRequest?.status === 'pending';
  const declined = self.myJoinRequest?.status === 'declined';
  const isFull = (session?.participants.length || 0) >= (session?.maxParticipants || 0);

  return (
    <div className="workshop-pg-panel__group">
      <span className="workshop-pg-panel__label">As the viewer</span>
      {joined ? (
        <p className="workshop-pg-panel__status">You're already in the workshop. Switch to the Participant tab to see your HUD.</p>
      ) : null}
      {!joined && !pending ? (
        <button
          type="button"
          className="workshop-pg-action"
          onClick={() => self.actions.requestJoin()}
          disabled={isFull}
        >
          <Hand size={14} strokeWidth={2.2} />
          Request to join
          {isFull ? <small>Full</small> : null}
        </button>
      ) : null}
      {pending ? (
        <button
          type="button"
          className="workshop-pg-action is-ghost"
          onClick={() => self.actions.cancelJoinRequest(self.myJoinRequest.id)}
        >
          <X size={14} strokeWidth={2.2} />
          Cancel pending request
        </button>
      ) : null}
      {declined ? (
        <p className="workshop-pg-panel__status workshop-pg-panel__status--warn">Your last request was declined. Click again below to try once more.</p>
      ) : null}
      {(!joined && !pending && declined) ? (
        <button
          type="button"
          className="workshop-pg-action"
          onClick={() => self.actions.requestJoin()}
          disabled={isFull}
        >
          <RefreshCw size={14} strokeWidth={2.2} />
          Retry join request
        </button>
      ) : null}
    </div>
  );
}

function ParticipantControls({
  session,
  focusedParticipant,
  impersonatedPersona,
  viewerStatus,
  personas,
  onPickPersona,
}) {
  const p = focusedParticipant;
  const kind = viewerStatus?.kind || 'none';
  const name = impersonatedPersona?.userName;
  const amSpotlighted = p && session?.spotlightParticipantId === p.id;
  const spotlightPending = p?.pendingSpotlightRequest?.status === 'pending';
  const incomingFromHost = spotlightPending && p.pendingSpotlightRequest.origin === 'host';

  // Branch purely on viewerStatus — every state has an action tree.
  if (!impersonatedPersona) {
    return (
      <div className="workshop-pg-panel__group">
        <p className="workshop-pg-panel__status">No persona selected. Pick one in the Impersonate picker to simulate their flow.</p>
        <PersonaSwitch personas={personas} session={session} activeUserId={null} onPickPersona={onPickPersona} />
      </div>
    );
  }

  if (kind === 'absent' || kind === 'left' || kind === 'declined') {
    const labels = {
      absent: { line: `${name} has not joined yet.`, btn: 'Request to join' },
      left: { line: `${name} left the workshop.`, btn: 'Request to rejoin' },
      declined: { line: `${name}'s last request was declined.`, btn: 'Request again' },
    };
    const { line, btn } = labels[kind];
    return (
      <div className="workshop-pg-panel__group">
        <span className="workshop-pg-panel__label">As {name} — {statusBadge(kind)}</span>
        <p className="workshop-pg-panel__status workshop-pg-panel__status--muted">{line}</p>
        <button
          type="button"
          className="workshop-pg-action"
          onClick={() => mockSvc.requestJoin(DEMO_LIVE_ID, impersonatedPersona)}
        >
          <Hand size={14} strokeWidth={2.2} />
          {btn}
        </button>
        <PersonaSwitch personas={personas} session={session} activeUserId={impersonatedPersona.userId} onPickPersona={onPickPersona} />
      </div>
    );
  }

  if (kind === 'pending') {
    return (
      <div className="workshop-pg-panel__group">
        <span className="workshop-pg-panel__label">As {name} — Pending</span>
        <p className="workshop-pg-panel__status">{name} is waiting for host approval.</p>
        <button
          type="button"
          className="workshop-pg-action is-ghost"
          onClick={() => mockSvc.cancelJoinRequest(DEMO_LIVE_ID, viewerStatus.request.id)}
        >
          <X size={14} strokeWidth={2.2} />
          Cancel pending request
        </button>
        <PersonaSwitch personas={personas} session={session} activeUserId={impersonatedPersona.userId} onPickPersona={onPickPersona} />
      </div>
    );
  }

  // kind === 'active'
  return (
    <div className="workshop-pg-panel__group">
      <span className="workshop-pg-panel__label">As {p.userName} — Active{amSpotlighted ? ' · Spotlight Live' : ''}</span>
      <div className="workshop-pg-panel__row">
        <button
          type="button"
          className={`workshop-pg-action${p.cameraOn ? ' is-active' : ''}`}
          onClick={() => mockSvc.setParticipantMedia(DEMO_LIVE_ID, p.id, { cameraOn: !p.cameraOn })}
        >
          {p.cameraOn ? <Camera size={14} strokeWidth={2.2} /> : <CameraOff size={14} strokeWidth={2.2} />}
          Camera {p.cameraOn ? 'off' : 'on'}
          <small>mock</small>
        </button>
        <button
          type="button"
          className={`workshop-pg-action${p.micOn ? ' is-active' : ''}`}
          onClick={() => mockSvc.setParticipantMedia(DEMO_LIVE_ID, p.id, { micOn: !p.micOn })}
        >
          {p.micOn ? <Mic size={14} strokeWidth={2.2} /> : <MicOff size={14} strokeWidth={2.2} />}
          Mic {p.micOn ? 'off' : 'on'}
        </button>
      </div>

      {incomingFromHost ? (
        <div className="workshop-pg-panel__row">
          <button
            type="button"
            className="workshop-pg-action"
            onClick={() => mockSvc.participantRespondSpotlight(DEMO_LIVE_ID, p.id, { accept: true })}
          >
            <Check size={14} strokeWidth={2.2} />
            Accept host spotlight
          </button>
          <button
            type="button"
            className="workshop-pg-action is-ghost"
            onClick={() => mockSvc.participantRespondSpotlight(DEMO_LIVE_ID, p.id, { accept: false })}
          >
            <X size={14} strokeWidth={2.2} />
            Decline
          </button>
        </div>
      ) : null}

      {!amSpotlighted && !spotlightPending ? (
        <button
          type="button"
          className="workshop-pg-action"
          onClick={() => {
            mockSvc.setPublicSpotlightConsent(DEMO_LIVE_ID, p.id, true);
            mockSvc.participantRequestSpotlight(DEMO_LIVE_ID, p.id);
          }}
          disabled={!p.cameraOn}
        >
          <Lightbulb size={14} strokeWidth={2.2} />
          Request spotlight (raise hand)
          {!p.cameraOn ? <small>Camera off</small> : null}
        </button>
      ) : null}

      {amSpotlighted ? (
        <button
          type="button"
          className="workshop-pg-action is-danger"
          onClick={() => mockSvc.endSpotlight(DEMO_LIVE_ID, { by: 'participant' })}
        >
          <Radio size={14} strokeWidth={2.2} />
          Stop sharing (end spotlight)
        </button>
      ) : null}

      {!p.pendingFeedback ? (
        <button
          type="button"
          className="workshop-pg-action is-ghost"
          onClick={() => mockSvc.requestFeedback(DEMO_LIVE_ID, p.id)}
        >
          <HandHelping size={14} strokeWidth={2.2} />
          Ask host for feedback
        </button>
      ) : null}

      <button
        type="button"
        className="workshop-pg-action is-danger"
        onClick={() => mockSvc.leaveWorkshop(DEMO_LIVE_ID, p.id)}
      >
        <LogOut size={14} strokeWidth={2.2} />
        Leave workshop
      </button>

      <PersonaSwitch personas={personas} session={session} activeUserId={impersonatedPersona.userId} onPickPersona={onPickPersona} />
    </div>
  );
}

function PersonaSwitch({ personas, session, activeUserId, onPickPersona }) {
  if (!personas?.length) return null;
  return (
    <>
      <span className="workshop-pg-panel__label">Switch persona</span>
      <div className="workshop-pg-panel__row workshop-pg-panel__row--wrap">
        {personas.map((persona) => {
          const status = classifyViewer(session, persona.userId);
          const isActive = persona.userId === activeUserId;
          return (
            <button
              key={persona.userId}
              type="button"
              className={`workshop-pg-action is-compact is-ghost${isActive ? ' is-active' : ''}`}
              onClick={() => onPickPersona?.(persona.userId)}
            >
              {persona.userName}
              <small>{statusBadge(status.kind)}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}

function CreatorControls({ session, host }) {
  const pendingJoins = host.pendingJoinRequests;
  const spotlightId = session?.spotlightParticipantId;
  const spotlightP = session?.participants.find((p) => p.id === spotlightId);
  const raisedHand = session?.participants.find((p) => p.pendingSpotlightRequest?.origin === 'participant' && p.pendingSpotlightRequest.status === 'pending');

  return (
    <div className="workshop-pg-panel__group">
      <span className="workshop-pg-panel__label">As the creator (Malo)</span>

      {pendingJoins.length === 0 ? (
        <p className="workshop-pg-panel__status workshop-pg-panel__status--muted">No pending join requests.</p>
      ) : (
        pendingJoins.map((req) => (
          <div key={req.id} className="workshop-pg-panel__row workshop-pg-panel__row--between">
            <span className="workshop-pg-panel__name">{req.userName} wants in</span>
            <div className="workshop-pg-panel__row">
              <button
                type="button"
                className="workshop-pg-action is-compact"
                onClick={() => host.actions.respondJoinRequest(req.id, { accept: true })}
              >
                <Check size={13} strokeWidth={2.2} />
                Accept
              </button>
              <button
                type="button"
                className="workshop-pg-action is-compact is-ghost"
                onClick={() => host.actions.respondJoinRequest(req.id, { accept: false })}
              >
                <X size={13} strokeWidth={2.2} />
                Decline
              </button>
            </div>
          </div>
        ))
      )}

      {raisedHand ? (
        <div className="workshop-pg-panel__row workshop-pg-panel__row--between workshop-pg-panel__row--hilite">
          <span className="workshop-pg-panel__name"><Hand size={13} strokeWidth={2.2} /> {raisedHand.userName} raised hand</span>
          <div className="workshop-pg-panel__row">
            <button
              type="button"
              className="workshop-pg-action is-compact"
              onClick={() => { host.actions.hostRespondSpotlight(raisedHand.id, { accept: true }); host.actions.startSpotlight(raisedHand.id); }}
            >
              <Check size={13} strokeWidth={2.2} />
              Accept & start
            </button>
            <button
              type="button"
              className="workshop-pg-action is-compact is-ghost"
              onClick={() => host.actions.hostRespondSpotlight(raisedHand.id, { accept: false })}
            >
              <X size={13} strokeWidth={2.2} />
              Decline
            </button>
          </div>
        </div>
      ) : null}

      {spotlightP ? (
        <button
          type="button"
          className="workshop-pg-action is-danger"
          onClick={() => host.actions.endSpotlight({ by: 'host' })}
        >
          <X size={14} strokeWidth={2.2} />
          Stop spotlight ({spotlightP.userName})
        </button>
      ) : null}

      {(session?.participants || []).map((p) => {
        if (p.id === spotlightId) return null;
        const pendingFromHost = p.pendingSpotlightRequest?.origin === 'host' && p.pendingSpotlightRequest.status === 'pending';
        const canStart = p.publicSpotlightAuthorized && p.cameraOn;
        return (
          <div key={p.id} className="workshop-pg-panel__row workshop-pg-panel__row--between">
            <span className="workshop-pg-panel__name">{p.userName}</span>
            <div className="workshop-pg-panel__row">
              {canStart ? (
                <button
                  type="button"
                  className="workshop-pg-action is-compact"
                  onClick={() => host.actions.startSpotlight(p.id)}
                >
                  <Radio size={13} strokeWidth={2.2} />
                  Start
                </button>
              ) : pendingFromHost ? (
                <span className="workshop-pg-panel__flag">awaiting consent</span>
              ) : (
                <button
                  type="button"
                  className="workshop-pg-action is-compact is-ghost"
                  onClick={() => host.actions.hostRequestSpotlight(p.id)}
                >
                  <Lightbulb size={13} strokeWidth={2.2} />
                  Ask to feature
                </button>
              )}
              <button
                type="button"
                className="workshop-pg-action is-compact is-ghost"
                onClick={() => host.actions.removeParticipant(p.id)}
                aria-label={`Remove ${p.userName}`}
              >
                <UserMinus size={13} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SimulatedViewers({ session }) {
  return (
    <div className="workshop-pg-panel__group">
      <span className="workshop-pg-panel__label">Simulated viewers</span>
      <div className="workshop-pg-panel__row workshop-pg-panel__row--wrap">
        {DEMO_SIM_VIEWERS.map((v) => {
          const asParticipant = (session?.participants || []).find((p) => p.userId === v.userId);
          const asRequest = (session?.joinRequests || []).find((r) => r.userId === v.userId && r.status === 'pending');
          return asParticipant ? (
            <button
              key={v.userId}
              type="button"
              className="workshop-pg-action is-compact is-ghost"
              onClick={() => mockSvc.leaveWorkshop(DEMO_LIVE_ID, asParticipant.id)}
            >
              <LogOut size={12} strokeWidth={2.2} />
              {v.userName} · leave
            </button>
          ) : (
            <button
              key={v.userId}
              type="button"
              className="workshop-pg-action is-compact"
              disabled={Boolean(asRequest)}
              onClick={() => mockSvc.requestJoin(DEMO_LIVE_ID, v)}
            >
              <UserPlus size={12} strokeWidth={2.2} />
              {asRequest ? `${v.userName} · pending` : `${v.userName} · request`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════ */

function ActivityLog({ session }) {
  const entries = (session?.log || []).slice(0, 40);
  return (
    <section className="workshop-pg-panel workshop-pg-panel--log">
      <header className="workshop-pg-panel__head">
        <h2>Activity Log</h2>
        <span>{entries.length} events</span>
      </header>
      {entries.length === 0 ? (
        <p className="workshop-pg-panel__status workshop-pg-panel__status--muted">Trigger an action to see it here.</p>
      ) : (
        <ol className="workshop-pg-log">
          {entries.map((e) => (
            <li key={e.id}>
              <strong>{timeLabel(e.at)}</strong>
              <span>{humanizeLog(session, e)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
