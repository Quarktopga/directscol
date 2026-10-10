// ============================================================
// DirectScol — app.js
// Démonstration : appels directs à Supabase depuis le navigateur,
// mots de passe en clair, RLS ouvertes. Fait exprès, non sécurisé.
// ============================================================

const SUPABASE_URL = "https://hgbpszifabxyxdudqefl.supabase.co";
const SUPABASE_KEY = "sb_publishable_UfMe8-ReaEIudh94AhctCA_Zl0nhPk_";
const clientSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CLE_SESSION = "directscol_utilisateur";

let utilisateur = null;      // utilisateur connecté (ligne de la table utilisateurs)
let annuaire = [];           // cache de tous les utilisateurs (pour noms, select, etc.)

// ------------------------------------------------------------
// Utilitaires
// ------------------------------------------------------------

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateCourte(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatNote(valeur) {
  return Number(valeur).toFixed(1).replace(".0", "");
}

function classePastille(valeur) {
  if (valeur < 10) return "faible";
  if (valeur >= 14) return "forte";
  return "";
}

function moyennePonderee(liste) {
  if (!liste.length) return null;
  const totalPoints = liste.reduce((s, n) => s + Number(n.valeur) * Number(n.coefficient), 0);
  const totalCoef = liste.reduce((s, n) => s + Number(n.coefficient), 0);
  return totalCoef ? totalPoints / totalCoef : null;
}

function nomComplet(u) {
  if (!u) return "Utilisateur supprimé";
  return `${u.prenom} ${u.nom}`;
}

function utilisateurParId(id) {
  return annuaire.find((u) => u.id === id) || null;
}

function afficherErreurConnexion(texte) {
  const bloc = document.getElementById("erreur-connexion");
  bloc.textContent = texte;
  bloc.classList.remove("hidden");
}

function masquerErreurConnexion() {
  document.getElementById("erreur-connexion").classList.add("hidden");
}

// ------------------------------------------------------------
// Connexion / déconnexion
// ------------------------------------------------------------

async function chargerAnnuaire() {
  const { data, error } = await clientSupabase
    .from("utilisateurs")
    .select("id, identifiant, type, nom, prenom, matiere, classe")
    .order("type", { ascending: true })
    .order("nom", { ascending: true });
  if (!error && data) annuaire = data;
}

async function tenterConnexion(identifiant, motDePasse) {
  const { data, error } = await clientSupabase
    .from("utilisateurs")
    .select("*")
    .eq("identifiant", identifiant.trim())
    .eq("mot_de_passe", motDePasse)
    .maybeSingle();

  if (error) {
    afficherErreurConnexion("Une erreur est survenue lors de la connexion. Réessayez.");
    return;
  }
  if (!data) {
    afficherErreurConnexion("Identifiant ou mot de passe incorrect.");
    return;
  }

  utilisateur = data;
  localStorage.setItem(CLE_SESSION, JSON.stringify(data));
  if (data.type === "admin") { window.location.href = "admin.html"; return; }
  await demarrerApplication();
}

function deconnecter() {
  localStorage.removeItem(CLE_SESSION);
  utilisateur = null;
  document.getElementById("ecran-application").classList.add("hidden");
  document.getElementById("ecran-connexion").classList.remove("hidden");
  document.getElementById("formulaire-connexion").reset();
  masquerErreurConnexion();
}

// ------------------------------------------------------------
// Démarrage de l'application (après connexion)
// ------------------------------------------------------------

async function demarrerApplication() {
  await chargerAnnuaire();

  document.getElementById("ecran-connexion").classList.add("hidden");
  document.getElementById("ecran-application").classList.remove("hidden");

  document.getElementById("nom-utilisateur").textContent = nomComplet(utilisateur);
  const badge = document.getElementById("badge-role");
  if (utilisateur.type === "professeur") {
    badge.textContent = `Professeur · ${utilisateur.matiere}`;
    badge.classList.remove("eleve");
  } else {
    badge.textContent = "Élève";
    badge.classList.add("eleve");
  }

  remplirSelectDestinataire();
  await Promise.all([
    rendreAccueil(),
    rendreNotes(),
    rendreEmploiDuTemps(),
    rendreDevoirs(),
    rendreMessagerie(),
  ]);
}

// ------------------------------------------------------------
// Onglets
// ------------------------------------------------------------

function initialiserOnglets() {
  document.querySelectorAll(".onglet").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      document.querySelectorAll(".onglet").forEach((b) => b.classList.remove("actif"));
      document.querySelectorAll(".vue").forEach((v) => v.classList.remove("actif"));
      bouton.classList.add("actif");
      document.getElementById(`vue-${bouton.dataset.onglet}`).classList.add("actif");
    });
  });
}

