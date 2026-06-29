const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// Ajouter un commentaire
router.post('/', requireAuth, async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Le contenu du commentaire est requis' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO comments (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, content, created_at`,
      [postId, req.userId, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les commentaires d'un post
router.get('/', async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await pool.query(
      `SELECT comments.id, comments.content, comments.created_at,
              users.id AS author_id, users.username AS author_username
       FROM comments
       JOIN users ON users.id = comments.user_id
       WHERE comments.post_id = $1
       ORDER BY comments.created_at ASC`,
      [postId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un commentaire (seulement son auteur)
router.delete('/:commentId', requireAuth, async (req, res) => {
  const { commentId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id',
      [commentId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Commentaire introuvable ou tu n'es pas l'auteur" });
    }

    res.json({ message: 'Commentaire supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
