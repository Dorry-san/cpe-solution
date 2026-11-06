# PME Jobs — Documentation technique et fonctionnelle

## 1. Objet de l’application

PME Jobs est une plateforme de recrutement destinée à des PME et startups. Elle sépare deux univers :

1. **L’espace candidat**, accessible à la racine du site.
2. **L’espace employeur**, isolé sous `/employer`.

Un employeur publie des offres et consulte les candidatures. Un candidat n’a pas de compte : il choisit une offre, remplit ses informations, envoie un CV et complète un questionnaire. Ce questionnaire est constitué de deux étapes internes, mais le candidat le voit comme un seul parcours continu.

---

## 2. Architecture générale

```text
Navigateur candidat / employeur
        |
        v
Next.js App Router (React + TypeScript)
        |
        +--> Pages et composants clients
        |
        +--> Next.js API Routes
                |
                +--> Validation Zod
                +--> Authentification cookies signés
                +--> Prisma ORM
                |       |
                |       +--> PostgreSQL 17
                |
                +--> Stockage local des CV
                +--> Extraction PDF / DOC / DOCX
                +--> API compatible OpenAI Responses vers GLM
```

Le backend n’est pas séparé du frontend : les API Routes Next.js jouent le rôle de serveur HTTP. Cette disposition réduit la duplication des types, simplifie le déploiement et permet d’appeler le modèle IA uniquement depuis le serveur.

---

## 3. Choix techniques

| Domaine | Technologie | Raison |
|---|---|---|
| Interface | React 19 | Modèle à composants adapté aux formulaires et aux états de chargement |
| Framework | Next.js 15 App Router | Frontend, backend, routage de fichiers et build dans un seul projet |
| Langage | TypeScript strict | Typage des API, données Prisma et réponses IA |
| Style | Tailwind CSS 4 via PostCSS | Styles utilitaires sans framework UI lourd |
| Base de données | PostgreSQL 17 | Base relationnelle fiable, transactions et contraintes d’unicité |
| ORM | Prisma 6 | Schéma typé, migrations versionnées et client généré |
| Validation | Zod 3 | Validation stricte des entrées et des réponses IA |
| IA | `glm-5.3-flash` via API compatible OpenAI Responses | Génération JSON et évaluation structurée |
| SDK IA | OpenAI SDK 5 | Client compatible avec `baseURL` personnalisée |
| PDF | `pdf-parse` 2 | Extraction du texte contenu dans les CV PDF |
| DOCX | `mammoth` | Extraction du texte brut des fichiers Word modernes |
| DOC | `word-extractor` | Prise en charge de l’ancien format Word |
| Conteneurisation | Docker + Docker Compose | Déploiement reproductible du web et de PostgreSQL |

Le fichier `next.config.ts` contient :

```ts
serverExternalPackages: ["pdf-parse"]
```

Cette option évite que le worker interne de `pdf-parse` soit transformé par le bundler Next.js. Le package reste chargé depuis `node_modules` à l’exécution.

---

## 4. Arborescence du projet

```text
.
├── docker-compose.yml
├── Dockerfile
├── next.config.ts
├── package.json
├── prisma
│   ├── migrations
│   └── schema.prisma
├── src
│   ├── app
│   │   ├── api
│   │   │   ├── applications
│   │   │   ├── auth
│   │   │   ├── offers
│   │   │   └── tests
│   │   ├── applications
│   │   ├── employer
│   │   ├── offers
│   │   └── page.tsx
│   └── lib
│       ├── ai.ts
│       ├── auth.ts
│       ├── files.ts
│       ├── prisma.ts
│       └── validation.ts
└── DOCUMENTATION.md
```

---

## 5. Modèle de données

Le schéma Prisma se trouve dans `prisma/schema.prisma`.

### `User`

Représente uniquement un utilisateur employeur.

| Champ | Type | Rôle |
|---|---|---|
| `id` | `String` | Identifiant CUID |
| `email` | `String` | Email unique |
| `passwordHash` | `String` | Mot de passe salé et dérivé avec scrypt |
| `firstName` | `String?` | Prénom facultatif |
| `lastName` | `String?` | Nom facultatif |
| `role` | `UserRole` | Actuellement toujours `EMPLOYER` |
| `createdAt` | `DateTime` | Date de création |

### `Company`

| Champ | Type | Rôle |
|---|---|---|
| `id` | `String` | Identifiant |
| `name` | `String` | Nom de l’entreprise |
| `ownerId` | `String` | Unique et lié à un seul `User` |
| `owner` | `User` | Relation cascade : la suppression utilisateur supprime l’entreprise |

### `Offer`

| Champ | Type | Rôle |
|---|---|---|
| `id` | `String` | Identifiant |
| `companyId` | `String` | Entreprise propriétaire |
| `title` | `String` | Titre public |
| `body` | `String` | Corps public de l’offre |
| `specificNeeds` | `String` | Problème utilisé pour construire le test |
| `criticalSkills` | `String?` | Notion à renforcer si elle est déjà présente dans `body` |
| `domain` | `String` | Domaine public affiché |
| `isActive` | `Boolean` | Une offre inactive n’est pas visible publiquement |
| `createdAt` | `DateTime` | Date de publication |

