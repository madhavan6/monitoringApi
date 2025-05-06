const fs = require('fs');
const path = require('path');

const imageDir = path.join(__dirname, 'public/images');

// Recursively delete folder contents
function deleteFolderContents(dir) {
  if (!fs.existsSync(dir)) return;

  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      deleteFolderContents(fullPath);  // Recurse into subdir
      fs.rmdirSync(fullPath);          // Remove the empty folder
      console.log('Deleted folder:', fullPath);
    } else {
      fs.unlinkSync(fullPath);         // Delete file
      console.log('Deleted file:', fullPath);
    }
  });
}

deleteFolderContents(imageDir);
console.log('✅ Cleanup complete');
