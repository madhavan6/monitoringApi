const db = require('./db');

async function clearWorkDiary() {
  try {
    await db.execute('TRUNCATE TABLE workDiary;');
    console.log('✅ All records deleted and ID reset.');
  } catch (err) {
    console.error('❌ Failed to clear data:', err.message);
  } finally {
    process.exit();
  }
}

clearWorkDiary();
