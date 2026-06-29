const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// 1. ENVOYER UN MESSAGE (1-à-1 ou dans un groupe)
router.post('/send', auth, async (req, res) => {
    const senderId = req.user.id;
    // receiver_id pour un DM classique, group_id si c'est un message de groupe
    const { receiver_id, group_id, content } = req.body; 

    if (!content || content.trim() === "") {
        return res.status(400).json({ error: "Le contenu du message ne peut pas être vide." });
    }

    try {
        // Si c'est un message de groupe, on pourrait plus tard vérifier si l'utilisateur fait partie du groupe
        const newMessage = await pool.query(
            `INSERT INTO messages (sender_id, receiver_id, content, created_at) 
             VALUES ($1, $2, $3, now()) 
             RETURNING *`,
            [senderId, receiver_id || null, content]
        );

        res.json({ message: "Message envoyé !", data: newMessage.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors de l'envoi du message");
    }
    // --- ZONE DE SÉCURITÉ : VÉRIFICATION DES BLOCAGES ---
if (receiver_id) {
    const blockCheck = await pool.query(
        `SELECT * FROM blocks 
         WHERE (blocker_id = $1 AND blocked_id = $2) 
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [senderId, receiver_id]
    );

    if (blockCheck.rows.length > 0) {
        return res.status(403).json({ error: "Envoi impossible. Vous avez bloqué cet utilisateur ou vous avez été bloqué." });
    }
}
// -----------------------------------------------------
});

// 2. RÉCUPÉRER L'HISTORIQUE DE DISCUSSION ENTRE DEUX UTILISATEURS (DM 1-à-1)
router.get('/conversation/:otherUserId', auth, async (req, res) => {
    const userId = req.user.id;
    const { otherUserId } = req.params;

    try {
        // Récupère tous les messages envoyés par userId à otherUserId ET vice-versa, triés par date
        const history = await pool.query(
            `SELECT m.*, u.username as sender_name 
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE (m.sender_id = $1 AND m.receiver_id = $2)
                OR (m.sender_id = $2 AND m.receiver_id = $1)
             ORDER BY m.created_at ASC`,
            [userId, otherUserId]
        );

        // On marque automatiquement les messages reçus comme "lus" (is_read = true)
        await pool.query(
            `UPDATE messages SET is_read = true 
             WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false`,
            [otherUserId, userId]
        );

        res.json(history.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors de la récupération de la conversation");
    }
});

// 3. SUPPRIMER UN MESSAGE (Pour tout le monde - "Unsend" comme sur Insta)
router.delete('/:messageId', auth, async (req, res) => {
    const userId = req.user.id;
    const { messageId } = req.params;

    try {
        // On vérifie d'abord si le message existe et s'il a bien été envoyé par l'utilisateur connecté
        const messageCheck = await pool.query('SELECT sender_id FROM messages WHERE id = $1', [messageId]);

        if (messageCheck.rows.length === 0) {
            return res.status(404).json({ error: "Message introuvable." });
        }

        if (messageCheck.rows[0].sender_id !== userId) {
            return res.status(403).json({ error: "Action non autorisée. Vous ne pouvez supprimer que vos propres messages." });
        }

        // Suppression du message
        await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
        res.json({ message: "Message supprimé / annulé avec succès !" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erreur serveur lors de la suppression");
    }
});

module.exports = router;