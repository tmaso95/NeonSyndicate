const db = require('../database/connection');

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAlphaNum(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
    }
    return result;
}

// CNP: 4-8 unique digits
async function generateCNP() {
    const len = randomInt(4, 8);
    const max = 10 ** len;
    const min = 10 ** (len - 1);

    for (let attempt = 0; attempt < 100; attempt++) {
        const cnp = String(randomInt(min, max - 1));
        const existing = await db.queryOne('SELECT cnp FROM characters WHERE cnp = ?', [cnp]);
        if (!existing) return cnp;
    }
    throw new Error('Failed to generate unique CNP after 100 attempts');
}

// VIN: NS- + 14 alphanumeric = 17 chars total
async function generateVIN() {
    for (let attempt = 0; attempt < 100; attempt++) {
        const vin = 'NS-' + randomAlphaNum(14);
        const existing = await db.queryOne('SELECT vin FROM vehicles WHERE vin = ?', [vin]);
        if (!existing) return vin;
    }
    throw new Error('Failed to generate unique VIN after 100 attempts');
}

// Random vehicle plate (8 chars alphanumeric)
function generatePlate() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits  = '0123456789';
    let plate = '';
    for (let i = 0; i < 3; i++) plate += letters[Math.floor(Math.random() * letters.length)];
    plate += '-';
    for (let i = 0; i < 4; i++) plate += digits[Math.floor(Math.random() * digits.length)];
    return plate;
}

module.exports = { generateCNP, generateVIN, generatePlate, randomInt };
