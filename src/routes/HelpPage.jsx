import { Mail, Siren } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HelpAccordion from '../components/HelpAccordion.jsx';
import HelpSearch from '../components/HelpSearch.jsx';
import SettingsPageHeader from '../components/SettingsPageHeader.jsx';

const helpCategories = [
  {
    title: 'Discover Vuvio',
    items: [
      {
        question: 'What is Vuvio?',
        answer: (
          <>
            <p>Vuvio is a platform for discovering and watching live videos from different places around the world.</p>
            <p>Creators can share an activity, event, profession, journey or point of view in real time. Viewers can explore live streams from the feed or the interactive map.</p>
          </>
        ),
      },
      {
        question: 'How do I discover live streams?',
        answer: (
          <>
            <p>You can discover live streams from:</p>
            <ul>
              <li>the home screen;</li>
              <li>the Discover page;</li>
              <li>the world map;</li>
              <li>profiles you follow;</li>
              <li>categories suggested by Vuvio.</li>
            </ul>
            <p>Live streams currently broadcasting are marked with LIVE.</p>
          </>
        ),
      },
      {
        question: 'What do the map categories mean?',
        answer: (
          <>
            <p>Live streams can be grouped by environment or activity:</p>
            <ul>
              <li>Air: drone, aviation, paragliding or aerial view;</li>
              <li>Land: walking, cycling, vehicle, profession or event;</li>
              <li>Water: boat, surfing, diving or water activity;</li>
              <li>Fixed place: concert, workshop, cooking, venue or installed camera.</li>
            </ul>
            <p>You can use filters to show only some categories.</p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Watch a live',
    items: [
      {
        question: 'How do I open a live stream?',
        answer: (
          <>
            <p>Tap a thumbnail, a glowing point on the map or a post marked LIVE.</p>
            <p>The live view shows:</p>
            <ul>
              <li>the video;</li>
              <li>the creator name;</li>
              <li>the live title and category;</li>
              <li>the viewer count;</li>
              <li>available reactions and comments;</li>
              <li>location or activity details.</li>
            </ul>
          </>
        ),
      },
      {
        question: 'Why does the video stop?',
        answer: (
          <>
            <p>An interruption can be caused by:</p>
            <ul>
              <li>an unstable internet connection;</li>
              <li>the creator’s connection;</li>
              <li>a network change;</li>
              <li>a manual pause;</li>
              <li>the end of the live stream.</li>
            </ul>
            <p>When possible, Vuvio tries to reconnect the stream automatically.</p>
          </>
        ),
      },
      {
        question: 'Can I watch a live stream after it ends?',
        answer: (
          <>
            <p>Some creators can choose to save their live stream and make it available as a replay.</p>
            <p>If no replay is available, the live stream cannot be viewed after it ends.</p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Broadcast on Vuvio',
    items: [
      {
        question: 'How do I start a live stream?',
        answer: (
          <ol>
            <li>Tap the central Vuvio button.</li>
            <li>Select Start a live.</li>
            <li>Add a title and category.</li>
            <li>Choose the location details you want to display.</li>
            <li>Allow camera and microphone access.</li>
            <li>Tap Start live.</li>
          </ol>
        ),
      },
      {
        question: 'Can I choose who sees my location?',
        answer: (
          <>
            <p>Yes. Before starting a live stream, you can choose the displayed precision level:</p>
            <ul>
              <li>precise location;</li>
              <li>approximate area;</li>
              <li>city or region only;</li>
              <li>no public location.</li>
            </ul>
            <p>A precise location should never be made public without a clear user action. Location access should remain limited to what is necessary and easy to revoke.</p>
          </>
        ),
      },
      {
        question: 'Why does Vuvio ask for camera and microphone access?',
        answer: (
          <>
            <p>These permissions are required to broadcast live video.</p>
            <p>You can revoke them from your phone or browser settings. Without them, you can still watch live streams but cannot start one.</p>
          </>
        ),
      },
      {
        question: 'Can I pause my live stream temporarily?',
        answer: (
          <>
            <p>Yes. Use the Pause button.</p>
            <p>During a short interruption, viewers see a waiting screen. You can then resume or end the live stream.</p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Account and profile',
    items: [
      {
        question: 'How do I edit my profile?',
        answer: (
          <>
            <p>From your profile, select Edit my profile.</p>
            <p>You can edit:</p>
            <ul>
              <li>your photo or avatar;</li>
              <li>your display name;</li>
              <li>your bio;</li>
              <li>your language;</li>
              <li>your interests;</li>
              <li>your privacy preferences.</li>
            </ul>
          </>
        ),
      },
      {
        question: 'How do I change my email address or password?',
        answer: <p>Open: Profile → Settings → Account and security. Depending on your sign-in method, a new authentication step may be required.</p>,
      },
      {
        question: 'How do I delete my account?',
        answer: <p>Open: Profile → Settings → Account and security → Delete my account. Deletion disables your profile and removes or anonymizes related data, except data Vuvio must temporarily keep for security or legal reasons.</p>,
      },
    ],
  },
  {
    title: 'Safety and moderation',
    items: [
      {
        question: 'How do I report content?',
        answer: <p>Tap the ··· menu on the live stream, video, comment or profile, then select Report. You will choose a report reason and can add details.</p>,
      },
      {
        question: 'How do I block a user?',
        answer: <p>From their profile or one of their posts: ··· → Block user. The blocked person will no longer be able to interact directly with you. Vuvio will not tell them they were blocked.</p>,
      },
      {
        question: 'What should I do in immediate danger?',
        answer: <p>Do not put yourself in danger to film or intervene. Leave the live stream and contact the appropriate emergency services. Vuvio reports do not replace police, rescue or medical services.</p>,
      },
    ],
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (location.state?.scrollTo === 'what-is-vuvio') {
      setOpenId('What is Vuvio?');
    }
  }, [location.state]);

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return helpCategories;

    return helpCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => item.question.toLowerCase().includes(normalized)),
      }))
      .filter((category) => category.items.length > 0);
  }, [query]);

  return (
    <section className="screen-scroll support-screen" aria-label="Help center">
      <SettingsPageHeader title="Help center" />
      <div className="support-content">
        <p className="support-intro">Find answers to the most common questions about Vuvio.</p>
        <HelpSearch value={query} onChange={setQuery} />
        <HelpAccordion categories={filteredCategories} openId={openId} onToggle={setOpenId} />
        <footer className="support-footer-actions">
          <strong>Didn’t find your answer?</strong>
          <button type="button" className="support-primary-button" onClick={() => navigate('/report-problem')}>
            <Siren size={17} strokeWidth={1.8} />
            Report a problem
          </button>
          <a className="support-secondary-button" href="mailto:hello@vuvio.app">
            <Mail size={17} strokeWidth={1.8} />
            Contact support
          </a>
        </footer>
      </div>
    </section>
  );
}
