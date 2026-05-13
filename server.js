// Cargar variables de entorno desde el archivo .env
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const os = require('os');

const app = express();


// --- 1. CONFIGURACIÓN DE RED ---
const PORT = process.env.PORT || 8080;
const isLanEnabled = process.env.ENABLE_LAN_ACCESS === 'true';
const isPublicEnabled = process.env.ENABLE_PUBLIC_ACCESS === 'true';

// Por defecto
let HOST = '127.0.0.1'; 

// Si LAN o Public están activos
if (isLanEnabled || isPublicEnabled) {
    HOST = '0.0.0.0';
}

// --- FUNCIÓN PARA OBTENER LA IP LOCAL (LAN) ---
function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        // Ignoramos nombres comunes de adaptadores virtuales
        if (devName.toLowerCase().includes('vbox') || devName.toLowerCase().includes('vmware') || devName.toLowerCase().includes('wsl')) {
            continue; 
        }
        
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                // Filtramos la subred clásica de VirtualBox por si acaso
                if (!alias.address.startsWith('192.168.56.')) {
                    return alias.address;
                }
            }
        }
    }
    return '127.0.0.1';
}


// funcionalidad login: JWT.
/*
usuario hace login y verifica usuario y contraseña, si es correcto se genera un token JWT con una clave secreta y
se devuelve al cliente. El cliente lo guarda en localStorage o cookies y lo envía en cada solicitud para autenticación.
El servidor verifica el token en cada solicitud protegida para permitir o denegar acceso.
*/



// --- 2. CONFIGURACIÓN DE SESIONES MULTICLIENTE ---
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));



// --- 3. RUTAS Y ARCHIVOS ESTATICOS ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    if (req.session.views) {
        req.session.views++;
    } else {
        req.session.views = 1;
    }

    console.log(`[Cliente ${req.session.id}] ha visitado la página ${req.session.views} veces.`);
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});






// --- 4. LEVANTAR EL SERVIDOR ---
app.listen(PORT, HOST, () => {
    console.log('========================================');
    if (HOST === '0.0.0.0') {
        const lanIP = getLocalIPAddress();
        console.log(`Servidor ejecutándose y escuchando en todas las interfaces.`);
        console.log(`Acceso Local (esta PC): http://localhost:${PORT}`);
        console.log(`Acceso en LAN (otros dispositivos): http://${lanIP}:${PORT}`);
    } else {
        console.log(`Servidor ejecutándose en modo estricto local.`);
        console.log(`ACCESO: Restringido solo a http://localhost:${PORT}`);
    }
    console.log('========================================');
});