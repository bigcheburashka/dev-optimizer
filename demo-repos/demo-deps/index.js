// Only express is actually used
const express = require('express');
const app = express();

// Note: lodash, moment, axios, underscore, request, left-pad are NOT imported
// These are unused dependencies for demo purposes

app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello Deps!',
    timestamp: Date.now() // Using native Date, not moment
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});