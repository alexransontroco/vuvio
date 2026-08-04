import { ChevronLeft, Download, Github } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FriendsWatchingPill } from '../components/social/FriendsWatchingPill.jsx';
import { FriendsWatchingSheet } from '../components/social/FriendsWatchingSheet.jsx';
import { InviteFriendsSheet } from '../components/social/InviteFriendsSheet.jsx';
import { FriendLiveActivityCard } from '../components/social/FriendLiveActivityCard.jsx';
import { FriendJoinedToast } from '../components/social/FriendJoinedToast.jsx';
import { useFriendsWatching, useInviteFriends, useFriendArrivals } from '../hooks/useLivePresence.js';
import '../components/social/social.css';

const mockLiveId = 'demo-live-tokyo';
const mockLiveTitle = 'Night Ride Through Tokyo';

const mockFriends = [
  { id: 'user-cecilia', name: 'Cecilia', username: 'cecilia', avatar: '👩', joinedAt: new Date(Date.now() - 120000).toISOString() },
  { id: 'user-lucas', name: 'Lucas', username: 'lucas', avatar: '👨', joinedAt: new Date(Date.now() - 480000).toISOString() },
  { id: 'user-maya', name: 'Maya', username: 'maya', avatar: '👨‍🦱', joinedAt: new Date(Date.now() - 5000).toISOString() },
];

const mockLive = {
  id: mockLiveId,
  title: mockLiveTitle,
  image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=200&h=200&fit=crop',
  location: 'Tokyo, Japan',
};

/**
 * Demo page showcasing social presence features
 * Shows all components in action with mock data
 */