// ------------------------------------------------------------
// Accueil
// ------------------------------------------------------------

async function rendreAccueil() {
  document.getElementById("titre-bienvenue").textContent = `Bonjour ${utilisateur.prenom}`;

  if (utilisateur.type === "eleve") {
    document.getElementById("sous-titre-bienvenue").textContent =
      "Voici un aperçu de votre scolarité.";

    const { data: notes } = await clientSupabase
      .from("notes").select("*").eq("eleve_id", utilisateur.id)
      .order("date_note", { ascending: false });
    const { count: devoirsAVenir } = await clientSupabase
      .from("devoirs").select("id", { count: "exact", head: true })
      .gte("date_rendu", new Date().toISOString().slice(0, 10));
    const { count: messagesNonLus } = await clientSupabase
      .from("messages").select("id", { count: "exact", head: true })
      .eq("lu", false).neq("expediteur_id", utilisateur.id)
      .or(`destinataire_id.eq.${utilisateur.id},destinataire_id.is.null`);

    const moyenne = moyennePonderee(notes || []);

    document.getElementById("grille-stats").innerHTML = `
      <div class="carte-stat"><div class="valeur">${moyenne !== null ? formatNote(moyenne) + "/20" : "—"}</div><div class="libelle">Moyenne générale</div></div>
      <div class="carte-stat"><div class="valeur">${devoirsAVenir ?? 0}</div><div class="libelle">Devoirs à venir</div></div>
      <div class="carte-stat"><div class="valeur">${messagesNonLus ?? 0}</div><div class="libelle">Messages non lus</div></div>
    `;

    document.getElementById("titre-liste-recente").textContent = "Dernières notes";
    document.getElementById("contenu-liste-recente").innerHTML =
      (notes || []).slice(0, 5).map((n) => `
        <div class="ligne-recente">
          <span>${n.titre} <span class="matiere-tag">· ${n.matiere}</span></span>
          <span class="pastille-note ${classePastille(n.valeur)}">${formatNote(n.valeur)}</span>
        </div>
      `).join("") || `<div class="vide">Aucune note pour le moment.</div>`;

  } else {
    document.getElementById("sous-titre-bienvenue").textContent =
      `Espace professeur · ${utilisateur.matiere}`;

    const eleves = annuaire.filter((u) => u.type === "eleve");
    const { data: mesNotes } = await clientSupabase
      .from("notes").select("*").eq("professeur_id", utilisateur.id)
      .order("created_at", { ascending: false });
    const { count: devoirsActifs } = await clientSupabase
      .from("devoirs").select("id", { count: "exact", head: true })
      .eq("professeur_id", utilisateur.id)
      .gte("date_rendu", new Date().toISOString().slice(0, 10));

    document.getElementById("grille-stats").innerHTML = `
      <div class="carte-stat"><div class="valeur">${eleves.length}</div><div class="libelle">Élèves suivis</div></div>
      <div class="carte-stat"><div class="valeur">${(mesNotes || []).length}</div><div class="libelle">Notes saisies</div></div>
      <div class="carte-stat"><div class="valeur">${devoirsActifs ?? 0}</div><div class="libelle">Devoirs en cours</div></div>
    `;

    document.getElementById("titre-liste-recente").textContent = "Dernières notes saisies";
    document.getElementById("contenu-liste-recente").innerHTML =
      (mesNotes || []).slice(0, 5).map((n) => `
        <div class="ligne-recente">
          <span>${n.titre} <span class="matiere-tag">· ${nomComplet(utilisateurParId(n.eleve_id))}</span></span>
          <span class="pastille-note ${classePastille(n.valeur)}">${formatNote(n.valeur)}</span>
        </div>
      `).join("") || `<div class="vide">Aucune note saisie pour le moment.</div>`;
  }
}

