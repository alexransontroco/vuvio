import { useEffect } from 'react';

/**
 * Temporary toast notification when a friend joins the live
 */
export function FriendJoinedToast({ friend, onDismiss, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div className="friend-joined-toast" role="status" aria-live="polite">
      <div className="friend-joined-toast__avatar">{friend.avatar}</div>
      <p className="friend-joined-toast__message">
        <span className="friend-joined-toast__name">{friend.name}</span> joined
      </p>
    </div>
  );
}
