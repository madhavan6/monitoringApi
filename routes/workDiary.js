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
function saveBase64Image(base64String, options = {}) {
  const {
    rootFolder = 'public/images',
    projectID = 'unknownProject',
    taskID = 'unknownTask',
    timestamp = new Date().toISOString()
  } = options;

  // Match base64 string format
  const matches = base64String.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 string');

  // Extract file extension and base64 data
  const ext = matches[1].split('/')[1];
  const data = matches[2];
  const fileName = `${uuidv4()}.${ext}`;

  // Define folder path based on projectID, taskID, and date
  const date = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
  const folderPath = path.join(
    rootFolder,
    `ProjectID_${projectID}`,
    `TaskID_${taskID}`,
    date
  );
  
  

  // Create directory if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Define file path and write the image data to the file system
  const filePath = path.join(folderPath, fileName);
  fs.writeFileSync(filePath, data, { encoding: 'base64' });

  // Return relative file path for use in the database
  return filePath.replace(/^public/, '').replace(/\\/g, '/');
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

    // Fetch image as base64
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

// Helper to ensure valid JSON
function tryParseJson(data) {
  try {
    return typeof data === 'string' ? JSON.stringify(JSON.parse(data)) : JSON.stringify(data);
  } catch (e) {
    return JSON.stringify({});
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
      console.log("Screenshot Base64 Data: ", base64); // Log the screenshot base64 data
      imageURLToStore = saveBase64Image(`data:image/png;base64,${base64}`, {
        projectID,
        taskID,
        timestamp: screenshotTimeStamp
      });
    } else if (imageURL && imageURL.startsWith('data:image')) {
      const base64 = imageURL.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      console.log("Screenshot Base64 URL Data: ", base64); // Log the base64 URL data
      imageURLToStore = saveBase64Image(`data:image/png;base64,${base64}`, {
        projectID,
        taskID,
        timestamp: screenshotTimeStamp
      });
    } else if (imageURL) {
      const base64 = await fetchImageAsBase64(imageURL);
      console.log("Screenshot Base64 Fetched Data: ", base64); // Log the fetched base64 data
      imageURLToStore = saveBase64Image(`data:image/png;base64,${base64}`, {
        projectID,
        taskID,
        timestamp: screenshotTimeStamp
      });
    }

    // Thumbnail base64 or file
    if (req.files && req.files['thumbnail']) {
      const base64 = toBase64(req.files['thumbnail'][0].buffer);
      console.log("Thumbnail Base64 Data: ", base64); // Log the thumbnail base64 data
      thumbNailURLToStore = saveBase64Image(`data:image/png;base64,${base64}`, {
        projectID,
        taskID,
        timestamp: screenshotTimeStamp
      });
    } else if (thumbNailURL && thumbNailURL.startsWith('data:image')) {
      const base64 = thumbNailURL.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      console.log("Thumbnail Base64 URL Data: ", base64); // Log the base64 URL data
      thumbNailURLToStore = saveBase64Image(`data:image/png;base64,${base64}`, {
        projectID,
        taskID,
        timestamp: screenshotTimeStamp
      });
    } else if (thumbNailURL) {
      const base64 = await fetchImageAsBase64(thumbNailURL);
      console.log("Thumbnail Base64 Fetched Data: ", base64); // Log the fetched base64 data
      thumbNailURLToStore = saveBase64Image(`data:image/png;base64,${base64}`, {
        projectID,
        taskID,
        timestamp: screenshotTimeStamp
      });
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