// ------------------------------------------------------------
// Notes
// ------------------------------------------------------------

async function rendreNotes() {
  const conteneur = document.getElementById("contenu-notes");

  if (utilisateur.type === "eleve") {
    document.getElementById("sous-titre-notes").textContent = "Toutes vos notes, regroupées par matière.";

    const { data: notes } = await clientSupabase
      .from("notes").select("*").eq("eleve_id", utilisateur.id)
      .order("date_note", { ascending: false });

    if (!notes || !notes.length) {
      conteneur.innerHTML = `<div class="vide">Aucune note pour le moment.</div>`;
      return;
    }

    const matieres = [...new Set(notes.map((n) => n.matiere))];
    conteneur.innerHTML = matieres.map((matiere) => {
      const notesMatiere = notes.filter((n) => n.matiere === matiere);
      const moyenne = moyennePonderee(notesMatiere);
      return `
        <div class="bloc-matiere">
          <div class="titre-matiere">
            <h3>${matiere}</h3>
            <span class="moyenne-matiere">Moyenne : <strong>${formatNote(moyenne)}/20</strong></span>
          </div>
          <table class="tableau-notes">
            <thead><tr><th>Évaluation</th><th>Date</th><th>Coeff.</th><th>Note</th><th>Commentaire</th></tr></thead>
            <tbody>
              ${notesMatiere.map((n) => `
                <tr>
                  <td>${n.titre}</td>
                  <td>${formatDateCourte(n.date_note)}</td>
                  <td>${n.coefficient}</td>
                  <td><span class="pastille-note ${classePastille(n.valeur)}">${formatNote(n.valeur)}</span></td>
                  <td>${n.commentaire || ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }).join("");

  } else {
    document.getElementById("sous-titre-notes").textContent =
      `Saisissez et modifiez les notes de ${utilisateur.matiere}.`;

    const eleves = annuaire.filter((u) => u.type === "eleve");

    const { data: notes } = await clientSupabase
      .from("notes").select("*").eq("professeur_id", utilisateur.id)
      .order("date_note", { ascending: false });

    conteneur.innerHTML = `
      <div class="formulaire-edition">
        <h3 id="titre-formulaire-note">Ajouter une note</h3>
        <form id="formulaire-note">
          <input type="hidden" id="note-id">
          <div class="ligne-formulaire" style="margin-bottom:12px;">
            <div class="champ" style="margin-bottom:0;">
              <label for="note-eleve">Élève</label>
              <select id="note-eleve" required>
                ${eleves.map((e) => `<option value="${e.id}">${nomComplet(e)}</option>`).join("")}
              </select>
            </div>
            <div class="champ" style="margin-bottom:0;">
              <label for="note-titre">Intitulé</label>
              <input type="text" id="note-titre" placeholder="Contrôle chapitre 4" required>
            </div>
            <div class="champ" style="margin-bottom:0;">
              <label for="note-date">Date</label>
              <input type="date" id="note-date" value="${new Date().toISOString().slice(0,10)}" required>
            </div>
          </div>
          <div class="ligne-formulaire" style="margin-bottom:12px;">
            <div class="champ" style="margin-bottom:0;">
              <label for="note-valeur">Note (/20)</label>
              <input type="number" id="note-valeur" min="0" max="20" step="0.5" required>
            </div>
            <div class="champ" style="margin-bottom:0;">
              <label for="note-coefficient">Coefficient</label>
              <input type="number" id="note-coefficient" min="0.5" step="0.5" value="1" required>
            </div>
          </div>
          <div class="champ">
            <label for="note-commentaire">Commentaire</label>
            <textarea id="note-commentaire" rows="2"></textarea>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="submit" class="bouton bouton-principal" id="bouton-note-valider" style="width:auto;">Enregistrer la note</button>
            <button type="button" class="bouton bouton-secondaire hidden" id="bouton-note-annuler">Annuler</button>
          </div>
        </form>
      </div>

      <table class="tableau-notes">
        <thead><tr><th>Élève</th><th>Évaluation</th><th>Date</th><th>Note</th><th>Actions</th></tr></thead>
        <tbody id="corps-tableau-notes-prof">
          ${(notes && notes.length) ? notes.map((n) => `
            <tr>
              <td>${nomComplet(utilisateurParId(n.eleve_id))}</td>
              <td>${n.titre}</td>
              <td>${formatDateCourte(n.date_note)}</td>
              <td><span class="pastille-note ${classePastille(n.valeur)}">${formatNote(n.valeur)}</span></td>
              <td>
                <button class="icone-bouton" data-editer-note="${n.id}">Modifier</button>
                <button class="icone-bouton supprimer" data-supprimer-note="${n.id}">Supprimer</button>
              </td>
            </tr>
          `).join("") : `<tr><td colspan="5" class="vide">Aucune note saisie pour le moment.</td></tr>`}
        </tbody>
      </table>
    `;

    const notesParId = {};
    (notes || []).forEach((n) => (notesParId[n.id] = n));

    document.getElementById("formulaire-note").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("note-id").value;
      const enregistrement = {
        eleve_id: document.getElementById("note-eleve").value,
        professeur_id: utilisateur.id,
        matiere: utilisateur.matiere,
        titre: document.getElementById("note-titre").value.trim(),
        date_note: document.getElementById("note-date").value,
        valeur: parseFloat(document.getElementById("note-valeur").value),
        coefficient: parseFloat(document.getElementById("note-coefficient").value),
        commentaire: document.getElementById("note-commentaire").value.trim() || null,
      };

      if (id) {
        await clientSupabase.from("notes").update(enregistrement).eq("id", id);
      } else {
        await clientSupabase.from("notes").insert(enregistrement);
      }
      await rendreNotes();
      await rendreAccueil();
    });

    document.getElementById("bouton-note-annuler").addEventListener("click", () => reinitialiserFormulaireNote());

    document.querySelectorAll("[data-editer-note]").forEach((bouton) => {
      bouton.addEventListener("click", () => {
        const n = notesParId[bouton.dataset.editerNote];
        document.getElementById("titre-formulaire-note").textContent = "Modifier la note";
        document.getElementById("note-id").value = n.id;
        document.getElementById("note-eleve").value = n.eleve_id;
        document.getElementById("note-titre").value = n.titre;
        document.getElementById("note-date").value = n.date_note;
        document.getElementById("note-valeur").value = n.valeur;
        document.getElementById("note-coefficient").value = n.coefficient;
        document.getElementById("note-commentaire").value = n.commentaire || "";
        document.getElementById("bouton-note-valider").textContent = "Enregistrer les modifications";
        document.getElementById("bouton-note-annuler").classList.remove("hidden");
        document.getElementById("formulaire-note").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    document.querySelectorAll("[data-supprimer-note]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        if (!confirm("Supprimer définitivement cette note ?")) return;
        await clientSupabase.from("notes").delete().eq("id", bouton.dataset.supprimerNote);
        await rendreNotes();
        await rendreAccueil();
      });
    });
  }
}

