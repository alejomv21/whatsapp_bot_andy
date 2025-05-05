/**
 * incomingMessage.js - Maneja los mensajes entrantes de WhatsApp
 */

const stateManager = require("../services/stateManager");
const commandHandler = require("../services/commandHandler");
const timeManager = require("../services/timeManager");
const dialogflowHandler = require("../services/dialogflowHandler");
const { sendBotMessage } = require("../services/messageService");
const { processIntent } = require("./intentProcessor");

/**
 * Procesa los mensajes entrantes de WhatsApp
 * @param {Object} sock - Instancia del socket de WhatsApp
 * @param {Object} message - Mensaje recibido
 */
async function handleIncomingMessage(sock, message) {
  const chatId = message.key.remoteJid;

  // Verificar si el mensaje proviene de un grupo
  if (chatId.endsWith("@g.us")) {
    console.log(`Mensaje de grupo ignorado: ${chatId}`);
    return; // Ignorar mensajes de grupos
  }

  const userId = chatId.split("@")[0];
  const userMessage = message.message.conversation || 
                      message.message.extendedTextMessage?.text || 
                      "";

  console.log(`[${userId}]: ${userMessage}`);

  // 1. Verificar si es mensaje del propietario (prioridad máxima)
  if (commandHandler.isOwner(userId)) {
    console.log(`Mensaje del propietario: ${userMessage}`);
    
    // Si es un comando, procesarlo
    if (commandHandler.isCommand(userMessage)) {
      await commandHandler.handleCommand(sock, message);
      return;
    }
    // Si no es comando, detectar intervención manual
    else if (commandHandler.detectOwnerMessage(chatId, userMessage)) {
      return; // No necesitamos enviar mensaje cuando el propietario interviene
    }
  }

  // 2. Verificar si el chat está desactivado
  if (commandHandler.isChatDisabled(chatId)) {
    console.log(`Bot desactivado para ${chatId}. Ignorando mensaje.`);
    return;
  }

  // 3. Obtener estado del usuario
  const userState = stateManager.getUserState(userId);
  
  // Preparar contextos para Dialogflow
  let currentContexts = [];
  if (userState.currentContext) {
    currentContexts.push(userState.currentContext);
  }

  // 4. Procesar el mensaje con Dialogflow
  try {
    const dialogflowResponse = await dialogflowHandler.detectIntentWithContexts(
      userId,
      userMessage,
      userState.languageCode || "es",
      currentContexts
    );

    console.log("Respuesta de Dialogflow:", dialogflowResponse);
    console.log("Idioma:", dialogflowResponse.queryResult.languageCode);

    const intent = dialogflowResponse.queryResult.intent.displayName;
    const parameters = dialogflowResponse.queryResult.parameters.fields;

    // Obtener contextos activos para debugging
    const outputContexts = dialogflowResponse.queryResult.outputContexts || [];
    const activeContextNames = outputContexts.map(context => {
      const parts = context.name.split('/');
      return parts[parts.length - 1];
    });
    console.log("Contextos activos después de la respuesta:", activeContextNames);

    // 5. Verificar si el proceso ha sido completado
    if (intent === "ProcessCompleted" || userState.processCompleted) {
      console.log("Proceso completado, desactivando el bot por 24 horas.");
      
      // Marcar el chat como completado
      commandHandler.markProcessCompleted(chatId);

      // Enviar mensaje de despedida final
      const language = userState.languageCode || "es";
      const farewellMsg = language === "en"
        ? "Thank you for your inquiry! We've registered your information."
        : "¡Gracias por tu consulta! Hemos registrado tu información.";

      await sendBotMessage(sock, chatId, farewellMsg);

      // Actualizar estado para próxima interacción
      stateManager.updateUserState(userId, {
        currentContext: "",
        processCompleted: false,
      });
      return;
    }

    // 6. Continuar con el procesamiento normal de intenciones
    await processIntent(sock, chatId, userId, intent, parameters, userState, userMessage);
  } catch (error) {
    console.error("Error al procesar mensaje con Dialogflow:", error);

    // Enviar un mensaje de error genérico
    const errorMsg = userState.languageCode === "en"
      ? "I'm sorry, there was an error processing your message. Please try again later."
      : "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta más tarde.";

    await sendBotMessage(sock, chatId, errorMsg);
  }
}

module.exports = {
  handleIncomingMessage
};