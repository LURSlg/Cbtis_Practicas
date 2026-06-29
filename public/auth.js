const authState = {
    loggedIn: false,
    user: null,
};
const loginPagePath = '/login.html';
const isLoginPage = window.location.pathname.endsWith(loginPagePath);
let authCheckPromise = null;

function setAccountMenu() {
    const accountUsername = document.getElementById('accountUsername');
    const menuLogged = document.getElementById('accountMenuLogged');
    const menuNotLogged = document.getElementById('accountMenuNotLogged');
    const accountButton = document.getElementById('accountButton');

    if (authState.loggedIn) {
        if (accountUsername) accountUsername.textContent = authState.user?.username || 'Usuario';
        if (menuLogged) menuLogged.classList.remove('hidden');
        if (menuNotLogged) menuNotLogged.classList.add('hidden');
        if (accountButton) accountButton.setAttribute('title', `Conectado como ${authState.user?.username || 'Usuario'}`);
    } else {
        if (menuLogged) menuLogged.classList.add('hidden');
        if (menuNotLogged) menuNotLogged.classList.remove('hidden');
        if (accountButton) accountButton.setAttribute('title', 'Cuenta');
    }
}

function showLoginError(message) {
    const errorNode = document.getElementById('loginError');
    if (errorNode) {
        errorNode.textContent = message;
    }
}

function clearLoginError() {
    showLoginError('');
}

async function fetchSessionData() {
    try {
        const response = await fetch('/api/session', { cache: 'no-store' });
        if (!response.ok) return { loggedIn: false };
        return await response.json();
    } catch {
        return { loggedIn: false };
    }
}

async function guardPage() {
    try {
        const session = await fetchSessionData();
        const wasLoggedIn = authState.loggedIn;
        
        // Corrección de la asignación global implícita
        authState.loggedIn = Boolean(session.loggedIn);
        if (typeof gameState !== 'undefined') {
            gameState = authState.loggedIn;
        }
        
        authState.user = session.user || null;
        
        setAccountMenu();
        setPageLock(!isLoginPage && !authState.loggedIn);

        // 1. Redirección si no está autenticado
        if (!isLoginPage && !authState.loggedIn) {
            window.location.href = 'login.html';
            return false;
        }

        // 2. Redirección si ya está autenticado e intenta ir a login
        if (isLoginPage && authState.loggedIn) {
            setPageLock(false);
            window.location.href = 'main.html';
            return false;
        }

        if (wasLoggedIn !== authState.loggedIn) {
            setAccountMenu();
        }

        return true;
    } catch (error) {
        console.error('Error en guardPage:', error);
        if (!isLoginPage) {
            setPageLock(true);
            window.location.href = 'login.html';
        }
        return false;
    }
}

function waitForAuth() {
    if (!authCheckPromise) {
        authCheckPromise = guardPage().finally(() => {
            authCheckPromise = null;
        });
    }
    return authCheckPromise;
}

async function login(credentials) {
    try {
        console.log('[LOGIN API] Enviando credenciales a /api/login');
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });

        console.log('[LOGIN API] Respuesta status:', response.status);
        
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            console.log('[LOGIN API] Error:', body);
            showLoginError(body.error || 'Usuario o contraseña inválidos.');
            return false;
        }

        const body = await response.json();
        console.log('[LOGIN API] Respuesta exitosa:', body);
        
        if (body.success) {
            authState.loggedIn = true;
            authState.user = body.user || null;
            setAccountMenu();
            console.log('[LOGIN API] Estado actualizado:', authState);
            return true;
        }

        showLoginError('Error desconocido al iniciar sesión.');
        return false;
    } catch (error) {
        console.error('[LOGIN API] Error de comunicación:', error);
        showLoginError('Error de comunicación con el servidor.');
        return false;
    }
}

function setPageLock(locked) {
    const pageLock = document.getElementById('pageLock');
    if (!pageLock) return;
    pageLock.classList.toggle('hidden', !locked);
}

async function handleLoginSubmit(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    clearLoginError();

    const usernameInput = document.getElementById('loginUser');
    const passwordInput = document.getElementById('loginPassword');

    if (!usernameInput || !passwordInput) {
        showLoginError('No se encontró el formulario de inicio de sesión.');
        return false;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        showLoginError('Usuario y contraseña son obligatorios.');
        return false;
    }

    const ok = await login({ username, password });
    if (ok) {
        window.location.href = 'main.html';
    }

    return false;
}

