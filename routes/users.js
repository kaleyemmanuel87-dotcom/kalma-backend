const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth'); // Pour savoir si le visiteur est abonné ou non

// RÉCUPÉRER UN PROFIL COMPLET (Style Insta/TikTok)
router.get('/profile/:username', async (req, res) => {
    const { username } = req.params;

    try {
        // 1. Récupérer les infos de base de l'utilisateur et son statut privé
        const userQuery = await pool.query(
            'SELECT id, username, bio, avatar_url, is_private, created_at FROM users WHERE username = $1',
            [username]
        );

        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: "Utilisateur introuvable" });
        }

        const user = userQuery.rows[0];

        // 2. Compter les Followers (Abonnés)
        const followersQuery = await pool.query(
            "SELECT COUNT(*) FROM follows WHERE following_id = $1 AND status = 'accepted'",
            [user.id]
        );

        // 3. Compter les Followings (Abonnements)
        const followingQuery = await pool.query(
            "SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND status = 'accepted'",
            [user.id]
        );

        // 4. Compter le nombre total de J'aime (Likes) reçus sur tous ses posts (Très style TikTok !)
        const totalLikesQuery = await pool.query(
            `SELECT COUNT(l.id) FROM likes l 
             JOIN posts p ON l.post_id = p.id 
             WHERE p.user_id = $1`,
            [user.id]
        );

        // Renvoie l'ensemble des données prêtes pour ton design d'interface
        res.json({
            user: {
                id: user.id,
                username: user.username,
                bio: user.bio,
                avatar_url: user.avatar_url,
                is_private: user.is_private,
                created_at: user.created_at
            },
            stats: {
                followers_count: parseInt(followersQuery.rows[0].count),
                following_count: parseInt(followingQuery.rows[0].count),
                total_likes_received: parseInt(totalLikesQuery.rows[0].count)
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors du chargement du profil");
    }
});

module.exports = router;