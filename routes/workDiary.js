const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const upload = multer(); // Store files in memory

// Convert buffer to base64
function toBase64(fileBuffer) {
  return fileBuffer.toString('base64');
}

// Save base64 image to the local file system
function saveBase64Image(base64String, folder = 'public/images') {
  const matches = base64String.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 string');

  const ext = matches[1].split('/')[1];
  const data = matches[2];
  const fileName = `${uuidv4()}.${ext}`;
  const filePath = path.join(folder, fileName);

  // Ensure the folder exists
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  // Write the base64 data to a file
  fs.writeFileSync(filePath, data, { encoding: 'base64' });

  return `/images/${fileName}`; // URL to access the image
}

// Convert image URL to base64 (supports Google Drive)
async function fetchImageAsBase64(imageURL) {
  try {
    let downloadURL = imageURL;

    // Handle different Google Drive URL formats
    if (imageURL.includes('drive.google.com')) {
      const fileIdMatch = imageURL.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
      const fileId = fileIdMatch?.[1];

      if (fileId) {
        downloadURL = `https://drive.google.com/uc?export=download&id=${fileId}`;
      } else {
        throw new Error('Invalid Google Drive link');
      }
    }

    const response = await axios.get(downloadURL, { responseType: 'arraybuffer' });
    return toBase64(response.data);
  } catch (err) {
    console.error('❌ Image fetch error:', err.message);
    throw new Error('Failed to fetch image from URL');
  }
}

// Helper function to format the datetime string into MySQL-compatible format
function formatDatetimeForMySQL(datetime) {
  return datetime.replace('T', ' ').split('.')[0]; // Remove 'Z' and milliseconds
}

// POST route: insert workDiary entry
router.post('/', upload.fields([
  { name: 'screenshot', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      projectID,
      userID,
      taskID,
      screenshotTimeStamp,
      calcTimeStamp,
      keyboardJSON,
      mouseJSON,
      activeJSON,
      activeFlag,
      activeMins,
      deletedFlag,
      activeMemo,
      imageURL,  // base64 string for image
      thumbNailURL // base64 string for thumbnail
    } = req.body;

    // Check if required fields are provided
    if (!projectID || !userID || !taskID || !screenshotTimeStamp || !calcTimeStamp) {
      return res.status(400).json({ error: 'Missing required fields: projectID, userID, taskID, screenshotTimeStamp, or calcTimeStamp' });
    }

    // Format timestamps to MySQL-compatible format
    const screenshotTimeStampFormatted = formatDatetimeForMySQL(screenshotTimeStamp);
    const calcTimeStampFormatted = formatDatetimeForMySQL(calcTimeStamp);

    let imageURLToStore = null;
    let thumbNailURLToStore = null;

    // Screenshot base64 or file
    if (req.files && req.files['screenshot']) {
      const base64 = toBase64(req.files['screenshot'][0].buffer);
      imageURLToStore = saveBase64Image(`data:image/png;base64,${base64}`);
    } else if (imageURL && imageURL.startsWith('data:image')) {
      // If imageURL is base64 string
      const sanitizedImageURL = imageURL.replace(/^data:image\/[a-zA-Z]+;base64,/, ''); // Remove prefix
      imageURLToStore = saveBase64Image(`data:image/png;base64,${sanitizedImageURL}`);
    } else if (imageURL) {
      const base64 = await fetchImageAsBase64(imageURL);
      imageURLToStore = saveBase64Image(`data:image/png;base64,${base64}`);
    }

    // Thumbnail base64 or file
    if (req.files && req.files['thumbnail']) {
      const base64 = toBase64(req.files['thumbnail'][0].buffer);
      thumbNailURLToStore = saveBase64Image(`data:image/png;base64,${base64}`);
    } else if (thumbNailURL && thumbNailURL.startsWith('data:image')) {
      // If thumbNailURL is base64 string
      const sanitizedThumbNailURL = thumbNailURL.replace(/^data:image\/[a-zA-Z]+;base64,/, ''); // Remove prefix
      thumbNailURLToStore = saveBase64Image(`data:image/png;base64,${sanitizedThumbNailURL}`);
    } else if (thumbNailURL) {
      const base64 = await fetchImageAsBase64(thumbNailURL);
      thumbNailURLToStore = saveBase64Image(`data:image/png;base64,${base64}`);
    }

    // Sanitize undefined parameters by replacing them with null
    const sanitizedData = {
      projectID: projectID || null,
      userID: userID || null,
      taskID: taskID || null,
      screenshotTimeStamp: screenshotTimeStampFormatted,  // Use the formatted timestamp
      calcTimeStamp: calcTimeStampFormatted,             // Use the formatted timestamp
      keyboardJSON: tryParseJson(keyboardJSON) || null,
      mouseJSON: tryParseJson(mouseJSON) || null,
      activeJSON: tryParseJson(activeJSON) || null,
      activeFlag: activeFlag || null,
      activeMins: activeMins || null,
      deletedFlag: deletedFlag !== undefined ? deletedFlag : 0, // Default to 0 if not provided
      activeMemo: activeMemo || null,
      imageURL: imageURLToStore || null,
      thumbNailURL: thumbNailURLToStore || null
    };

    // Log sanitized data for debugging
    console.log('Sanitized Data:', sanitizedData);

    // Store in database
    const [result] = await db.execute(
      `INSERT INTO workDiary
        (projectID, userID, taskID, screenshotTimeStamp, calcTimeStamp, keyboardJSON, mouseJSON, activeJSON,
         activeFlag, activeMins, deletedFlag, activeMemo, imageURL, thumbNailURL)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizedData.projectID,
        sanitizedData.userID,
        sanitizedData.taskID,
        sanitizedData.screenshotTimeStamp,
        sanitizedData.calcTimeStamp,
        sanitizedData.keyboardJSON,
        sanitizedData.mouseJSON,
        sanitizedData.activeJSON,
        sanitizedData.activeFlag,
        sanitizedData.activeMins,
        sanitizedData.deletedFlag,
        sanitizedData.activeMemo,
        sanitizedData.imageURL,
        sanitizedData.thumbNailURL
      ]
    );

    res.json({ message: 'Data inserted with image URLs', id: result.insertId });
  } catch (err) {
    console.error('❌ Insert Error:', err);
    res.status(500).json({ error: 'Database insert failed', details: err.message });
  }
});

// Helper to ensure valid JSON
function tryParseJson(data) {
  try {
    return typeof data === 'string' ? JSON.stringify(JSON.parse(data)) : JSON.stringify(data);
  } catch (e) {
    return JSON.stringify({});
  }
}

// GET route: retrieve work logs by user and date
router.get('/', async (req, res) => {
  const { userID, date } = req.query;

  if (!userID || !date) {
    return res.status(400).json({ error: 'Missing userID or date' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT * FROM workDiary
       WHERE userID = ? AND screenshotTimeStamp BETWEEN ? AND ?
       ORDER BY screenshotTimeStamp ASC`,
      [`${userID}`, `${date} 00:00:00`, `${date} 23:59:59`]
    );

    res.json(rows);
  } catch (err) {
    console.error('❌ SQL Error:', err);
    res.status(500).json({ error: 'Database fetch failed', details: err.message });
  }
});

module.exports = router;
