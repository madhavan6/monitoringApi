require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Built-in / third-party middleware
app.use(cors());                   // enable CORS
app.use(express.json());           // parse JSON bodies

// 2. API-Key middleware (runs before your routes)
app.use((req, res, next) => {
  const clientKey = req.headers['x-api-key'];
  if (!clientKey || clientKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
  }
  next();
});

// 3. Mount your routes
const workDiaryRoutes = require('./routes/workDiary');
app.use('/api/workdiary', workDiaryRoutes);

// 4. (Optional) root route
app.get('/', (req, res) => res.send('Employee Monitoring API is running'));

// 5. Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
