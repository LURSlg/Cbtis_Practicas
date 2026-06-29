const express = require('express');
const bcrypt = require('bcrypt');
const { readUsersFromFile, writeUsersToFile, SALT_ROUNDS } = require('../controllers/authController');
const solicitudController = require('../controllers/solicitudController');

const router = express.Router();

// Middleware para proteger rutas exclusivas de administración
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.username === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador.' });
}

// ==========================================
// RUTAS PÚBLICAS (AUTENTICACIÓN Y RECUPERACIÓN)
// ==========================================

router.get('/session', (req, res) => {
    const loggedIn = Boolean(req.session && req.session.user);
    res.json({ 
        loggedIn, 
        user: req.session.user ? { username: req.session.user.username } : null 
    });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsersFromFile();
    const user = users[username];

    if (!user || !user.passwordHash) {
        console.log(`[LOGIN] Intento fallido: El usuario "${username}" no existe o no tiene hash.`);
        return res.status(401).json({ error: 'Usuario o contraseña inválidos.' });
    }

    if (user.active === false) {
        return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
    }

    try {
        const match = await bcrypt.compare(password, user.passwordHash);
        if (match) {
            req.session.user = { username, role: user.role };
            return res.json({ success: true, user: { username, role: user.role } });
        } else {
            return res.status(401).json({ error: 'Usuario o contraseña inválidos.' });
        }
    } catch (err) {
        console.error('[LOGIN ERROR]', err);
        return res.status(500).json({ error: 'Error interno en la autenticación.' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Error cerrando sesión' });
        res.json({ success: true });
    });
});

router.get('/recovery/admin-question', (req, res) => {
    const users = readUsersFromFile();
    const admin = users['admin'];
    if (admin && admin.securityQuestion) {
        return res.json({ question: admin.securityQuestion.question });
    }
    res.status(404).json({ error: 'El administrador no ha configurado una pregunta de seguridad.' });
});

router.post('/recovery/admin-reset', async (req, res) => {
    const { answer, newPassword } = req.body;
    let users = readUsersFromFile();
    const admin = users['admin'];

    if (!admin || !admin.securityQuestion || !newPassword) {
        return res.status(400).json({ error: 'Acción no permitida o parámetros incompletos.' });
    }

    const match = await bcrypt.compare(answer.toLowerCase().trim(), admin.securityQuestion.answerHash);
    if (!match) {
        return res.status(401).json({ error: 'La respuesta de seguridad es incorrecta.' });
    }

    admin.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    writeUsersToFile(users);
    res.json({ success: true, message: 'Contraseña restablecida con éxito.' });
});

// ==========================================
// RUTAS PRIVADAS (GESTIÓN DE OPERADORES)
// ==========================================

// Listar todos los usuarios
router.get('/admin/usuarios', requireAdmin, (req, res) => {
    const users = readUsersFromFile();
    const userList = Object.keys(users).map(username => ({
        username,
        role: users[username].role,
        active: users[username].active !== false
    }));
    res.json(userList);
});

// Crear o Modificar un usuario operador
router.post('/admin/usuarios/save', requireAdmin, async (req, res) => {
    const { username, password, role, active, mode } = req.body;
    let users = readUsersFromFile();

    if (!username) return res.status(400).json({ error: 'El nombre de usuario es obligatorio.' });
    if (username.toLowerCase() === 'admin') return res.status(400).json({ error: 'No puedes alterar al usuario admin desde este módulo.' });

    if (mode === 'create') {
        if (users[username]) return res.status(400).json({ error: 'El usuario ya existe.' });
        if (!password) return res.status(400).json({ error: 'La contraseña es obligatoria.' });

        users[username] = {
            passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
            role: role || 'operador',
            active: active !== false
        };
    } else if (mode === 'edit') {
        if (!users[username]) return res.status(404).json({ error: 'El usuario no existe.' });
        users[username].role = role || users[username].role;
        users[username].active = active !== false;
        
        if (password && password.trim() !== '') {
            users[username].passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        }
    }

    writeUsersToFile(users);
    res.json({ success: true, message: 'Usuario guardado correctamente.' });
});

// Eliminar usuario operador
router.delete('/admin/usuarios/:username', requireAdmin, (req, res) => {
    const username = req.params.username;
    let users = readUsersFromFile();

    if (username === 'admin') return res.status(400).json({ error: 'No se puede eliminar al administrador.' });
    if (!users[username]) return res.status(404).json({ error: 'Usuario no encontrado.' });

    delete users[username];
    writeUsersToFile(users);
    res.json({ success: true, message: `Usuario ${username} eliminado.` });
});

// Admin actualiza su propia contraseña y pregunta secreta
router.post('/admin/update-mypassword', requireAdmin, async (req, res) => {
    const { currentPass, newPass, securityQuestion, securityAnswer } = req.body;
    let users = readUsersFromFile();
    const admin = users['admin'];

    const match = await bcrypt.compare(currentPass, admin.passwordHash);
    if (!match) return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });

    if (newPass && newPass.trim() !== '') {
        admin.passwordHash = await bcrypt.hash(newPass, SALT_ROUNDS);
    }

    if (securityQuestion && securityAnswer) {
        const answerHash = await bcrypt.hash(securityAnswer.toLowerCase().trim(), SALT_ROUNDS);
        admin.securityQuestion = {
            question: securityQuestion.trim(),
            answerHash: answerHash
        };
    }

    writeUsersToFile(users);
    res.json({ success: true, message: 'Perfil de administrador actualizado correctamente.' });
});

// ==========================================
// SOLICITUDES DE CUENTA (público + admin)
// ==========================================

router.post('/solicitud-cuenta', solicitudController.crearSolicitud);
router.get('/solicitud-cuenta/estado', solicitudController.estadoSolicitud);

router.get('/admin/solicitudes', requireAdmin, solicitudController.listarSolicitudes);
router.get('/admin/solicitudes/pendientes/count', requireAdmin, solicitudController.contarPendientes);
router.post('/admin/solicitudes/:id/aprobar', requireAdmin, solicitudController.aprobarSolicitud);
router.post('/admin/solicitudes/:id/rechazar', requireAdmin, solicitudController.rechazarSolicitud);

module.exports = router;