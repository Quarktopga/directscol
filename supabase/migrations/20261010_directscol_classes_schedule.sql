-- DirectScol: schema additionnel pour les classes et emplois du temps.
-- Les identifiants existants, les mots de passe et les données métier ne sont pas supprimés.
alter table public.utilisateurs add column if not exists classe text;
alter table public.utilisateurs drop constraint if exists utilisateurs_type_check;
alter table public.utilisateurs add constraint utilisateurs_type_check check (type in ('eleve','professeur','admin'));
create table if not exists public.emplois_du_temps (
  id uuid primary key default gen_random_uuid(),
  classe text not null,
  jour smallint not null check (jour between 1 and 5),
  heure_debut time not null,
  heure_fin time not null,
  matiere text not null,
  professeur_id uuid references public.utilisateurs(id) on delete set null,
  salle text,
  created_at timestamptz not null default now(),
  check (heure_fin > heure_debut)
);
create index if not exists emplois_du_temps_classe_jour_idx on public.emplois_du_temps(classe, jour, heure_debut);
alter table public.emplois_du_temps enable row level security;
drop policy if exists emplois_du_temps_tout_ouvert on public.emplois_du_temps;
create policy emplois_du_temps_tout_ouvert on public.emplois_du_temps for all to public using (true) with check (true);
