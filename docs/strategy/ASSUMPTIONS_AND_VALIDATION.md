Status: Current

# Hypothèses et validation terrain

*Backlog de tests au 23 novembre 2026 — aucun résultat empirique n'est inventé.*

| ID | Hypothèse falsifiable | Signal et test minimum | État |
| --- | --- | --- | --- |
| H01 | Des spectateurs veulent regarder une activité réelle en direct sans connaître l'auteur. | Tests Watch anonymes + entretiens ; comparaison avec vidéo à la demande. | À tester |
| H02 | Le POV centré sur l'activité réduit la gêne à diffuser chez certains créateurs. | Entretiens et essais avec/sans visage ; observer le choix réel. | À tester |
| H03 | Le Globe aide à découvrir des lives pertinents. | Mesurer ouverture, clics, démarrage de visionnage et retour depuis le Globe. | À tester |
| H04 | Quelques créateurs pilotes peuvent amener leurs propres audiences. | Attribuer clics → watch → inscription → deuxième visite par lien pilote. | À tester |
| H05 | Une session en live donne envie de revenir pour la suite. | Cohortes D1/D7, follow, notifications réellement reçues, revisites. | À tester |
| H06 | Les fiches Equipment créent une intention commerciale spontanée. | Ouvertures Equipment → clics marchands → conversions attribuées si données disponibles. | À tester |
| H07 | Des lieux ou marques paieraient pour une mise en avant contextualisée. | Entretiens acheteurs + test de proposition/prix, sans promesse produit. | À tester |
| H08 | Certains professionnels souhaitent animer des workshops payants. | Entretiens et pilotes gratuits, puis tests de prix et taux d'inscription. | À tester |
| H09 | Les visiteurs accepteraient un Workshop Pass. | Comparer achat à l'unité, crédits et pass ; éviter d'imposer un abonnement avant preuve. | À tester |
| H10 | Le coût de visionnage est compatible avec les sources de revenus. | Modèle coût par minute regardée + scénarios de concurrence et de conversion. | À mesurer |

## Première boucle recommandée : bêta de 50 personnes / 2 semaines

Séparer explicitement **créateurs**, **spectateurs invités** et **retours utilisateurs**. Capturer la provenance des visiteurs, nombre de sessions diffusées, qualité média, minutes regardées, délai vers premier live utile, rétention et motifs d'abandon.

La taille de bêta est un **objectif de test**, pas une preuve de demande. Les mesures sont à instrumenter avant de tirer des conclusions.

## Statut des métriques

La base analytics inclut des événements de visionnage, sessions et inscriptions. Toutefois, l'attribution `ref` de créateur n'est pas encore un entonnoir fiable de bout en bout. Voir [audit acquisition du 21 novembre](../analytics/first-creator-acquisition-mvp.md). Ne pas annoncer comme acquis : taux de conversion par créateur, rappel visiteur livré ou push PWA iOS.

## Canevas d'expérience

```text
ID / propriétaire :
Hypothèse :
Segment :
Comportement observable / seuil de décision préfixé :
Protocole et taille d'échantillon :
Résultats (y compris négatifs) :
Décision : conserver / modifier / abandonner
Prochaine étape :
```

Le suivi financier est détaillé dans [Unit Economics](../business/UNIT_ECONOMICS.md).
