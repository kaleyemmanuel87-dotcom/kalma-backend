const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// Liker un post
router.post('/', requireAuth, async (req, res) => {
  const { postId } = req.params;

  try {
    await pool.query(
      'INSERT INTO likes (post_id, user_id) VALUES ($1, $2)',
      [postId, req.userId]
    );
    res.status(201).json({ message: 'Post liké' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Tu as déjà liké ce post' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Retirer son like
router.delete('/', requireAuth, async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM likes WHERE post_id = $1 AND user_id = $2 RETURNING id',
      [postId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tu n'avais pas liké ce post" });
    }

    res.json({ message: 'Like retiré' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
