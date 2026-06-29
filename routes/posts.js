const express = require('express');
const router = express.Router();
const pool = require('../db'); // Ton fichier de connexion Supabase
const auth = require('../middleware/auth'); // Ton middleware de protection JWT

// 1. RÉCUPÉRER LES POSTS D'UN UTILISATEUR AVEC TRI (Public ou Privé selon filtres)
// Exemple : /api/posts/user/ID_UTILISATEUR?sort=popular (ou recent, ou old)
router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { sort } = query; // Récupère le paramètre ?sort=
    
    let orderBy = 'created_at DESC'; // Par défaut : récent
    if (sort === 'old') orderBy = 'created_at ASC';
    if (sort === 'popular') orderBy = 'views_count DESC';

    try {
        const result = await pool.query(
            `SELECT p.*, u.username, u.avatar_url 
             FROM posts p
             JOIN users u ON p.user_id = u.id
             WHERE p.user_id = $1
             ORDER BY ${orderBy}`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors de la récupération des posts");
    }
});

-- 2. INCREMENTER LES VUES (À appeler dès qu'un utilisateur clique/voit un post)
router.patch('/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('UPDATE posts SET views_count = views_count + 1 WHERE id = $1', [id]);
        res.json({ message: "Vue enregistrée" });
    } catch (err) {
        res.status(500).send("Erreur serveur");
    }
});

// 3. SUPPRIMER UN POST (Sécurisé : Seul l'auteur peut le supprimer)
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id; // Récupéré grâce au Token JWT

        // Vérifier si le post appartient bien à l'utilisateur connecté
        const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
        
        if (postCheck.rows.length === 0) {
            return res.status(404).json({ error: "Post introuvable" });
        }

        if (postCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ error: "Action non autorisée (Ce n'est pas votre publication)" });
        }

        // Suppression (Grace au ON DELETE CASCADE, les likes et coms associés sautent aussi !)
        await pool.query('DELETE FROM posts WHERE id = $1', [id]);
        res.json({ message: "Publication supprimée avec succès !" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors de la suppression");
    }
});
// 4. CRÉER UN POST MULTI-MÉDIAS (CARROUSEL STYLE INSTAGRAM)
router.post('/carousel', auth, async (req, res) => {
    const userId = req.user.id;
    const { content, medias } = req.body; // medias doit être un tableau ex: [{url: '...', type: 'image'}, {url: '...', type: 'video'}]

    if (!medias || !Array.isArray(medias) || medias.length === 0) {
        return res.status(400).json({ error: "Un post carrousel nécessite au moins un média." });
    }

    try {
        // 1. Créer le post principal
        const mainPost = await pool.query(
            'INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *',
            [userId, content || '']
        );
        const postId = mainPost.rows[0].id;

        // 2. Insérer tous les médias en boucle avec leur position
        const mediaPromises = medias.map((media, index) => {
            return pool.query(
                'INSERT INTO post_medias (post_id, media_url, media_type, position) VALUES ($1, $2, $3, $4)',
                [postId, media.url, media.type || 'image', index]
            );
        });
        await Promise.all(mediaPromises);

        res.json({ message: "Post carrousel publié avec succès !", postId });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors de la création du carrousel");
    }
});
// 5. ENREGISTRER OU RETIRER UN POST DES SIGNETS (BOOKMARKS)
router.post('/:id/bookmark', auth, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params; // L'id du post à sauvegarder

    try {
        // Vérifier si le post est déjà enregistré
        const checkSave = await pool.query(
            'SELECT * FROM saved_posts WHERE user_id = $1 AND post_id = $2',
            [userId, id]
        );

        if (checkSave.rows.length > 0) {
            // Déjà enregistré -> On le retire (Unbookmark)
            await pool.query(
                'DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2',
                [userId, id]
            );
            return res.json({ status: "unsaved", message: "Publication retirée de vos enregistrements." });
        }

        // Sinon, on l'enregistre
        await pool.query(
            'INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2)',
            [userId, id]
        );
        res.json({ status: "saved", message: "Publication enregistrée dans vos signets !" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur");
    }
});

// 6. RÉCUPÉRER LA LISTE DE NOS POSTS ENREGISTRÉS (Pour l'onglet privé du profil)
router.get('/my-bookmarks', auth, async (req, res) => {
    const userId = req.user.id;

    try {
        const savedList = await pool.query(
            `SELECT p.*, u.username, u.avatar_url 
             FROM saved_posts s
             JOIN posts p ON s.post_id = p.id
             JOIN users u ON p.user_id = u.id
             WHERE s.user_id = $1
             ORDER BY s.saved_at DESC`,
            [userId]
        );
        res.json(savedList.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur");
    }
});

module.exports = router;