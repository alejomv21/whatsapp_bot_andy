/**
 * telegramService.js - Servicio genérico para comunicación con Telegram
 * Puede ser reutilizado en cualquier parte de la aplicación
 */

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const dotenv = require('dotenv');

// Cargar variables de entorno si no se han cargado
if (!process.env.NODE_ENV) {
  dotenv.config();
}

// Configuración por defecto del bot de Telegram
const defaultConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
  authorizedChatIds: process.env.TELEGRAM_AUTHORIZED_CHAT_IDS 
    ? process.env.TELEGRAM_AUTHORIZED_CHAT_IDS.split(',') 
    : []
};

// Variables del bot
let bot = null;
let initialized = false;
let config = { ...defaultConfig };

// Mantener un registro de eventos
const events = [];

/**
 * Inicializa el bot de Telegram con configuración personalizada
 * @param {Object} customConfig - Configuración personalizada (opcional)
 * @returns {boolean} true si la inicialización es exitosa
 */
function initialize(customConfig = {}) {
  try {
    // Combinar configuración por defecto con personalizada
    config = { ...defaultConfig, ...customConfig };
    
    // Verificar configuración mínima
    if (!config.token) {
      console.error('Token de bot de Telegram no configurado. Verifica las variables de entorno.');
      return false;
    }
    
    // Si ya está inicializado, detener el bot actual
    if (initialized && bot) {
      bot.stopPolling();
      bot = null;
    }
    
    // Añadir admin chat ID a la lista de autorizados si existe
    if (config.adminChatId && !config.authorizedChatIds.includes(config.adminChatId)) {
      config.authorizedChatIds.push(config.adminChatId);
    }
    
    // Crear bot
    bot = new TelegramBot(config.token, { polling: true });
    
    // Configurar manejo básico de mensajes y comandos
    setupBasicHandlers();
    
    console.log('Bot de Telegram inicializado');
    initialized = true;
    logEvent('initialize', { success: true });
    return true;
  } catch (error) {
    console.error('Error al inicializar el bot de Telegram:', error);
    logEvent('initialize', { success: false, error: error.message });
    initialized = false;
    return false;
  }
}

/**
 * Configura los manejadores básicos del bot
 */
function setupBasicHandlers() {
  // Manejar comando /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const isAuthorized = isAuthorizedChat(chatId);
    
    if (isAuthorized) {
      bot.sendMessage(chatId, '✅ Bot conectado. Este bot puede enviar notificaciones y actualizaciones.');
      
      // Si es la primera vez que se conecta y es autorizado, guardar el chat ID
      if (chatId.toString() !== config.adminChatId && !config.authorizedChatIds.includes(chatId.toString())) {
        config.authorizedChatIds.push(chatId.toString());
        console.log(`Nuevo chat autorizado: ${chatId}`);
      }
    } else {
      bot.sendMessage(chatId, '❌ No tienes autorización para usar este bot. Contacta al administrador.');
    }
    
    logEvent('start_command', { chatId, isAuthorized });
  });
  
  // Manejar comando /status
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    
    if (isAuthorizedChat(chatId)) {
      const uptime = process.uptime();
      const uptimeStr = formatUptime(uptime);
      
      bot.sendMessage(chatId, 
        `📊 *Estado del Bot*\n\n` +
        `🔄 *Tiempo activo:* ${uptimeStr}\n` +
        `👥 *Usuarios autorizados:* ${config.authorizedChatIds.length}\n` +
        `🔐 *Tu ID:* \`${chatId}\`\n\n` +
        `El bot está funcionando correctamente.`,
        { parse_mode: 'Markdown' }
      );
    }
    
    logEvent('status_command', { chatId });
  });
  
  // Manejar comando /help
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    if (isAuthorizedChat(chatId)) {
      bot.sendMessage(chatId,
        `📚 *Comandos disponibles*\n\n` +
        `/start - Iniciar el bot\n` +
        `/status - Ver estado del bot\n` +
        `/help - Mostrar este mensaje\n\n` +
        `Este bot se usa para enviar notificaciones y actualizaciones importantes.`,
        { parse_mode: 'Markdown' }
      );
    }
    
    logEvent('help_command', { chatId });
  });
  
  // Registrar eventos personalizados
  bot.on('callback_query', (query) => {
    logEvent('callback_query', { 
      chatId: query.message.chat.id,
      data: query.data, 
      messageId: query.message.message_id 
    });
  });
}

/**
 * Verifica si un chat está autorizado
 * @param {string|number} chatId - ID del chat a verificar
 * @returns {boolean} true si está autorizado
 */
function isAuthorizedChat(chatId) {
  const chatIdStr = chatId.toString();
  return config.authorizedChatIds.includes(chatIdStr) || chatIdStr === config.adminChatId;
}

