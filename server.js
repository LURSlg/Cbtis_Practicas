// ==========================================
// 1. IMPORTACIONES Y CONFIGURACIÓN GLOBAL
// ==========================================
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// Configuración de red e IP local
const { PORT, HOST, getLocalIPAddress } = require('./src/config/network');

// --- DETECTOR AUTOMÁTICO DE RUTAS DE AUTENTICACIÓN ---
let authControllerPath = '';
let userRoutesPath = '';

// Buscar authController
if (fs.existsSync(path.join(__dirname, 'src', 'controllers', 'authController.js'))) {
    authControllerPath = './src/controllers/authController';
} else if (fs.existsSync(path.join(__dirname, 'controllers', 'authController.js'))) {
    authControllerPath = './controllers/authController';
} else {
    console.error("❌ ERROR CRÍTICO: No se encuentra 'authController.js' ni en /src/controllers/ ni en /controllers/");
}

// Buscar userRoutes
if (fs.existsSync(path.join(__dirname, 'src', 'routes', 'userRoutes.js'))) {
    userRoutesPath = './src/routes/userRoutes';
} else if (fs.existsSync(path.join(__dirname, 'routes', 'userRoutes.js'))) {
    userRoutesPath = './routes/userRoutes';
} else {
    console.error("❌ ERROR CRÍTICO: No se encuentra 'userRoutes.js' ni en /src/routes/ ni en /routes/");
}

// Inyección dinámica de los módulos encontrados
const { asegurarUsuarioAdmin } = require(authControllerPath);
const userRoutes = require(userRoutesPath); 
// -----------------------------------------------------

// Nuevas rutas modulares de control escolar
const paymentRoutes = require('./src/routes/paymentRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const infoRoutes = require('./src/routes/infoRoutes');
const syncService = require('./src/services/syncService');

const app = express();

const mongoose = require('mongoose'); // 🟢 Añadir Mongoose

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('🔌 ✅ Conectado exitosamente a MongoDB Compass');
        try {
            await syncService.ensureIndexes();
            await syncService.importAlumnosFromExcel();
        } catch (syncErr) {
            console.warn('⚠️ Sincronización inicial:', syncErr.message);
        }
    })
    .catch(err => console.error('❌ Error al conectar a MongoDB:', err));

// Ejecutar rutina de verificación del administrador
asegurarUsuarioAdmin();

// ==========================================
// 2. MIDDLEWARES DE APLICACIÓN (ORDEN CORRECTO)
// ==========================================
// 2.1 Procesamiento de Datos entrantes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2.2 Configuración del Manejo de Sesiones (DEBE IR ANTES DE CUALQUIER RUTA O FILTRO)
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret-key-change-in-production',
    resave: true,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        sameSite: 'lax'
    }
}));

// 2.3 Interceptor de Autenticación Global para la API
app.use('/api', (req, res, next) => {
    console.log('[MIDDLEWARE AUTH] Ruta:', req.path, 'Método:', req.method);
    
    // Rutas públicas exceptuadas del filtro de sesión
    if (
        req.path === '/login'
        || req.path === '/session'
        || req.path === '/health'
        || req.path.startsWith('/recovery/')
        || req.path === '/solicitud-cuenta'
        || req.path === '/solicitud-cuenta/estado'
    ) {
        return next();
    }
    
    // Si hay sesión activa del usuario, permitimos continuar de forma transparente
    if (req.session && req.session.user) {
        return next();
    }
    
    // Si no está logueado, mandamos un JSON real (Evita mandar código HTML inesperado)
    return res.status(401).json({ error: 'Sesión requerida', code: 'NO_SESSION' });
});

// ==========================================
// 3. VINCULACIÓN DE ENRUTADORES
// ==========================================
app.use('/api', userRoutes);
app.use('/api', paymentRoutes);
app.use('/api', reportRoutes);
app.use('/api', infoRoutes);

// ==========================================
// 4. ARCHIVOS ESTÁTICOS Y VISTAS (Front-End)
// ==========================================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    req.session.views = (req.session.views || 0) + 1;
    console.log(`[Cliente ${req.session.id}] ha visitado la página ${req.session.views} veces.`);
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// ==========================================
// 5. INICIALIZACIÓN DEL SERVIDOR
// ==========================================
app.listen(PORT, HOST, () => {
    console.log('========================================');
    console.log('Servidor ejecutándose de forma estructurada.');
    console.log(`Acceso Local: http://localhost:${PORT}`);
    if (HOST === '0.0.0.0') {
        console.log(`Acceso en LAN: http://${getLocalIPAddress()}:${PORT}`);
    }
    console.log('========================================');
});