/**
 * intentProcessor.js - Procesa las intenciones detectadas por Dialogflow
 */

const stateManager = require("../services/stateManager");
const messageProvider = require("../services/messageProvider");
const timeManager = require("../services/timeManager");
const { sendBotMessage } = require("../services/messageService");

/**
 * Procesa la intención detectada por Dialogflow
 * @param {Object} sock - Instancia del socket de WhatsApp
 * @param {String} chatId - ID del chat
 * @param {String} userId - ID del usuario
 * @param {String} intent - Nombre de la intención detectada
 * @param {Object} parameters - Parámetros extraídos por Dialogflow
 * @param {Object} userState - Estado actual del usuario
 */
async function processIntent(sock, chatId, userId, intent, parameters, userState) {
  console.log('Intent detectado:', intent);
  console.log('Estado del usuario:', userState);
  console.log('Contextos activos:', userState.dialogflowContexts || []);
  
  switch (intent) {
    case "Default Welcome Intent":
      // Mensaje de bienvenida con opciones de idioma
      const welcomeMsg = messageProvider.getWelcomeMessage();
      await sendBotMessage(sock, chatId, welcomeMsg);

      stateManager.updateUserState(userId, {
        currentContext: "waiting_language_selection",
      });
      break;

    case "lenguaje":
      console.log("Parámetros de lenguaje:", parameters);

      const isLanguageSelectionContext =
        !userState.languageCode || // El usuario aún no ha seleccionado idioma
        userState.currentContext === "waiting_language_selection";

      const languageInput =
        parameters.number?.numberValue ||
        (parameters.language?.stringValue === "español"
          ? 1
          : parameters.language?.stringValue === "ingles" ||
            parameters.language?.stringValue === "english"
          ? 2
          : null) ||
        (userState.text === "1" ||
        userState.text?.toLowerCase() === "español" ||
        userState.text?.toLowerCase() === "espanol"
          ? "es"
          : userState.text === "2" ||
            userState.text?.toLowerCase() === "english" ||
            userState.text?.toLowerCase() === "ingles"
          ? "en"
          : null);

      if (languageInput) {
        console.log("Idioma detectado:", languageInput);
        const languageCode =
          languageInput === 1 ||
          languageInput === "1" ||
          languageInput === "es" ||
          languageInput === "español"
            ? "es"
            : "en";

        console.log("Código de idioma establecido:", languageCode);

        // Actualizar estado del usuario y marcar que ya pasamos la selección de idioma
        stateManager.updateUserState(userId, {
          languageCode: languageCode,
          currentContext: "language_selected", // Importante para las futuras decisiones
          languageSelectionComplete: true, // Flag explícito para verificaciones
        });

        // Verificar horario para enviar menú
        const isBusinessHours = timeManager.isBusinessHours();
        let menuMessage;
        
        if (isBusinessHours) {
          menuMessage = messageProvider.getBusinessHoursMenu(languageCode);
        } else {
          menuMessage = messageProvider.getOutOfHoursMessage(languageCode);
          stateManager.updateUserState(userId, {
            currentContext: "product_selected",
            processCompleted: true
          });
        }

        await sendBotMessage(sock, chatId, menuMessage);
      } else {
        // Idioma no reconocido, reenviar opciones
        const languagePrompt = messageProvider.getLanguagePrompt();
        stateManager.updateUserState(userId, {
          currentContext: "waiting_language_selection",
        });
        await sendBotMessage(sock, chatId, languagePrompt);
      }
      break;

    case "ProductSelection":
      // Procesamiento de selección de producto
      const productType =
        parameters.number?.numberValue || parameters.language?.stringValue;

      let responseMessage = "";

      if (["1", "relojes", "watches", 1].includes(productType)) {
        responseMessage = messageProvider.getWatchesResponse(
          userState.languageCode
        );
      } else if (["2", "diamantes", "diamonds", 2].includes(productType)) {
        responseMessage = messageProvider.getDiamondsResponse(
          userState.languageCode
        );
      } else if (
        ["3", "oro", "gold", "plata", "silver", 3].includes(productType)
      ) {
        responseMessage = messageProvider.getGoldResponse(
          userState.languageCode
        );
      } else {
        // Producto no reconocido, enviar fallback
        responseMessage = messageProvider.getFallbackMessage(
          userState.languageCode
        );
        await sendBotMessage(sock, chatId, responseMessage);
        return;
      }

      // Actualizar estado del usuario
      stateManager.updateUserState(userId, {
        currentContext: "product_selected",
        selectedProduct: productType,
        processCompleted: true
      });

      // Añadir mensaje de cierre según horario
      const closingMessage = messageProvider.getClosingMessage(
        userState.languageCode,
        timeManager.isBusinessHours()
      );

      responseMessage += "\n\n" + closingMessage;
      await sendBotMessage(sock, chatId, responseMessage);
      break;

    case "Default Fallback Intent":
      // Mensaje de fallback cuando no se entiende la solicitud
      console.log("Fallback activado, estado del usuario:", userState);
      
      if(userState.currentContext === "waiting_language_selection"){
        console.log("Idioma no reconocido, reenviar opciones");
        // Idioma no reconocido, reenviar opciones
        const languagePrompt = messageProvider.getLanguagePrompt();
        stateManager.updateUserState(userId, {
          currentContext: "waiting_language_selection",
        });
        await sendBotMessage(sock, chatId, languagePrompt);
        break;
      }

      const fallbackMsg = messageProvider.getFallbackMessage(
        userState.languageCode
      );
      await sendBotMessage(sock, chatId, fallbackMsg);
      break;

    default:
      // Cualquier otro intent no manejado específicamente
      const defaultMsg = messageProvider.getDefaultResponse(
        userState.languageCode
      );
      await sendBotMessage(sock, chatId, defaultMsg);
    }
  }


module.exports = {
  processIntent
};