/**
 * Envía un mensaje de texto a un chat específico
 * @param {string|number} chatId - ID del chat destinatario
 * @param {string} text - Texto del mensaje
 * @param {Object} options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendMessage(chatId, text, options = {}) {
  try {
    // Verificar si el bot está inicializado
    if (!initialized || !bot) {
      const initResult = initialize();
      if (!initResult) {
        throw new Error('No se pudo inicializar el bot de Telegram');
      }
    }
    
    // Verificar si el chat está autorizado
    if (!isAuthorizedChat(chatId)) {
      throw new Error(`Chat no autorizado: ${chatId}`);
    }
    
    // Enviar mensaje
    const sent = await bot.sendMessage(chatId, text, options);
    
    logEvent('send_message', { chatId, success: true });
    return {
      success: true,
      messageId: sent.message_id
    };
  } catch (error) {
    console.error('Error al enviar mensaje por Telegram:', error);
    logEvent('send_message', { chatId, success: false, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envía un mensaje a todos los chats autorizados
 * @param {string} text - Texto del mensaje
 * @param {Object} options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
async function broadcastMessage(text, options = {}) {
  try {
    // Verificar si el bot está inicializado
    if (!initialized || !bot) {
      const initResult = initialize();
      if (!initResult) {
        throw new Error('No se pudo inicializar el bot de Telegram');
      }
    }
    
    // Verificar si hay destinatarios
    if (config.authorizedChatIds.length === 0) {
      throw new Error('No hay chats autorizados para enviar el mensaje');
    }
    
    // Array para almacenar promesas de mensajes
    const messagePromises = [];
    const sentMessageIds = [];
    
    // Enviar mensaje a todos los chats autorizados
    for (const chatId of config.authorizedChatIds) {
      if (chatId) { // Asegurar que hay un chatId válido
        try {
          const sent = await bot.sendMessage(chatId, text, options);
          sentMessageIds.push({ chatId, messageId: sent.message_id });
          messagePromises.push(Promise.resolve(sent));
        } catch (err) {
          console.error(`Error al enviar a ${chatId}:`, err.message);
          messagePromises.push(Promise.reject(err));
        }
      }
    }
    
    // Esperar a que todos los mensajes se envíen
    const results = await Promise.allSettled(messagePromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    logEvent('broadcast_message', { 
      success: successCount > 0, 
      totalChats: config.authorizedChatIds.length,
      successCount 
    });
    
    return {
      success: successCount > 0,
      totalSent: successCount,
      totalFailed: config.authorizedChatIds.length - successCount,
      sentMessageIds
    };
  } catch (error) {
    console.error('Error en broadcast por Telegram:', error);
    logEvent('broadcast_message', { success: false, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envía una imagen a un chat específico
 * @param {string|number} chatId - ID del chat destinatario
 * @param {string|Buffer|stream.ReadStream} photo - Ruta del archivo, Buffer o Stream de la imagen
 * @param {Object} options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendPhoto(chatId, photo, options = {}) {
  try {
    // Verificar si el bot está inicializado
    if (!initialized || !bot) {
      const initResult = initialize();
      if (!initResult) {
        throw new Error('No se pudo inicializar el bot de Telegram');
      }
    }
    
    // Verificar si el chat está autorizado
    if (!isAuthorizedChat(chatId)) {
      throw new Error(`Chat no autorizado: ${chatId}`);
    }
    
    // Si photo es una ruta de archivo, verificar que existe
    if (typeof photo === 'string' && photo.indexOf('/') !== -1) {
      if (!fs.existsSync(photo)) {
        throw new Error(`El archivo no existe: ${photo}`);
      }
      photo = fs.createReadStream(photo);
    }
    
    // Enviar imagen
    const sent = await bot.sendPhoto(chatId, photo, options);
    
    logEvent('send_photo', { chatId, success: true });
    return {
      success: true,
      messageId: sent.message_id
    };
  } catch (error) {
    console.error('Error al enviar imagen por Telegram:', error);
    logEvent('send_photo', { chatId, success: false, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envía una imagen a todos los chats autorizados
 * @param {string|Buffer|stream.ReadStream} photo - Ruta del archivo, Buffer o Stream de la imagen
 * @param {Object} options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
async function broadcastPhoto(photo, options = {}) {
  try {
    // Verificar si el bot está inicializado
    if (!initialized || !bot) {
      const initResult = initialize();
      if (!initResult) {
        throw new Error('No se pudo inicializar el bot de Telegram');
      }
    }
    
    // Verificar si hay destinatarios
    if (config.authorizedChatIds.length === 0) {
      throw new Error('No hay chats autorizados para enviar la imagen');
    }
    
    // Si photo es una ruta de archivo, verificar que existe
    let photoStream = photo;
    if (typeof photo === 'string' && photo.indexOf('/') !== -1) {
      if (!fs.existsSync(photo)) {
        throw new Error(`El archivo no existe: ${photo}`);
      }
    }
    
    // Array para almacenar promesas de mensajes
    const messagePromises = [];
    const sentMessageIds = [];
    
    // Enviar imagen a todos los chats autorizados
    for (const chatId of config.authorizedChatIds) {
      if (chatId) { // Asegurar que hay un chatId válido
        try {
          // Para cada envío, crear un nuevo stream si es necesario
          if (typeof photo === 'string' && photo.indexOf('/') !== -1) {
            photoStream = fs.createReadStream(photo);
          }
          
          const sent = await bot.sendPhoto(chatId, photoStream, options);
          sentMessageIds.push({ chatId, messageId: sent.message_id });
          messagePromises.push(Promise.resolve(sent));
        } catch (err) {
          console.error(`Error al enviar foto a ${chatId}:`, err.message);
          messagePromises.push(Promise.reject(err));
        }
      }
    }
    
    // Esperar a que todos los mensajes se envíen
    const results = await Promise.allSettled(messagePromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    logEvent('broadcast_photo', { 
      success: successCount > 0, 
      totalChats: config.authorizedChatIds.length,
      successCount 
    });
    
    return {
      success: successCount > 0,
      totalSent: successCount,
      totalFailed: config.authorizedChatIds.length - successCount,
      sentMessageIds
    };
  } catch (error) {
    console.error('Error en broadcast de foto por Telegram:', error);
    logEvent('broadcast_photo', { success: false, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envía un documento a un chat específico
 * @param {string|number} chatId - ID del chat destinatario
 * @param {string|Buffer|stream.ReadStream} document - Ruta del archivo, Buffer o Stream del documento
 * @param {Object} options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendDocument(chatId, document, options = {}) {
  try {
    // Verificar si el bot está inicializado
    if (!initialized || !bot) {
      const initResult = initialize();
      if (!initResult) {
        throw new Error('No se pudo inicializar el bot de Telegram');
      }
    }
    
    // Verificar si el chat está autorizado
    if (!isAuthorizedChat(chatId)) {
      throw new Error(`Chat no autorizado: ${chatId}`);
    }
    
    // Si document es una ruta de archivo, verificar que existe
    if (typeof document === 'string' && document.indexOf('/') !== -1) {
      if (!fs.existsSync(document)) {
        throw new Error(`El archivo no existe: ${document}`);
      }
      document = fs.createReadStream(document);
    }
    
    // Enviar documento
    const sent = await bot.sendDocument(chatId, document, options);
    
    logEvent('send_document', { chatId, success: true });
    return {
      success: true,
      messageId: sent.message_id
    };
  } catch (error) {
    console.error('Error al enviar documento por Telegram:', error);
    logEvent('send_document', { chatId, success: false, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envía un mensaje con botones inline
 * @param {string|number} chatId - ID del chat destinatario
 * @param {string} text - Texto del mensaje
 * @param {Array} buttons - Array de botones en formato [[{text, callback_data}]]
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendInlineKeyboard(chatId, text, buttons) {
  try {
    // Verificar si el bot está inicializado
    if (!initialized || !bot) {
      const initResult = initialize();
      if (!initResult) {
        throw new Error('No se pudo inicializar el bot de Telegram');
      }
    }
    
    // Verificar si el chat está autorizado
    if (!isAuthorizedChat(chatId)) {
      throw new Error(`Chat no autorizado: ${chatId}`);
    }
    
    // Configurar opciones con teclado inline
    const options = {
      reply_markup: {
        inline_keyboard: buttons
      },
      parse_mode: 'Markdown'
    };
    
    // Enviar mensaje con botones
    const sent = await bot.sendMessage(chatId, text, options);
    
    logEvent('send_inline_keyboard', { chatId, success: true });
    return {
      success: true,
      messageId: sent.message_id
    };
  } catch (error) {
    console.error('Error al enviar teclado inline por Telegram:', error);
    logEvent('send_inline_keyboard', { chatId, success: false, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Actualiza un mensaje existente
 * @param {string|number} chatId - ID del chat
 * @param {number} messageId - ID del mensaje a actualizar
 * @param {string} text - Nuevo texto
 * @param {Object} options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Resultado de la actualización
 */
