const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// 1. POSTER UNE STORY
router.post('/', auth, async (req, res) => {
    const userId = req.user.id;
    const { media_url, type } = req.body; // L'URL du média (image/vidéo) stocké sur Cloudinary/Supabase Storage

    if (!media_url) {
        return res.status(400).json({ error: "L'URL du média est obligatoire pour une story." });
    }

    try {
        const newStory = await pool.query(
            'INSERT INTO stories (user_id, media_url, type) VALUES ($1, $2, $3) RETURNING *',
            [userId, media_url, type || 'image']
        );
        res.json({ message: "Story publiée !", data: newStory.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors de la publication de la story");
    }
});

// 2. RÉCUPÉRER LES STORIES DES PERSONNES QU'ON SUIT (Moins de 24h & non bloquées)
router.get('/feed', auth, async (req, res) => {
    const userId = req.user.id;

    try {
        // Requête SQL magique : 
        // - On cherche les stories créées il y a moins d'un jour (now() - INTERVAL '1 day')
        // - Des utilisateurs que l'on suit (status = 'accepted')
        // - En vérifiant qu'il n'y a aucun blocage mutuel entre nous
        const storiesFeed = await pool.query(
            `SELECT s.*, u.username, u.avatar_url 
             FROM stories s
             JOIN users u ON s.user_id = u.id
             JOIN follows f ON f.following_id = s.user_id
             WHERE f.follower_id = $1 
               AND f.status = 'accepted'
               AND s.created_at >= now() - INTERVAL '1 day'
               AND NOT EXISTS (
                   SELECT 1 FROM blocks b 
                   WHERE (b.blocker_id = $1 AND b.blocked_id = s.user_id)
                      OR (b.blocker_id = s.user_id AND b.blocked_id = $1)
               )
             ORDER BY s.created_at DESC`,
            [userId]
        );

        res.json(storiesFeed.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors de la récupération des stories");
    }
});

// 3. SUPPRIMER SA PROPRE STORY (Si on change d'avis avant les 24h)
router.delete('/:id', auth, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const storyCheck = await pool.query('SELECT user_id FROM stories WHERE id = $1', [id]);

        if (storyCheck.rows.length === 0) {
            return res.status(404).json({ error: "Story introuvable." });
        }

        if (storyCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ error: "Action non autorisée." });
        }

        await pool.query('DELETE FROM stories WHERE id = $1', [id]);
        res.json({ message: "Story supprimée avec succès." });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur");
    }
});

module.exports = router;