`specificNeeds` et `criticalSkills` ne sont jamais exposées à un utilisateur non propriétaire.

### `Application`

| Champ | Type | Rôle |
|---|---|---|
| `offerId` | `String` | Offre concernée |
| `firstName` | `String` | Prénom candidat |
| `lastName` | `String` | Nom candidat |
| `email` | `String` | Email normalisé en minuscules |
| `phone` | `String?` | Téléphone facultatif |
| `cvPath` | `String` | Chemin réel du fichier CV |
| `cvFileName` | `String` | Nom original du fichier, utilisé au téléchargement |
| `screeningPassed` | `Boolean?` | Résultat interne du premier filtrage |
| `status` | `ApplicationStatus` | Étape courante |
| `createdAt` | `DateTime` | Date de candidature |

Contrainte importante :

```text
@@unique([offerId, email])
```

Un même email ne peut postuler qu’une seule fois à une même offre.

### `Test`

| Champ | Type | Rôle |
|---|---|---|
| `applicationId` | `String` | Candidature concernée |
| `type` | `TestType` | `SCREENING` ou `MAIN` |
| `status` | `TestStatus` | État du questionnaire |
| `questions` | `Json` | Questions générées |
| `answers` | `Json?` | Réponses du candidat |
| `totalScore` | `Int?` | Score entier sur 10 |
| `criteriaScores` | `Json?` | Scores par critère pour le test principal |
| `aiSummary` | `String?` | Texte simple ou JSON structuré selon le test |
| `completedAt` | `DateTime?` | Date d’évaluation |

Contrainte importante :

```text
@@unique([applicationId, type])
```

Une candidature ne peut contenir qu’un seul test de filtrage et qu’un seul test principal.

### Énumérations

```ts
UserRole:
  EMPLOYER

ApplicationStatus:
  SCREENING
  SCREENING_FAILED
  MAIN_TEST
  RESULTS_READY
  REJECTED
  HIRED

TestType:
  SCREENING
  MAIN

TestStatus:
  GENERATED
  COMPLETED
  EVALUATED
  FAILED
```

Le statut `SCREENING_FAILED` existe toujours pour compatibilité historique, mais le flux normal n’y reste pas : le candidat passe toujours au test principal.

---

## 6. Authentification et sessions

### Comptes employeur

Les mots de passe sont hachés avec `scrypt` :

1. Génération d’un sel aléatoire de 16 octets.
2. Dérivation de 64 octets.
3. Stockage au format `salt:derivedKey`.

La session employeur est un cookie signé :

| Propriété | Valeur |
|---|---|
| Nom | `pme_jobs_session` |
| Signature | HMAC SHA-256 avec `AUTH_SECRET` |
| Contenu signé | `userId.expiresAt` |
| Durée | 7 jours |
| `httpOnly` | `true` |
| `sameSite` | `lax` |
| `secure` | `true` en production |

### Session candidat

Un candidat n’a pas de compte. Après une candidature réussie, le serveur crée un ticket signé propre à la candidature :

| Propriété | Valeur |
|---|---|
| Nom | `candidate_application_<applicationId>` |
| Contenu | `applicationId.signature` |
| Signature | HMAC SHA-256 avec `AUTH_SECRET` |
| Durée du cookie | 30 jours |
| `httpOnly` | `true` |

Ce ticket autorise uniquement la continuation du questionnaire de cette candidature.

### Isolation

- L’espace candidat ne contient aucun lien vers l’espace employeur.
- Les API employeur vérifient le rôle `EMPLOYER`.
- Les candidatures, offres, tests et CV sont filtrés par `companyId`.
- Un employeur ne peut pas lire la candidature, le CV ou les résultats d’une autre entreprise.

---

## 7. Validation des entrées

### Offre

Définie dans `src/lib/validation.ts` :

| Champ | Règle |
|---|---|
| `title` | Minimum 3 caractères |
| `body` | Minimum 30 caractères |
| `specificNeeds` | Minimum 10 caractères |
| `criticalSkills` | Facultatif, maximum 500 caractères |
| `domain` | Minimum 2 caractères |

### Candidature

| Champ | Règle |
|---|---|
| `firstName` | Obligatoire |
| `lastName` | Obligatoire |
| `email` | Format email valide |
| `phone` | Facultatif |
| `cv` | Fichier obligatoire |

### CV

| Règle | Valeur |
|---|---|
| Formats | PDF, DOC, DOCX |
| MIME acceptés | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Taille | Entre 1 octet et 5 Mo |
| Nom réel | Remplacé par un UUID conservant l’extension |
| Nom original | Conservé en base pour le téléchargement |

---

## 8. Flux fonctionnel candidat

### 8.1 Liste des offres

Page : `/`

1. La page appelle `GET /api/offers`.
2. Seules les offres actives sont retournées.
3. La réponse publique contient uniquement les champs non sensibles.
4. Le candidat voit un aperçu puis peut ouvrir l’offre complète.

