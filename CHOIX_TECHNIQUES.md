# Choix techniques et fonctionnement clé

## 1. Pourquoi Next.js plutôt que PHP ?

Le projet utilise **Next.js 15**, **React 19** et **TypeScript**.

### Un seul projet pour le frontend et le backend

Next.js permet de mettre dans le même dépôt :

- les pages candidat,
- l’espace employeur,
- les API Routes serveur,
- la validation,
- les appels Prisma,
- les appels IA.

Avec une architecture PHP classique, il faudrait souvent séparer :

- un frontend,
- un backend/API,
- la configuration du routage,
- les types ou contrats d’API,
- deux chaînes de déploiement.

Ici, une route comme `/api/offers` est écrite à côté du reste de l’application et appelée directement par le frontend.

### TypeScript partagé

Le projet est fortement typé :

- les schémas Prisma génèrent des types de base de données,
- Zod valide les entrées utilisateurs,
- Zod valide aussi les réponses de l’IA,
- les formulaires et composants React utilisent les mêmes conventions de types.

Cela réduit les erreurs entre la base, l’API et l’interface.

### API serveur protégée

Les clés importantes ne vont jamais dans le navigateur :

- clé API de l’IA,
- secret de signature des cookies,
- chemin réel des CV,
- contenu complet extrait des CV.

Le navigateur appelle seulement les API Routes Next.js. C’est le serveur Next.js qui parle à PostgreSQL, aux fichiers CV et au modèle IA.

### React est adapté à ce parcours

Le parcours candidat a beaucoup d’états visuels :

- chargement des offres,
- aperçu puis offre complète,
- formulaire de candidature,
- page d’attente IA,
- questionnaire continu,
- transition automatique entre les deux tests,
- écran final sans résultat.

React gère ces états simplement avec des composants locaux.

### Pourquoi pas PHP ?

PHP aurait été possible. Mais il aurait apporté deux backends logiques : un frontend React et une API PHP. Pour ce projet, Next.js donne une pile plus courte, un typage partagé et un déploiement Docker plus simple.

---

## 2. Pourquoi PostgreSQL ?

Le projet utilise **PostgreSQL 17** via **Prisma ORM**.

### Données relationnelles

Les données sont naturellement relationnelles :

```text
User 1 ─── 1 Company
Company 1 ─── N Offer
Offer 1 ─── N Application
Application 1 ─── 2 Test
```

PostgreSQL garantit :

- les clés étrangères,
- les suppressions en cascade,
- les contraintes d’unicité,
- les transactions,
- la cohérence entre offres, candidatures, tests et CV.

Par exemple, un candidat ne peut pas postuler deux fois avec le même email à la même offre :

```text
@@unique([offerId, email])
```

Un candidat ne peut pas avoir deux tests principaux :

```text
@@unique([applicationId, type])
```

### Transactions utiles au projet

Le premier test et le second test doivent rester cohérents. Lors de la génération initiale, les deux tests peuvent être créés dans une transaction Prisma. Si une insertion échoue, l’autre n’est pas conservée dans un état incohérent.

De même, l’évaluation du premier test met à jour :

- le test,
- le booléen interne `screeningPassed`,
- le statut de la candidature.

PostgreSQL est adapté à ce type de mise à jour relationnelle.

### Pourquoi pas MongoDB ?

MongoDB aurait été possible pour stocker les questions JSON. Mais le cœur du projet n’est pas un document isolé : c’est une relation forte entre une entreprise, une offre, un candidat, un CV et deux tests.

Avec MongoDB, les règles d’unicité et d’intégrité devraient être maintenues manuellement. PostgreSQL les fait au niveau de la base.

### Pourquoi pas SQLite ?

SQLite est excellent pour un petit outil local, mais ce projet doit :

- être déployé avec Docker,
- garder plusieurs volumes de données,
- séparer le service web et la base,
- supporter des écritures concurrentes,
- être prêt pour plusieurs employeurs et candidats.

PostgreSQL est plus adapté à ce déploiement.

### Pourquoi Prisma ?

Prisma ajoute :

- un schéma central,
- des migrations versionnées,
- un client TypeScript,
- des requêtes typées,
- des transactions simples.

Le code n’écrit pas de SQL brut dans la majorité des cas.

---

## 3. Fonctionnement de l’IA

L’IA est appelée depuis le serveur, jamais depuis le navigateur. Le projet utilise le SDK OpenAI comme client compatible avec une API personnalisée :

```text
modèle : glm-5.3-flash
API   : endpoint compatible OpenAI Responses
sortie : JSON
```

Les deux questionnaires sont générés avant la première réponse du candidat.

### Étape 1 — Génération initiale

Après la candidature, le candidat arrive sur la page du questionnaire. Le backend extrait d’abord le contenu réel du CV, puis génère les deux tests en parallèle :

1. le premier test de filtrage : 3 questions simples ;
2. le second test principal : 5 questions métier.

Les entrées utilisées sont :

