const bcrypt = require('bcrypt');
const RegistrationRequest = require('../models/RegistrationRequest');
const { readUsersFromFile, writeUsersToFile, SALT_ROUNDS } = require('./authController');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

exports.crearSolicitud = async (req, res) => {
    const { username, password, nombreCompleto, motivo } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
    }
    if (!USERNAME_RE.test(username)) {
        return res.status(400).json({ error: 'Usuario inválido (3-24 caracteres: letras, números o _).' });
    }
    if (username.toLowerCase() === 'admin') {
        return res.status(400).json({ error: 'Ese nombre de usuario no está disponible.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const users = readUsersFromFile();
    if (users[username]) {
        return res.status(409).json({ error: 'Ese usuario ya existe en el sistema.' });
    }

    const pending = await RegistrationRequest.findOne({ username, status: 'pending' });
    if (pending) {
        return res.status(409).json({ error: 'Ya hay una solicitud pendiente para ese usuario.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const solicitud = await RegistrationRequest.create({
            username,
            nombreCompleto: (nombreCompleto || '').trim(),
            motivo: (motivo || '').trim(),
            passwordHash,
        });

        res.status(201).json({
            success: true,
            message: 'Solicitud enviada. El administrador la revisará pronto.',
            solicitud: { id: solicitud._id, username: solicitud.username, status: solicitud.status },
        });
    } catch (err) {
        console.error('Error creando solicitud:', err);
        res.status(500).json({ error: 'No se pudo registrar la solicitud.' });
    }
};

exports.estadoSolicitud = async (req, res) => {
    const username = (req.query.username || '').trim();
    if (!username) return res.status(400).json({ error: 'Usuario requerido.' });

    const solicitud = await RegistrationRequest.findOne({ username })
        .sort({ createdAt: -1 })
        .lean();

    if (!solicitud) {
        return res.json({ found: false });
    }

    res.json({
        found: true,
        status: solicitud.status,
        username: solicitud.username,
        rejectReason: solicitud.rejectReason || '',
        createdAt: solicitud.createdAt,
        resolvedAt: solicitud.resolvedAt,
    });
};

exports.listarSolicitudes = async (req, res) => {
    const status = req.query.status || 'pending';
    const filter = status === 'all' ? {} : { status };

    const solicitudes = await RegistrationRequest.find(filter)
        .sort({ createdAt: -1 })
        .select('-passwordHash')
        .lean();

    res.json({ data: solicitudes });
};

exports.contarPendientes = async (req, res) => {
    const count = await RegistrationRequest.countDocuments({ status: 'pending' });
    res.json({ pending: count });
};

exports.aprobarSolicitud = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    const solicitud = await RegistrationRequest.findById(id);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (solicitud.status !== 'pending') {
        return res.status(409).json({ error: 'Esta solicitud ya fue procesada.' });
    }

    const users = readUsersFromFile();
    if (users[solicitud.username]) {
        solicitud.status = 'rejected';
        solicitud.rejectReason = 'El usuario ya existía en el sistema.';
        solicitud.resolvedAt = new Date();
        solicitud.resolvedBy = req.session.user.username;
        await solicitud.save();
        return res.status(409).json({ error: 'Ese usuario ya existe.' });
    }

    users[solicitud.username] = {
        passwordHash: solicitud.passwordHash,
        role: role || 'operador',
        active: true,
    };
    writeUsersToFile(users);

    solicitud.status = 'approved';
    solicitud.resolvedAt = new Date();
    solicitud.resolvedBy = req.session.user.username;
    await solicitud.save();

    res.json({ success: true, message: `Usuario "${solicitud.username}" creado y activado.` });
};

exports.rechazarSolicitud = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const solicitud = await RegistrationRequest.findById(id);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (solicitud.status !== 'pending') {
        return res.status(409).json({ error: 'Esta solicitud ya fue procesada.' });
    }

    solicitud.status = 'rejected';
    solicitud.rejectReason = (reason || '').trim();
    solicitud.resolvedAt = new Date();
    solicitud.resolvedBy = req.session.user.username;
    await solicitud.save();

    res.json({ success: true, message: 'Solicitud rechazada.' });
};
