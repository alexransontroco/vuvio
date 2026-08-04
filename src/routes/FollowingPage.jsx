import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/pages/following.css';

export default function FollowingPage() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [followingUsers, setFollowingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.followedCreators?.length) {
      setLoading(false);
      return;
    }

    const loadFollowingUsers = async () => {
      try {
        const users = [];
        for (const creatorUid of userProfile.followedCreators) {
          const docSnap = await getDoc(doc(db, 'users', creatorUid));
          if (docSnap.exists()) {
            users.push({
              uid: creatorUid,
              ...docSnap.data(),
            });
          }
        }
        setFollowingUsers(users);
      } catch (err) {
        console.error('[FollowingPage] Failed to load following:', err.message);
      } finally {
        setLoading(false);
      }
    };

    loadFollowingUsers();
  }, [userProfile?.followedCreators]);

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
                  {followingUser.displayName?.[0]?.toUpperCase() || '?'}
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
