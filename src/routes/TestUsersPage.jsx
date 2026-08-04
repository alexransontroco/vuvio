import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import '../styles/pages/test-users.css';

export default function TestUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });

  const loadUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(userList.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
    } catch (err) {
      console.error('Failed to load users:', err.message);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.displayName || !form.username || !form.email || !form.password) return;

    setLoading(true);
    try {
      console.log('[TestUsersPage] Creating user:', form.email);
      const userRecord = await createUserWithEmailAndPassword(auth, form.email, form.password);
      console.log('[TestUsersPage] Auth user created:', userRecord.user.uid);

      await setDoc(doc(db, 'users', userRecord.user.uid), {
        uid: userRecord.user.uid,
        email: form.email,
        emailNormalized: form.email.toLowerCase(),
        displayName: form.displayName,
        username: form.username,
        usernameNormalized: form.username.toLowerCase(),
        photoURL: null,
        bio: '',
        city: '',
        country: '',
        locationLabel: '',
        primaryActivity: null,
        activities: [],
        preferredCategories: [],
        equipment: [],
        followerCount: 0,
        followingCount: 0,
        liveCount: 0,
        followedCreators: [],
        role: 'user',
        accountStatus: 'active',
        onboardingCompleted: false,
        authProvider: 'password',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      console.log('[TestUsersPage] User profile created in Firestore');
      setForm({ displayName: '', username: '', email: '', password: '' });
      await loadUsers();
    } catch (err) {
      console.error('[TestUsersPage] Error creating user:', err.message, err.code);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (userUid) => {
    navigate(`/profile/${userUid}`);
  };

  return (
    <div className="test-users-page screen-scroll">
      <div className="test-users-container">
        <h1>Test Users</h1>

        <form className="test-users-form" onSubmit={handleCreateUser}>
          <div className="test-users-inputs">
            <input
              type="text"
              placeholder="Display name"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" disabled={loading} className="test-users-submit">
            <Plus size={18} />
            Create User
          </button>
        </form>

        <div className="test-users-list">
          <h2>{users.length} users</h2>
          {users.length === 0 ? (
            <p className="test-users-empty">No users yet. Create one above!</p>
          ) : (
            <ul className="test-users-items">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="test-users-item"
                  onClick={() => handleSelectUser(user.uid)}
                >
                  <div className="test-users-avatar">
                    {user.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="test-users-info">
                    <strong>{user.displayName}</strong>
                    <span className="test-users-username">@{user.username}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
