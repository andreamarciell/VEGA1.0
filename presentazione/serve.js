const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 TopperyAML Presentation server running at http://localhost:${port}`);
  console.log(`📊 Open your browser and navigate to the URL above`);
});
