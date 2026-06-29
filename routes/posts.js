const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Créer un post (protégé)
router.post('/', requireAuth, async (req, res) => {
  const { content, image_url } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Le contenu du post est requis' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO posts (user_id, content, image_url)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, content, image_url, created_at`,
      [req.userId, content, image_url || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les posts (fil d'actualité simple, tous les posts triés par date)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT posts.id, posts.content, posts.image_url, posts.created_at,
              users.id AS author_id, users.username AS author_username, users.avatar_url AS author_avatar
       FROM posts
       JOIN users ON users.id = posts.user_id
       ORDER BY posts.created_at DESC
       LIMIT 50`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer un post précis avec ses commentaires et son nombre de likes
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const postResult = await pool.query(
      `SELECT posts.id, posts.content, posts.image_url, posts.created_at,
              users.id AS author_id, users.username AS author_username
       FROM posts
       JOIN users ON users.id = posts.user_id
       WHERE posts.id = $1`,
      [id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post introuvable' });
    }

    const likesResult = await pool.query(
      'SELECT COUNT(*) FROM likes WHERE post_id = $1',
      [id]
    );

    const commentsResult = await pool.query(
      `SELECT comments.id, comments.content, comments.created_at,
              users.username AS author_username
       FROM comments
       JOIN users ON users.id = comments.user_id
       WHERE comments.post_id = $1
       ORDER BY comments.created_at ASC`,
      [id]
    );

    res.json({
      ...postResult.rows[0],
      likes_count: parseInt(likesResult.rows[0].count, 10),
      comments: commentsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un post (seulement son auteur)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post introuvable ou tu n'es pas l'auteur" });
    }

    res.json({ message: 'Post supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
