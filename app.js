require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const likesRoutes = require('./routes/likes');
const followsRoutes = require('./routes/follows');
const commentsRoutes = require('./routes/comments');
const messagesRoutes = require('./routes/messages');
const usersRoutes = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/posts/:postId/like', likesRoutes);
app.use('/api/posts/:postId/comments', commentsRoutes);
app.use('/api/follows', followsRoutes);
app.use('/api/messages', require('./routes/messages'));
app.use('/api/users', usersRoutes);
app.use('/api/posts', require('./routes/posts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/', (req, res) => {
  res.json({ message: 'API réseau social en ligne' });
});

module.exports = app;
