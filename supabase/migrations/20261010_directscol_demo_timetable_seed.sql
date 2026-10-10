-- DirectScol: exemple d'emploi du temps pour les trois classes.
-- Les enseignants sont laissés sans professeur_id jusqu'à la création des comptes.
with slots as (
  select * from (values
    (1,1,'08:00'::time,'09:00'::time,'maths','B101'),
    (2,1,'09:00'::time,'10:00'::time,'francais','B101'),
    (3,1,'10:15'::time,'11:15'::time,'anglais','B102'),
    (4,1,'11:15'::time,'12:15'::time,'physique-chimie','Labo 1'),
    (5,1,'13:30'::time,'14:30'::time,'histoire-géographie','B103'),
    (6,1,'14:30'::time,'15:30'::time,'sport','Gymnase'),
    (1,2,'08:00'::time,'09:00'::time,'francais','B101'),
    (2,2,'09:00'::time,'10:00'::time,'maths','B101'),
    (3,2,'10:15'::time,'11:15'::time,'physique-chimie','Labo 1'),
    (4,2,'11:15'::time,'12:15'::time,'anglais','B102'),
    (5,2,'13:30'::time,'14:30'::time,'sport','Gymnase'),
    (6,2,'14:30'::time,'15:30'::time,'histoire-géographie','B103'),
    (1,3,'08:00'::time,'09:00'::time,'anglais','B102'),
    (2,3,'09:00'::time,'10:00'::time,'histoire-géographie','B103'),
    (3,3,'10:15'::time,'11:15'::time,'maths','B101'),
    (4,3,'11:15'::time,'12:15'::time,'francais','B101'),
    (5,3,'13:30'::time,'14:30'::time,'physique-chimie','Labo 1'),
    (6,3,'14:30'::time,'15:30'::time,'sport','Gymnase'),
    (1,4,'08:00'::time,'09:00'::time,'physique-chimie','Labo 1'),
    (2,4,'09:00'::time,'10:00'::time,'anglais','B102'),
    (3,4,'10:15'::time,'11:15'::time,'sport','Gymnase'),
    (4,4,'11:15'::time,'12:15'::time,'maths','B101'),
    (5,4,'13:30'::time,'14:30'::time,'francais','B101'),
    (6,4,'14:30'::time,'15:30'::time,'histoire-géographie','B103'),
    (1,5,'08:00'::time,'09:00'::time,'histoire-géographie','B103'),
    (2,5,'09:00'::time,'10:00'::time,'sport','Gymnase'),
    (3,5,'10:15'::time,'11:15'::time,'francais','B101'),
    (4,5,'11:15'::time,'12:15'::time,'maths','B101'),
    (5,5,'13:30'::time,'14:30'::time,'anglais','B102'),
    (6,5,'14:30'::time,'15:30'::time,'physique-chimie','Labo 1')
  ) as v(periode,jour,debut,fin,matiere,salle)
)
insert into public.emplois_du_temps(classe,jour,heure_debut,heure_fin,matiere,professeur_id,salle)
select cl.classe,s.jour,s.debut,s.fin,s.matiere,null,s.salle
from (values ('2nde A'),('2nde B'),('2nde C')) cl(classe)
cross join slots s
where not exists (
  select 1 from public.emplois_du_temps e
  where e.classe=cl.classe and e.jour=s.jour and e.heure_debut=s.debut
);