export default function SocialDemoPage() {
  const navigate = useNavigate();
  const [showFriendsSheet, setShowFriendsSheet] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [selectedTab, setSelectedTab] = useState('pill');

  const { friends } = useFriendsWatching(mockLiveId);
  const { friends: invitableFriends, selected, toggleFriend, sendInvites, invitedIds } = useInviteFriends(mockLiveId, mockLiveTitle);

  return (
    <section className="screen-scroll settings-screen" aria-label="Social Presence Demo">
      <header className="settings-header">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={1.9} />
        </button>
        <h1>Social Presence Features</h1>
        <span aria-hidden="true" />
      </header>

      <div className="settings-content" style={{ paddingTop: 0 }}>
        {/* Navigation tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '16px 16px 0', marginBottom: '16px', overflowX: 'auto', borderBottom: '0.5px solid rgba(134, 202, 224, 0.1)' }}>
          {[
            { id: 'pill', label: 'Friends Pill' },
            { id: 'activity', label: 'Activity Card' },
            { id: 'sheets', label: 'Sheets' },
            { id: 'about', label: 'About' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTab(tab.id)}
              style={{
                padding: '8px 12px',
                border: 'none',
                background: selectedTab === tab.id ? 'rgba(53, 227, 220, 0.15)' : 'transparent',
                color: selectedTab === tab.id ? '#35e3dc' : 'var(--vuvio-text-muted)',
                fontSize: '12px',
                fontWeight: selectedTab === tab.id ? '600' : '500',
                borderRadius: '8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 200ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Friends Watching Pill Demo */}
        {selectedTab === 'pill' && (
          <section className="settings-group">
            <h2>Friends Watching Pill</h2>
            <div className="settings-card">
              <p style={{ fontSize: '13px', color: 'var(--vuvio-text-secondary)', marginBottom: '16px' }}>
                Compact capsule showing when friends are watching the same live. Appears in the live viewer when friends are present.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'rgba(4, 19, 31, 0.5)', borderRadius: '14px', border: '0.5px solid rgba(134, 202, 224, 0.1)' }}>
                <div>
                  <p style={{ fontSize: '11px', color: 'var(--vuvio-text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Three friends watching</p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <FriendsWatchingPill
                      friends={mockFriends}
                      count={mockFriends.length}
                      onClick={() => setShowFriendsSheet(true)}
                    />
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: '11px', color: 'var(--vuvio-text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Single friend watching</p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <FriendsWatchingPill
                      friends={[mockFriends[0]]}
                      count={1}
                      onClick={() => setShowFriendsSheet(true)}
                    />
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: '11px', color: 'var(--vuvio-text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Many friends (7 total)</p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <FriendsWatchingPill
                      friends={mockFriends}
                      count={7}
                      onClick={() => setShowFriendsSheet(true)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFriendsSheet(true)}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px 16px',
                  border: '0.5px solid rgba(134, 202, 224, 0.24)',
                  borderRadius: '10px',
                  background: 'rgba(53, 227, 220, 0.1)',
                  color: '#35e3dc',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
              >
                Try interactive pill →
              </button>
            </div>
          </section>
        )}

        {/* Activity Card Demo */}
        {selectedTab === 'activity' && (
          <section className="settings-group">
            <h2>Friend Live Activity Card</h2>
            <div className="settings-card" style={{ padding: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--vuvio-text-secondary)', marginBottom: '16px' }}>
                Reusable card showing a friend is watching a live. Can be used in Messages, Home, or friends activity sections.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {mockFriends.map((friend) => (
                  <FriendLiveActivityCard
                    key={friend.id}
                    friend={friend}
                    live={mockLive}
                    onJoinLive={() => alert(`Join ${friend.name} watching ${mockLive.title}`)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Sheets Demo */}
        {selectedTab === 'sheets' && (
          <section className="settings-group">
            <h2>Bottom Sheets</h2>
            <div className="settings-card">
              <p style={{ fontSize: '13px', color: 'var(--vuvio-text-secondary)', marginBottom: '16px' }}>
                Interactive bottom sheets for viewing friends and inviting them to watch.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteSheet(false);
                    setShowFriendsSheet(true);
                  }}
                  style={{
                    padding: '12px 16px',
                    border: '0.5px solid rgba(134, 202, 224, 0.24)',
                    borderRadius: '10px',
                    background: 'rgba(53, 227, 220, 0.1)',
                    color: '#35e3dc',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                >
                  Open Friends Watching Sheet
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowFriendsSheet(false);
                    setShowInviteSheet(true);
                  }}
                  style={{
                    padding: '12px 16px',
                    border: '0.5px solid rgba(134, 202, 224, 0.24)',
                    borderRadius: '10px',
                    background: 'rgba(53, 227, 220, 0.1)',
                    color: '#35e3dc',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                >
                  Open Invite Friends Sheet
                </button>

                <button
                  type="button"
                  onClick={() => setShowToast(true)}
                  style={{
                    padding: '12px 16px',
                    border: '0.5px solid rgba(134, 202, 224, 0.24)',
                    borderRadius: '10px',
                    background: 'rgba(53, 227, 220, 0.1)',
                    color: '#35e3dc',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                >
                  Show Friend Joined Toast
                </button>
              </div>
            </div>
          </section>
        )}

        {/* About */}
        {selectedTab === 'about' && (
          <section className="settings-group">
            <h2>About Social Presence</h2>
            <div className="settings-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', color: '#f5fbff', fontSize: '14px', fontWeight: '600' }}>Features</h3>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--vuvio-text-secondary)', fontSize: '13px', gap: '6px', display: 'flex', flexDirection: 'column' }}>
                    <li>See when friends are watching the same live</li>
                    <li>Open a sheet showing who's present</li>
                    <li>Invite friends to join the current live</li>
                    <li>Get notified when friends join</li>
                    <li>Control viewing activity visibility in Settings</li>
                  </ul>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px', color: '#f5fbff', fontSize: '14px', fontWeight: '600' }}>Architecture</h3>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--vuvio-text-secondary)', fontSize: '13px', gap: '6px', display: 'flex', flexDirection: 'column' }}>
                    <li>Mock data service for presence</li>
                    <li>React hooks for state management</li>
                    <li>Reusable components (pills, sheets, cards)</li>
                    <li>Ready to connect to real-time backend</li>
                  </ul>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px', color: '#f5fbff', fontSize: '14px', fontWeight: '600' }}>Design</h3>
                  <p style={{ margin: 0, color: 'var(--vuvio-text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
                    Integrates seamlessly with Vuvio's design language using existing colors, spacing, and interaction patterns. Subtle, non-intrusive, and maintains focus on the live stream.
                  </p>
                </div>

                <div style={{ borderTop: '0.5px solid rgba(134, 202, 224, 0.1)', paddingTop: '16px' }}>
                  <p style={{ margin: '0 0 12px', color: 'var(--vuvio-text-muted)', fontSize: '12px' }}>Created with attention to detail and Vuvio's visual identity.</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a href="#" style={{ color: '#35e3dc', textDecoration: 'none', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Github size={14} /> Code
                    </a>
                    <a href="#" style={{ color: '#35e3dc', textDecoration: 'none', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={14} /> Design specs
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Sheets */}
      {showFriendsSheet && (
        <FriendsWatchingSheet
          friends={mockFriends}
          onClose={() => setShowFriendsSheet(false)}
          onViewProfile={(userId) => console.log('View profile:', userId)}
          onInvite={() => {
            setShowFriendsSheet(false);
            setShowInviteSheet(true);
          }}
        />
      )}

      {showInviteSheet && (
        <InviteFriendsSheet
          friends={invitableFriends}
          selected={selected}
          invitedIds={invitedIds}
          onToggleFriend={toggleFriend}
          onSendInvites={sendInvites}
          onClose={() => setShowInviteSheet(false)}
        />
      )}

      {/* Toast */}
      {showToast && (
        <FriendJoinedToast
          friend={mockFriends[0]}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </section>
  );
}
