# AGENTS.md — Guide de reconstruction de PME Jobs

Ce fichier décrit comment reconstruire le projet dans cet ordre, avec le même comportement que l’application finalisée. `DOCUMENTATION.md` contient la documentation exhaustive. Ce fichier sert de plan d’exécution.

## 1. Objectif produit

Construire une plateforme de recrutement pour PME et startups avec deux espaces séparés :

1. **Candidat**, accessible à la racine, sans compte.
2. **Employeur**, isolé sous `/employer`, avec authentification.

Le parcours final est :

1. L’employeur crée un compte et publie une offre.
2. L’offre contient des champs publics et des champs internes invisibles au candidat.
3. Le candidat consulte l’offre, envoie ses informations et un CV.
4. L’application génère deux questionnaires IA avant la première réponse.
5. Le candidat répond à un parcours continu de 8 questions.
6. L’IA évalue chaque étape.
7. L’employeur consulte les résultats, les réponses, le score et le CV.

### Règles produit obligatoires

- La racine `/` est dédiée aux candidats.
- Aucun lien candidat ne doit pointer vers l’espace employeur.
- Un candidat n’a pas de compte.
- Un même email ne peut postuler qu’une fois à une même offre.
- Le candidat ne voit jamais les problèmes internes, les connaissances critiques, les scores ni les décisions.
- Le questionnaire candidat apparaît comme un seul parcours continu, pas comme deux tests distincts.
- Le premier questionnaire contient exactement 3 questions simples à choix multiples.
- Le second questionnaire contient exactement 5 questions principales.
- Les deux tests sont générés avant la première réponse.
- Le résultat du premier test ne doit pas influencer la génération du second.
- Tous les scores sont des entiers de 0 à 10.
- Si le premier test est réussi, la candidature reste visible quel que soit le score principal.
- Si le premier test est raté, la candidature n’est conservée que si le score principal est strictement supérieur à 5.
- L’employeur voit un avertissement dépliable pour un premier test raté.
- Le filtre employeur par défaut est `7/10`.
- Les CV sont accessibles uniquement à l’employeur propriétaire de l’offre.

## 2. Stack imposée

| Domaine | Technologie |
|---|---|
| Runtime | Node.js 22+ |
| Framework | Next.js 15 App Router |
| UI | React 19 |
| Langage | TypeScript strict |
| Styles | Tailwind CSS 4 via PostCSS |
| Base | PostgreSQL 17 |
| ORM | Prisma 6 |
| Validation | Zod 3 |
| IA | `glm-5.3-flash` via SDK OpenAI compatible |
| PDF | `pdf-parse` |
| DOCX | `mammoth` |
| DOC | `word-extractor` |
| Conteneurs | Docker Compose |

Ne pas remplacer cette stack sans demande explicite.

## 3. Environnement

Créer un fichier `.env` à partir de `.env.example` :

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pme_jobs?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
GLM_API_KEY="your-glm-api-key"
GLM_BASE_URL="https://api.z.ai/api/v1"
GLM_MODEL="glm-5.3-flash"
GLM_REASONING_EFFORT="high"
GLM_MAX_OUTPUT_TOKENS="8000"
GLM_TIMEOUT_MS="300000"
GLM_MAX_RETRIES="4"
CV_UPLOAD_DIR="./data/cv"
```

Variables obligatoires :

- `DATABASE_URL`
- `AUTH_SECRET`, au moins 16 caractères
- `GLM_API_KEY`

Variables utiles :

| Variable | Défaut |
|---|---|
| `GLM_BASE_URL` | `https://api.z.ai/api/v1` |
| `GLM_MODEL` | `glm-5.3-flash` |
| `GLM_REASONING_EFFORT` | `high` |
| `GLM_MAX_OUTPUT_TOKENS` | `8000` |
| `GLM_TIMEOUT_MS` | `300000` |
| `GLM_MAX_RETRIES` | `4` |
| `CV_UPLOAD_DIR` | `./data/cv` |

## 4. Dépendances et scripts

Dependencies :

```json
{
  "dependencies": {
    "@prisma/client": "^6",
    "mammoth": "^1.13.0",
    "next": "^15",
    "openai": "^5",
    "pdf-parse": "^2.4.5",
    "react": "^19",
    "react-dom": "^19",
    "word-extractor": "^1.0.4",
    "zod": "^3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^24",
    "@types/react": "^24",
    "@types/react-dom": "^24",
    "prisma": "^6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

Scripts attendus :

```json
{
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "next lint",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:push": "prisma db push",
  "db:studio": "prisma studio"
}
```

Configurer `next.config.ts` ainsi :

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
```