### 8.2 Détail d’une offre

Page : `/offers/[id]`

Pour un visiteur non propriétaire, l’API ne retourne volontairement que :

- `id`
- `title`
- `body`
- `domain`
- `isActive`
- `createdAt`
- `company.name`

Le candidat ne voit jamais :

- `specificNeeds`
- `criticalSkills`
- questions
- réponses
- scores
- résultats internes

### 8.3 Postulation

Page : `/offers/[id]/apply`

Le formulaire envoie une requête `multipart/form-data` vers :

```http
POST /api/offers/:id/applications
```

Le backend :

1. Vérifie que l’offre existe et est active.
2. Valide les champs avec Zod.
3. Normalise l’email en minuscules.
4. Refuse un email déjà utilisé pour cette offre.
5. Sauvegarde le CV localement.
6. Vérifie immédiatement que le CV contient du texte exploitable.
7. Si l’extraction échoue, supprime le fichier déjà écrit.
8. Crée la candidature.
9. Crée la session candidat.

Le candidat est ensuite redirigé vers `/applications/[id]/test`.

### 8.4 Page d’attente IA

La page du questionnaire affiche un état de chargement avec un cercle animé Tailwind :

- Pendant la génération : **Préparation du questionnaire**.
- Pendant l’évaluation : **Analyse de vos réponses**.

Pendant ces traitements, les questions et le bouton d’envoi ne sont pas affichés.

### 8.5 Génération des deux questionnaires

Avant l’affichage du premier questionnaire, le backend appelle :

```http
POST /api/applications/:id/tests
```

Pour une nouvelle candidature :

1. Le backend extrait le contenu réel du CV.
2. Les deux tests sont générés en parallèle :
   - 3 questions de pré-filtrage.
   - 5 questions principales.
3. Les deux tests sont enregistrés dans une transaction avec le statut `GENERATED`.
4. Seules les questions du premier test sont renvoyées au candidat.

Le second test est donc déjà en base avant que le candidat ne réponde au premier. Le résultat du premier test n’influence pas la génération du second.

Les entrées IA utilisées pour les deux tests sont :

- Titre de l’offre.
- Corps de l’offre.
- Domaine.
- Problème spécifique donné par l’employeur.
- Connaissances critiques facultatives.
- Contenu réel du CV du candidat.

### 8.6 Premier test interne

Le premier test contient exactement 3 questions à choix multiples.

Il vérifie des éléments simples :

- Notions liées au domaine.
- Intérêt pour le domaine.
- Capacité à travailler sur les notions importantes de l’offre.

Le candidat ne sait pas qu’il s’agit d’un premier filtrage.

Après envoi :

```http
PATCH /api/tests/:id
```

L’IA évalue les réponses et retourne :

```json
{
  "score": 8,
  "passed": true,
  "summary": "Réponses cohérentes avec le domaine."
}
```

Le score est un entier entre 0 et 10. Si l’IA renvoie un nombre décimal dans l’intervalle, il est arrondi automatiquement.

En base :

- `Test.totalScore` est enregistré.
- `Test.aiSummary` contient la synthèse du premier test.
- `Test.status` devient `EVALUATED`.
- `Application.screeningPassed` reçoit le booléen.
- `Application.status` passe à `MAIN_TEST`.

Le backend retourne ensuite le test principal déjà généré.

### 8.7 Second test principal

Le second test contient exactement 5 questions.

Types acceptés :

```ts
qcm | problem | situation
```

Le prompt impose :

- Questions adaptées à l’offre.
- Mélange de QCM, problèmes métier et mises en situation.
- Aucune épreuve de code ni demande d’écriture de code.
- Questions de connaissances conceptuelles seulement si l’employeur a explicitement demandé un langage, un outil ou une librairie.
- Le problème spécifique doit rester lié au corps de l’offre.
- Une connaissance critique ne peut être utilisée que si elle est déjà présente dans le corps de l’offre.

Après envoi des réponses, l’IA retourne :

```json
{
  "totalScore": 8,
  "criteriaScores": [
    { "name": "Architecture", "score": 8 }
  ],
  "summary": "Réponses précises et applicables.",
  "strengths": ["Méthode claire"],
  "concerns": ["Points de déploiement à approfondir"],
  "recommendation": "Recommandé"
}
```

Le champ `recommendation` est optionnel dans la réponse IA. S’il manque, il est calculé automatiquement :

| Score | Recommandation calculée |
|---|---|
| `>= 8` | `Recommandé` |
| `> 5` | `À considérer` |
| `<= 5` | `Non recommandé` |

Le score total et chaque score de critère sont des entiers sur 10.

À la fin, le candidat voit uniquement :

> Candidature transmise. Merci. L’entreprise examinera votre candidature.

Il ne voit jamais ses scores, son classement, la réussite du premier test ni la décision finale.

---

## 9. Règle de conservation et d’affichage

Le premier test sert à vérifier l’intérêt initial. Le second mesure la réponse au problème de l’employeur.