async function logout() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        if (response.ok) {
            authState.loggedIn = false;
            authState.user = null;
            
            const menu = document.getElementById('accountMenu');
            const button = document.getElementById('accountButton');
            if (menu) menu.classList.add('hidden');
            if (button) button.setAttribute('aria-expanded', 'false');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 200);
        }
    } catch (err) {
        console.warn('Logout error', err);
        window.location.href = 'login.html';
    }
}

function bindAuthControls() {
    const button = document.getElementById('accountButton');
    const menu = document.getElementById('accountMenu');

    if (!button || !menu) return;

    button.addEventListener('click', (event) => {
        event.stopPropagation();
        menu.classList.toggle('hidden');
        button.setAttribute('aria-expanded', String(!menu.classList.contains('hidden')));
    });

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (menu && !menu.contains(target) && target !== button) {
            menu.classList.add('hidden');
            button?.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
            button?.setAttribute('aria-expanded', 'false');
        }
    });

    document.querySelectorAll('[data-action="openLogin"]').forEach((el) => {
        el.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.location.href = 'login.html';
        });
    });

    document.querySelectorAll('[data-action="logout"]').forEach((el) => {
        el.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await logout();
        });
    });

    const pageLockLogin = document.getElementById('pageLockLogin');
    if (pageLockLogin) {
        pageLockLogin.addEventListener('click', (event) => {
            event.preventDefault();
            window.location.href = 'login.html';
        });
    }
}

