const os = require('os');

const PORT = process.env.PORT || 8080;
const isLanEnabled = process.env.ENABLE_LAN_ACCESS === 'true';
const isPublicEnabled = process.env.ENABLE_PUBLIC_ACCESS === 'true';

const HOST = (isLanEnabled || isPublicEnabled) ? '0.0.0.0' : '127.0.0.1';

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        if (devName.toLowerCase().includes('vbox') || devName.toLowerCase().includes('vmware') || devName.toLowerCase().includes('wsl')) {
            continue; 
        }
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                if (!alias.address.startsWith('192.168.56.')) {
                    return alias.address;
                }
            }
        }
    }
    return '127.0.0.1';
}

module.exports = { PORT, HOST, getLocalIPAddress };