- titre de l’offre,
- corps de l’offre,
- domaine,
- problème spécifique donné par l’employeur,
- connaissances critiques facultatives,
- contenu réel du CV du candidat.

Le modèle doit renvoyer du JSON strict. Le backend valide ce JSON avec Zod avant de l’utiliser.

### Étape 2 — Évaluation du premier test

Le candidat répond aux 3 questions. Le backend envoie :

- les questions du premier test,
- les réponses,
- le contenu réel du CV.

L’IA retourne :

```json
{
  "score": 8,
  "passed": true,
  "summary": "Réponses cohérentes avec le domaine."
}
```

Le score est un entier de 0 à 10. Si l’IA renvoie un nombre décimal dans l’intervalle, il est arrondi automatiquement.

Le backend enregistre :

- le score du premier test,
- la synthèse interne,
- le booléen `screeningPassed`,
- le passage de la candidature au test principal.

Le candidat ne voit ni score, ni réussite, ni échec.

### Étape 3 — Second test déjà préparé

Le second test n’est pas généré après le premier test. Il a déjà été généré et enregistré avant que le candidat ne réponde au premier.

Cela garantit que :

- le résultat du premier filtrage n’influence pas la génération du second test ;
- le passage entre les deux questionnaires est plus rapide ;
- le candidat voit un parcours continu, pas deux tests séparés.

### Étape 4 — Évaluation du second test

Le candidat répond aux 5 questions principales. Le backend envoie à l’IA :

- le corps de l’offre,
- le problème spécifique de l’employeur,
- les connaissances critiques,
- les questions,
- les réponses,
- le contenu réel du CV.

L’IA retourne une évaluation structurée :

```json
{
  "totalScore": 8,
  "criteriaScores": [
    { "name": "Architecture", "score": 8 }
  ],
  "summary": "Réponses précises et applicables.",
  "strengths": ["Méthode claire"],
  "concerns": ["Déploiement à approfondir"],
  "recommendation": "Recommandé"
}
```

Le score total et chaque score de critère sont des entiers sur 10.

Si l’IA ne renvoie pas la recommandation, elle est calculée automatiquement :

| Score principal | Recommandation |
|---|---|
| 8 à 10 | Recommandé |
| 6 à 7 | À considérer |
| 0 à 5 | Non recommandé |

### Règle de conservation

| Premier test | Second test | Résultat |
|---|---|---|
| Réussi | Tout score | Candidature visible |
| Raté | Strictement plus de 5/10 | Candidature visible avec avertissement |
| Raté | 5/10 ou moins | Candidature rejetée |

Le candidat ne voit jamais ces règles, ces scores ni la décision finale.

---

## 4. Stockage des CV

Les CV ne sont pas stockés dans PostgreSQL en binaire.

### À l’upload

Le fichier envoyé par le candidat est validé :

| Règle | Valeur |
|---|---|
| Formats | PDF, DOC, DOCX |
| Taille maximum | 5 Mo |
| Nom disque | UUID + extension |

Le nom original est conservé en base uniquement pour le téléchargement.

Exemple :

```text
Fichier original : CV_Dupont.pdf
Fichier disque  : 4f9d2ac2-8d3c-4e94-9f40-6b4dd5b8ec61.pdf
```

### En développement

Par défaut, les fichiers sont écrits dans :

```text
./data/cv
```

### En Docker

Le conteneur utilise :

```text
/app/uploads
```

Cette chemin est monté sur le volume Docker :

```yaml
cv-uploads:/app/uploads
```

Ainsi, les CV survivent à la recréation du conteneur web.

### En base de données

La table `Application` ne stocke pas le binaire du CV. Elle stocke seulement :

```text
cvPath     : chemin réel du fichier serveur
cvFileName : nom original affiché au téléchargement
```

### Extraction du texte

Après l’écriture du fichier, le backend extrait le texte réel du CV :

| Format | Bibliothèque |
|---|---|
| PDF | `pdf-parse` |
| DOCX | `mammoth` |
| DOC | `word-extractor` |

Le texte est nettoyé, limité à 12 000 caractères, puis envoyé à l’IA pendant la génération et l’évaluation.

Si le fichier est un PDF scanné sans couche texte, la candidature est refusée car le contenu ne peut pas être exploité.

### Accès aux CV

Les CV ne sont pas publics.

Seul l’employeur propriétaire de l’offre peut télécharger le CV d’un candidat. La route vérifie :

1. la session employeur ;
2. l’appartenance de la candidature à son entreprise ;
3. l’existence du fichier dans le répertoire autorisé.

---

## Résumé

- **Next.js** évite de séparer un frontend React et un backend PHP, et permet un typage TypeScript de bout en bout.
- **PostgreSQL** est choisi parce que les données sont fortement relationnelles et nécessitent des contraintes, des transactions et une cohérence forte.
- **L’IA** génère les deux tests avant la première réponse, puis évalue chaque étape sans révéler de résultat au candidat.
- **Les CV** sont stockés sur le disque serveur, référencés en base, protégés par l’authentification employeur, puis extraits en texte pour l’IA.
