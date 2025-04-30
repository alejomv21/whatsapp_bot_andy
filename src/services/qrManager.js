/**
 * qrManager.js - Gestión centralizada de códigos QR para WhatsApp
 * Permite compartir los códigos QR de reconexión a través de diferentes métodos
 * Utiliza servicios base de comunicación reutilizables
 */

const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const dotenv = require('dotenv');

// Cargar variables de entorno si no se han cargado
if (!process.env.NODE_ENV) {
  dotenv.config();
}

// Importar los diferentes métodos de entrega de QR
const emailDelivery = require('./qrDelivery/emailDelivery');
const apiDelivery = require('./qrDelivery/apiDelivery');
const telegramDelivery = require('./qrDelivery/telegramDelivery');

// Estado del QR actual
let currentQR = null;
let qrTimestamp = null;
let qrImageBuffer = null;
let initialized = false;

// Configuración por defecto (se puede sobreescribir)
const config = {
  tempDir: path.join(__dirname, '..', '..', 'temp'),
  qrLifetime: 60000, // 60 segundos
  deliveryMethods: {
    email: process.env.QR_DELIVERY_EMAIL === 'true',
    api: process.env.QR_DELIVERY_API === 'true',
    telegram: process.env.QR_DELIVERY_TELEGRAM === 'true',
    console: true // El QR en consola siempre está activado
  }
};

/**
 * Inicializa el gestor de QR
 * @param {Object} customConfig - Configuración personalizada
 */
function initialize(customConfig = {}) {
  // Combinar configuración por defecto con personalizada
  Object.assign(config, customConfig);
  
  // Crear directorio temporal si no existe
  if (!fs.existsSync(config.tempDir)) {
    fs.mkdirSync(config.tempDir, { recursive: true });
    console.log(`Directorio temporal creado: ${config.tempDir}`);
  }
  
  // Inicializar los métodos de entrega activados
  if (config.deliveryMethods.api) {
    apiDelivery.initialize();
    console.log('API para entrega de códigos QR inicializada');
  }
  
  if (config.deliveryMethods.telegram) {
    telegramDelivery.initialize();
    console.log('Bot de Telegram para entrega de códigos QR inicializado');
  }
  
  if (config.deliveryMethods.email) {
    emailDelivery.initialize();
    console.log('Servicio de correo para entrega de códigos QR inicializado');
  }
  
  initialized = true;
  console.log('Gestor de códigos QR inicializado');
}

/**
 * Procesa un nuevo código QR y lo distribuye según la configuración
 * @param {string} qrData - Datos del código QR
 */
