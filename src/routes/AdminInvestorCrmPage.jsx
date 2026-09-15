import {
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Flag,
  GitBranch,
  Handshake,
  Layers3,
  LockKeyhole,
  Network,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const keyTerms = [
  { label: 'Source', value: '~190 HEC profiles', icon: Database },
  { label: 'First raise', value: '30-50 k€ target', icon: Target },
  { label: 'Next rounds', value: '150 k€ / 500 k€', icon: BarChart3 },
  { label: 'Rule', value: 'Public-source outreach', icon: LockKeyhole },
];

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'objective', label: 'Objective' },
  { id: 'qualification', label: 'Qualification' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'network', label: 'Network' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'quality', label: 'Quality rules' },
];

const qualificationFields = [
  'Nom complet',
  'Diplôme / promotion HEC',
  'Vivant / décédé / à vérifier',
  'Fonction actuelle',
  'Entreprise / organisation actuelle',
  'Profil : entrepreneur / dirigeant / BA / VC / family office / mécène / autre',
  'Business angel actif ? Oui / Non / Occasionnel / Non vérifié',
  'Historique d’investissements publics identifiés',
  'Secteurs et stades privilégiés',
  'Ticket estimé avec niveau de confiance',
  'Expérience consumer / mobile / media / vidéo / creator economy / marketplace',
  'Dimension France / Europe / États-Unis / internationale',
  'Potentiel advisor et puissance du réseau',
  'Sources publiques et date de vérification',
];

const scores = [
  ['Pertinence Vuvio', 'Adéquation générale avec le projet et l’équipe.'],
  ['Premier tour 30-50 k€', 'Habitude d’investir très tôt, petits tickets, tolérance à l’absence de traction.'],
  ['Tour 150 k€', 'Pertinence après premiers utilisateurs, créateurs et validation technique.'],
  ['Tour 500 k€', 'Pertinence avec métriques solides, produit stable et vrai seed.'],
  ['Advisor', 'Valeur stratégique potentielle hors investissement.'],
  ['Réseau', 'Capacité à ouvrir des portes vers investisseurs, tech, media, consumer, vidéo ou international.'],
];

const segments = [
  'Base complète',
  'Top 25',
  'Top 50',
  'Premier tour 30-50 k€',
  'Tour 150 k€',
  'Tour 500 k€',
  'Advisors / introducteurs',
  'À écarter / faible priorité',
];

const statuses = [
  'À qualifier',
  'Introduction à trouver',
  'Prêt à contacter',
  'Premier contact envoyé',
  'Relance',
  'Premier rendez-vous',
  'Deuxième rendez-vous',
  'À recontacter plus tard',
  'Due diligence / discussion investissement',
  'Investisseur',
  'Advisor / introducteur',
  'Pas intéressé',
  'À ne pas contacter',
];

const priorityProfiles = [
  ['André Haddad', 'Très haute', '30-50 k€', 'Consumer internet, expérience entrepreneuriale et investissements early-stage.'],
  ['Christophe Crémer', 'Très haute', '30-50 k€', 'Entrepreneur Internet / business angel, profil adapté à l’amorçage.'],
  ['Sébastien Breteau', 'Très haute', '30-150 k€', 'Entrepreneur-investisseur avec historique important de startups.'],
  ['Pascal Quiry', 'Très haute', '50-150 k€', 'Investissement + expertise finance et structuration.'],
  ['Nathalie Gaveau', 'Très haute', '50-150 k€', 'Consumer, marketplace, Internet/mobile et investissement startup.'],
  ['David Baverez', 'Haute', '30-150 k€', 'Private investor, seed/advisory et dimension internationale.'],
  ['Pierre Andurand', 'Haute', '150-500 k€', 'Early-stage tech/media, proximité sectorielle vidéo/media.'],
  ['Pierre Kosciusko-Morizet', 'À cultiver', '150-500 k€', 'Entrepreneur-investisseur et réseau tech très puissant.'],
];

const structures = [
  ['Paris Business Angels', 'Réseau BA', 'Premier tour / seed', 'Haute'],
  ['Investessor', 'Réseau BA', 'Premier tour / seed', 'Haute'],
  ['Angelsquare', 'Plateforme investisseurs', 'Pré-seed / seed', 'Haute'],
  ['France Angels', 'Fédération BA', 'Tous premiers tours', 'Haute comme source de réseau'],
  ['Kima Ventures', 'Fonds early-stage', 'Après premiers signaux', 'Moyenne'],
  ['ISAI', 'Fonds + réseau entrepreneurs', 'Seed structuré', 'Moyenne maintenant, haute plus tard'],
  ['C4 Ventures', 'Fonds VC', 'Tour 500 k€+', 'Haute plus tard'],
  ['HEC Incubateur / HEC Innovation', 'Écosystème', 'Maintenant', 'Haute'],
  ['Station F', 'Écosystème startup', 'Maintenant et plus tard', 'Moyenne à haute'],
  ['Bpifrance', 'Financement public', 'Selon éligibilité', 'À qualifier'],
];

