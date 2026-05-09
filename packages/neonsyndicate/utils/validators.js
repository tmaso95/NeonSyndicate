const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE  = /^[A-Za-zÀ-ÖØ-öø-ÿ\- ]{2,32}$/;

function isValidEmail(email) {
    return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6 && password.length <= 64;
}

function isValidName(name) {
    return typeof name === 'string' && NAME_RE.test(name.trim());
}

function isValidAge(age) {
    return Number.isInteger(age) && age >= 18 && age <= 70;
}

function getPlayerIP(player) {
    return player.ip ? player.ip.split(':')[0] : '0.0.0.0';
}

module.exports = { isValidEmail, isValidPassword, isValidName, isValidAge, getPlayerIP };