`serverExternalPackages` est indispensable pour éviter de casser le worker de `pdf-parse` pendant le build Next.js.

## 5. Modèle de données Prisma

Créer `prisma/schema.prisma` avec PostgreSQL et Prisma Client.

### Énumérations

```prisma
enum UserRole {
  EMPLOYER
}

enum ApplicationStatus {
  SCREENING
  SCREENING_FAILED
  MAIN_TEST
  RESULTS_READY
  REJECTED
  HIRED
}

enum TestType {
  SCREENING
  MAIN
}

enum TestStatus {
  GENERATED
  COMPLETED
  EVALUATED
  FAILED
}
```

### `User`

- `id`, `email`, `passwordHash`, `firstName?`, `lastName?`, `role`, `createdAt`
- `email` unique
- relation `Company?`

### `Company`

- `id`, `name`, `ownerId`, `owner`
- `ownerId` unique
- suppression en cascade depuis `User`
- relation `Offer[]`

### `Offer`

| Champ | Type | Usage |
|---|---|---|
| `id` | `String @id` | Identifiant |
| `companyId` | `String` | Entreprise propriétaire |
| `title` | `String` | Titre public |
| `body` | `String` | Corps public |
| `specificNeeds` | `String` | Problème interne donné pour le test |
| `criticalSkills` | `String?` | Notion interne à renforcer |
| `domain` | `String` | Domaine public |
| `isActive` | `Boolean @default(true)` | Visibilité publique |

Ajouter des index :

```prisma
@@index([companyId])
@@index([isActive, createdAt])
```

### `Application`

| Champ | Type | Usage |
|---|---|---|
| `offerId` | `String` | Offre concernée |
| `firstName` | `String` | Prénom |
| `lastName` | `String` | Nom |
| `email` | `String` | Email normalisé en minuscules |
| `phone` | `String?` | Téléphone facultatif |
| `cvPath` | `String` | Chemin serveur du CV |
| `cvFileName` | `String` | Nom original du CV |
| `screeningPassed` | `Boolean?` | Résultat interne du premier test |
| `status` | `ApplicationStatus` | Étape courante |

Contraintes :

```prisma
@@unique([offerId, email])
@@index([offerId, status])
```

### `Test`

| Champ | Type | Usage |
|---|---|---|
| `applicationId` | `String` | Candidature |
| `type` | `TestType` | `SCREENING` ou `MAIN` |
| `status` | `TestStatus` | État du questionnaire |
| `questions` | `Json` | Questions |
| `answers` | `Json?` | Réponses |
| `totalScore` | `Int?` | Score entier sur 10 |
| `criteriaScores` | `Json?` | Scores par critère |
| `aiSummary` | `String?` | Synthèse ou JSON sérialisé |
| `completedAt` | `DateTime?` | Date d’évaluation |

Contraintes :

```prisma
@@unique([applicationId, type])
@@index([applicationId, type])
```

Puis créer et appliquer la migration initiale :

```bash
npx prisma migrate dev --name init
```

## 6. Arborescence cible

```text
.
├── Dockerfile
├── docker-compose.yml
├── next.config.ts
├── package.json
├── prisma
│   ├── migrations
│   └── schema.prisma
├── scripts
│   ├── seed-demo.mjs
│   ├── seed-demo.ps1
│   └── seed-demo.sh
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
│   │   ├── globals.css
│   │   └── layout.tsx
│   └── lib
│       ├── ai.ts
│       ├── auth.ts
│       ├── files.ts
│       ├── prisma.ts
│       └── validation.ts
└── types
```

## 7. Librairies serveur à créer

### `src/lib/prisma.ts`

Créer un client Prisma singleton compatible avec le hot reload en développement.

### `src/lib/auth.ts`

Implémenter :

- `hashPassword(password)`
- `verifyPassword(password, storedHash)`
- `createSession(userId)`
- `destroySession()`
- `getSessionUser()`
- `requireUser("EMPLOYER")`
- `createApplicationSession(applicationId)`
- `hasApplicationSession(applicationId)`

Règles :

1. Hash de mot de passe avec `scrypt`.
2. Sel aléatoire de 16 octets.
3. Dérivation de 64 octets.
4. Stockage au format `salt:derivedKey`.
5. Comparaison avec `timingSafeEqual`.
6. Cookie employeur signé avec HMAC SHA-256.
7. Cookie candidat signé et lié à un seul `applicationId`.
8. Cookies `httpOnly`, `sameSite: "lax"` et `secure` en production.
9. Cookie employeur valide 7 jours.
10. Cookie candidat valide 30 jours.

