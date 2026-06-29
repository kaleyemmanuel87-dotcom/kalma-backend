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
// 1. CHANGER LA CONFIDENTIALITÉ DU COMPTE (Passer en privé ou public)
router.patch('/privacy', auth, async (req, res) => {
    const { is_private } = req.body; // true ou false
    const userId = req.user.id;

    try {
        await pool.query(
            'UPDATE users SET is_private = $1 WHERE id = $2',
            [is_private, userId]
        );
        res.json({ message: `Compte passé en ${is_private ? 'privé' : 'public'}.` });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur");
    }
});

// 2. S'ABONNER / SE DÉSABONNER / DEMANDE EN ATTENTE
router.post('/follow/:targetId', auth, async (req, res) => {
    const followerId = req.user.id; // Toi
    const { targetId } = req.params; // La personne que tu veux suivre

    if (followerId === targetId) {
        return res.status(400).json({ error: "Vous ne pouvez pas vous suivre vous-même" });
    }

    try {
        // Vérifier si la cible est un compte privé
        const targetCheck = await pool.query('SELECT is_private FROM users WHERE id = $1', [targetId]);
        if (targetCheck.rows.length === 0) {
            return res.status(404).json({ error: "Utilisateur introuvable" });
        }

        const isPrivate = targetCheck.rows[0].is_private;

        // Vérifier si on suit déjà
        const followCheck = await pool.query(
            'SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2',
            [followerId, targetId]
        );

        if (followCheck.rows.length > 0) {
            // Si on suit déjà, l'action "Re-cliquer" signifie : SE DÉSABONNER
            await pool.query(
                'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
                [followerId, targetId]
            );
            return res.json({ status: "unfollowed", message: "Vous vous êtes désabonné." });
        }

        // Sinon, on crée la relation
        // Si le compte est privé -> statut 'pending' (en attente), si public -> 'accepted'
        const initialStatus = isPrivate ? 'pending' : 'accepted';
        
        await pool.query(
            'INSERT INTO follows (follower_id, following_id, status) VALUES ($1, $2, $3)',
            [followerId, targetId, initialStatus]
        );

        res.json({ 
            status: initialStatus, 
            message: isPrivate ? "Demande d'abonnement envoyée." : "Vous suivez maintenant cet utilisateur." 
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur");
    }
    // Déclencher la notification de follow (si accepté directement)
if (initialStatus === 'accepted') {
    await pool.query(
        'INSERT INTO notifications (sender_id, receiver_id, type, target_id) VALUES ($1, $2, $3, $4)',
        [followerId, targetId, 'follow', followerId]
    );
}
});

// 3. SUPPRIMER DÉFINITIVEMENT SON COMPTE
router.delete('/delete-account', auth, async (req, res) => {
    const userId = req.user.id;

    try {
        // La magie du ON DELETE CASCADE configuré au début va supprimer automatiquement
        // tous les posts, commentaires, likes, messages et abonnements de cet id.
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        
        res.json({ message: "Votre compte et toutes vos données ont été définitivement supprimés." });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors de la suppression du compte");
    }
});
// 5. BLOQUER OU DÉBLOQUER UN UTILISATEUR
router.post('/block/:targetId', auth, async (req, res) => {
    const blockerId = req.user.id; // Toi
    const { targetId } = req.params; // La personne à bloquer

    if (blockerId === targetId) {
        return res.status(400).json({ error: "Vous ne pouvez pas vous bloquer vous-même." });
    }

    try {
        // Vérifier si le blocage existe déjà
        const blockCheck = await pool.query(
            'SELECT * FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
            [blockerId, targetId]
        );

        if (blockCheck.rows.length > 0) {
            // S'il est déjà bloqué, l'action inverse : DÉBLOQUER
            await pool.query(
                'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
                [blockerId, targetId]
            );
            return res.json({ status: "unblocked", message: "Utilisateur débloqué." });
        }

        // Sinon, on le bloque
        await pool.query(
            'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)',
            [blockerId, targetId]
        );

        // 💡 BONUS STYLE INSTAGRAM : Quand on bloque quelqu'un, on le supprime automatiquement de nos abonnés/abonnements mutuels
        await pool.query(
            `DELETE FROM follows 
             WHERE (follower_id = $1 AND following_id = $2) 
                OR (follower_id = $2 AND following_id = $1)`,
            [blockerId, targetId]
        );

        res.json({ status: "blocked", message: "Utilisateur bloqué et abonnements annulés." });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors du blocage");
    }
});

// 6. RÉCUPÉRER LA LISTE DES PERSONNES QU'ON A BLOQUÉES (Pour la page Paramètres > Comptes bloqués)
router.get('/blocked-list', auth, async (req, res) => {
    try {
        const list = await pool.query(
            `SELECT b.blocked_id, u.username, u.avatar_url 
             FROM blocks b
             JOIN users u ON b.blocked_id = u.id
             WHERE b.blocker_id = $1`,
            [req.user.id]
        );
        res.json(list.rows);
    } catch (err) {
        res.status(500).send("Erreur serveur");
    }
});
module.exports = router;