| Premier test | Score principal | Statut final | Visible par l’employeur |
|---|---:|---|---|
| Réussi | Tout score | `RESULTS_READY` | Oui |
| Raté | Strictement supérieur à 5 | `RESULTS_READY` | Oui, avec avertissement |
| Raté | Inférieur ou égal à 5 | `REJECTED` | Oui seulement dans la liste complète selon le filtre |

Important :

- Un candidat ayant réussi le premier test reste visible même si le second score est très mauvais.
- Un candidat ayant raté le premier test est conservé seulement si le second score est strictement supérieur à 5.
- L’employeur voit un avertissement ambre dépliable pour un premier test raté.
- Cet avertissement explique que le premier test porte surtout sur la motivation et la pertinence immédiate.
- L’employeur peut développer l’avertissement pour voir le score du premier test et l’observation interne.

---

## 10. Flux fonctionnel employeur

### 10.1 Inscription

Page : `/employer/register`

Le formulaire demande :

- Email.
- Mot de passe d’au moins 8 caractères.
- Nom de l’entreprise.

Le backend crée l’utilisateur et l’entreprise dans une transaction.

### 10.2 Connexion

Page : `/employer/login`

Le backend vérifie le mot de passe avec `timingSafeEqual`, puis crée la session employeur.

### 10.3 Tableau de bord

Page : `/employer`

Fonctions :

- Liste des offres de l’entreprise.
- Bouton **Publier une offre**.
- Bouton **Actualiser**.
- Bouton **Se déconnecter**.
- Pour chaque offre : prévisualisation et accès aux candidats.

### 10.4 Création d’une offre

Page : `/employer/offers/new`

Champs :

- Titre.
- Domaine.
- Corps de l’offre.
- Problème spécifique donné pour le test.
- Connaissances critiques facultatives.

Le formulaire contient un bouton retour vers le tableau de bord.

Les aides affichées précisent :

- Le problème spécifique n’est pas visible par le candidat.
- Il sert de matière principale au test.
- Il doit être directement lié au corps de l’offre.
- Les connaissances critiques doivent être une notion déjà présente dans le corps de l’offre.

Après création, l’employeur est redirigé vers la prévisualisation.

### 10.5 Prévisualisation

Page : `/employer/offers/[id]/review`

Elle affiche :

- Titre.
- Entreprise.
- Statut de publication.
- Domaine.
- Corps de l’offre.
- Problème spécifique interne.
- Connaissances critiques internes.

Elle donne accès au tableau de bord et à la liste des candidats.

### 10.6 Liste des candidats

Page : `/employer/offers/[id]/candidates`

La liste affiche les candidatures dont le test principal est évalué et dont le score est supérieur ou égal au filtre choisi.

Valeur par défaut :

```text
7/10
```

Le filtre ancien « Candidats retenus » a été supprimé : l’employeur travaille directement sur la liste des candidats évalués selon le score choisi.

Pour chaque candidat, l’employeur voit :

- Nom et prénom.
- Email.
- Téléphone facultatif.
- Statut courant.
- Score principal sur 10.
- Recommandation IA.
- Scores par critère.
- Synthèse courte.
- Points forts.
- Points d’attention.
- Avertissement dépliable si le premier test n’est pas réussi.
- Questionnaire complet avec réponses via un bouton dépliable.
- Lien de téléchargement du CV.

Des boutons permettent de revenir à l’offre et au tableau de bord.

---

## 11. API HTTP

### Authentification

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Créer un utilisateur et une entreprise |
| `POST` | `/api/auth/login` | Public | Créer une session employeur |
| `POST` | `/api/auth/logout` | Connecté | Supprimer la session |
| `GET` | `/api/auth/me` | Connecté | Retourner l’utilisateur courant et son entreprise |

### Offres

#### `GET /api/offers`

Accès public.

Paramètre facultatif :

| Paramètre | Effet |
|---|---|
| `domain` | Filtre insensible à la casse sur le domaine |

Retour public volontairement limité.

Si `scope=mine`, la route devient employeur et retourne toutes les offres de l’entreprise connectée.

#### `POST /api/offers`

Accès employeur obligatoire.

Crée une offre à partir du JSON validé.

#### `GET /api/offers/:id`

Comportement selon le rôle :

| Visiteur | Réponse |
|---|---|
| Non propriétaire | Champs publics uniquement |
| Propriétaire connecté | Offre complète, y compris champs internes |

Une offre inactive reste visible par son propriétaire, mais retourne `404` pour les autres.

#### `DELETE /api/offers/:id`

Accès propriétaire obligatoire.

Supprime l’offre et, par cascade, ses candidatures, tests et relations liées.

### Candidatures

#### `POST /api/offers/:id/applications`

Accès public avec session candidat créée après succès.

Corps : `multipart/form-data`.

Erreurs possibles :

| Code | Cause |
|---|---|
| `400` | Champs invalides ou CV illisible |
| `404` | Offre introuvable ou inactive |
| `409` | Email déjà utilisé pour cette offre |

#### `GET /api/applications`

Accès employeur obligatoire.

Paramètres :

