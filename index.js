// index.js
const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');

// 📦 Environment setup
const PORT = process.env.PORT || 8000;
require('events').EventEmitter.defaultMaxListeners = 500;

// 📂 Load pairing route
const code = require('./pair');

// ✅ Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Static assets (CSS, JS, images)
app.use(express.static(path.join(__dirname)));

// ✅ API routes
app.use('/code', code);

// ✅ HTML routes
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).send('Something broke on the server!');
});

// ✅ 404 Handler
app.use((req, res) => {
  res.status(404).send('404 - Page not found 😢');
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`\n🌐 NAPPIER-XMD Session Server running on: http://localhost:${PORT}`);
  console.log('⭐ Don’t forget to star the repo!');
});

module.exports = app;