// Inicialización de Eventos de la Interfaz
document.addEventListener('DOMContentLoaded', async () => {
    bindAuthControls();

    // LÓGICA EXCLUSIVA DE LA PÁGINA DE LOGIN
    if (isLoginPage) {
        const loginUser = document.getElementById('loginUser');
        const linkForgot = document.getElementById('linkForgot');
        const recoverySection = document.getElementById('recoverySection');
        const loginForm = document.getElementById('loginForm');
        const recoveryQuestionLabel = document.getElementById('recoveryQuestionLabel');
        const btnSubmitRecovery = document.getElementById('btnSubmitRecovery');
        const btnCancelRecovery = document.getElementById('btnCancelRecovery');
        const recoveryError = document.getElementById('recoveryError');
        const recoverySuccess = document.getElementById('recoverySuccess');

        // Escucha en tiempo real si el usuario es "admin" para mostrar el enlace
        loginUser?.addEventListener('input', () => {
            if (loginUser.value.trim().toLowerCase() === 'admin') {
                linkForgot.style.display = 'block';
            } else {
                linkForgot.style.display = 'none';
            }
        });

        // Evento al dar clic en "Olvidé mi contraseña"
        linkForgot?.addEventListener('click', async (e) => {
            e.preventDefault();
            const username = loginUser.value.trim();

            if (username.toLowerCase() !== 'admin') return;

            try {
                const response = await fetch('/api/recovery/admin-question');
                const data = await response.json();
                
                if (response.ok && data.question) {
                    recoveryQuestionLabel.textContent = `Pregunta: ¿${data.question}?`;
                    
                    // Intercambiar formularios
                    loginForm.style.display = 'none';
                    linkForgot.style.display = 'none';
                    recoverySection.style.display = 'block';
                    
                    recoveryError.textContent = '';
                    recoverySuccess.textContent = '';
                } else {
                    alert(data.error || 'El administrador no cuenta con una pregunta de seguridad.');
                }
            } catch (err) {
                console.error('Error de conexión:', err);
                alert('No se pudo establecer comunicación con el servidor.');
            }
        });

        // Enviar respuesta secreta y nueva contraseña
        btnSubmitRecovery?.addEventListener('click', async () => {
            const answer = document.getElementById('recoveryAnswer').value.trim();
            const newPassword = document.getElementById('recoveryNewPass').value;

            recoveryError.textContent = '';
            recoverySuccess.textContent = '';

            if (!answer || !newPassword) {
                recoveryError.textContent = 'Por favor, rellena todos los campos.';
                return;
            }

            try {
                const response = await fetch('/api/recovery/admin-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answer, newPassword })
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    recoverySuccess.textContent = '✓ Contraseña actualizada correctamente.';
                    document.getElementById('recoveryAnswer').value = '';
                    document.getElementById('recoveryNewPass').value = '';
                    
                    setTimeout(() => {
                        location.reload();
                    }, 2000);
                } else {
                    recoveryError.textContent = data.error || 'La respuesta de seguridad es incorrecta.';
                }
            } catch (err) {
                recoveryError.textContent = 'Error interno al procesar la solicitud.';
            }
        });

        // Cancelar y volver al Login
        btnCancelRecovery?.addEventListener('click', () => {
            recoverySection.style.display = 'none';
            loginForm.style.display = 'block';
            loginUser.value = ''; // Resetea el campo para ocultar el enlace de nuevo
            linkForgot.style.display = 'none';
        });

        // Enlazar envío del login regular
        if (loginForm) {
            console.log('[BIND AUTH] Agregando listener al formulario de login');
            loginForm.addEventListener('submit', handleLoginSubmit);
        }

        // ─── Solicitud de cuenta ───
        const linkRequestAccount = document.getElementById('linkRequestAccount');
        const requestSection = document.getElementById('requestSection');
        const btnSubmitRequest = document.getElementById('btnSubmitRequest');
        const btnCancelRequest = document.getElementById('btnCancelRequest');
        const requestError = document.getElementById('requestError');
        const requestSuccess = document.getElementById('requestSuccess');
        const requestPending = document.getElementById('requestPending');
        let requestPollTimer = null;

        linkRequestAccount?.addEventListener('click', () => {
            loginForm.style.display = 'none';
            linkForgot.style.display = 'none';
            linkRequestAccount.style.display = 'none';
            requestSection.style.display = 'block';
            requestError.textContent = '';
            requestSuccess.textContent = '';
            requestPending.style.display = 'none';
        });

        btnCancelRequest?.addEventListener('click', () => {
            requestSection.style.display = 'none';
            loginForm.style.display = 'block';
            linkRequestAccount.style.display = 'block';
            if (requestPollTimer) clearInterval(requestPollTimer);
        });

        btnSubmitRequest?.addEventListener('click', async () => {
            const username = document.getElementById('reqUsername').value.trim();
            const nombreCompleto = document.getElementById('reqNombre').value.trim();
            const password = document.getElementById('reqPassword').value;
            const motivo = document.getElementById('reqMotivo').value.trim();

            requestError.textContent = '';
            requestSuccess.textContent = '';
            requestPending.style.display = 'none';

            if (!username || !password) {
                requestError.textContent = 'Usuario y contraseña son obligatorios.';
                return;
            }

            try {
                const res = await fetch('/api/solicitud-cuenta', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, nombreCompleto, motivo }),
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    requestSuccess.textContent = '✓ Solicitud enviada. Espera la aprobación del administrador.';
                    localStorage.setItem('pendingRequestUser', username);
                    startRequestStatusPoll(username);
                } else {
                    requestError.textContent = data.error || 'No se pudo enviar la solicitud.';
                }
            } catch {
                requestError.textContent = 'Error de conexión con el servidor.';
            }
        });

        function startRequestStatusPoll(username) {
            if (requestPollTimer) clearInterval(requestPollTimer);
            requestPending.style.display = 'block';
            requestPending.textContent = '⏳ Esperando aprobación del administrador...';

            const check = async () => {
                try {
                    const res = await fetch(`/api/solicitud-cuenta/estado?username=${encodeURIComponent(username)}`, { cache: 'no-store' });
                    const data = await res.json();
                    if (!data.found) return;

                    if (data.status === 'approved') {
                        requestPending.style.display = 'none';
                        requestSuccess.textContent = '✓ ¡Cuenta aprobada! Ya puedes iniciar sesión.';
                        localStorage.removeItem('pendingRequestUser');
                        clearInterval(requestPollTimer);
                        document.getElementById('loginUser').value = username;
                        requestSection.style.display = 'none';
                        loginForm.style.display = 'block';
                        linkRequestAccount.style.display = 'block';
                    } else if (data.status === 'rejected') {
                        requestPending.style.display = 'none';
                        requestError.textContent = data.rejectReason
                            ? `Solicitud rechazada: ${data.rejectReason}`
                            : 'Tu solicitud fue rechazada por el administrador.';
                        localStorage.removeItem('pendingRequestUser');
                        clearInterval(requestPollTimer);
                    }
                } catch { /* ignore */ }
            };

            check();
            requestPollTimer = setInterval(check, 4000);
        }

        const savedPending = localStorage.getItem('pendingRequestUser');
        if (savedPending) {
            linkRequestAccount?.click();
            document.getElementById('reqUsername').value = savedPending;
            startRequestStatusPoll(savedPending);
        }
    }

    await waitForAuth();
});

window.waitForAuth = waitForAuth;
window.authSession = authState;
window.handleLoginSubmit = handleLoginSubmit;

window.addEventListener('load', async () => {
    if (!isLoginPage && authState.loggedIn) {
        bindAuthControls();
    }
});