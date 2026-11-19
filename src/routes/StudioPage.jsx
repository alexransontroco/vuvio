import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Eye, ExternalLink, Loader2, MessageCircle, MessageSquare, Radio, Send, Users } from 'lucide-react';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { answerQuestion, subscribeToQuestions } from '../services/liveQAService.js';
import '../styles/pages/live.css';
import { isWorkshopEnabled } from '../config/workshop.js';
import { useWorkshopSession } from '../hooks/useWorkshopSession.js';
import WorkshopParticipantsPanel from '../components/workshop/WorkshopParticipantsPanel.jsx';
import WorkshopSpotlightConsentSheet from '../components/workshop/WorkshopSpotlightConsentSheet.jsx';

function formatElapsed(startMs) {
  if (!startMs) return '—';
  const s = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function liveStartMs(live) {
  const ts = live?.createdAt;
  if (!ts) return null;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export default function StudioPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const { liveId: liveIdParam } = useParams();

  const [resolvedLiveId, setResolvedLiveId] = useState(liveIdParam ?? null);
  const [resolveState, setResolveState] = useState(liveIdParam ? 'ready' : 'resolving');
  const [live, setLive] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [comments, setComments] = useState([]);
  const [draftByQuestion, setDraftByQuestion] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [activeTab, setActiveTab] = useState('qa');
  const [chatDraft, setChatDraft] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [tick, setTick] = useState(0);
  const listRef = useRef(null);
  const chatListRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true, state: { returnTo: '/studio' } });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (liveIdParam) {
      setResolvedLiveId(liveIdParam);
      setResolveState('ready');
      return;
    }
    if (!user?.uid) return;
    let cancelled = false;
    setResolveState('resolving');
    (async () => {
      try {
        const q = query(
          collection(db, 'activeLives'),
          where('creatorUid', '==', user.uid),
          where('status', '==', 'live'),
          limit(5),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        if (snap.empty) {
          setResolveState('none');
          return;
        }
        const latest = snap.docs
          .map((d) => d.data())
          .sort((a, b) => (liveStartMs(b) ?? 0) - (liveStartMs(a) ?? 0))[0];
        setResolvedLiveId(latest.id);
        setResolveState('ready');
      } catch (err) {
        console.warn('[StudioPage] resolve live failed:', err.message);
        if (!cancelled) setResolveState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [liveIdParam, user?.uid]);

  useEffect(() => {
    if (!resolvedLiveId) return;
    const unsub = onSnapshot(
      doc(db, 'activeLives', resolvedLiveId),
      (snap) => setLive(snap.exists() ? snap.data() : null),
      (err) => console.warn('[StudioPage] live doc error:', err.message),
    );
    return unsub;
  }, [resolvedLiveId]);

  useEffect(() => {
    if (!resolvedLiveId) return;
    return subscribeToQuestions(resolvedLiveId, setQuestions);
  }, [resolvedLiveId]);

  useEffect(() => {
    if (!resolvedLiveId) return;
    const unsub = onSnapshot(
      collection(db, `activeLives/${resolvedLiveId}/comments`),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const at = a.timestamp?.toMillis?.() ?? (a.timestamp?.seconds ?? 0) * 1000;
            const bt = b.timestamp?.toMillis?.() ?? (b.timestamp?.seconds ?? 0) * 1000;
            return at - bt;
          });
        setComments(rows);
      },
      (err) => console.warn('[StudioPage] comments snapshot error:', err.message),
    );
    return unsub;
  }, [resolvedLiveId]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      if (a.answered !== b.answered) return a.answered ? 1 : -1;
      const at = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000;
      const bt = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000;
      return bt - at;
    });
  }, [questions]);

  const pendingCount = useMemo(() => sortedQuestions.filter((q) => !q.answered).length, [sortedQuestions]);

  const handleAnswer = useCallback(async (questionId) => {
    const text = (draftByQuestion[questionId] ?? '').trim();
    if (!text || !resolvedLiveId || !user?.uid || sendingId === questionId) return;
    setSendingId(questionId);
    setSendError(null);
    try {
      await answerQuestion({
        liveId: resolvedLiveId,
        questionId,
        text,
        authorId: user.uid,
        authorName: user.displayName || 'Streamer',
      });
      setDraftByQuestion((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch (err) {
      console.warn('[StudioPage] answer failed:', err.message);
      setSendError(err.message || 'Envoi impossible');
    } finally {
      setSendingId(null);
    }
  }, [draftByQuestion, resolvedLiveId, user?.uid, user?.displayName, sendingId]);

  const sendChat = useCallback(async () => {
    const text = chatDraft.trim();
    if (!text || !resolvedLiveId || !user?.uid || sendingChat) return;
    setSendingChat(true);
    setSendError(null);
    try {
      const commentsRef = collection(db, `activeLives/${resolvedLiveId}/comments`);
      await addDoc(commentsRef, {
        text,
        userId: user.uid,
        userDisplayName: user.displayName || 'Streamer',
        userPhotoURL: user.photoURL || null,
        timestamp: serverTimestamp(),
      });
      const latestComment = {
        id: `${resolvedLiveId}-${Date.now()}`,
        text,
        userId: user.uid,
        userDisplayName: user.displayName || 'Streamer',
        userPhotoURL: user.photoURL || null,
        avatar: '🎙️',
        timestamp: new Date().toISOString(),
      };
      try {
        await updateDoc(doc(db, 'activeLives', resolvedLiveId), {
          latestComment,
          latestCommentAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {}
      setChatDraft('');
    } catch (err) {
      console.warn('[StudioPage] chat send failed:', err.message);
      setSendError(err.message || 'Envoi impossible');
    } finally {
      setSendingChat(false);
    }
  }, [chatDraft, resolvedLiveId, user?.uid, user?.displayName, user?.photoURL, sendingChat]);

  useEffect(() => {
    if (activeTab !== 'chat') return;
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments, activeTab]);

  const workshopFlagOn = isWorkshopEnabled();
  const workshopMode = live?.participation || 'off';
  const workshopActive = workshopFlagOn && workshopMode !== 'off' && Boolean(resolvedLiveId);
  const workshopHostConfig = useMemo(() => {
    if (!workshopActive) return undefined;
    return {
      mode: workshopMode,
      maxParticipants: live?.participationConfig?.maxParticipants || 6,
      audience: live?.participationConfig?.audience || 'everyone',
      activityTitle: live?.participationConfig?.activityTitle || live?.title || '',
      hostId: live?.creatorUid || user?.uid || resolvedLiveId,
      hostName: live?.name || user?.displayName || 'Host',
    };
  }, [workshopActive, workshopMode, live?.participationConfig?.maxParticipants, live?.participationConfig?.audience, live?.participationConfig?.activityTitle, live?.title, live?.creatorUid, live?.name, user?.uid, user?.displayName, resolvedLiveId]);
  const workshopViewer = useMemo(() => (
    workshopActive && user ? { userId: user.uid, userName: user.displayName || 'Host' } : null
  ), [workshopActive, user?.uid, user?.displayName]);
  const workshopSession = useWorkshopSession({
    liveId: workshopActive ? resolvedLiveId : null,
    viewer: workshopViewer,
    hostConfig: workshopHostConfig,
  });
  const workshopPendingJoin = workshopSession?.pendingJoinRequests?.length || 0;
  const workshopParticipantCount = workshopSession?.session?.participants?.length || 0;
  const hostIncomingSpotlight = useMemo(() => {
    const parts = workshopSession?.session?.participants || [];
    return parts.find((p) => {
      const req = p.pendingSpotlightRequest;
      return req?.status === 'pending' && req.origin === 'participant';
    }) || null;
  }, [workshopSession?.session?.participants]);
  const [hostConsentOpen, setHostConsentOpen] = useState(false);
  useEffect(() => { if (hostIncomingSpotlight) setHostConsentOpen(true); }, [hostIncomingSpotlight?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || resolveState === 'resolving') {
    return (
      <main className="studio-page studio-page--centered">
        <Loader2 size={22} className="studio-spin" />
        <p>Recherche de votre live…</p>
      </main>
    );
  }

  if (resolveState === 'none') {
    return (
      <main className="studio-page studio-page--centered">
        <Radio size={28} strokeWidth={1.6} />
        <h1>Aucun live actif</h1>
        <p>Lancez un live depuis votre téléphone, puis revenez ici pour répondre aux questions au clavier.</p>
        <Link to="/watch" className="studio-cta">Aller au feed</Link>
      </main>
    );
  }

  if (resolveState === 'error') {
    return (
      <main className="studio-page studio-page--centered">
        <h1>Impossible de charger votre live</h1>
        <p>Vérifiez votre connexion et rechargez la page.</p>
      </main>
    );
  }

  const startMs = liveStartMs(live);
  const elapsed = startMs ? formatElapsed(startMs) : '—';
  const watchUrl = resolvedLiveId ? `/watch?live=${encodeURIComponent(resolvedLiveId)}&mode=view` : '/watch';

  return (
    <main className="studio-page">
      <aside className="studio-side">
        <div className="studio-cover">
          {live?.image
            ? <img src={live.image} alt={live?.title || 'Live cover'} />
            : <div className="studio-cover__fallback"><Radio size={24} /></div>}
          <span className="studio-cover__live">LIVE</span>
        </div>
        <h1 className="studio-title">{live?.title || live?.experienceTitle || 'Votre live'}</h1>
        <p className="studio-meta">
          {live?.name || user?.displayName || 'Streamer'}
          {live?.location ? ` · ${live.location}` : ''}
        </p>
        <div className="studio-stats">
          <div>
            <Eye size={15} strokeWidth={1.9} />
            <span>{live?.viewerLabel || live?.viewers || '—'}</span>
            <small>Viewers</small>
          </div>
          <div>
            <Radio size={15} strokeWidth={1.9} />
            <span>{elapsed}</span>
            <small>Durée</small>
          </div>
          <div>
            <MessageSquare size={15} strokeWidth={1.9} />
            <span>{pendingCount}</span>
            <small>En attente</small>
          </div>
        </div>
        <a href={watchUrl} target="_blank" rel="noreferrer" className="studio-watch-link">
          <ExternalLink size={14} strokeWidth={1.9} />
          Ouvrir le live spectateur
        </a>
        <p className="studio-hint">
          Astuce : laissez le téléphone filmer, répondez ici au clavier. Les réponses apparaissent instantanément dans le chat des spectateurs.
        </p>
      </aside>

      <section className="studio-feed">
        <header className="studio-feed__header studio-feed__header--tabs">
          <div className="studio-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'qa'}
              className={`studio-tab${activeTab === 'qa' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('qa')}
            >
              <MessageSquare size={14} strokeWidth={1.9} />
              <span>Q&amp;A</span>
              {pendingCount > 0 ? <span className="studio-tab__badge">{pendingCount}</span> : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'chat'}
              className={`studio-tab${activeTab === 'chat' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageCircle size={14} strokeWidth={1.9} />
              <span>Chat</span>
              {comments.length > 0 ? <span className="studio-tab__badge studio-tab__badge--muted">{comments.length}</span> : null}
            </button>
            {workshopActive ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'workshop'}
                className={`studio-tab${activeTab === 'workshop' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('workshop')}
              >
                <Users size={14} strokeWidth={1.9} />
                <span>Workshop</span>
                {workshopPendingJoin > 0 ? <span className="studio-tab__badge">{workshopPendingJoin}</span> : (
                  workshopParticipantCount > 0 ? <span className="studio-tab__badge studio-tab__badge--muted">{workshopParticipantCount}</span> : null
                )}
              </button>
            ) : null}
          </div>
          {sendError ? <span className="studio-feed__error">{sendError}</span> : null}
        </header>

        {activeTab === 'qa' ? (
          sortedQuestions.length === 0 ? (
            <div className="studio-feed__empty">
              <MessageSquare size={30} strokeWidth={1.4} />
              <p>Aucune question pour l'instant.</p>
              <small>Elles apparaîtront ici dès qu'un spectateur en posera une.</small>
            </div>
          ) : (
            <div className="studio-feed__list" ref={listRef}>
              {sortedQuestions.map((q) => {
                const isAnswered = Boolean(q.answered);
                const draft = draftByQuestion[q.id] ?? '';
                const sending = sendingId === q.id;
                return (
                  <article key={q.id} className={`studio-card${isAnswered ? ' is-answered' : ''}`}>
                    <div className="studio-card__head">
                      <div className="studio-card__avatar">
                        {q.authorAvatar
                          ? <img src={q.authorAvatar} alt="" />
                          : <span>{(q.authorName || '?')[0].toUpperCase()}</span>}
                      </div>
                      <div className="studio-card__who">
                        <strong>{q.authorName || 'Spectateur'}</strong>
                        <span>{isAnswered ? 'Répondu' : 'En attente'}</span>
                      </div>
                    </div>
                    <p className="studio-card__text">{q.text}</p>

                    {isAnswered && q.answer ? (
                      <div className="studio-card__answer">
                        <strong>Vous</strong>
                        <p>{q.answer.text}</p>
                      </div>
                    ) : (
                      <form
                        className="studio-card__form"
                        onSubmit={(e) => { e.preventDefault(); handleAnswer(q.id); }}
                      >
                        <textarea
                          value={draft}
                          onChange={(e) => setDraftByQuestion((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAnswer(q.id);
                            }
                          }}
                          placeholder="Tapez votre réponse… (Entrée pour envoyer, Maj+Entrée = nouvelle ligne)"
                          rows={2}
                          aria-label="Réponse à la question"
                        />
                        <button
                          type="submit"
                          className="studio-card__send"
                          disabled={!draft.trim() || sending}
                        >
                          {sending ? <Loader2 size={15} className="studio-spin" /> : <Send size={15} strokeWidth={1.9} />}
                          Envoyer
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )
        ) : activeTab === 'chat' ? (
          <div className="studio-chat">
            {comments.length === 0 ? (
              <div className="studio-feed__empty studio-feed__empty--chat">
                <MessageCircle size={30} strokeWidth={1.4} />
                <p>Pas encore de messages.</p>
                <small>Dites bonjour depuis le clavier.</small>
              </div>
            ) : (
              <div className="studio-chat__list" ref={chatListRef}>
                {comments.map((c) => {
                  const isHost = c.userId && live?.creatorUid && c.userId === live.creatorUid;
                  const who = c.userDisplayName || 'Spectateur';
                  return (
                    <article key={c.id} className={`studio-chat__row${isHost ? ' is-host' : ''}`}>
                      <div className="studio-chat__avatar">
                        {c.userPhotoURL
                          ? <img src={c.userPhotoURL} alt="" />
                          : <span>{who[0]?.toUpperCase() || '?'}</span>}
                      </div>
                      <div className="studio-chat__body">
                        <header>
                          <strong>{who}</strong>
                          {isHost ? <span className="studio-chat__host-pill">Host</span> : null}
                        </header>
                        <p>{c.text}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <form
              className="studio-chat__composer"
              onSubmit={(e) => { e.preventDefault(); sendChat(); }}
            >
              <textarea
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                placeholder="Envoyer un message au chat… (Entrée pour envoyer)"
                rows={2}
                aria-label="Message au chat"
              />
              <button
                type="submit"
                className="studio-card__send"
                disabled={!chatDraft.trim() || sendingChat}
              >
                {sendingChat ? <Loader2 size={15} className="studio-spin" /> : <Send size={15} strokeWidth={1.9} />}
                Envoyer
              </button>
            </form>
          </div>
        ) : workshopActive ? (
          <div className="studio-workshop">
            <WorkshopParticipantsPanel
              variant="embedded"
              session={workshopSession.session}
              pendingJoinRequests={workshopSession.pendingJoinRequests}
              pendingFeedback={workshopSession.pendingFeedback}
              onRespondJoin={(id, opts) => workshopSession.actions.respondJoinRequest(id, opts)}
              onViewPrivate={() => {}}
              onAskPrivateView={(pid) => workshopSession.actions.setHostViewAuthorization(pid, true)}
              onRequestSpotlight={(pid) => workshopSession.actions.hostRequestSpotlight(pid)}
              onStartSpotlight={(pid) => workshopSession.actions.startSpotlight(pid)}
              onEndSpotlight={() => workshopSession.actions.endSpotlight({ by: 'host' })}
              onRemoveParticipant={(pid) => workshopSession.actions.removeParticipant(pid)}
              onResolveFeedback={(fid) => workshopSession.actions.resolveFeedback(fid)}
              onRespondParticipantSpotlight={(pid, opts) => workshopSession.actions.hostRespondSpotlight(pid, opts)}
            />
          </div>
        ) : null}
      </section>
      {workshopActive && hostConsentOpen && hostIncomingSpotlight ? (
        <WorkshopSpotlightConsentSheet
          variant="host-incoming"
          participantName={hostIncomingSpotlight.userName}
          onAccept={() => workshopSession.actions.hostRespondSpotlight(hostIncomingSpotlight.id, { accept: true })}
          onDecline={() => workshopSession.actions.hostRespondSpotlight(hostIncomingSpotlight.id, { accept: false })}
          onClose={() => setHostConsentOpen(false)}
        />
      ) : null}
    </main>
  );
}
