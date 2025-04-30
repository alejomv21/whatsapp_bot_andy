/**
 * telegramDelivery.js - Módulo específico para envío de códigos QR a través de Telegram
 * Utiliza el servicio base de Telegram para la comunicación
 */

const telegramService = require('../communications/telegramService');
const fs = require('fs');
const dotenv = require('dotenv');

// Cargar variables de entorno si no se han cargado
if (!process.env.NODE_ENV) {
  dotenv.config();
}

// Configuración específica para envío de QR
const config = {
  caption: process.env.QR_TELEGRAM_CAPTION || '🔄 *Reconexión requerida*\n\nEscanea este código QR para reconectar el bot de WhatsApp.\n⏱️ Válido por 60 segundos.',
  parse_mode: 'Markdown'
};

/**
 * Inicializa el servicio de envío de QR por Telegram
 * @param {Object} customConfig - Configuración personalizada (opcional)
 * @returns {boolean} true si la inicialización es exitosa
 */
function initialize(customConfig = {}) {
  try {
    // Combinar configuración por defecto con personalizada
    Object.assign(config, customConfig);
    
    // Inicializar el servicio base de Telegram si no está inicializado
    if (!telegramService.isInitialized()) {
      return telegramService.initialize();
    }
    
    return true;
  } catch (error) {
    console.error('Error al inicializar el servicio de envío de QR por Telegram:', error);
    return false;
  }
}

/**
 * Envía un código QR por Telegram
 * @param {string} qrImagePath - Ruta a la imagen del código QR
 * @returns {Promise<boolean>} true si el envío es exitoso
 */
async function sendQR(qrImagePath) {
  try {
    // Inicializar el servicio si no está inicializado
    if (!telegramService.isInitialized()) {
      initialize();
    }
    
    // Verificar si el archivo existe
    if (!fs.existsSync(qrImagePath)) {
      console.error(`El archivo QR no existe en la ruta: ${qrImagePath}`);
      return false;
    }
    
    // Configurar opciones para el envío
    const options = {
      caption: config.caption,
      parse_mode: config.parse_mode
    };
    
    // Enviar imagen a todos los chats autorizados
    const result = await telegramService.broadcastPhoto(qrImagePath, options);
    
    if (result.success) {
      console.log(`QR enviado a ${result.totalSent} chats de Telegram`);
      return true;
    } else {
      console.error('Error al enviar QR por Telegram:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error al enviar QR por Telegram:', error);
    return false;
  }
}

/**
 * Envía un mensaje de texto por Telegram
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<boolean>} true si el envío es exitoso
 */
async function sendMessage(message) {
  try {
    // Inicializar el servicio si no está inicializado
    if (!telegramService.isInitialized()) {
      initialize();
    }
    
    // Enviar mensaje a todos los chats autorizados
    const result = await telegramService.broadcastMessage(message, { parse_mode: 'Markdown' });
    
    return result.success;
  } catch (error) {
    console.error('Error al enviar mensaje por Telegram:', error);
    return false;
  }
}

/**
 * Actualiza la configuración del servicio
 * @param {Object} newConfig - Nueva configuración
 */
function updateConfig(newConfig) {
  Object.assign(config, newConfig);
}

/**
 * Verifica si el servicio está inicializado
 * @returns {boolean} true si está inicializado
 */
function isInitialized() {
  return telegramService.isInitialized();
}

module.exports = {
  initialize,
  sendQR,
  sendMessage,
  updateConfig,
  isInitialized
};