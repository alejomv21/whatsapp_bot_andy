/**
 * whatsappClient.js - Manejo de la conexión con WhatsApp usando Baileys
 */

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const { logger } = require("../utils/logger");
const { handleIncomingMessage } = require("../handlers/incomingMessage");
const { handleOutgoingMessage } = require("../handlers/outgoingMessage");
const {
  cleanupAuthFiles,
  backupAuthState,
  resetAuthState,
} = require("./authHelpers");
const qrManager = require("../services/qrManager");

// Variables para la conexión
let sock = null;
let connectionRetries = 0;
const MAX_RETRIES = 5;
let connectionState = "disconnected";
let sessionExpired = false;

/**
 * Inicializa la conexión con WhatsApp
 *
 * Este método se encarga de inicializar el gestor de códigos QR
 * y luego establecer la conexión con WhatsApp.
 */
function initialize() {
  // Inicializar el gestor de QR primero
  qrManager.initialize({
    deliveryMethods: {
      email: false,
      api: true,
      telegram: false,
      console: true, // Mantener consola siempre activa es recomendable
    },
  });

  // Iniciar la conexión con WhatsApp
  return connectToWhatsApp();
}

/**
 * Función principal para conectar con WhatsApp
 */
async function connectToWhatsApp() {
  // qrManager.initialize();

  try {
    // Si hay una conexión existente, limpiarla correctamente
    if (sock) {
      // Eliminar todos los listeners para evitar duplicados
      sock.ev.removeAllListeners();
      sock = null;
    }

    // Reiniciar bandera de sesión expirada si es necesario
    if (sessionExpired) {
      console.log(
        "Detectada sesión expirada. Reiniciando estado de autenticación..."
      );

      try {
        // Hacer copia de seguridad del estado actual antes de intentar limpiar
        await backupAuthState();

        // Limpiar archivos problemáticos si es necesario
        await cleanupAuthFiles();
      } catch (error) {
        console.error("Error al limpiar estado de autenticación:", error);
      }

      sessionExpired = false;
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Esperar antes de reconectar
    }

    // Cargar estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState(
      "auth_info_baileys"
    );

    // Crear conexión con opciones mejoradas
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: logger,
      // Opciones adicionales para mejorar la estabilidad
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      markOnlineOnConnect: true,
      retryRequestDelayMs: 2000,
      browser: ["WhatsApp Bot", "Chrome", "10.0.0"],
    });

    // Evento de conexión
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Manejo de códigos QR
      if (qr) {
        console.log("Escanea el siguiente código QR:");
        // Mostrar QR en terminal
        qrcode.generate(qr, { small: true });
        // Manejar el código QR generado utilizando el gestor de QR
        await qrManager.handleQR(qr);

        // Notificar que se generó un código QR (opcional)
        //   qrManager.notifyConnectionStatus('qr_generated');
      }

      // Manejo de estados de conexión
      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(
          `Conexión cerrada. Código: ${statusCode}. Razón: ${
            lastDisconnect?.error?.message || "Desconocida"
          }`
        );

        // Detectar los diferentes tipos de cierre de sesión
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const badSession = statusCode === DisconnectReason.badSession;
        const connectionReplaced =
          statusCode === DisconnectReason.connectionReplaced;
        const timedOut = statusCode === DisconnectReason.timedOut;
        const connectionLost = statusCode === DisconnectReason.connectionLost;
        const connectionClosed =
          statusCode === DisconnectReason.connectionClosed;

        // Si el usuario cerró sesión desde WhatsApp o la sesión es inválida
        if (loggedOut || badSession || connectionReplaced) {
          console.log(
            "Detectada posible cierre de sesión manual desde WhatsApp."
          );
          sessionExpired = true;

          if (connectionRetries < MAX_RETRIES) {
            connectionRetries++;
            console.log(
              `Preparando reconexión después de cierre de sesión... (${connectionRetries}/${MAX_RETRIES})`
            );
            connectionState = "session_expired";
            setTimeout(connectToWhatsApp, 10000); // Esperar más tiempo después de un cierre de sesión
          } else {
            console.error(
              "Número máximo de intentos alcanzado después de cierre de sesión. Generando nuevo QR."
            );
            // Reiniciar contador para permitir nuevos intentos con el nuevo QR
            connectionRetries = 0;
            // Limpiar completamente el estado de autenticación para forzar nuevo QR
            await resetAuthState();
            setTimeout(connectToWhatsApp, 5000);
          }
          return;
        }

        // Para otros tipos de desconexión (timeout, pérdida de conexión, etc.)
        if (connectionRetries < MAX_RETRIES) {
          connectionRetries++;
          const reconnectDelay = timedOut || connectionLost ? 5000 : 3000;
          console.log(
            `Intentando reconectar... (${connectionRetries}/${MAX_RETRIES}) en ${
              reconnectDelay / 1000
            } segundos`
          );
          connectionState = "reconnecting";
          setTimeout(connectToWhatsApp, reconnectDelay);
        } else {
          console.error(
            "Número máximo de intentos alcanzado. Reiniciando estado de autenticación."
          );
          await resetAuthState();
          connectionRetries = 0;
          connectionState = "reset";
          setTimeout(connectToWhatsApp, 5000);
        }
      } else if (connection === "open") {
        console.log("¡Conexión establecida con WhatsApp!");
        connectionRetries = 0;
        sessionExpired = false;
        connectionState = "connected";
      } else {
        console.log(`Estado de conexión: ${connection}`);
      }
    });

    // Guardar credenciales
    sock.ev.on("creds.update", saveCreds);

    // Manejar mensajes entrantes
    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        for (const message of messages) {
          if (!message.key.fromMe && message.message) {
            await handleIncomingMessage(sock, message);
          } else if (message.key.fromMe && message.message) {
            await handleOutgoingMessage(sock, message);
          }
        }
      } catch (error) {
        console.error("Error al procesar mensajes:", error);
      }
    });
  } catch (error) {
    console.error("Error al iniciar la conexión:", error);
    // Intentar reconectar en caso de error inicial
    if (connectionRetries < MAX_RETRIES) {
      connectionRetries++;
      console.log(
        `Error de inicio. Reintentando... (${connectionRetries}/${MAX_RETRIES})`
      );
      setTimeout(connectToWhatsApp, 5000);
    } else {
      // Si falla demasiadas veces, reiniciar estado
      await resetAuthState();
      connectionRetries = 0;
      setTimeout(connectToWhatsApp, 8000);
    }
  }
}

/**
 * Obtiene el estado actual de la conexión
 */
function getConnectionState() {
  return connectionState;
}

/**
 * Obtiene la instancia actual del socket
 */
function getSocket() {
  return sock;
}

module.exports = {
  initialize,
  connectToWhatsApp,
  getConnectionState,
  getSocket,
};
