import { useLanguage } from '../../../context/LanguageContext.jsx';

const COPY = {
  en: {
    dialog: 'Vuvio introduction',
    skip: 'Skip', back: 'Back', next: 'Next', previous: 'Previous',
    captions: {
      watch: 'Discover real experiences.', live: 'Be there. Ask questions.',
      equipment: 'Discover their gear.', globe: 'Explore the world, live.',
    },
    tagline: 'See the world through their eyes.',
    activities: ['Live · Piano Dubai POV', 'Live · Cockpit POV', 'Live · Alpine ridge POV', 'Live · Wingsuit POV', 'Live · Moody Rooster'],
    nav: { watch: 'Watch', explore: 'Explore', globe: 'Globe', profile: 'Profile', start: 'Start a live', navigation: 'Vuvio navigation' },
    watch: {
      categories: ['All', 'Cooking', 'Riding', 'Hiking', 'Travel'],
      title: 'Busy Friday — behind the pass', watching: '3,210 watching',
    },
    live: {
      follow: 'Follow', viewOnGlobe: 'View on globe', openOnGlobe: 'Open this live on the globe',
      question: 'Ask a question…', start: 'Start a live',
      chefChat: ['The pace is insane 🔥', 'Friday dinner rush energy', 'Chef life is real 🍽️'],
      firefighterChat: ['The heat in there must be insane', 'Respect for these guys 🙏', 'The comms in the background 🔥'],
      otherChat: ['What a view!', 'This POV is incredible', 'Where are you right now?'],
    },
    equipment: {
      title: 'Creator gear', count: '3 items', view: 'View',
      items: [
        { name: 'GoPro Hero 13', sub: 'POV camera' },
        { name: 'Chest mount', sub: 'Hands-free streaming' },
        { name: 'Chef kit', sub: 'Friday service' },
      ],
    },
    globe: {
      recent: 'Recent', upcoming: 'Upcoming',
      cluster: (label, count) => `Open ${label} live cluster with ${count} streams`,
      title: (name) => `Live ${name}`, viewers: (count) => `${count} viewers`,
      watch: 'Watch', watchLive: (name) => `Watch ${name} live`, close: 'Close live preview', filters: 'Filters',
      categories: { Emergency: 'Emergency', Cooking: 'Cooking', Music: 'Music', 'Alpine ridge': 'Alpine ridge', Wingsuit: 'Wingsuit' },
    },
    start: {
      bikingName: 'Biking POV', bikingLocation: 'Forest trail',
      title: 'Start a live', preview: 'Preview', activity: 'What are you doing?',
      activityValue: 'Riding a forest trail', category: 'Choose a category',
      categories: ['Walking', 'Cooking', 'Work', 'Hiking', 'Cycling', 'Surfing', 'Flying', 'More'],
      broadcast: 'Broadcast to', alwaysOn: 'Always on', goLive: 'Go Live',
      guidelines: 'By going live you agree to our', communityGuidelines: 'Community Guidelines', everyone: 'Everyone',
    },
    enter: { titleFirst: 'Your world.', titleSecond: 'A new perspective.', button: 'Enter Vuvio' },
  },
  fr: {
    dialog: 'Présentation de Vuvio',
    skip: 'Passer', back: 'Retour', next: 'Suivant', previous: 'Précédent',
    captions: {
      watch: 'Découvrez des expériences réelles.', live: 'Vivez le moment. Posez vos questions.',
      equipment: 'Découvrez leur équipement.', globe: 'Explorez le monde en direct.',
    },
    tagline: 'Voyez le monde à travers leurs yeux.',
    activities: ['En direct · Piano à Dubaï', 'En direct · Vue du cockpit', 'En direct · Crête alpine', 'En direct · Wingsuit', 'En direct · Moody Rooster'],
    nav: { watch: 'Regarder', explore: 'Explorer', globe: 'Globe', profile: 'Profil', start: 'Lancer un live', navigation: 'Navigation Vuvio' },
    watch: {
      categories: ['Tout', 'Cuisine', 'Pilotage', 'Randonnée', 'Voyage'],
      title: 'Service du vendredi — côté cuisine', watching: '3 210 spectateurs',
    },
    live: {
      follow: 'Suivre', viewOnGlobe: 'Voir sur le globe', openOnGlobe: 'Ouvrir ce live sur le globe',
      question: 'Poser une question…', start: 'Lancer un live',
      chefChat: ['Quel rythme incroyable 🔥', 'Le coup de feu du vendredi !', 'La vraie vie en cuisine 🍽️'],
      firefighterChat: ['La chaleur doit être intense', 'Respect à toute l’équipe 🙏', 'On entend leurs échanges 🔥'],
      otherChat: ['Quelle vue !', 'Ce POV est incroyable', 'Tu es où en ce moment ?'],
    },
    equipment: {
      title: 'Équipement du créateur', count: '3 articles', view: 'Voir',
      items: [
        { name: 'GoPro Hero 13', sub: 'Caméra POV' },
        { name: 'Harnais poitrine', sub: 'Filmer les mains libres' },
        { name: 'Tenue de chef', sub: 'Service du vendredi' },
      ],
    },
    globe: {
      recent: 'Récents', upcoming: 'À venir',
      cluster: (label, count) => `Ouvrir les ${count} lives de ${label}`,
      title: (name) => `${name} en direct`, viewers: (count) => `${count} spectateurs`,
      watch: 'Regarder', watchLive: (name) => `Regarder le live de ${name}`, close: 'Fermer l’aperçu du live', filters: 'Filtres',
      categories: { Emergency: 'Urgences', Cooking: 'Cuisine', Music: 'Musique', 'Alpine ridge': 'Crête alpine', Wingsuit: 'Wingsuit' },
    },
    start: {
      bikingName: 'Vélo en forêt', bikingLocation: 'Sentier forestier',
      title: 'Lancer un live', preview: 'Aperçu', activity: 'Que faites-vous ?',
      activityValue: 'Descente sur un sentier forestier', category: 'Choisissez une catégorie',
      categories: ['Marche', 'Cuisine', 'Travail', 'Randonnée', 'Vélo', 'Surf', 'Vol', 'Plus'],
      broadcast: 'Diffuser sur', alwaysOn: 'Toujours actif', goLive: 'Lancer le live',
      guidelines: 'En lançant un live, vous acceptez nos', communityGuidelines: 'Règles de la communauté', everyone: 'Tout le monde',
    },
    enter: { titleFirst: 'Votre monde.', titleSecond: 'Un nouveau regard.', button: 'Entrer dans Vuvio' },
  },
};

export function useIntroCopy() {
  const { language } = useLanguage();
  return COPY[language === 'fr' ? 'fr' : 'en'];
}
