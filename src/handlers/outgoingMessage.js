/**
 * outgoingMessage.js - Maneja los mensajes salientes (enviados por el propietario)
 */

const commandHandler = require("../services/commandHandler");
const { wasBotGeneratedMessage } = require("../services/messageService");

/**
 * Procesa los mensajes salientes (enviados desde el número del bot)
 * @param {Object} sock - Instancia del socket de WhatsApp
 * @param {Object} message - Mensaje enviado
 */
async function handleOutgoingMessage(sock, message) {
  const chatId = message.key.remoteJid;

  // Ignorar mensajes a grupos
  if (chatId.endsWith("@g.us")) {
    return;
  }

  // Verificar si el mensaje fue generado automáticamente por el bot
  if (!wasBotGeneratedMessage(message)) {
    console.log(`Detectada intervención manual del propietario en chat: ${chatId}`);

    // Desactivar el bot para este chat específico por 24 horas
    commandHandler.registerManualIntervention(chatId);

    const userMessage = message.message.conversation || 
                        message.message.extendedTextMessage?.text || 
                        "";

    // Si es un comando, procesarlo
    if (commandHandler.isCommand(userMessage)) {
      await commandHandler.handleCommand(sock, message);
      return;
    }
  }
}

module.exports = {
  handleOutgoingMessage
};