| Paramètre | Défaut | Rôle |
|---|---|---|
| `offerId` | Aucun | Limiter à une offre |
| `minScore` | `0` | Score principal minimum, inclus |
| `status` | Aucun | Statut applicatif facultatif |

La requête vérifie :

- L’appartenance de l’offre à l’entreprise connectée.
- L’existence d’un test principal `EVALUATED`.
- `totalScore >= minScore`.

La réponse inclut les tests de filtrage et principaux avec questions, réponses, scores et synthèses.

#### `GET /api/applications/:id/cv`

Accès employeur propriétaire obligatoire.

Retourne le fichier CV en pièce jointe.

### Questionnaires

#### `POST /api/applications/:id/tests`

Accès session candidat.

Rôles :

1. Retourner le questionnaire courant.
2. Générer et enregistrer les questionnaires manquants.
3. Retourner `completed: true` si la candidature est déjà terminée.

#### `PATCH /api/tests/:id`

Accès session candidat.

Corps attendu :

```json
{
  "testId": "id_du_test",
  "answers": ["réponse 1", "réponse 2"]
}
```

Pour le premier test, exactement 3 réponses sont attendues.

Pour le second test, exactement 5 réponses sont attendues.

Si l’évaluation échoue, le test reste `GENERATED` pour permettre une nouvelle tentative.

---

## 12. Utilisation de l’IA

### Fournisseur et modèle

Le SDK OpenAI n’est pas utilisé pour appeler OpenAI directement. Il sert de client compatible avec une API personnalisée :

```ts
new OpenAI({
  apiKey: process.env.GLM_API_KEY,
  baseURL: process.env.GLM_BASE_URL,
})
```

Modèle par défaut :

```text
glm-5.3-flash
```

### Appel utilisé

```ts
client.responses.create({
  model,
  input: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  text: {
    format: { type: "json_object" }
  },
  reasoning: { effort },
  max_output_tokens
})
```

### Configuration IA

| Variable | Défaut | Rôle |
|---|---|---|
| `GLM_MODEL` | `glm-5.3-flash` | Modèle utilisé |
| `GLM_BASE_URL` | `https://api.z.ai/api/v1` | Base compatible OpenAI |
| `GLM_REASONING_EFFORT` | `high` | Accepte `low` ou `high` |
| `GLM_MAX_OUTPUT_TOKENS` | `8000` | Limite de sortie |
| `GLM_TIMEOUT_MS` | `300000` | Timeout de l’appel |
| `GLM_MAX_RETRIES` | `4` | Nombre de tentatives SDK |

### Sorties exigées

Toutes les réponses IA doivent être du JSON valide.

Le backend :

1. Vérifie que `response.status === "completed"`.
2. Vérifie que `output_text` n’est pas vide.
3. Fait `JSON.parse`.
4. Valide le résultat avec un schéma Zod.
5. Normalise les scores décimaux en entiers.
6. Retourne une erreur explicite si le format n’est pas respecté.

### Schémas de génération

#### Test de filtrage

```ts
{
  questions: [
    {
      id: 1,
      question: "string",
      options: ["option 1", "option 2"]
    }
  ]
}
```

Contraintes :

- Exactement 3 questions.
- IDs de 1 à 3.
- Chaque question entre 5 et plus de caractères.
- Entre 2 et 4 options.

#### Test principal

```ts
{
  criteria: ["Critère 1", "Critère 2"],
  questions: [
    {
      id: 1,
      type: "qcm | problem | situation",
      question: "string",
      options: ["option 1", "option 2"]
    }
  ]
}
```

Contraintes :

- Entre 2 et 10 critères.
- Exactement 5 questions.
- IDs de 1 à 5.
- Questions de plus de 10 caractères.
- Aucun code à écrire.
- Options facultatives selon le type.

### Schémas d’évaluation

#### Filtrage

```ts
{
  score: entier_0_a_10,
  passed: boolean,
  summary: "string"
}
```

#### Test principal

```ts
{
  totalScore: entier_0_a_10,
  criteriaScores: [
    { name: "string", score: entier_0_a_10 }
  ],
  summary: "maximum 500 caractères",
  strengths: ["maximum 3 points"],
  concerns: ["maximum 3 points"],
  recommendation: "Recommandé | À considérer | Non recommandé"
}
```

La recommandation est recalculée automatiquement si l’IA ne la fournit pas.

### Contenu du CV

Le contenu du CV est extrait à l’upload :

| Format | Bibliothèque |
|---|---|
| PDF | `pdf-parse` |
| DOCX | `mammoth` |
| DOC | `word-extractor` |

Le texte est :

1. Nettoyé des espaces répétés.
2. Refusé s’il contient moins de 20 caractères.
3. Tronqué à 12 000 caractères maximum.

Ainsi, le modèle n’utilise pas seulement le nom du fichier : il exploite le contenu réel du CV.

Un PDF scanné sans couche texte est refusé.

---

## 13. Sécurité

### Mesures en place