function reinitialiserFormulaireNote() {
  document.getElementById("titre-formulaire-note").textContent = "Ajouter une note";
  document.getElementById("formulaire-note").reset();
  document.getElementById("note-id").value = "";
  document.getElementById("note-date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("bouton-note-valider").textContent = "Enregistrer la note";
  document.getElementById("bouton-note-annuler").classList.add("hidden");
}

// ------------------------------------------------------------
// Devoirs
// ------------------------------------------------------------

async function rendreDevoirs() {
  const conteneur = document.getElementById("contenu-devoirs");

  if (utilisateur.type === "eleve") {
    document.getElementById("sous-titre-devoirs").textContent = "Le travail à préparer, toutes matières confondues.";

    const { data: devoirs } = await clientSupabase
      .from("devoirs").select("*").order("date_rendu", { ascending: true });

    conteneur.innerHTML = `<div class="grille-devoirs">` +
      ((devoirs && devoirs.length) ? devoirs.map((d) => `
        <div class="carte-devoir">
          <span class="matiere-tag">${d.matiere}</span>
          <h4>${d.titre}</h4>
          <p>${d.description || ""}</p>
          <div class="echeance">Pour le ${formatDate(d.date_rendu)}</div>
        </div>
      `).join("") : `<div class="vide">Aucun devoir pour le moment.</div>`)
      + `</div>`;

  } else {
    document.getElementById("sous-titre-devoirs").textContent =
      `Créez et gérez les devoirs de ${utilisateur.matiere}.`;

    const { data: devoirs } = await clientSupabase
      .from("devoirs").select("*").eq("professeur_id", utilisateur.id)
      .order("date_rendu", { ascending: true });

    conteneur.innerHTML = `
      <div class="formulaire-edition">
        <h3 id="titre-formulaire-devoir">Ajouter un devoir</h3>
        <form id="formulaire-devoir">
          <input type="hidden" id="devoir-id">
          <div class="ligne-formulaire" style="margin-bottom:12px;">
            <div class="champ" style="margin-bottom:0;">
              <label for="devoir-titre">Intitulé</label>
              <input type="text" id="devoir-titre" placeholder="Exercices - Chapitre 5" required>
            </div>
            <div class="champ" style="margin-bottom:0;">
              <label for="devoir-date">À rendre pour le</label>
              <input type="date" id="devoir-date" required>
            </div>
          </div>
          <div class="champ">
            <label for="devoir-description">Description</label>
            <textarea id="devoir-description" rows="2"></textarea>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="submit" class="bouton bouton-principal" id="bouton-devoir-valider" style="width:auto;">Enregistrer le devoir</button>
            <button type="button" class="bouton bouton-secondaire hidden" id="bouton-devoir-annuler">Annuler</button>
          </div>
        </form>
      </div>

      <div class="grille-devoirs" id="grille-devoirs-prof">
        ${(devoirs && devoirs.length) ? devoirs.map((d) => `
          <div class="carte-devoir">
            <span class="matiere-tag">${d.matiere}</span>
            <h4>${d.titre}</h4>
            <p>${d.description || ""}</p>
            <div class="echeance">Pour le ${formatDate(d.date_rendu)}</div>
            <div class="actions-carte">
              <button class="icone-bouton" data-editer-devoir="${d.id}">Modifier</button>
              <button class="icone-bouton supprimer" data-supprimer-devoir="${d.id}">Supprimer</button>
            </div>
          </div>
        `).join("") : `<div class="vide">Aucun devoir créé pour le moment.</div>`}
      </div>
    `;

    const devoirsParId = {};
    (devoirs || []).forEach((d) => (devoirsParId[d.id] = d));

    document.getElementById("formulaire-devoir").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("devoir-id").value;
      const enregistrement = {
        professeur_id: utilisateur.id,
        matiere: utilisateur.matiere,
        titre: document.getElementById("devoir-titre").value.trim(),
        description: document.getElementById("devoir-description").value.trim() || null,
        date_rendu: document.getElementById("devoir-date").value,
      };
      if (id) {
        await clientSupabase.from("devoirs").update(enregistrement).eq("id", id);
      } else {
        await clientSupabase.from("devoirs").insert(enregistrement);
      }
      await rendreDevoirs();
      await rendreAccueil();
    });

    document.getElementById("bouton-devoir-annuler").addEventListener("click", () => reinitialiserFormulaireDevoir());

    document.querySelectorAll("[data-editer-devoir]").forEach((bouton) => {
      bouton.addEventListener("click", () => {
        const d = devoirsParId[bouton.dataset.editerDevoir];
        document.getElementById("titre-formulaire-devoir").textContent = "Modifier le devoir";
        document.getElementById("devoir-id").value = d.id;
        document.getElementById("devoir-titre").value = d.titre;
        document.getElementById("devoir-date").value = d.date_rendu;
        document.getElementById("devoir-description").value = d.description || "";
        document.getElementById("bouton-devoir-valider").textContent = "Enregistrer les modifications";
        document.getElementById("bouton-devoir-annuler").classList.remove("hidden");
        document.getElementById("formulaire-devoir").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    document.querySelectorAll("[data-supprimer-devoir]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        if (!confirm("Supprimer définitivement ce devoir ?")) return;
        await clientSupabase.from("devoirs").delete().eq("id", bouton.dataset.supprimerDevoir);
        await rendreDevoirs();
        await rendreAccueil();
      });
    });
  }
}

