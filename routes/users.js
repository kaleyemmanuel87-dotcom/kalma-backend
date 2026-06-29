const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');

const router = express.Router();

// Profil public d'un utilisateur
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, username, bio, avatar_url, is_verified, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Posts publiés par un utilisateur précis (vue "profil", comme la grille Instagram)
router.get('/:userId/posts', async (req, res) => {
  const { userId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const result = await pool.query(
      `SELECT posts.id, posts.content, posts.image_url, posts.created_at,
              COALESCE(likes_count.count, 0) AS likes_count,
              COALESCE(comments_count.count, 0) AS comments_count
       FROM posts
       LEFT JOIN (
         SELECT post_id, COUNT(*) AS count FROM likes GROUP BY post_id
       ) likes_count ON likes_count.post_id = posts.id
       LEFT JOIN (
         SELECT post_id, COUNT(*) AS count FROM comments GROUP BY post_id
       ) comments_count ON comments_count.post_id = posts.id
       WHERE posts.user_id = $1
       ORDER BY posts.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Certifier (ou retirer la certification d'un) compte - réservé aux admins
router.patch('/:userId/verify', requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { verified } = req.body;

  if (typeof verified !== 'boolean') {
    return res.status(400).json({ error: 'Le champ "verified" doit être true ou false' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET is_verified = $1 WHERE id = $2
       RETURNING id, username, is_verified`,
      [verified, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
