const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'maddy123', // set your MySQL password if any
  database: 'VW',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool.promise();