### `src/lib/files.ts`

Implémenter :

- `saveCv(file)`
- `readCv(filePath)`
- `extractCvContent(filePath)`
- `deleteCv(filePath)`

Règles CV :

| Règle | Valeur |
|---|---|
| Formats | PDF, DOC, DOCX |
| Taille | entre 1 octet et 5 Mo |
| Nom disque | UUID + extension |
| Texte minimum | 20 caractères |
| Limite IA | 12 000 caractères |

Extraction :

| Format | Bibliothèque |
|---|---|
| PDF | `pdf-parse` |
| DOCX | `mammoth` |
| DOC | `word-extractor` |

Vérifier que le chemin résolu est bien dans `CV_UPLOAD_DIR`. Si le CV ne contient pas de texte exploitable, refuser la candidature et supprimer le fichier déjà écrit.

### `src/lib/validation.ts`

Créer des schémas Zod :

#### Offre

```ts
title: string >= 3
body: string >= 30
specificNeeds: string >= 10
criticalSkills?: string <= 500
domain: string >= 2
```

#### Candidature

```ts
firstName: string >= 1
lastName: string >= 1
email: email
phone?: string
```

#### Réponses

- Test de filtrage : tableau d’exactement 3 valeurs.
- Test principal : tableau d’exactement 5 valeurs.
- Chaque réponse peut être `string`, `number`, `boolean` ou `null`.

## 8. Authentification

### Employeur

Créer :

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

L’inscription crée `User` et `Company` dans une transaction.

### Candidat

Le candidat n’a pas de compte. Après une candidature réussie, créer une session liée à l’identifiant de la candidature.

Cette session autorise uniquement :

```http
POST  /api/applications/:id/tests
PATCH /api/tests/:id
```

## 9. API offres

### `GET /api/offers`

Public.

- Retourner uniquement les offres actives.
- Paramètre facultatif : `domain`.
- Ne jamais retourner `specificNeeds` ni `criticalSkills`.

Si `scope=mine` :

- Exiger une session employeur.
- Retourner les offres de son entreprise.

### `POST /api/offers`

Employeur connecté.

Valider avec Zod puis créer l’offre.

### `GET /api/offers/:id`

Comportement selon le rôle :

| Visiteur | Réponse |
|---|---|
| Non propriétaire | Champs publics seulement |
| Propriétaire connecté | Offre complète |

Une offre inactive reste visible par son propriétaire mais retourne `404` pour les autres.

### `DELETE /api/offers/:id`

Employeur propriétaire uniquement.

## 10. Candidature

### Route

```http
POST /api/offers/:id/applications
```

Corps : `multipart/form-data`.

Étapes :

1. Vérifier que l’offre est active.
2. Valider les champs Zod.
3. Normaliser l’email en minuscules.
4. Refuser un email déjà utilisé pour cette offre.
5. Sauvegarder le CV.
6. Extraire le texte du CV immédiatement.
7. Si l’extraction échoue, supprimer le fichier.
8. Créer la candidature.
9. Créer la session candidat.

## 11. Génération IA

Créer `src/lib/ai.ts` autour du SDK OpenAI :

```ts
new OpenAI({
  apiKey: process.env.GLM_API_KEY,
  baseURL: process.env.GLM_BASE_URL,
})
```

Appel :

```ts
client.responses.create({
  model: process.env.GLM_MODEL,
  input: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
  text: {
    format: { type: "json_object" },
  },
  reasoning: { effort },
  max_output_tokens,
})
```

Règles communes :

1. Vérifier `response.status === "completed"`.
2. Lire `response.output_text`.
3. Parser le JSON.
4. Valider avec Zod.
5. Arrondir tous les scores entre 0 et 10.
6. Retourner une erreur explicite si le format échoue.

### Génération simultanée

Après la candidature, générer les deux tests en parallèle :

- 3 questions de filtrage.
- 5 questions principales.

Entrées communes :

- titre de l’offre ;
- corps de l’offre ;
- domaine ;
- `specificNeeds` ;
- `criticalSkills` ;
- contenu réel du CV.

Prompt du premier test :

- 3 questions simples.
- 2 à 4 options par question.
- Vérifier les notions du domaine et l’intérêt.
- Aucun score visible côté candidat.

Prompt du second test :

- 5 questions.
- Types autorisés : `qcm`, `problem`, `situation`.
- Entre 2 et 10 critères.
- Aucune épreuve de code.
- Le problème spécifique doit être lié au corps de l’offre.
- Une connaissance critique doit déjà être présente dans le corps de l’offre.

Schémas Zod :

