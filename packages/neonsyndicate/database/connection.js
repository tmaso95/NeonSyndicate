require('dotenv').config();
const mysql = require('mysql2/promise');

let pool = null;

async function connect() {
    pool = mysql.createPool({
        host:               process.env.DB_HOST     || 'localhost',
        port:               parseInt(process.env.DB_PORT) || 3306,
        user:               process.env.DB_USER     || 'root',
        password:           process.env.DB_PASS     || '',
        database:           process.env.DB_NAME     || 'neonsyndicate',
        waitForConnections: true,
        connectionLimit:    20,
        queueLimit:         0,
        charset:            'utf8mb4'
    });

    // Verify connectivity
    const conn = await pool.getConnection();
    conn.release();
    mp.console.logInfo('[DB] MySQL pool connected.');
    return pool;
}

function query(sql, params = []) {
    if (!pool) throw new Error('[DB] Pool not initialised');
    return pool.execute(sql, params);
}

async function queryOne(sql, params = []) {
    const [rows] = await query(sql, params);
    return rows[0] || null;
}

async function queryAll(sql, params = []) {
    const [rows] = await query(sql, params);
    return rows;
}

async function insert(sql, params = []) {
    const [result] = await query(sql, params);
    return result.insertId;
}

async function update(sql, params = []) {
    const [result] = await query(sql, params);
    return result.affectedRows;
}

module.exports = { connect, query, queryOne, queryAll, insert, update };
