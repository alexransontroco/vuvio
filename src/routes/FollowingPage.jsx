import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { creatorProfiles } from '../data/creatorProfiles.js';
import { newPovStreams } from '../data/newPovStreams.js';
import { subscribeToFollowing } from '../services/followService.js';
import '../styles/pages/following.css';

const mockProfilesById = Object.values(creatorProfiles).reduce((acc, p) => {
  if (p?.id) acc[p.id] = p;
  return acc;
}, {});

const mockStreamById = newPovStreams.reduce((acc, s) => {
  acc[s.id] = { uid: s.id, displayName: s.name, username: s.id, bio: s.job ? `${s.job} · ${s.city}, ${s.country}` : null, avatarUrl: s.image };
  return acc;
}, {});

export default function FollowingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [followingIds, setFollowingIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vuvio:following-creators') ?? '[]'); } catch { return []; }
  });
  const [followingUsers, setFollowingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeToFollowing(setFollowingIds), []);

  useEffect(() => {
    if (!followingIds.length) {
      setFollowingUsers([]);
      setLoading(false);
      return;
    }

    const loadFollowingUsers = async () => {
      setLoading(true);
      try {
        const users = [];
        for (const creatorId of followingIds) {
          const mock = mockProfilesById[creatorId];
          if (mock) {
            users.push({ uid: creatorId, displayName: mock.displayName, username: mock.username, bio: mock.bio, avatarUrl: mock.avatarUrl });
            continue;
          }
          const stream = mockStreamById[creatorId];
          if (stream) {
            users.push(stream);
            continue;
          }
          try {
            const docSnap = await getDoc(doc(db, 'users', creatorId));
            if (docSnap.exists()) users.push({ uid: creatorId, ...docSnap.data() });
          } catch { /* skip */ }
        }
        setFollowingUsers(users);
      } catch (err) {
        console.error('[FollowingPage] Failed to load following:', err.message);
      } finally {
        setLoading(false);
      }
    };

    loadFollowingUsers();
  }, [followingIds]);

  if (!user) {
    return (
      <div className="following-page">
        <div className="following-empty">
          <p>Please log in to see your following list.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="following-page">
      <div className="following-container">
        <h1>Following ({followingUsers.length})</h1>

        {loading ? (
          <div className="following-loading">Loading...</div>
        ) : followingUsers.length === 0 ? (
          <div className="following-empty">
            <p>You're not following anyone yet.</p>
            <small>Find and follow creators in Explore!</small>
          </div>
        ) : (
          <ul className="following-list">
            {followingUsers.map((followingUser) => (
              <li
                key={followingUser.uid}
                className="following-item"
                onClick={() => navigate(`/profile/${followingUser.uid}`)}
              >
                <div className="following-avatar">
                  {followingUser.avatarUrl
                    ? <img src={followingUser.avatarUrl} alt={followingUser.displayName} />
                    : followingUser.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="following-info">
                  <strong>{followingUser.displayName}</strong>
                  <span className="following-username">@{followingUser.username}</span>
                  {followingUser.bio && (
                    <p className="following-bio">{followingUser.bio}</p>
                  )}
                </div>
                <span className="following-arrow">→</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