```ts
screeningTestSchema = {
  questions: [
    {
      id: 1 | 2 | 3,
      question: string >= 5,
      options: string[] entre 2 et 4,
    }
  ] // exactement 3
}

mainTestSchema = {
  criteria: string[] entre 2 et 10,
  questions: [
    {
      id: 1 | 2 | 3 | 4 | 5,
      type: "qcm" | "problem" | "situation",
      question: string >= 10,
      options?: string[] <= 4,
    }
  ] // exactement 5
}
```

## 12. Évaluation IA

### Premier test

Entrées :

- questions ;
- réponses ;
- contenu du CV.

Sortie :

```json
{
  "score": 8,
  "passed": true,
  "summary": "Réponses cohérentes."
}
```

Enregistrer :

1. `Test.totalScore`.
2. `Test.aiSummary`.
3. `Test.status = "EVALUATED"`.
4. `Application.screeningPassed`.
5. `Application.status = "MAIN_TEST"`.

Puis retourner le test principal déjà généré.

### Second test

Entrées :

- corps de l’offre ;
- problème spécifique ;
- connaissances critiques ;
- questions ;
- réponses ;
- contenu du CV.

Sortie :

```json
{
  "totalScore": 8,
  "criteriaScores": [
    { "name": "Architecture", "score": 8 }
  ],
  "summary": "Réponses précises.",
  "strengths": ["Méthode claire"],
  "concerns": ["Déploiement à approfondir"],
  "recommendation": "Recommandé"
}
```

Limites :

- `summary` : 500 caractères maximum.
- `strengths` : 3 éléments maximum.
- `concerns` : 3 éléments maximum.
- `recommendation` parmi `Recommandé`, `À considérer`, `Non recommandé`.

Si `recommendation` est absente, la déduire :

| Score | Recommandation |
|---|---|
| `>= 8` | `Recommandé` |
| `> 5` | `À considérer` |
| `<= 5` | `Non recommandé` |

## 13. Règle de conservation

Après le second test :

| Premier test | Score principal | Statut |
|---|---:|---|
| Réussi | Tout score | `RESULTS_READY` |
| Raté | `> 5` | `RESULTS_READY` |
| Raté | `<= 5` | `REJECTED` |

Le candidat ne voit aucun score, statut ou décision.

## 14. Pages à créer

### Candidat

| Route | Fonction |
|---|---|
| `/` | Liste des offres actives |
| `/offers/[id]` | Offre publique complète |
| `/offers/[id]/apply` | Candidature |
| `/applications/[id]/test` | Questionnaire continu |

Le questionnaire doit afficher une page d’attente avec un cercle Tailwind `animate-spin` pendant :

1. la génération des tests ;
2. l’évaluation d’un test.

Pendant ces traitements, les questions ne doivent pas être affichées.

### Employeur

| Route | Fonction |
|---|---|
| `/employer` | Tableau de bord |
| `/employer/register` | Inscription entreprise |
| `/employer/login` | Connexion |
| `/employer/offers/new` | Création d’offre |
| `/employer/offers/[id]/review` | Prévisualisation complète |
| `/employer/offers/[id]/candidates` | Candidats |

La création d’offre doit avoir :

- un bouton retour ;
- un champ `specificNeeds` clairement présenté comme problème donné pour le test ;
- un champ `criticalSkills` facultatif ;
- une aide précisant que ces notions doivent être présentes dans le corps de l’offre.

La liste des candidats doit :

- filtrer par score principal ;
- démarrer à `7/10` ;
- afficher contact, score, recommandation, synthèse, critères, points forts et points d’attention ;
- afficher les questions et réponses via un bouton dépliable ;
- afficher un avertissement ambre dépliable si le premier test est raté ;
- permettre le téléchargement du CV ;
- permettre le retour à l’offre et au tableau de bord.

## 15. API candidatures et tests

```http
GET    /api/applications?offerId=...&minScore=7
GET    /api/applications/:id/cv
POST   /api/applications/:id/tests
PATCH  /api/tests/:id
```

`GET /api/applications` est employeur. Il doit vérifier l’appartenance à l’entreprise, exiger un test principal `EVALUATED` et appliquer `totalScore >= minScore`.

`GET /api/applications/:id/cv` doit vérifier que la candidature appartient bien à l’entreprise connectée.

`POST /api/applications/:id/tests` :

1. Vérifie la session candidat.
2. Génère les tests manquants.
3. Retourne le test courant.
4. Retourne `completed: true` si la candidature est terminée.

`PATCH /api/tests/:id` :

1. Vérifie la session candidat.
2. Valide les réponses.
3. Évalue avec l’IA.
4. Met à jour le test et la candidature.
5. Retourne le test suivant ou `completed: true`.

