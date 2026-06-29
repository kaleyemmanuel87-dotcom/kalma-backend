const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Envoyer un message à un utilisateur
router.post('/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Le contenu du message est requis' });
  }

  if (userId === req.userId) {
    return res.status(400).json({ error: "Tu ne peux pas t'envoyer un message à toi-même" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, receiver_id, content, is_read, created_at`,
      [req.userId, userId, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer la conversation avec un utilisateur (et marquer les messages reçus comme lus)
router.get('/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, sender_id, receiver_id, content, is_read, created_at
       FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [req.userId, userId]
    );

    await pool.query(
      `UPDATE messages SET is_read = true
       WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false`,
      [userId, req.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
