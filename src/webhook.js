/**
 * webhook.js - Servidor para webhook de Dialogflow
 * Maneja las respuestas de Dialogflow mediante fulfillment
 */

const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');
const stateManager = require('./stateManager');
const timeManager = require('./timeManager');
const messageProvider = require('./messageProvider');

// Inicializar express
const app = express();
app.use(express.json());

const PORT = process.env.WEBHOOK_PORT || 3000;

/**
 * Manejador para la intención de selección de producto
 * @param {WebhookClient} agent Cliente de webhook de Dialogflow
 */
function handleProductSelection(agent) {
  // Extraer parámetros de la consulta
  const productType = agent.parameters.product_type || '';
  
  // Extraer ID de usuario de la sesión
  const sessionPath = agent.session;
  const sessionParts = sessionPath.split('/');
  const userId = sessionParts[sessionParts.length - 1];
  
  // Obtener estado del usuario
  const userState = stateManager.getUserState(userId);
  const languageCode = userState.languageCode || 'es';
  
  // Preparar respuesta según el producto seleccionado
  let response = '';
  
  if (['relojes', 'watches', '1'].includes(productType)) {
    response = messageProvider.getWatchesResponse(languageCode);
    stateManager.updateUserState(userId, { 
      selectedProduct: 'watches',
      currentContext: 'watches_info' 
    });
  } else if (['diamantes', 'diamonds', '2'].includes(productType)) {
    response = messageProvider.getDiamondsResponse(languageCode);
    stateManager.updateUserState(userId, { 
      selectedProduct: 'diamonds',
      currentContext: 'diamonds_info' 
    });
  } else if (['oro', 'plata', 'gold', 'silver', '3'].includes(productType)) {
    response = messageProvider.getGoldResponse(languageCode);
    stateManager.updateUserState(userId, { 
      selectedProduct: 'gold',
      currentContext: 'gold_info' 
    });
  } else {
    // Si no se reconoce el producto, enviar un mensaje de fallback
    response = messageProvider.getFallbackMessage(languageCode);
    stateManager.updateUserState(userId, { currentContext: 'fallback' });
  }
  
  // Añadir mensaje de cierre según horario de atención
  const isBusinessHours = timeManager.isBusinessHours();
  const closingMessage = messageProvider.getClosingMessage(languageCode, isBusinessHours);
  
  response += '\n\n' + closingMessage;
  
  // Enviar respuesta
  agent.add(response);
}

/**
 * Manejador para la intención de selección de idioma
 * @param {WebhookClient} agent Cliente de webhook de Dialogflow
 */
function handleLanguageSelection(agent) {
  // Extraer parámetros de la consulta
  const language = agent.parameters.language || '';
  
  // Extraer ID de usuario de la sesión
  const sessionPath = agent.session;
  const sessionParts = sessionPath.split('/');
  const userId = sessionParts[sessionParts.length - 1];
  
  // Determinar el código de idioma
  let languageCode = 'es'; // Por defecto español
  
  if (['english', 'inglés', '2'].includes(language)) {
    languageCode = 'en';
  }
  
  // Actualizar estado del usuario
  stateManager.updateUserState(userId, { 
    languageCode: languageCode,
    currentContext: 'main_menu' 
  });
  
  // Preparar respuesta según horario de atención
  const isBusinessHours = timeManager.isBusinessHours();
  const response = isBusinessHours 
    ? messageProvider.getBusinessHoursMenu(languageCode)
    : messageProvider.getOutOfHoursMessage(languageCode);
  
  // Enviar respuesta
  agent.add(response);
}

/**
 * Manejador para intención de fallback
 * @param {WebhookClient} agent Cliente de webhook de Dialogflow
 */
function handleFallback(agent) {
  // Extraer ID de usuario de la sesión
  const sessionPath = agent.session;
  const sessionParts = sessionPath.split('/');
  const userId = sessionParts[sessionParts.length - 1];
  
  // Obtener estado del usuario
  const userState = stateManager.getUserState(userId);
  const languageCode = userState.languageCode || 'es';
  
  // Preparar respuesta de fallback
  const response = messageProvider.getFallbackMessage(languageCode);
  
  // Actualizar estado del usuario
  stateManager.updateUserState(userId, { currentContext: 'fallback' });
  
  // Enviar respuesta
  agent.add(response);
}

/**
 * Manejador para intención de bienvenida
 * @param {WebhookClient} agent Cliente de webhook de Dialogflow
 */
function handleWelcome(agent) {
  // Extraer ID de usuario de la sesión
  const sessionPath = agent.session;
  const sessionParts = sessionPath.split('/');
  const userId = sessionParts[sessionParts.length - 1];
  
  // Actualizar estado del usuario
  stateManager.updateUserState(userId, { 
    currentContext: 'welcome',
    languageCode: null // Reiniciar selección de idioma
  });
  
  // Obtener mensaje de bienvenida
  const response = messageProvider.getWelcomeMessage();
  
  // Enviar respuesta
  agent.add(response);
}

// Configurar ruta para webhook
app.post('/webhook', (req, res) => {
  console.log('Webhook called');
  
  const agent = new WebhookClient({ request: req, response: res });
  
  // Mapeo de intents con sus manejadores
  const intentMap = new Map();
  intentMap.set('Welcome', handleWelcome);
  intentMap.set('LanguageSelection', handleLanguageSelection);
  intentMap.set('ProductSelection', handleProductSelection);
  intentMap.set('Default Fallback Intent', handleFallback);
  
  // Procesar la solicitud
  agent.handleRequest(intentMap);
});

// Ruta de verificación de estado
app.get('/status', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    businessHours: timeManager.isBusinessHours()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor webhook iniciado en puerto ${PORT}`);
});

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Error no capturado en webhook:', err);
});

module.exports = app;