async function editMessage(chatId, messageId, text, options = {}) {
  try {
    // Verificar si el bot está inicializado
    if (!initialized || !bot) {
      const initResult = initialize();
      if (!initResult) {
        throw new Error('No se pudo inicializar el bot de Telegram');
      }
    }
    
    // Verificar si el chat está autorizado
    if (!isAuthorizedChat(chatId)) {
      throw new Error(`Chat no autorizado: ${chatId}`);
    }
    
    // Actualizar mensaje
    const updated = await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      ...options
    });
    
    logEvent('edit_message', { chatId, messageId, success: true });
    return {
      success: true,
      updated
    };
  } catch (error) {
    console.error('Error al editar mensaje por Telegram:', error);
    logEvent('edit_message', { chatId, messageId, success: false, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Registra un manejador para un comando personalizado
 * @param {string|RegExp} command - Comando a manejar (ej: '/micomando')
 * @param {Function} handler - Función manejadora (recibe msg y match)
 */
function registerCommand(command, handler) {
  try {
    // Verificar si el bot está inicializado
    if (!initialized || !bot) {
      const initResult = initialize();
      if (!initResult) {
        throw new Error('No se pudo inicializar el bot de Telegram');
      }
    }
    
    // Registrar comando
    bot.onText(command, (msg, match) => {
      const chatId = msg.chat.id;
      
      // Solo permitir comandos de chats autorizados
      if (isAuthorizedChat(chatId)) {
        handler(msg, match);
      } else {
        bot.sendMessage(chatId, '❌ No tienes autorización para usar este comando.');
      }
      
      logEvent('command', { command: match[0], chatId });
    });
    
    console.log(`Comando registrado: ${command}`);
    return true;
  } catch (error) {
    console.error('Error al registrar comando:', error);
    return false;
  }
}

/**
 * Registra un evento en el sistema
 * @param {string} type - Tipo de evento
 * @param {Object} data - Datos asociados al evento
 */
function logEvent(type, data) {
  const event = {
    type,
    timestamp: new Date(),
    data
  };
  
  events.push(event);
  
  // Limitar el tamaño del registro de eventos
  if (events.length > 100) {
    events.shift(); // Eliminar el evento más antiguo
  }
}

/**
 * Formatea el tiempo de actividad en un formato legible
 * @param {number} uptime - Tiempo de actividad en segundos
 * @returns {string} Tiempo formateado
 */
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  let uptimeStr = '';
  if (days > 0) uptimeStr += `${days}d `;
  if (hours > 0) uptimeStr += `${hours}h `;
  if (minutes > 0) uptimeStr += `${minutes}m `;
  uptimeStr += `${seconds}s`;
  
  return uptimeStr;
}

/**
 * Obtiene los eventos registrados
 * @param {number} limit - Límite de eventos a obtener (opcional)
 * @returns {Array} Lista de eventos
 */
function getEvents(limit = 10) {
  return events.slice(-limit);
}

/**
 * Obtiene la lista de chats autorizados
 * @returns {Array} Lista de IDs de chat autorizados
 */
function getAuthorizedChats() {
  return [...config.authorizedChatIds];
}

/**
 * Añade un chat a la lista de autorizados
 * @param {string|number} chatId - ID del chat a autorizar
 * @returns {boolean} true si se añadió correctamente
 */
function addAuthorizedChat(chatId) {
  const chatIdStr = chatId.toString();
  
  if (!config.authorizedChatIds.includes(chatIdStr)) {
    config.authorizedChatIds.push(chatIdStr);
    console.log(`Chat autorizado añadido: ${chatId}`);
    return true;
  }
  
  return false; // Ya estaba autorizado
}

/**
 * Elimina un chat de la lista de autorizados
 * @param {string|number} chatId - ID del chat a desautorizar
 * @returns {boolean} true si se eliminó correctamente
 */
function removeAuthorizedChat(chatId) {
  const chatIdStr = chatId.toString();
  const index = config.authorizedChatIds.indexOf(chatIdStr);
  
  if (index !== -1) {
    // No permitir eliminar el chat del administrador
    if (chatIdStr === config.adminChatId) {
      console.warn(`No se puede eliminar el chat del administrador: ${chatId}`);
      return false;
    }
    
    config.authorizedChatIds.splice(index, 1);
    console.log(`Chat autorizado eliminado: ${chatId}`);
    return true;
  }
  
  return false; // No estaba autorizado
}

/**
 * Detiene el bot de Telegram
 */
function stop() {
  if (initialized && bot) {
    bot.stopPolling();
    console.log('Bot de Telegram detenido');
    bot = null;
    initialized = false;
    logEvent('stop', { success: true });
    return true;
  }
  
  return false;
}

/**
 * Verifica si el bot está inicializado
 * @returns {boolean} true si el bot está inicializado
 */
function isInitialized() {
  return initialized;
}

/**
 * Obtiene la instancia del bot para uso avanzado
 * @returns {TelegramBot|null} Instancia del bot o null si no está inicializado
 */
function getBotInstance() {
  return bot;
}

module.exports = {
  initialize,
  isInitialized,
  sendMessage,
  broadcastMessage,
  sendPhoto,
  broadcastPhoto,
  sendDocument,
  sendInlineKeyboard,
  editMessage,
  registerCommand,
  getEvents,
  getAuthorizedChats,
  addAuthorizedChat,
  removeAuthorizedChat,
  stop,
  getBotInstance
};