const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

// Note: lodash is imported but never used after this comment
// This simulates an unused dependency

app.listen(3000);