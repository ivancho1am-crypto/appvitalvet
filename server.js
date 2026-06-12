const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_ANON_KEY || '';

const configScript = `<script>window.__SB_URL="${SB_URL}";window.__SB_KEY="${SB_KEY}";</script>`;

const indexPath = path.join(__dirname, 'public', 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8').replace('</head>', configScript + '\n</head>');

const estadPath = path.join(__dirname, 'public', 'estadisticas.html');
const estadHtml = fs.readFileSync(estadPath, 'utf8').replace('</head>', configScript + '\n</head>');

// Security headers — panel admin is internal, never indexed
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Estadisticas dashboard — servir con variables inyectadas
app.get('/estadisticas.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(estadHtml);
});

// SPA fallback — serve index.html for all other routes
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(indexHtml);
});

app.listen(PORT, () => {
  console.log(`VitalVet corriendo en http://localhost:${PORT}`);
});