- Mots de passe jamais stockés en clair.
- Hash scrypt avec sel aléatoire.
- Cookies `httpOnly`.
- Cookies signés avec `AUTH_SECRET`.
- Cookies `secure` en production.
- Validation Zod côté serveur.
- Isolation par entreprise.
- Vérification de propriété avant lecture ou suppression.
- CV non servis publiquement.
- Noms de fichiers CV remplacés par UUID.
- Chemins de CV résolus puis vérifiés contre le répertoire autorisé.
- Champs internes d’offre retirés des réponses publiques.
- Session candidat limitée à sa propre candidature.

### Limites connues

- Il n’y a pas encore de limitation de débit globale.
- Il n’y a pas encore de vérification anti-virus des CV.
- La sécurité MIME dépend du type envoyé par le client, mais l’extension et l’extraction de texte servent de contrôle secondaire.
- Les CV scannés sans texte exploitable ne peuvent pas être analysés par l’IA.
- `AUTH_SECRET` doit impérativement être long et secret en production.

---

## 14. Variables d’environnement

### Développement local

Fichier : `.env`

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `AUTH_SECRET` | Secret de signature des sessions |
| `GLM_API_KEY` | Clé API IA |
| `GLM_BASE_URL` | Base compatible OpenAI |
| `GLM_MODEL` | Modèle IA |
| `GLM_REASONING_EFFORT` | Effort de raisonnement IA |
| `GLM_MAX_OUTPUT_TOKENS` | Limite de tokens de sortie |
| `GLM_TIMEOUT_MS` | Timeout IA |
| `GLM_MAX_RETRIES` | Tentatives SDK |
| `CV_UPLOAD_DIR` | Répertoire local des CV |

### Docker Compose

Dans `docker-compose.yml`, le conteneur reçoit :

```yaml
GLM_API_KEY: ${ZAI_API_KEY:?Set ZAI_API_KEY in your shell environment}
```

Cela signifie que l’environnement utilisé par Docker Compose doit fournir `ZAI_API_KEY`, même si la variable interne du conteneur s’appelle `GLM_API_KEY`.

Autres variables Docker :

| Variable | Défaut | Rôle |
|---|---|---|
| `POSTGRES_PASSWORD` | `postgres` | Mot de passe PostgreSQL |
| `AUTH_SECRET` | Obligatoire | Secret applicatif |
| `CV_UPLOAD_DIR` | `/app/uploads` | Répertoire des CV dans le conteneur |

---

## 15. Développement local

### Installation

```bash
cp .env.example .env
npm install
```

### Migrations

```bash
npm run db:migrate
```

Cette commande exécute `prisma migrate dev`.

### Génération du client Prisma seul

```bash
npm run db:generate
```

### Démarrage

```bash
npm run dev
```

Application :

```text
http://localhost:3000
```

### Base en développement local

Si PostgreSQL tourne via Docker :

```bash
docker compose up -d db
```

Connexion utilisée par `.env.example` :

```text
postgresql://postgres:postgres@localhost:5432/pme_jobs?schema=public
```

---

## 16. Build et vérification

### Build complet

```bash
npm run build
```

Cette commande fait :

1. `prisma generate`.
2. `next build`.

### Vérification TypeScript seule

```bash
npx tsc --noEmit
```

### Lint

```bash
npm run lint
```

---

## 17. Déploiement Docker

### Démarrage complet

```bash
cp .env.example .env
docker compose up -d --build
```

### Services

| Service | Image | Port | Rôle |
|---|---|---|---|
| `db` | `postgres:17-alpine` | `5432:5432` | Base PostgreSQL |
| `web` | Image construite depuis `Dockerfile` | `3000:3000` | Application Next.js |

PostgreSQL a un healthcheck :

```bash
pg_isready -U postgres -d pme_jobs
```

Le service `web` ne démarre que lorsque `db` est healthy.

### Volumes persistants

| Volume | Montage | Rôle |
|---|---|---|
| `postgres-data` | `/var/lib/postgresql/data` | Données PostgreSQL |
| `cv-uploads` | `/app/uploads` | CV envoyés par les candidats |

### Étapes du `Dockerfile`

1. Image de base `node:22-alpine`.
2. Répertoire de travail `/app`.
3. Environnement `NODE_ENV=production`.
4. Désactivation de la télémétrie Next.js.
5. Configuration des retries npm pour les réseaux instables.
6. Copie de `package.json` et `package-lock.json`.
7. `npm ci --include=dev`.
8. Copie du code.
9. `prisma generate`.
10. `next build`.
11. Exposition du port 3000.
12. Au démarrage : `prisma migrate deploy`, puis `npm run start`.

Les dépendances de développement sont installées pendant le build parce que Prisma, TypeScript et Tailwind sont nécessaires à la compilation.

### Arrêt

```bash
docker compose down
```

Cette commande conserve les volumes.

Pour supprimer aussi les volumes :

```bash
docker compose down -v
```

Attention : cette commande supprime les données PostgreSQL et les CV persistés.

### Logs

```bash
docker compose logs -f web
docker compose logs -f db
```

### État des services

```bash
docker compose ps
```

---

