const fs = require('fs');
const path = require('path');

function appendAudit(entry) {
    try {
        const auditsDir = path.join(__dirname, '..', '..', 'logs');
        if (!fs.existsSync(auditsDir)) fs.mkdirSync(auditsDir, { recursive: true });
        const auditFile = path.join(auditsDir, 'audit.log');
        const line = JSON.stringify(entry) + '\n';
        fs.appendFileSync(auditFile, line, 'utf-8');
    } catch (err) {
        console.error('Error escribiendo auditoría:', err);
    }
}

module.exports = { appendAudit };