function reinitialiserFormulaireDevoir() {
  document.getElementById("titre-formulaire-devoir").textContent = "Ajouter un devoir";
  document.getElementById("formulaire-devoir").reset();
  document.getElementById("devoir-id").value = "";
  document.getElementById("bouton-devoir-valider").textContent = "Enregistrer le devoir";
  document.getElementById("bouton-devoir-annuler").classList.add("hidden");
}


async function rendreEmploiDuTemps() {
  const conteneur = document.getElementById("contenu-emploi-du-temps");
  if (!conteneur) return;
  const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
  let requete = clientSupabase.from("emplois_du_temps").select("*").order("jour").order("heure_debut");
  if (utilisateur.type === "professeur") {
    requete = requete.eq("professeur_id", utilisateur.id);
    document.getElementById("sous-titre-emploi-du-temps").textContent = "Vos cours et salles, par jour.";
  } else {
    if (!utilisateur.classe) {
      conteneur.innerHTML = '<div class="vide">Aucune classe n’est associée à ce compte.</div>';
      return;
    }
    requete = requete.eq("classe", utilisateur.classe);
    document.getElementById("sous-titre-emploi-du-temps").textContent = "Classe " + utilisateur.classe;
  }
  const { data, error } = await requete;
  if (error) {
    conteneur.innerHTML = '<div class="message-erreur">Impossible de charger l’emploi du temps. Vérifiez que la migration Supabase a été appliquée.</div>';
    return;
  }
  if (!data || !data.length) {
    conteneur.innerHTML = '<div class="vide">Aucun cours planifié pour le moment.</div>';
    return;
  }
  conteneur.innerHTML = jours.map((jour, index) => {
    const cours = data.filter(c => c.jour === index + 1);
    if (!cours.length) return "";
    return '<section class="bloc-matiere"><div class="titre-matiere"><h3>' + jour + '</h3></div>' +
      '<div class="grille-devoirs">' + cours.map(c => {
        const prof = nomComplet(utilisateurParId(c.professeur_id));
        return '<article class="carte-devoir"><span class="matiere-tag">' + c.heure_debut.slice(0,5) + ' – ' + c.heure_fin.slice(0,5) + '</span><h4>' + c.matiere + '</h4><p>' + (utilisateur.type === "professeur" ? (c.classe || "") : prof) + '</p><div class="echeance">' + (c.salle || "Salle à préciser") + '</div></article>';
      }).join("") + '</div></section>';
  }).join("") || '<div class="vide">Aucun cours cette semaine.</div>';
}

