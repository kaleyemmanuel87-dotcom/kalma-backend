const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Suivre un utilisateur
router.post('/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;

  if (userId === req.userId) {
    return res.status(400).json({ error: 'Tu ne peux pas te suivre toi-même' });
  }

  try {
    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
      [req.userId, userId]
    );
    res.status(201).json({ message: 'Utilisateur suivi' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Tu suis déjà cet utilisateur' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ne plus suivre
router.delete('/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 RETURNING follower_id',
      [req.userId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tu ne suivais pas cet utilisateur' });
    }

    res.json({ message: 'Utilisateur non suivi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les abonnés d'un utilisateur
router.get('/:userId/followers', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT users.id, users.username, users.avatar_url
       FROM follows
       JOIN users ON users.id = follows.follower_id
       WHERE follows.following_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les utilisateurs suivis par un utilisateur
router.get('/:userId/following', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT users.id, users.username, users.avatar_url
       FROM follows
       JOIN users ON users.id = follows.following_id
       WHERE follows.follower_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