## 18. Migrations

Les migrations sont versionnées dans `prisma/migrations`.

Historique fonctionnel :

| Migration | Objectif |
|---|---|
| `0_init` | Création du schéma initial |
| `1_candidate_questionnaire` | Employer facultatif et ajout des connaissances critiques |
| `2_screening_flag` | Ajout de `Application.screeningPassed` |
| `3_normalize_legacy_scores` | Conversion des anciens scores sur 100 vers l’échelle sur 10 |
| `4_offer_seniority_levels` | Étape historique d’ajout de niveaux d’expérience |
| `5_remove_seniority_levels` | Suppression définitive des niveaux d’expérience |

En production ou Docker :

```bash
npx prisma migrate deploy
```

Cette commande est exécutée automatiquement au démarrage du conteneur `web`.

---

## 19. Pages et parcours

### Candidat

| Route | Rôle |
|---|---|
| `/` | Liste publique des offres |
| `/offers/[id]` | Offre complète publique |
| `/offers/[id]/apply` | Formulaire de candidature |
| `/applications/[id]/test` | Questionnaire continu et page d’attente IA |

### Employeur

| Route | Rôle |
|---|---|
| `/employer` | Tableau de bord |
| `/employer/register` | Inscription entreprise |
| `/employer/login` | Connexion employeur |
| `/employer/offers/new` | Création d’offre |
| `/employer/offers/[id]/review` | Prévisualisation complète pour l’employeur |
| `/employer/offers/[id]/candidates` | Candidatures, scores, CV et questionnaires |

---

## 20. États applicatifs détaillés

### Cycle normal

```text
Candidature créée
      |
      v
SCREENING
      |
      | Réponses au premier test évaluées
      v
MAIN_TEST
      |
      | Réponses au second test évaluées
      v
RESULTS_READY ou REJECTED
```

### Premier test réussi

```text
screeningPassed = true
Application.status = MAIN_TEST
puis RESULTS_READY après le second test, quel que soit le score
```

### Premier test raté

```text
screeningPassed = false
Application.status = MAIN_TEST

si totalScore > 5 :
  RESULTS_READY

si totalScore <= 5 :
  REJECTED
```

### Statuts restants

| Statut | Usage actuel |
---|---|
| `SCREENING_FAILED` | Statut historique, non utilisé comme étape d’arrêt dans le flux normal |
| `HIRED` | Réservé à une décision future d’embauche |
| `COMPLETED` sur `Test` | État historique possible, non produit par le flux d’évaluation normal |
| `FAILED` sur `Test` | État d’erreur historique ; le flux actuel remet le test en `GENERATED` après échec |

---

## 21. Comportement des réponses IA

### Scores

Le schéma Zod applique :

```ts
z.number().min(0).max(10).transform(Math.round)
```

Conséquences :

- `6.5` devient `7`.
- `7.4` devient `7`.
- `0.4` devient `0`.
- Une valeur hors intervalle est rejetée.
- La base reçoit toujours un entier.

### Recommandation

Si l’IA renvoie une recommandation invalide, le schéma échoue.

Si l’IA ne renvoie pas la clé `recommendation`, elle est déduite du score.

### Synthèse employeur

Le backend stocke la synthèse principale sous forme de JSON :

```json
{
  "summary": "Réponses précises.",
  "strengths": ["Point fort 1"],
  "concerns": ["Point d’attention 1"],
  "recommendation": "Recommandé"
}
```

L’interface employeur :

1. Tente de lire ce JSON.
2. Affiche la recommandation.
3. Affiche la synthèse.
4. Limite visuellement les points forts et points d’attention à trois éléments.

Si le JSON ne peut pas être lu, l’interface traite la valeur comme une synthèse texte simple.

---

## 22. Stockage des CV

### Développement local

```text
./data/cv
```

### Docker

```text
/app/uploads
```

Le nom disque est généré ainsi :

```text
UUID + extension
```

Exemple :

```text
4f9d2ac2-8d3c-4e94-9f40-6b4dd5b8ec61.pdf
```

Le nom original, par exemple `CV_Dupont.pdf`, est conservé dans `Application.cvFileName` pour le téléchargement.

La base ne stocke pas le binaire du CV. Elle stocke seulement :

- le chemin serveur ;
- le nom original ;
- les métadonnées candidat.

---

## 23. Erreurs et messages

### Côté candidat

| Situation | Message |
|---|---|
| Champs invalides | Message renvoyé par Zod ou message générique |
| Email déjà utilisé | `Cet email a déjà été utilisé pour cette offre.` |
| Mauvais format CV | `Le CV doit être un fichier PDF, DOC ou DOCX.` |
| CV trop volumineux | `Le CV doit avoir une taille comprise entre 1 octet et 5 Mo.` |
| CV sans texte | `Le CV ne contient pas de texte exploitable.` |
| Échec IA de génération | Message renvoyé ou `Génération du questionnaire impossible.` |
| Échec IA d’évaluation | Message renvoyé ou `Évaluation impossible.` |

### Côté employeur

