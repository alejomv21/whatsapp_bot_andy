/**
 * connection/index.js - Punto de entrada para el módulo de conexión
 */
// const qrManager = require("../services/qrManager");
const {
  initialize,
  connectToWhatsApp,
  getConnectionState,
  getSocket,
} = require("./whatsappClient");

/**
 * Inicia la conexión con WhatsApp
 */
function initConnection() {
  return initialize();
}

module.exports = {
  initConnection,
  getConnectionState,
  getSocket,
};
