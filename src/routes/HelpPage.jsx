import { Mail, Siren } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HelpAccordion from '../components/HelpAccordion.jsx';
import HelpSearch from '../components/HelpSearch.jsx';
import SettingsPageHeader from '../components/SettingsPageHeader.jsx';

export default function HelpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  const helpCategories = useMemo(() => [
    {
      title: t('help.categories.discover.title'),
      items: [
        {
          question: t('help.categories.discover.items.whatIsVuvio.question'),
          answer: (
            <>
              <p>{t('help.categories.discover.items.whatIsVuvio.p1')}</p>
              <p>{t('help.categories.discover.items.whatIsVuvio.p2')}</p>
            </>
          ),
        },
        {
          question: t('help.categories.discover.items.howDiscover.question'),
          answer: (
            <>
              <p>{t('help.categories.discover.items.howDiscover.intro')}</p>
              <ul>
                <li>{t('help.categories.discover.items.howDiscover.item1')}</li>
                <li>{t('help.categories.discover.items.howDiscover.item2')}</li>
                <li>{t('help.categories.discover.items.howDiscover.item3')}</li>
                <li>{t('help.categories.discover.items.howDiscover.item4')}</li>
                <li>{t('help.categories.discover.items.howDiscover.item5')}</li>
              </ul>
              <p>{t('help.categories.discover.items.howDiscover.footer')}</p>
            </>
          ),
        },
        {
          question: t('help.categories.discover.items.mapCategories.question'),
          answer: (
            <>
              <p>{t('help.categories.discover.items.mapCategories.intro')}</p>
              <ul>
                <li>{t('help.categories.discover.items.mapCategories.item1')}</li>
                <li>{t('help.categories.discover.items.mapCategories.item2')}</li>
                <li>{t('help.categories.discover.items.mapCategories.item3')}</li>
                <li>{t('help.categories.discover.items.mapCategories.item4')}</li>
              </ul>
              <p>{t('help.categories.discover.items.mapCategories.footer')}</p>
            </>
          ),
        },
      ],
    },
    {
      title: t('help.categories.watch.title'),
      items: [
        {
          question: t('help.categories.watch.items.openLive.question'),
          answer: (
            <>
              <p>{t('help.categories.watch.items.openLive.p1')}</p>
              <p>{t('help.categories.watch.items.openLive.p2')}</p>
              <ul>
                <li>{t('help.categories.watch.items.openLive.item1')}</li>
                <li>{t('help.categories.watch.items.openLive.item2')}</li>
                <li>{t('help.categories.watch.items.openLive.item3')}</li>
                <li>{t('help.categories.watch.items.openLive.item4')}</li>
                <li>{t('help.categories.watch.items.openLive.item5')}</li>
                <li>{t('help.categories.watch.items.openLive.item6')}</li>
              </ul>
            </>
          ),
        },
        {
          question: t('help.categories.watch.items.videoStops.question'),
          answer: (
            <>
              <p>{t('help.categories.watch.items.videoStops.intro')}</p>
              <ul>
                <li>{t('help.categories.watch.items.videoStops.item1')}</li>
                <li>{t('help.categories.watch.items.videoStops.item2')}</li>
                <li>{t('help.categories.watch.items.videoStops.item3')}</li>
                <li>{t('help.categories.watch.items.videoStops.item4')}</li>
                <li>{t('help.categories.watch.items.videoStops.item5')}</li>
              </ul>
              <p>{t('help.categories.watch.items.videoStops.footer')}</p>
            </>
          ),
        },
        {
          question: t('help.categories.watch.items.afterEnds.question'),
          answer: (
            <>
              <p>{t('help.categories.watch.items.afterEnds.p1')}</p>
              <p>{t('help.categories.watch.items.afterEnds.p2')}</p>
            </>
          ),
        },
      ],
    },
    {
      title: t('help.categories.broadcast.title'),
      items: [
        {
          question: t('help.categories.broadcast.items.startLive.question'),
          answer: (
            <ol>
              <li>{t('help.categories.broadcast.items.startLive.step1')}</li>
              <li>{t('help.categories.broadcast.items.startLive.step2')}</li>
              <li>{t('help.categories.broadcast.items.startLive.step3')}</li>
              <li>{t('help.categories.broadcast.items.startLive.step4')}</li>
              <li>{t('help.categories.broadcast.items.startLive.step5')}</li>
              <li>{t('help.categories.broadcast.items.startLive.step6')}</li>
            </ol>
          ),
        },
        {
          question: t('help.categories.broadcast.items.chooseLocation.question'),
          answer: (
            <>
              <p>{t('help.categories.broadcast.items.chooseLocation.intro')}</p>
              <ul>
                <li>{t('help.categories.broadcast.items.chooseLocation.item1')}</li>
                <li>{t('help.categories.broadcast.items.chooseLocation.item2')}</li>
                <li>{t('help.categories.broadcast.items.chooseLocation.item3')}</li>
                <li>{t('help.categories.broadcast.items.chooseLocation.item4')}</li>
              </ul>
              <p>{t('help.categories.broadcast.items.chooseLocation.footer')}</p>
            </>
          ),
        },
        {
          question: t('help.categories.broadcast.items.permissions.question'),
          answer: (
            <>
              <p>{t('help.categories.broadcast.items.permissions.p1')}</p>
              <p>{t('help.categories.broadcast.items.permissions.p2')}</p>
            </>
          ),
        },
        {
          question: t('help.categories.broadcast.items.pause.question'),
          answer: (
            <>
              <p>{t('help.categories.broadcast.items.pause.p1')}</p>
              <p>{t('help.categories.broadcast.items.pause.p2')}</p>
            </>
          ),
        },
      ],
    },
    {
      title: t('help.categories.account.title'),
      items: [
        {
          question: t('help.categories.account.items.editProfile.question'),
          answer: (
            <>
              <p>{t('help.categories.account.items.editProfile.p1')}</p>
              <p>{t('help.categories.account.items.editProfile.p2')}</p>
              <ul>
                <li>{t('help.categories.account.items.editProfile.item1')}</li>
                <li>{t('help.categories.account.items.editProfile.item2')}</li>
                <li>{t('help.categories.account.items.editProfile.item3')}</li>
                <li>{t('help.categories.account.items.editProfile.item4')}</li>
                <li>{t('help.categories.account.items.editProfile.item5')}</li>
                <li>{t('help.categories.account.items.editProfile.item6')}</li>
              </ul>
            </>
          ),
        },
        {
          question: t('help.categories.account.items.changeEmail.question'),
          answer: <p>{t('help.categories.account.items.changeEmail.answer')}</p>,
        },
        {
          question: t('help.categories.account.items.deleteAccount.question'),
          answer: <p>{t('help.categories.account.items.deleteAccount.answer')}</p>,
        },
      ],
    },
    {
      title: t('help.categories.safety.title'),
      items: [
        {
          question: t('help.categories.safety.items.report.question'),
          answer: <p>{t('help.categories.safety.items.report.answer')}</p>,
        },
        {
          question: t('help.categories.safety.items.block.question'),
          answer: <p>{t('help.categories.safety.items.block.answer')}</p>,
        },
        {
          question: t('help.categories.safety.items.danger.question'),
          answer: <p>{t('help.categories.safety.items.danger.answer')}</p>,
        },
      ],
    },
  ], [t]);

  useEffect(() => {
    if (location.state?.scrollTo === 'what-is-vuvio') {
      setOpenId(t('help.categories.discover.items.whatIsVuvio.question'));
    }
  }, [location.state, t]);

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return helpCategories;

    return helpCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => item.question.toLowerCase().includes(normalized)),
      }))
      .filter((category) => category.items.length > 0);
  }, [query, helpCategories]);

  return (
    <section className="screen-scroll support-screen" aria-label={t('help.ariaLabel')}>
      <SettingsPageHeader title={t('help.title')} />
      <div className="support-content">
        <p className="support-intro">{t('help.intro')}</p>
        <HelpSearch value={query} onChange={setQuery} />
        <HelpAccordion categories={filteredCategories} openId={openId} onToggle={setOpenId} />
        <footer className="support-footer-actions">
          <strong>{t('help.footer.noAnswer')}</strong>
          <button type="button" className="support-primary-button" onClick={() => navigate('/report-problem')}>
            <Siren size={17} strokeWidth={1.8} />
            {t('help.footer.reportProblem')}
          </button>
          <a className="support-secondary-button" href="mailto:hello@vuvio.app">
            <Mail size={17} strokeWidth={1.8} />
            {t('help.footer.contactSupport')}
          </a>
        </footer>
      </div>
    </section>
  );
}
