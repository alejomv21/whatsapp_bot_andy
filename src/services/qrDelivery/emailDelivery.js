/**
 * emailDelivery.js - Módulo específico para envío de códigos QR por correo electrónico
 * Utiliza el servicio base de email para la comunicación
 */

const emailService = require('../communications/emailService');
const dotenv = require('dotenv');

// Cargar variables de entorno si no se han cargado
if (!process.env.NODE_ENV) {
  dotenv.config();
}

// Configuración específica para envío de QR
const config = {
  to: process.env.ADMIN_EMAIL || process.env.EMAIL_TO,
  subject: process.env.QR_EMAIL_SUBJECT || 'Código QR para reconexión de WhatsApp Bot',
  text: process.env.QR_EMAIL_TEXT || 'Se ha generado un nuevo código QR para reconectar el bot de WhatsApp. Escanéalo desde la app para reactivar la conexión.'
};

/**
 * Inicializa el servicio de envío de QR por correo
 * @param {Object} customConfig - Configuración personalizada (opcional)
 * @returns {boolean} true si la inicialización es exitosa
 */
function initialize(customConfig = {}) {
  try {
    // Combinar configuración por defecto con personalizada
    Object.assign(config, customConfig);
    
    // Verificar configuración mínima
    if (!config.to) {
      console.error('Email de destino no configurado. Verifica las variables de entorno.');
      return false;
    }
    
    // Inicializar el servicio base de email si no está inicializado
    if (!emailService.isInitialized()) {
      return emailService.initialize();
    }
    
    return true;
  } catch (error) {
    console.error('Error al inicializar el servicio de envío de QR por correo:', error);
    return false;
  }
}

/**
 * Envía un código QR por correo electrónico
 * @param {string} qrImagePath - Ruta a la imagen del código QR
 * @returns {Promise<boolean>} true si el envío es exitoso
 */
async function sendQR(qrImagePath) {
  try {
    // Inicializar el servicio si no está inicializado
    if (!emailService.isInitialized()) {
      initialize();
    }
    
    // Configurar opciones para el envío
    const options = {
      to: config.to,
      subject: config.subject,
      text: config.text,
      imagePath: qrImagePath,
      imageAlt: 'Código QR de WhatsApp',
      imageCid: 'whatsapp-qr'
    };
    
    // Enviar correo con imagen
    const result = await emailService.sendEmailWithImage(options);
    
    if (result.success) {
      console.log('QR enviado por correo:', result.messageId);
      return true;
    } else {
      console.error('Error al enviar QR por correo:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error al enviar QR por correo:', error);
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

module.exports = {
  initialize,
  sendQR,
  updateConfig
};