async function handleQR(qrData) {
  try {
    // Verificar si el gestor está inicializado
    if (!initialized) {
      initialize();
    }
    
    // Guardar datos del QR
    currentQR = qrData;
    qrTimestamp = Date.now();
    
    console.log('Nuevo código QR generado');
    
    // Generar imagen del QR (para envío por correo, Telegram, etc.)
    const qrImagePath = path.join(config.tempDir, 'temp-qr.png');
    await qrcode.toFile(qrImagePath, qrData);
    
    // Guardar buffer de la imagen para uso posterior
    qrImageBuffer = fs.readFileSync(qrImagePath);
    
    // También generar base64 para web
    const qrBase64 = await qrcode.toDataURL(qrData);
    
    // Distribuir el QR a través de los diferentes métodos activos
    const deliveryPromises = [];
    
    // 1. Email
    if (config.deliveryMethods.email) {
      deliveryPromises.push(
        emailDelivery.sendQR(qrImagePath)
          .then(success => {
            if (success) {
              console.log('QR enviado por correo electrónico');
            }
            return { method: 'email', success };
          })
          .catch(err => {
            console.error('Error al enviar QR por correo:', err);
            return { method: 'email', success: false, error: err.message };
          })
      );
    }
    
    // 2. API Web
    if (config.deliveryMethods.api) {
      try {
        apiDelivery.updateQR(qrBase64, qrTimestamp);
        deliveryPromises.push(Promise.resolve({ method: 'api', success: true }));
      } catch (err) {
        console.error('Error al actualizar QR en API:', err);
        deliveryPromises.push(Promise.resolve({ method: 'api', success: false, error: err.message }));
      }
    }
    
    // 3. Telegram
    if (config.deliveryMethods.telegram) {
      deliveryPromises.push(
        telegramDelivery.sendQR(qrImagePath)
          .then(success => {
            if (success) {
              console.log('QR enviado por Telegram');
            }
            return { method: 'telegram', success };
          })
          .catch(err => {
            console.error('Error al enviar QR por Telegram:', err);
            return { method: 'telegram', success: false, error: err.message };
          })
      );
    }
    
    // Esperar a que todos los métodos de entrega terminen
    const results = await Promise.allSettled(deliveryPromises);
    
    // Limpieza: Eliminar archivo temporal después de su uso
    // Dejamos un pequeño retraso para asegurar que los servicios tengan tiempo de usarlo
    setTimeout(() => {
      if (fs.existsSync(qrImagePath)) {
        fs.unlinkSync(qrImagePath);
      }
    }, 5000);
    
    // Analizar resultados
    const successCount = results
      .filter(r => r.status === 'fulfilled' && r.value && r.value.success)
      .length;
    
    if (deliveryPromises.length > 0 && successCount === 0) {
      console.warn('Ningún método de entrega de QR tuvo éxito');
    } else if (successCount > 0) {
      console.log(`QR entregado correctamente a través de ${successCount} método(s)`);
    }
    
    return {
      success: successCount > 0 || deliveryPromises.length === 0,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    };
  } catch (error) {
    console.error('Error al procesar el código QR:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verifica si el QR actual ha expirado
 * @returns {boolean} true si el QR ha expirado
 */
function isQRExpired() {
  if (!qrTimestamp) return true;
  return (Date.now() - qrTimestamp) > config.qrLifetime;
}

/**
 * Obtiene el estado actual del QR
 * @returns {Object} Estado del QR
 */
function getQRStatus() {
  return {
    exists: !!currentQR,
    timestamp: qrTimestamp,
    expired: isQRExpired(),
    timeRemaining: qrTimestamp ? Math.max(0, config.qrLifetime - (Date.now() - qrTimestamp)) : 0
  };
}

/**
 * Obtiene la imagen del QR actual
 * @returns {Buffer|null} Buffer de la imagen o null si no hay QR
 */
function getQRImage() {
  if (!qrImageBuffer || isQRExpired()) return null;
  return qrImageBuffer;
}

/**
 * Activa o desactiva un método de entrega
 * @param {string} method - Método a configurar (email, api, telegram)
 * @param {boolean} enabled - Estado (activado/desactivado)
 */
function configureDeliveryMethod(method, enabled) {
  if (config.deliveryMethods.hasOwnProperty(method)) {
    config.deliveryMethods[method] = enabled;
    console.log(`Método de entrega '${method}' ${enabled ? 'activado' : 'desactivado'}`);
    
    // Si se está activando, inicializar si es necesario
    if (enabled) {
      if (method === 'api' && !apiDelivery.isInitialized()) {
        apiDelivery.initialize();
      } else if (method === 'telegram' && !telegramDelivery.isInitialized()) {
        telegramDelivery.initialize();
      } else if (method === 'email') {
        emailDelivery.initialize();
      }
    }
  }
}

/**
 * Verifica si el gestor está inicializado
 * @returns {boolean} true si está inicializado
 */
function isInitialized() {
  return initialized;
}

/**
 * Notifica un cambio de estado de la conexión mediante Telegram (si está habilitado)
 * @param {string} status - Estado de la conexión 
 * @param {Object} details - Detalles adicionales
 */
function notifyConnectionStatus(status, details = {}) {
  // Solo notificar si Telegram está habilitado
  if (!config.deliveryMethods.telegram || !telegramDelivery.isInitialized()) {
    return false;
  }
  
  let message = '';
  
  switch (status) {
    case 'connected':
      message = '✅ *Conexión establecida*\nEl bot de WhatsApp se ha conectado correctamente.';
      break;
    case 'disconnected':
      message = `⚠️ *Conexión cerrada*\nRazón: ${details.reason || 'Desconocida'}${details.code ? `\nCódigo: ${details.code}` : ''}`;
      break;
    case 'connecting':
      message = '🔄 *Conectando*\nIntentando establecer conexión...';
      break;
    case 'reconnecting':
      message = `🔄 *Reconectando*\nIntento ${details.retry || '?'}/${details.maxRetries || '?'}`;
      break;
    case 'qr_generated':
      message = '📱 *Código QR generado*\nSe te ha enviado el código QR para reconectar. Revisa los mensajes.';
      break;
    default:
      message = `ℹ️ *Estado actualizado*\nEstado actual: ${status}`;
  }
  
  // Añadir detalles adicionales si existen
  if (details.message) {
    message += `\n\n${details.message}`;
  }
  
  // Enviar notificación por Telegram
  return telegramDelivery.sendMessage(message)
    .then(success => {
      if (success) {
        console.log(`Notificación de estado "${status}" enviada por Telegram`);
      }
      return success;
    })
    .catch(err => {
      console.error('Error al enviar notificación de estado por Telegram:', err);
      return false;
    });
}

/**
 * Detiene todos los servicios de entrega
 */
function shutdown() {
  // Detener API si está inicializada
  if (config.deliveryMethods.api && apiDelivery.isInitialized()) {
    apiDelivery.stop();
  }
  
  // Limpiar recursos y archivos temporales
  if (fs.existsSync(path.join(config.tempDir, 'temp-qr.png'))) {
    try {
      fs.unlinkSync(path.join(config.tempDir, 'temp-qr.png'));
    } catch (err) {
      console.error('Error al eliminar archivo temporal de QR:', err);
    }
  }
  
  // Marcar como no inicializado
  initialized = false;
  console.log('Gestor de QR detenido');
}

module.exports = {
  initialize,
  handleQR,
  getQRStatus,
  getQRImage,
  configureDeliveryMethod,
  isInitialized,
  notifyConnectionStatus,
  shutdown,
  isQRExpired
};