const qualityRules = [
  'Ne jamais inventer un investissement, un ticket, une relation ou une fonction actuelle.',
  'Séparer clairement : vérifié / estimé / non vérifié.',
  'Conserver les sources publiques utilisées et leur date de consultation.',
  'Inclure un niveau de confiance pour les tickets estimés.',
  'Recalculer les scores quand Vuvio change de stade.',
  'Ne jamais citer la liste HEC dans les prises de contact.',
];

function AdminGate({ children }) {
  const { user, authLoading } = useAuth();
  const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
  const isLocalDev = import.meta.env.DEV || isLocalHost;
  const isAdmin = isLocalDev || user?.email?.endsWith('@vuvio.app') || user?.email === 'alexandre.ranson@gmail.com';

  if (authLoading && !isLocalDev) return null;
  if (!user && !isLocalDev) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/watch" replace />;

  return children;
}

function SectionHeader({ eyebrow, title, children }) {
  return (
    <div className="admin-docs-section-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function IconList({ items }) {
  return (
    <div className="douglas-icon-list">
      {items.map((item) => (
        <div key={item}>
          <CheckCircle2 size={16} strokeWidth={1.9} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function AnchorNav() {
  return (
    <aside className="douglas-nav" aria-label="Investor CRM sections">
      <strong>Investor CRM Brief</strong>
      <nav>
        {navItems.map((item) => (
          <a key={item.id} href={`#${item.id}`}>{item.label}</a>
        ))}
      </nav>
    </aside>
  );
}

export default function AdminInvestorCrmPage() {
  return (
    <AdminGate>
      <section className="admin-docs douglas-page" aria-label="Vuvio investor CRM admin brief">
        <header className="admin-docs-hero douglas-hero" id="overview">
          <div className="admin-docs-hero__copy">
            <p>CRM Investisseurs</p>
            <h1>Vuvio Investor CRM</h1>
            <span>Brief de création et d’intégration aux documents Admin</span>
          </div>
          <div className="admin-docs-hero__side">
            <div className="douglas-draft-badge">
              <ShieldCheck size={17} strokeWidth={1.9} />
              <span>CONFIDENTIEL — Admin / fondateurs</span>
            </div>
            <div className="admin-docs-actions">
              <a href="/admin/docs">Docs</a>
              <a href="/admin/investor-crm" className="is-active">Investor CRM</a>
              <a href="/admin/analytics">Analytics</a>
            </div>
          </div>
        </header>

        <div className="douglas-mobile-nav" aria-label="Investor CRM compact sections">
          {navItems.map((item) => (
            <a key={item.id} href={`#${item.id}`}>{item.label}</a>
          ))}
        </div>

        <section className="douglas-key-grid" aria-label="Key CRM terms">
          {keyTerms.map((term) => {
            const Icon = term.icon;
            return (
              <article key={term.label} className="admin-docs-metric douglas-key-card">
                <Icon size={18} strokeWidth={1.9} />
                <span>{term.label}</span>
                <strong>{term.value}</strong>
              </article>
            );
          })}
        </section>

        <p className="douglas-assumption-note">
          La liste HEC est une source interne confidentielle. Toute approche externe doit être justifiée uniquement par des informations publiques indépendantes.
        </p>

        <div className="douglas-layout">
          <AnchorNav />

          <main className="douglas-content">
            <section className="admin-docs-panel douglas-section" id="objective">
              <SectionHeader eyebrow="Objectif" title="Transformer une liste en actif de levée">
                <Target size={20} strokeWidth={1.8} />
              </SectionHeader>
              <div className="douglas-two-col">
                <p className="admin-docs-panel-copy douglas-lead">
                  Le livrable doit permettre de distinguer les personnes pertinentes aujourd’hui pour Vuvio, celles à cultiver pour les tours ultérieurs, les advisors / introducteurs possibles et les profils peu pertinents.
                </p>
                <div className="douglas-card-pair">
                  <article>
                    <FileSpreadsheet size={18} strokeWidth={1.8} />
                    <h3>Vuvio Investor CRM</h3>
                    <p>Version adaptée au produit consumer/mobile POV live, au stade prototype privé.</p>
                  </article>
                  <article>
                    <Layers3 size={18} strokeWidth={1.8} />
                    <h3>CRM générique</h3>
                    <p>Version réutilisable par Douglas et l’équipe, avec critères rendus paramétrables.</p>
                  </article>
                </div>
              </div>
            </section>

            <section className="admin-docs-panel douglas-section" id="qualification">
              <SectionHeader eyebrow="Données" title="Qualification de chaque personne">
                <Users size={20} strokeWidth={1.8} />
              </SectionHeader>
              <div className="douglas-assessment-grid">
                <article>
                  <h3>Identité & profil</h3>
                  <IconList items={qualificationFields.slice(0, 7)} />
                </article>
                <article>
                  <h3>Fit Vuvio & preuves</h3>
                  <IconList items={qualificationFields.slice(7)} />
                </article>
              </div>
            </section>

            <section className="admin-docs-panel douglas-section" id="scoring">
              <SectionHeader eyebrow="Scoring" title="Scores de pertinence Vuvio">
                <BarChart3 size={20} strokeWidth={1.8} />
              </SectionHeader>
              <p className="douglas-principle">
                Les scores ne sont pas des probabilités d’investissement. Chaque note doit être justifiée par des informations publiques disponibles.
              </p>
              <div className="crm-score-grid">
                {scores.map(([label, copy]) => (
                  <article key={label}>
                    <strong>{label} /100</strong>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-docs-panel douglas-section" id="pipeline">
              <SectionHeader eyebrow="Pipeline" title="Segmentation & prospection">
                <GitBranch size={20} strokeWidth={1.8} />
              </SectionHeader>
              <div className="douglas-two-col">
                <article>
                  <h3>Vues minimales</h3>
                  <div className="crm-chip-grid">
                    {segments.map((segment) => <span key={segment}>{segment}</span>)}
                  </div>
                </article>
                <article>
                  <h3>Statuts recommandés</h3>
                  <div className="crm-chip-grid">
                    {statuses.map((status) => <span key={status}>{status}</span>)}
                  </div>
                </article>
              </div>
              <p className="admin-docs-panel-copy">
                Prévoir aussi : propriétaire du contact, date du dernier échange, prochaine action, date de relance, montant potentiel, niveau d’intérêt et notes de rendez-vous.
              </p>
            </section>

            <section className="admin-docs-panel douglas-section" id="network">
              <SectionHeader eyebrow="Réseau" title="Profils, structures et introductions">
                <Network size={20} strokeWidth={1.8} />
              </SectionHeader>
              <p className="admin-docs-panel-copy">
                La vue Réseau doit aider à identifier les introductions chaleureuses : co-investissements, conseils communs, sociétés liées, HEC, Station F, ISAI, Kima, Hexa et autres relais pertinents.
              </p>
              <div className="douglas-table crm-profile-table" role="table" aria-label="Priority investor profiles">
                {['Profil', 'Priorité', 'Stade envisagé', 'Raison principale'].map((head) => <strong key={head}>{head}</strong>)}
                {priorityProfiles.flatMap((row) => row.map((cell, index) => <span key={`${row[0]}-${index}`}>{cell}</span>))}
              </div>
              <div className="douglas-table crm-structure-table" role="table" aria-label="Structures and networks">
                {['Structure / réseau', 'Type', 'Stade Vuvio', 'Priorité'].map((head) => <strong key={head}>{head}</strong>)}
                {structures.flatMap((row) => row.map((cell, index) => <span key={`${row[0]}-${index}`}>{cell}</span>))}
              </div>
            </section>

            <section className="admin-docs-panel douglas-section" id="strategy">
              <SectionHeader eyebrow="Stratégie" title="Contact & financement">
                <Handshake size={20} strokeWidth={1.8} />
              </SectionHeader>
              <div className="douglas-card-pair crm-rounds">
                <article>
                  <h3>Tour 1</h3>
                  <strong>30-50 k€</strong>
                  <p>Rendre le prototype robuste, sécurisé et réellement testable.</p>
                </article>
                <article>
                  <h3>Tour 2</h3>
                  <strong>~150 k€</strong>
                  <p>Après premiers usages, premiers créateurs et premiers signaux de traction.</p>
                </article>
                <article>
                  <h3>Tour 3</h3>
                  <strong>~500 k€</strong>
                  <p>Lorsque Vuvio peut présenter des métriques, un produit stable et une stratégie de croissance.</p>
                </article>
              </div>
              <div className="douglas-copy-stack">
                <p>Ne pas traiter tous les profils comme des investisseurs immédiats. Certains sont surtout des premiers interlocuteurs de qualité.</p>
                <p>Montrer le prototype, expliquer le besoin des 6 prochains mois, exposer les jalons mesurables puis demander un avis ou une permission de revenir avec des métriques.</p>
                <p>Privilégier un petit syndicat de plusieurs investisseurs plutôt qu’une dépendance à un seul chèque.</p>
              </div>
            </section>

            <section className="admin-docs-panel douglas-section" id="quality">
              <SectionHeader eyebrow="Qualité" title="Règles de données & confidentialité">
                <LockKeyhole size={20} strokeWidth={1.8} />
              </SectionHeader>
              <IconList items={qualityRules} />
              <div className="douglas-warning">Ne jamais mentionner la liste HEC dans les messages externes</div>
            </section>

            <section className="admin-docs-panel douglas-section douglas-proposal">
              <SectionHeader eyebrow="Livrable final" title="Système CRM cible">
                <BriefcaseBusiness size={20} strokeWidth={1.8} />
              </SectionHeader>
              <div className="douglas-risk-grid">
                <span>Personnes physiques <b>Profils, scores, sources, pipeline</b></span>
                <span>Structures & réseaux <b>Clubs BA, fonds, incubateurs, écosystèmes</b></span>
                <span>Relations <b>Introductions, routes d’accès, prochaines actions</b></span>
              </div>
              <p className="admin-docs-panel-copy">
                Le CRM doit devenir une base vivante permettant à Alexandre, Cécilia et Douglas de savoir qui contacter, à quel moment, pour quel montant, par quelle introduction et avec quel argument.
              </p>
            </section>
          </main>
        </div>
      </section>
    </AdminGate>
  );
}
