# DirectScol

Application scolaire de démonstration (année 2026–2027) utilisant HTML/CSS/JavaScript et Supabase. L'interface existante est conservée.

## Fonctionnalités présentes
- Connexion DirectScol existante (table `utilisateurs`).
- Espaces élève et professeur : accueil, notes, devoirs et messagerie.
- Notes pondérées par coefficient, édition et suppression côté professeur.
- Messagerie privée ; les élèves ne peuvent pas adresser un message à un autre élève dans l'interface.
- Onglet emploi du temps, filtré par classe pour les élèves et par professeur pour les enseignants.
- Schéma SQL additionnel pour associer les élèves à une classe et stocker les cours.
- Page d'administration existante conservée.

## Déploiement
1. Appliquer `supabase/migrations/20261010_directscol_classes_schedule.sql` dans le SQL Editor du projet Supabase lié.
2. Déployer la branche `main` sur GitHub Pages ou Netlify (racine du dépôt).
3. La migration `20261010_directscol_demo_timetable_seed.sql` ajoute 90 créneaux d'exemple pour 2nde A, 2nde B et 2nde C. Les comptes ne sont pas créés automatiquement : ajoutez les comptes de démonstration dans `utilisateurs`, avec `classe` renseignée pour chaque élève et `matiere` pour chaque professeur.

## Limite de sécurité importante
Cette version conserve volontairement le mécanisme de connexion demandé, qui compare des mots de passe en clair dans une table accessible depuis le navigateur. Les politiques RLS historiques sont ouvertes. Elle doit rester une démonstration avec données fictives, pas un service scolaire réel ni un stockage de données d'élèves réels. Pour une mise en production, il faudra migrer l'authentification et restreindre les politiques RLS côté serveur.

## Identifiants
Ne pas publier de mots de passe de comptes réels. Les comptes de démonstration doivent être créés dans le projet Supabase avant utilisation.