// ------------------------------------------------------------
// Messagerie
// ------------------------------------------------------------

function remplirSelectDestinataire() {
  const select = document.getElementById("destinataire-message");
  const autres = annuaire.filter((u) => u.id !== utilisateur.id && (utilisateur.type === "professeur" || u.type === "professeur"));
  const options = [];

  options.push(...autres.map((u) => {
    const role = u.type === "professeur" ? `Professeur · ${u.matiere}` : "Élève";
    return `<option value="${u.id}">${nomComplet(u)} — ${role}</option>`;
  }));
  select.innerHTML = options.join("");
}

async function rendreMessagerie() {
  const { data: messages } = await clientSupabase
    .from("messages")
    .select("*")
    .or(`destinataire_id.eq.${utilisateur.id},destinataire_id.is.null,expediteur_id.eq.${utilisateur.id}`)
    .order("created_at", { ascending: true });

  const fil = document.getElementById("fil-messages");

  if (!messages || !messages.length) {
    fil.innerHTML = `<div class="vide">Aucun message pour le moment.</div>`;
  } else {
    fil.innerHTML = messages.map((m) => {
      const envoyeParMoi = m.expediteur_id === utilisateur.id;
      const expediteur = utilisateurParId(m.expediteur_id);
      const destinataireLabel = m.destinataire_id
        ? nomComplet(utilisateurParId(m.destinataire_id))
        : "toute la classe";
      return `
        <div class="message ${envoyeParMoi ? "envoye" : ""}">
          <div class="entete-message">
            <span>${envoyeParMoi ? "Vous" : nomComplet(expediteur)} → ${envoyeParMoi ? destinataireLabel : (m.destinataire_id ? "vous" : "toute la classe")}</span>
            <span>${formatDateCourte(m.created_at)}</span>
          </div>
          <div class="contenu-message">${m.contenu}</div>
        </div>
      `;
    }).join("");
    fil.scrollTop = fil.scrollHeight;
  }

  // Marquer comme lus les messages reçus non lus
  const nonLus = (messages || []).filter(
    (m) => m.destinataire_id === utilisateur.id && !m.lu && m.expediteur_id !== utilisateur.id
  );
  if (nonLus.length) {
    await clientSupabase.from("messages").update({ lu: true }).in("id", nonLus.map((m) => m.id));
  }
}

