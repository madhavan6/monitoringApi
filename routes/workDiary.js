const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const axios = require('axios');
const upload = multer(); // Store files in memory

// Convert buffer to base64
function toBase64(fileBuffer) {
  return fileBuffer.toString('base64');
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
      imageURL,
      thumbNailURL
    } = req.body;

    let imageBase64 = null;
    let thumbNailBase64 = null;
   // Screenshot base64
if (req.files && req.files['screenshot']) {
  imageBase64 = toBase64(req.files['screenshot'][0].buffer);
} else if (imageURL) {
  imageBase64 = await fetchImageAsBase64(imageURL);
}

// Thumbnail base64
if (req.files && req.files['thumbnail']) {
  thumbNailBase64 = toBase64(req.files['thumbnail'][0].buffer);
} else if (thumbNailURL) {
  thumbNailBase64 = await fetchImageAsBase64(thumbNailURL);
}


    // Store in database
    const [result] = await db.execute(
      `INSERT INTO workDiary
        (projectID, userID, taskID, screenshotTimeStamp, calcTimeStamp, keyboardJSON, mouseJSON, activeJSON,
         activeFlag, activeMins, deletedFlag, activeMemo, imageURL, thumbNailURL)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectID,
        userID,
        taskID,
        screenshotTimeStamp,
        calcTimeStamp,
        tryParseJson(keyboardJSON),
        tryParseJson(mouseJSON),
        tryParseJson(activeJSON),
        activeFlag,
        activeMins,
        deletedFlag,
        activeMemo,
        imageBase64,
        thumbNailBase64
      ]
    );

    res.json({ message: 'Data inserted with base64 images', id: result.insertId });
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
