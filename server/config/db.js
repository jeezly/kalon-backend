const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: 'KalonStudio',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Manejo de eventos del pool
pool.on('connection', (connection) => {
  console.log('Nueva conexión establecida con la base de datos');
});

pool.on('acquire', (connection) => {
  console.log('Conexión adquirida del pool');
});

pool.on('release', (connection) => {
  console.log('Conexión liberada de vuelta al pool');
});

pool.on('enqueue', () => {
  console.log('Esperando por una conexión disponible');
});

module.exports = pool;