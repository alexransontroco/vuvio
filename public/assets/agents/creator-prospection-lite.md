# 🚀 Agent Prospection Créateurs - CRM Vuvio

Système pour remplir ton Excel de prospection automatiquement.

---

## 5️⃣ Agents pour le Tunnel de Prospection

### 1️⃣ **Agent Recherche** 🔍
Trouve créateurs potentiels.

**Tu dis:**
```
"Trouve 15 chefs POV en France
Followers: 100k-500k
Format: Nom | Handle | Followers | Email"
```

**Agent répond:**
```
José Andrés | @chefandres | 2.1M | josé@...
Cyril Lignac | @cyril_lignac | 3.1M | cyril@...
Bruno Cirino | @bruno_cirino | 2.4M | bruno@...
[+ 12 autres]
```

---

### 2️⃣ **Agent Qualification** ⭐
Évalue la priorité pour chaque créateur.

**Tu dis:**
```
"Qualifie cette liste de chefs:
José Andrés (2.1M)
Cyril Lignac (3.1M)
Bruno Cirino (2.4M)"
```

**Agent répond:**
```
José Andrés | HAUTE | Celebrity + angle humanitaire unique
Cyril Lignac | HAUTE | Michelin + portée TV massive
Bruno Cirino | MOYENNE | TikTok fort mais moins prestige
```

---

### 3️⃣ **Agent Outreach** ✉️
Prépare messages personnalisés.

**Tu dis:**
```
"Message de contact pour José Andrés
Angle: Plateforme POV + humanitaire
Tone: Respectueux, pas commercial"
```

**Agent répond:**
```
Subject: Nouvelle plateforme POV authentiques - Vuvio

Cher José,

On crée Vuvio - plateforme de POV lives où les gens 
découvrent des métiers et lieux en direct.

Ton angle humanitaire avec World Central Kitchen 
correspondrait parfaitement. Les viewers adorent...

[Message complet personnalisé]
```

---

### 4️⃣ **Agent Suivi** 📈
Track statuts et prochaines actions.

**Tu dis:**
```
"Mise à jour:
- José Andrés → Email envoyé aujourd'hui
- Cyril Lignac → Réponse reçue
- Bruno Cirino → Pas de réponse (7 jours)"
```

**Agent:**
```
✓ José: Statut = Email envoyé | Prochaine action: Wait 3 days
✓ Cyril: Statut = Réponse reçue | Prochaine action: Proposer démo
✓ Bruno: Statut = Relance | Prochaine action: Follow-up email
```

---

### 5️⃣ **Agent Analytics** 📊
KPI & insights.

**Tu dis:**
```
"Stats prospection France:
- Trouvés: 150
- Contactés: 85
- Réponses: 24
- Démos: 8
- Inscrits: 5
Analyse: quoi améliorer?"
```

**Agent répond:**
```
✓ Taux réponse: 28% (BON)
✗ Taux démo|réponse: 33% (À AMÉLIORER)

💡 Suggestions:
1. Email subject trop commercial
   → Changer: "Découvre POV exclusive" au lieu de "Nouvelle plateforme"
   
2. Follow-up timing mauvais
   → Attendre 2-3 jours, pas 1 jour

🏆 Meilleure catégorie: Cuisine (40% réponse)
   → Ajouter +10 chefs cuisine la semaine prochaine

⚠️ Pire catégorie: Artisanat (12% réponse)
   → Améliorer message ou changer cible
```

---

## 📋 Structure de l'Excel

| Créateur | Catégorie | Pays | Followers | Statut | Priorité | Contacté | Réponse | Démo | Inscrit | Live | Notes |
|----------|-----------|------|-----------|--------|----------|----------|---------|------|---------|------|-------|
| José A. | Cuisine | ES | 2.1M | Email envoyé | Haute | ✓ | ⏳ | - | - | - | Humanitaire |
| Cyril L. | Cuisine | FR | 3.1M | Réponse reçue | Haute | ✓ | ✓ | À proposer | ⏳ | - | Michelin 3* |
| Bruno C. | Cuisine | FR | 2.4M | Relance | Moy | ✓ | ✗ | - | - | - | TikTok viral |

---

## 🎯 Workflow Type

```
SEMAINE 1:
1. Agent Recherche: "20 chefs France"
   → Obtiens liste

2. Agent Qualification: "Classement priorité"
   → Obtiens: Haute/Moy/Basse + raison

3. Agent Outreach: "Messages perso"
   → Obtiens: Emails prêts à envoyer

4. Tu envoies (copier-coller)

SEMAINE 2:
5. Agent Suivi: "Marquer réponses"
   → Update Excel automatiquement

6. Agent Outreach: "Follow-up pour non-réponses"
   → Obtiens: Relance personnalisée

SEMAINE 3:
7. Agent Analytics: "KPIs? Qu'améliorer?"
   → Obtiens: Stats + suggestions d'optimisation

→ Recommencer avec catégorie suivante
```

---

## 💬 Exemples à Copier-Coller

**Recherche:**
```
"Trouve 20 artisans POV (menuisier, joaillier, potier, peintre)
Allemagne, 50k-300k followers
Format: Nom | Category | Followers | Email si trouvable"
```

**Optimisation:**
```
"Taux réponse France seulement 15% (mauvais)
Liste: [emails qui n'ont pas répondu]
Quoi changer dans le message?"
```

**Analytics:**
```
"Stats prospection Espagne:
Trouvés: 200, Contactés: 120, Réponses: 45, Démos: 12, Inscrits: 4
- Taux par catégorie?
- Quoi optimiser?
- Top créateurs potentiels?"
```

---

## 🎯 Le But

**Avant:** Tu faisais tout manuellement (trouver, qualifier, écrire emails, tracker)
**Maintenant:** Agent fait 80% → Tu fais juste copy-paste + tracker

**Résultat:** Prospection 10x plus rapide. Excel = CRM autopilot ✈️