async function envoyerMessage(e) {
  e.preventDefault();
  const destinataireId = document.getElementById("destinataire-message").value || null;
  const contenu = document.getElementById("contenu-message").value.trim();
  if (!contenu) return;

  await clientSupabase.from("messages").insert({
    expediteur_id: utilisateur.id,
    destinataire_id: destinataireId,
    contenu,
  });

  document.getElementById("formulaire-message").reset();
  remplirSelectDestinataire();
  await rendreMessagerie();
}

// ------------------------------------------------------------
// Initialisation générale
// ------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  initialiserOnglets();

  document.getElementById("formulaire-connexion").addEventListener("submit", async (e) => {
    e.preventDefault();
    masquerErreurConnexion();
    const identifiant = document.getElementById("champ-identifiant").value;
    const motDePasse = document.getElementById("champ-mot-de-passe").value;
    const bouton = document.getElementById("bouton-connexion");
    bouton.disabled = true;
    bouton.textContent = "Connexion en cours…";
    await tenterConnexion(identifiant, motDePasse);
    bouton.disabled = false;
    bouton.textContent = "Se connecter";
  });

  document.getElementById("bouton-deconnexion").addEventListener("click", deconnecter);
  document.getElementById("formulaire-message").addEventListener("submit", envoyerMessage);

  const sessionSauvegardee = localStorage.getItem(CLE_SESSION);
  if (sessionSauvegardee) {
    try {
      utilisateur = JSON.parse(sessionSauvegardee);
      await demarrerApplication();
    } catch {
      localStorage.removeItem(CLE_SESSION);
    }
  }
});