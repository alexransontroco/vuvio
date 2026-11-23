Status: Current

# Unit economics — coût d'un live et d'un spectateur

*Cadre de calcul, 23 novembre 2026. Aucun tarif fournisseur non vérifié n'est supposé.*

## Unités (à ne pas mélanger)

- **Créateur actif** : créateur ayant diffusé au moins un live pendant la période.
- **Live-minute** : une minute d'ingestion/diffusion d'un live.
- **Viewer-minute** : une minute de visionnage par **un** spectateur. Un live de 30 min regardé par 10 personnes en entier = 300 viewer-minutes.
- **Utilisateur actif** : préciser MAU/WAU/DAU ; inscription seule ≠ utilisateur actif.
- **Session regardée** : démarrage et durée utile, avec seuil à documenter.

## Formules du modèle

```text
live_minutes = nombre_de_lives × durée_moyenne_min
viewer_minutes = Σ (minutes_effectivement_regardées_par_spectateur)

coût_streaming =
    coût_ingestion(live_minutes)
  + coût_livraison(viewer_minutes)
  + coût_stockage_replay(GB × durée_conservation)
  + coût_traitement_recaps/highlights
  + coût_realtime_si_et_seulement_si_activé

coût_variable_total =
    coût_streaming
  + coûts_cloud_variables (functions, stockage, egress, IA)
  + coûts_notifs/transactions/modération_variables

coût_par_viewer_minute = coût_variable_total_attribuable_au_visionnage / viewer_minutes
coût_par_live = coûts_attribuables_aux_lives / nombre_de_lives
coût_par_MAU = coûts_variables_attribuables_aux_MAU / MAU

marge_contributive = revenus_nets_attribuables - coûts_variables_attribuables
```

Les frais fixes (outils, domaine, hébergement minimum, administration, rémunérations) apparaissent **à part** : les intégrer ensuite au compte de résultat, ne pas les compter deux fois.

## Exemple purement pédagogique, sans prix Cloudflare

Une session de 60 min avec 5 spectateurs regardant chacun 20 min :
- ingestion : **60 live-minutes** ;
- consommation : **100 viewer-minutes** ;
- les 5 connexions simultanées **ne changent pas** les 60 minutes de durée du live ;
- le coût réel dépend du fournisseur, des règles de facturation, du replay et du pipeline.

## Scénarios

| Entrée | Bas | Central | Haut |
| --- | --- | --- | --- |
| Créateurs actifs / mois | à saisir | à saisir | à saisir |
| Lives / créateur / mois | à saisir | à saisir | à saisir |
| Durée moyenne live (min) | à saisir | à saisir | à saisir |
| Viewer-minutes / live | à saisir | à saisir | à saisir |
| Taux de replay sauvegardé | à saisir | à saisir | à saisir |
| Durée de rétention des vidéos | à saisir | à saisir | à saisir |
| Clics marchands / 100 spectateurs | à mesurer | à mesurer | à mesurer |
| Conversion commissionnable | à mesurer | à mesurer | à mesurer |

## Realtime : clarification essentielle

Le live normal actuel n'a pas besoin de l'infrastructure de **participation multi-utilisateur Realtime** envisagée pour les workshops. **Ne pas ajouter de coût Realtime au scénario MVP Watch Only** tant que cette option est désactivée. Les prix et politiques tarifaires doivent être revalidés sur les sources fournisseur avant une décision.

## Données à collecter

Horodatages de live, viewer watch durations réelles, replays effectivement consommés, unités Cloudflare facturées, frais Firebase/Storage/Functions, coûts IA par analyse, bande passante éventuelle, modération, taux de clic et commissions réellement attribuées.

## Ne pas confondre

- CAC = dépenses d'acquisition / nouveaux utilisateurs acquis selon définition explicite.
- LTV = marge contributive attendue sur la durée de vie, **pas** revenu brut par inscrit.
- Coût d'une visite ≠ coût d'un spectateur ≠ coût d'un inscrit.
- Un prévisionnel sur trois ou cinq ans reste un **scénario** jusqu'aux validations terrain.

Sources liées : [architecture streaming](../streaming/README.md), [analytics](../analytics/README.md), [business model](BUSINESS_MODEL.md).
