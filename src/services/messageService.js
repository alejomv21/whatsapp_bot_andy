/**
 * messageService.js - Servicio para gestionar el envío de mensajes
 */

// Conjunto para rastrear IDs de mensajes enviados por el bot
const botSentMessageIds = new Set();


/**
 * Detects the language of a given text using the `franc` library.
 * If the language cannot be determined, it defaults to Spanish ('es').
 *
 * @param {string} text - The input text to analyze for language detection.
 * @returns {string} - The detected language code (ISO 639-1 format) or 'es' if undetermined.
 */
function detectLanguageSimple(text) {
  const lower = text.toLowerCase().trim();

  const englishTriggers = [
    'hi',
    'hello',
    'hello there',
    'hello again',
    'good morning',
    'good afternoon',
    'good evening',
    'good day',
    'a good day',
    'how are you',
    'how’s it going',
    'how do you do',
    'long time no see',
    'nice to see you',
    'lovely day',
    "lovely day isn't it",
    'hey',
    'hey there',
    'greetings',
    'i greet you',
  ];
  const spanishTriggers = [
    'hola',
    'buenos días',
    'buenas tardes',
    'buenas noches',
    'cómo estás',
    'qué tal',
    'qué más',
    'hey',
    'saludos',
    'un saludo',
    'buen día',
    'feliz día',
    'tanto tiempo',
    'hola de nuevo'
  ];

  if (englishTriggers.some(word => lower.includes(word))) return 'en';
  if (spanishTriggers.some(word => lower.includes(word))) return 'es';

  return 'es'; // idioma por defecto
}

/**
 * Envía un mensaje desde el bot y registra su ID
 * @param {Object} sock - Instancia del socket de WhatsApp
 * @param {String} chatId - ID del chat donde enviar el mensaje
 * @param {String|Object} content - Contenido del mensaje (texto o objeto con formato)
 * @returns {Promise<Object>} - Mensaje enviado
 */
async function sendBotMessage(sock, chatId, content) {
  try {
    let message;

    // Si el contenido es un string simple, enviarlo como texto
    if (typeof content === 'string') {
      message = { text: content };
    }
    // Si es un objeto, asumimos que ya viene formateado correctamente
    else {
      message = content;
    }

    const sentMsg = await sock.sendMessage(chatId, message);

    // Guardar el ID del mensaje enviado por el bot
    if (sentMsg && sentMsg.key && sentMsg.key.id) {
      botSentMessageIds.add(sentMsg.key.id);
      // Eliminar IDs viejos para evitar memoria excesiva
      setTimeout(() => {
        botSentMessageIds.delete(sentMsg.key.id);
      }, 60000); // Limpiar después de 1 minuto
    }

    return sentMsg;
  } catch (error) {
    console.error(`Error enviando mensaje:`, error);
    throw error;
  }
}

/**
 * Verifica si un mensaje fue enviado por el bot
 * @param {Object} message - Mensaje a verificar
 * @returns {Boolean} - true si el mensaje fue enviado por el bot
 */
function wasBotGeneratedMessage(message) {
  try {
    // Verificar primero por ID (el método más confiable)
    if (message.key && message.key.id && botSentMessageIds.has(message.key.id)) {
      return true;
    }

    // Como respaldo, usar métodos alternativos
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
      return message.message.extendedTextMessage.contextInfo.mentionedJid.includes("bot-identifier");
    }

    const messageText = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        "";

    // Palabras clave que indican mensaje del bot
    const botKeywords = [
      "Wynwood baby!!!",
      "Andy's Don Cash",
      "🤖"
    ];

    return botKeywords.some(keyword => messageText.includes(keyword));
  } catch (error) {
    console.error("Error al verificar origen del mensaje:", error);
    return false;
  }
}

module.exports = {
  sendBotMessage,
  wasBotGeneratedMessage,
  botSentMessageIds,  // Exportamos el conjunto para posibles usos externos
  detectLanguageSimple
};