require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');  // Import body-parser for size limit
const multer = require('multer');           // Import multer for file upload handling

const app = express();
const PORT = process.env.PORT || 8080;


// 1. Built-in / third-party middleware
app.use(cors());                   // enable CORS
app.use(express.json({ limit: '10mb' }));  // Increase limit for JSON payloads (adjust as needed)
app.use(express.urlencoded({ limit: '10mb', extended: true })); // Increase limit for URL-encoded payloads
app.use('/images', express.static('public/images'));  // Serve images from 'public/images'

// 2. API-Key middleware (runs before your routes)
app.use((req, res, next) => {
  const clientKey = req.headers['x-api-key'];
  if (!clientKey || clientKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
  }
  next();
});

// 3. Set up multer to store uploaded images in the 'public/images' folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images'); // Store files in the 'public/images' folder
  },
  filename: (req, file, cb) => {
    // Generate a unique file name based on the current timestamp
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Set file size limit to 10MB
});

// 4. Mount your routes
const workDiaryRoutes = require('./routes/workDiary');
app.use('/api/workdiary', workDiaryRoutes);

// 5.5. Redirect /ma/backend to workDiary handler
const workDiaryHandler = require('./routes/workDiary');
app.use('/ma/backend', workDiaryHandler);


// 5. (Optional) root route
app.get('/', (req, res) => res.send('Employee Monitoring API is running'));


// 6. Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});