Après une erreur d’évaluation, garder le test en `GENERATED` pour permettre une nouvelle tentative.

## 16. Docker

### `docker-compose.yml`

Créer deux services :

1. `db` avec `postgres:17-alpine`.
2. `web` construite depuis le `Dockerfile`.

PostgreSQL doit avoir un healthcheck :

```bash
pg_isready -U postgres -d pme_jobs
```

Le service web doit démarrer seulement quand `db` est healthy.

Volumes :

| Volume | Montage |
|---|---|
| `postgres-data` | `/var/lib/postgresql/data` |
| `cv-uploads` | `/app/uploads` |

Exposer :

- PostgreSQL : `5432:5432`
- Web : `3000:3000`

### `Dockerfile`

Image de base :

```dockerfile
FROM node:22-alpine
```

Étapes :

1. `WORKDIR /app`.
2. `NODE_ENV=production`.
3. Copier `package.json` et `package-lock.json`.
4. `npm ci --include=dev`.
5. Copier le code.
6. `npx prisma generate`.
7. `npm run build`.
8. `EXPOSE 3000`.
9. Au démarrage : `npx prisma migrate deploy`, puis `npm run start`.

Les dépendances de développement sont nécessaires au build pour Prisma, TypeScript et Tailwind.

## 17. Développement et vérification

Depuis une base vide :

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Vérifications obligatoires avant de considérer le projet fonctionnel :

```bash
npx tsc --noEmit
npm run build
docker compose up -d --build
curl -I http://localhost:3000
```

Tests manuels obligatoires :

### Employeur

1. Créer un compte entreprise.
2. Se reconnecter.
3. Créer une offre.
4. Vérifier que la prévisualisation montre les champs internes.
5. Vérifier la déconnexion.

### Candidat

1. Voir l’offre depuis la racine.
2. Vérifier que les champs internes sont absents.
3. Postuler avec un PDF textuel.
4. Vérifier la page d’attente IA.
5. Répondre aux 3 premières questions.
6. Vérifier le passage aux 5 questions suivantes sans afficher de résultat.
7. Répondre aux 5 questions.
8. Vérifier l’écran de transmission.

### Employeur final

1. Ouvrir la liste des candidats.
2. Vérifier le filtre par défaut à 7/10.
3. Ouvrir les questions et réponses.
4. Vérifier l’avertissement pour un premier test raté.
5. Télécharger le CV.

## 18. Données de démonstration

Des scripts optionnels doivent pouvoir réinitialiser les données et recréer :

1. 1 entreprise.
2. 2 offres :
   - Développeur Web Full Stack ;
   - Comptable confirmé.
3. 3 candidatures par offre :
   - premier test réussi, second test mauvais ;
   - premier test réussi, second test bon ;
   - premier test raté, second test excellent.

Fichiers existants :

```bash
scripts/seed-demo.sh
scripts/seed-demo.ps1
scripts/seed-demo.mjs
```

Ces scripts sont destructifs : ils suppriment les données applicatives et les CV avant d’insérer les données de démonstration.

## 19. Sécurité

Obligations :

- Ne jamais exposer `AUTH_SECRET` ou `GLM_API_KEY` au navigateur.
- Ne jamais stocker `.env` dans le dépôt.
- Ne jamais servir les CV publiquement.
- Remplacer le nom des CV par un UUID.
- Vérifier la propriété entreprise avant chaque accès employeur.
- Valider toutes les entrées avec Zod.
- Ne pas retourner `specificNeeds` et `criticalSkills` dans les réponses publiques.
- Ne pas retourner de score ou de décision au candidat.

Limites acceptables dans la version actuelle :

- pas de rate limiting ;
- pas d’antivirus ;
- les CV scannés sans couche texte sont refusés.

## 20. Critères d’acceptation

Le projet peut être considéré terminé si :

1. `npx tsc --noEmit` réussit.
2. `npm run build` réussit.
3. Docker démarre web et PostgreSQL.
4. La migration s’applique au démarrage.
5. La racine affiche les offres sans champs internes.
6. Un employeur peut créer une offre.
7. Un candidat peut postuler avec un CV PDF textuel.
8. Les deux tests sont générés avant la première réponse.
9. Le candidat voit un parcours continu de 8 questions.
10. Le candidat ne voit aucun score.
11. L’employeur voit les scores, réponses, synthèses et CV.
12. L’employeur voit un avertissement pour un premier test raté.
13. La règle de conservation `screening failed + main <= 5 = REJECTED` fonctionne.
14. Les CV restent préservés dans un volume Docker.
