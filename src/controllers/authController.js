// src\controllers\authController.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const USERS_FILE = path.join(__dirname, '..', 'usuarios.json');
const SALT_ROUNDS = 10;

// Auxiliares de lectura y escritura
function readUsersFromFile() {
    try {
        if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}), 'utf-8');
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    } catch (err) {
        console.error('Error leyendo usuarios.json:', err);
        return {};
    }
}

function writeUsersToFile(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error('Error escribiendo usuarios.json:', err);
        return false;
    }
}

// Inicializador automático para base de datos limpia
async function asegurarUsuarioAdmin() {
    let users = readUsersFromFile();
    if (!users['admin'] || !users['admin'].passwordHash) {
        console.log('⚠️ [CONFIG] Base de datos nueva detectada. Generando credenciales del Administrador...');
        const hashPorDefecto = await bcrypt.hash('admin123', SALT_ROUNDS);
        users['admin'] = {
            passwordHash: hashPorDefecto,
            role: 'admin'
        };
        writeUsersToFile(users);
        console.log('✅ [CONFIG] Usuario "admin" creado con éxito. Contraseña provisional: admin123');
    }
}

module.exports = {
    readUsersFromFile,
    writeUsersToFile,
    asegurarUsuarioAdmin,
    SALT_ROUNDS
};