| Situation | Message |
|---|---|
| Non authentifié | `Accès employeur requis.` |
| Chargement impossible | `Chargement impossible.` |
| Offre introuvable | `Offre introuvable.` |
| Création invalide | Premier message Zod disponible |

---

## 24. Résilience du questionnaire

### Génération

Les deux tests sont générés avant la première réponse. Le backend utilise :

```ts
Promise.all([
  génération_filtrage,
  génération_test_principal
])
```

Puis les tests existants et les tests créés sont enregistrés ou réutilisés dans une transaction.

### Évaluation

Après l’envoi du premier test :

1. Le backend évalue le premier test.
2. Il met à jour `screeningPassed`.
3. Il recherche le test principal déjà généré.
4. Si ce test existe, il est immédiatement retourné.
5. Un test principal n’est généré à ce moment que comme solution de secours si aucun test préparé n’existe.

Après une erreur d’évaluation, le test reste `GENERATED`. Le candidat peut relancer l’envoi sans être bloqué par un statut `FAILED`.

---

## 25. Points d’attention opérationnels

### Avertissement Next.js

La configuration contient :

```ts
output: "standalone"
```

Mais le conteneur démarre actuellement avec :

```bash
npm run start
```

Next.js peut afficher :

```text
"next start" does not work with "output: standalone" configuration.
Use "node .next/standalone/server.js" instead.
```

Dans la configuration actuelle, l’application démarre et répond. Ce message est un avertissement, pas une panne. Une optimisation possible consiste à adapter le `Dockerfile` pour exécuter réellement le serveur standalone et copier les ressources statiques nécessaires.

### Coût et latence IA

Chaque nouvelle candidature déclenche deux générations en parallèle. Chaque envoi de questionnaire déclenche une évaluation.

Pour limiter le coût :

- `GLM_REASONING_EFFORT=low` peut accélérer les appels.
- `GLM_MAX_OUTPUT_TOKENS` peut être réduite si les réponses restent valides.
- Le contenu CV est déjà tronqué à 12 000 caractères.

### Fichiers volumineux

Un CV de plus de 5 Mo est refusé avant écriture disque.

### Texte illisible

Les fichiers sans texte exploitable sont refusés dès la candidature. Le fichier incomplet est supprimé pour éviter des fichiers orphelins.

---

## 26. Tests manuels recommandés

### Vérification minimale

```bash
npx tsc --noEmit
npm run build
docker compose up -d --build
curl -I http://localhost:3000
```

### Parcours employeur

1. Créer un compte entreprise.
2. Se déconnecter.
3. Se reconnecter.
4. Créer une offre avec un problème spécifique lié au corps.
5. Ajouter une connaissance critique déjà présente dans le corps.
6. Vérifier la prévisualisation.

### Parcours candidat

1. Ouvrir l’offre depuis la racine.
2. Vérifier que le problème spécifique et les connaissances critiques sont absents de la page publique.
3. Postuler avec un PDF textuel.
4. Attendre la génération avec le cercle de chargement.
5. Répondre aux 3 premières questions.
6. Vérifier que le passage au second test n’expose aucun résultat.
7. Répondre aux 5 questions principales.
8. Vérifier l’écran de transmission.

### Parcours employeur final

1. Ouvrir la liste des candidats.
2. Vérifier le filtre par défaut à 7/10.
3. Ouvrir le questionnaire et les réponses d’un candidat.
4. Vérifier l’avertissement pour un premier test raté.
5. Télécharger le CV.

---

## 27. Résumé des règles produit

1. La racine est uniquement candidat.
2. L’espace employeur est séparé et authentifié.
3. Une offre contient des champs publics et des champs internes.
4. Le candidat ne voit jamais le problème spécifique ni les connaissances critiques.
5. Le candidat répond à un parcours continu de 8 questions.
6. Le premier test contient 3 questions simples.
7. Le second test contient 5 questions principales.
8. Les deux tests sont générés avant la première réponse.
9. Le résultat du premier test n’influence pas la génération du second.
10. Le score est toujours un entier sur 10.
11. Un candidat ayant raté le premier test reste visible si le second score dépasse 5.
12. L’employeur voit un avertissement dépliable pour un premier test raté.
13. L’employeur peut consulter les questions, les réponses, les scores et le CV.
14. Le candidat ne voit aucun résultat ni décision.
15. Le déploiement Docker couvre le web, PostgreSQL et le stockage persistant des CV.

---

## 28. Améliorations possibles

| Domaine | Amélioration |
|---|---|
| Sécurité | Limitation de débit sur candidature et appels IA |
| Sécurité | Analyse antivirus des CV |
| Fichiers | Stockage objet type S3 ou compatible |
| Observation | Logs structurés et métriques d’appels IA |
| Tests | Tests automatisés d’API et de règles de scoring |
| IA | File d’attente pour génération longue |
| Recrutement | Actions de statut manuel et décision finale |
| Notifications | Email au candidat et à l’employeur |
| Docker | Exécution du build standalone sans avertissement `next start` |
| Base | Purge ou archivage automatisé des candidatures anciennes |

