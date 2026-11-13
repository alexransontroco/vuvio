import { MessageSquare, Send, X } from 'lucide-react';
import { useRef, useState } from 'react';

export default function LiveQASheet({ questions = [], onClose, onAnswer, streamerName = 'Streamer' }) {
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const handleReply = async (questionId) => {
    const text = replyDraft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onAnswer(questionId, text);
      setReplyingTo(null);
      setReplyDraft('');
    } finally {
      setSending(false);
    }
  };

  const startReply = (questionId) => {
    setReplyingTo(questionId);
    setReplyDraft('');
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  const newCount = questions.filter((q) => !q.answered).length;

  return (
    <section className="live-qa-sheet" aria-label="Questions des spectateurs">
      <button type="button" className="live-qa-sheet__backdrop" aria-label="Fermer" onClick={onClose} />
      <div className="live-qa-sheet__panel">
        <span className="live-qa-sheet__handle" aria-hidden="true" />
        <header className="live-qa-sheet__header">
          <div>
            <strong>Questions</strong>
            {newCount > 0 ? <span>{newCount} nouvelles</span> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X size={17} strokeWidth={2} />
          </button>
        </header>

        {questions.length === 0 ? (
          <div className="live-qa-sheet__empty">
            <MessageSquare size={26} strokeWidth={1.5} />
            <p>Aucune question pour l'instant</p>
          </div>
        ) : (
          <div className="live-qa-sheet__list">
            {[...questions].reverse().map((q) => (
              <article key={q.id} className={`live-qa-card${q.answered ? ' is-answered' : ''}`}>
                <div className="live-qa-card__question">
                  <div className="live-qa-card__avatar">
                    {q.authorAvatar
                      ? <img src={q.authorAvatar} alt="" />
                      : <span>{(q.authorName || '?')[0].toUpperCase()}</span>}
                  </div>
                  <div className="live-qa-card__body">
                    <strong>{q.authorName || 'Spectateur'}</strong>
                    <p>{q.text}</p>
                  </div>
                  {q.answered ? (
                    <span className="live-qa-card__done">Répondu</span>
                  ) : replyingTo !== q.id ? (
                    <button type="button" className="live-qa-card__reply-btn" onClick={() => startReply(q.id)}>
                      Répondre
                    </button>
                  ) : null}
                </div>

                {q.answered && q.answer ? (
                  <div className="live-qa-card__answer">
                    <strong>
                      {q.answer.authorName || streamerName}
                      <span className="live-qa-host-badge">Host</span>
                    </strong>
                    <p>{q.answer.text}</p>
                  </div>
                ) : null}

                {replyingTo === q.id ? (
                  <form
                    className="live-qa-card__reply-form"
                    onSubmit={(e) => { e.preventDefault(); handleReply(q.id); }}
                  >
                    <p className="live-qa-card__reply-context">{q.text}</p>
                    <div className="live-qa-card__reply-row">
                      <input
                        ref={inputRef}
                        type="text"
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Votre réponse…"
                        aria-label="Répondre à la question"
                      />
                      <button
                        type="submit"
                        disabled={!replyDraft.trim() || sending}
                        className={replyDraft.trim() ? 'is-active' : ''}
                        aria-label="Envoyer"
                      >
                        <Send size={16} strokeWidth={1.9} />
                      </button>
                    </div>
                    <button type="button" className="live-qa-card__cancel" onClick={() => setReplyingTo(null)}>
                      Annuler
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
