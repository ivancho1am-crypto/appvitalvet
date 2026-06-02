const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_ANON_KEY || '';

const indexPath = path.join(__dirname, 'public', 'index.html');
let indexTemplate = fs.readFileSync(indexPath, 'utf8');

const configScript = `<script>window.__SB_URL="${SB_URL}";window.__SB_KEY="${SB_KEY}";</script>`;
const indexHtml = indexTemplate.replace('</head>', configScript + '\n</head>');

app.use(express.static(path.join(__dirname, 'public')));

// Explicit route for estadisticas dashboard
app.get('/estadisticas.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname, 'public', 'estadisticas.html'));
});

// SPA fallback — serve index.html for all other routes
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(indexHtml);
});

app.listen(PORT, () => {
  console.log(`VitalVet corriendo en http://localhost:${PORT}`);
});
