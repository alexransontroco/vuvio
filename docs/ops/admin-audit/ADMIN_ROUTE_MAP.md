# Carte des routes et accès

```mermaid
flowchart TD
  S[Settings, Admin console] --> A[/admin]
  A --> D[/admin/docs]
  S --> B[/admin/business]
  D --> M[/admin/marketing]
  D --> I[/admin/investor-crm]
  D --> N[/admin/analytics]
  M --> N
  U[URL directe] --> R[/admin/realtime-test]
  U --> T[/internal/streams]
```

Toutes les routes `/admin/*` passent dans `AdminRoute` (`App.jsx:108-119`) : allowlist email frontend, avec contournement local de développement. Plusieurs pages répètent encore cette vérification. `/internal/streams` passe seulement dans `ProtectedRoute`, bien qu’elle expose des actions de création et de modification ; les handlers serveur doivent être vérifiés avant tout changement d’accès.

Les liens principaux ne forment pas un menu global : les Docs listent Marketing, Investor CRM et Analytics ; Settings expose Admin console et Financial dashboard ; les laboratoires ne sont pas dans le menu. Le bouton retour de Marketing et Business utilise `navigate(-1)`, résultat dépendant de l’historique navigateur. La route Market Research n’existe pas dans ce commit `dev`.

**Contrôle des liens :** correspondance statique des routes ci-dessus ; navigation en navigateur et liens Markdown internes non validés. Les URL de documents Markdown ne sont pas des routes publiques autonomes ; leur résolution passe par la visionneuse Admin.
