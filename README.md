# PME Jobs

Plateforme de recrutement pour PME et startups, avec offres d'emploi, candidatures, CV en stockage local, pré-filtrage IA et tests principaux générés avec `glm-5.3-flash`.

## Stack

- Next.js 15 App Router
- API Routes
- TypeScript
- Tailwind CSS 4
- Prisma
- PostgreSQL
- API compatible OpenAI Responses
- Zod
- Docker Compose

## Développement local

1. Copier la configuration :

```bash
cp .env.example .env
```

2. Renseigner `AUTH_SECRET`, `GLM_API_KEY` et ajuster `DATABASE_URL`.

3. Installer et préparer la base :

```bash
npm install
npm run db:migrate
npm run dev
```

Le site est disponible sur [http://localhost:3000](http://localhost:3000).

## Déploiement Docker

```bash
cp .env.example .env
docker compose up --build
```

Services :

- Web : `http://localhost:3000`
- PostgreSQL : `localhost:5432`
- CV : volume persistant `cv-uploads`
- Base : volume persistant `postgres-data`

## Fonctionnalités actuelles

- Racine du site dédiée à la consultation des offres par les candidats
- Aucun compte candidat : candidature par nom, prénom, email, téléphone optionnel et CV
- Offres affichées en aperçu, puis ouverture complète avant candidature
- Espace employeur séparé avec inscription entreprise et connexion
- Publication d'offres avec titre, corps, domaine, problème spécifique et connaissances critiques optionnelles
- Candidature avec nom, prénom, email, téléphone optionnel et CV analysé par l'IA
- Stockage local des CV dans `./data/cv` en développement et `/app/uploads` en Docker
- Questionnaire candidat opaque en deux étapes internes : 3 questions de pré-filtrage puis 5 questions principales, préparées avant la première réponse
- Évaluation IA sur 10 points avec scores par critère
- Candidatures gardées après un pré-filtrage raté uniquement si le test principal dépasse 5/10
- Synthèse employeur structurée : recommandation, synthèse courte, points forts et points d'attention
- Consultation employeur avec filtre de score par défaut à 7/10, questionnaire réponses, CV et contact candidat

