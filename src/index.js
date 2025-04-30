/**
 * index.js - Archivo principal del bot de WhatsApp para Andy's Don Cash
 * Maneja la conexión con WhatsApp y el flujo principal de mensajes
 */

// Importaciones
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const result = dotenv.config();

// Módulos personalizados
const stateManager = require("./stateManager");
const commandHandler = require("./commandHandler");
const messageProvider = require("./messageProvider");
const timeManager = require("./timeManager");
const dialogflowHandler = require("./dialogflowHandler");
const backup = require("./backup");
const cleanupScheduler = require("./cleanupScheduler");
const autoReactivation = require("./autoReactivationManager");

// Configuración de logging
const logger = pino({ level: "warn" });

// Variables para la conexión
let sock = null;
let connectionRetries = 0;
const MAX_RETRIES = 5;

// Iniciar sistemas automáticos
backup.scheduleBackup();
cleanupScheduler.startScheduler();
autoReactivation.startAutoReactivation();

/**
 * Función principal para conectar con WhatsApp
 */
async function connectToWhatsApp() {
  // Cargar estado de autenticación
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  // Crear conexión
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: logger,
  });

  // Evento de conexión
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Manejo de códigos QR
    if (qr) {
      console.log("Escanea el siguiente código QR:");
      qrcode.generate(qr, { small: true });
    }

    // Manejo de estados de conexión
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect && connectionRetries < MAX_RETRIES) {
        connectionRetries++;
        console.log(
          `Intentando reconectar... (${connectionRetries}/${MAX_RETRIES})`
        );
        setTimeout(connectToWhatsApp, 5000);
      } else if (connectionRetries >= MAX_RETRIES) {
        console.error("Número máximo de intentos alcanzado. Deteniendo bot.");
        process.exit(1);
      }
    } else if (connection === "open") {
      console.log("¡Conexión establecida con WhatsApp!");
      connectionRetries = 0;
    }
  });

  // Guardar credenciales
  sock.ev.on("creds.update", saveCreds);

  // Manejar mensajes entrantes
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      for (const message of messages) {
        if (!message.key.fromMe && message.message) {
          await handleIncomingMessage(sock, message);
        } else if (message.key.fromMe && message.message) {
          await handleOutgoingMessage(sock, message);
        }
      }
    } catch (error) {
      console.error("Error al procesar mensajes:", error);
    }
  });
}

const botSentMessageIds = new Set();

// En la función donde el bot envía mensajes, registramos el ID
// Añadir esta función para reemplazar todos los sock.sendMessage:
async function sendBotMessage(sock, chatId, text) {
  try {
    const sentMsg = await sock.sendMessage(chatId, { text });
    // Guardar el ID del mensaje enviado por el bot
    if (sentMsg && sentMsg.key && sentMsg.key.id) {
      botSentMessageIds.add(sentMsg.key.id);
      // Eliminar IDs viejos para evitar memoria excesiva (opcional)
      setTimeout(() => {
        botSentMessageIds.delete(sentMsg.key.id);
      }, 60000); // Limpiar después de 1 minuto
    }
    return sentMsg;
  } catch (error) {
    console.error(`Error enviando mensaje:`, error);
  }
}

// async function sendBotMessage(sock, chatId, content) {
//   try {
//     let message;

//     // Si el contenido es un string simple, enviarlo como texto
//     if (typeof content === 'string') {
//       console.log('mensaje de texto', content)
//       message = { text: content };
//     }
//     // Si es un objeto, asumimos que ya viene formateado correctamente
//     else {
//       console.log('mensaje de objeto', content)
//       message = content;
//     }

//     console.log('el mensaje', message)
//     const sentMsg = await sock.sendMessage(chatId, message);

//     // Guardar el ID del mensaje enviado por el bot
//     if (sentMsg && sentMsg.key && sentMsg.key.id) {
//       botSentMessageIds.add(sentMsg.key.id);
//       // Eliminar IDs viejos para evitar memoria excesiva
//       setTimeout(() => {
//         botSentMessageIds.delete(sentMsg.key.id);
//       }, 60000); // Limpiar después de 1 minuto
//     }

//     return sentMsg;
//   } catch (error) {
//     console.error(`Error enviando mensaje:`, error);
//   }
// }

/**
 * Procesa los mensajes entrantes
 */
async function handleIncomingMessage(sock, message) {
  const chatId = message.key.remoteJid;

  // Verificar si el mensaje proviene de un grupo (los IDs de grupo terminan con "@g.us")
  if (chatId.endsWith("@g.us")) {
    console.log(`Mensaje de grupo ignorado: ${chatId}`);
    return; // Ignorar mensajes de grupos completamente
  }
  const userId = chatId.split("@")[0];
  const userMessage =
    message.message.conversation ||
    message.message.extendedTextMessage?.text ||
    "";

  console.log(`[${userId}]: ${userMessage}`);

  console.log("commandHandler se está ejecutando", commandHandler);

  // 1. Verificar si es mensaje del propietario (prioridad máxima)
  if (commandHandler.isOwner(userId)) {
    // Si es un comando, procesarlo
    console.log(`Mensaje del propietario: ${userMessage}`);
    if (commandHandler.isCommand(userMessage)) {
      await commandHandler.handleCommand(sock, message);
      return;
    }
    // Si no es comando, detectar intervención manual
    else if (commandHandler.detectOwnerMessage(chatId, userMessage)) {
      // No necesitamos enviar mensaje cuando el propietario interviene
      return;
    }
  }

  // 2. Verificar si el chat está desactivado por cualquier razón
  if (commandHandler.isChatDisabled(chatId)) {
    console.log(`Bot desactivado para ${chatId}. Ignorando mensaje.`);
    return;
  }

  // 3. Obtener estado del usuario
  const userState = stateManager.getUserState(userId);

  // await dialogflowHandler.clearAllContexts(userId);

  let currentContexts = [];

  // Configurar contextos según estado actual
  // if (!userState.languageCode) {
  //   // Si no hay idioma seleccionado, estamos en selección de idioma
  //   currentContexts.push("waiting_language_selection");
  // } else if (userState.languageCode && !userState.selectedProduct) {
  //   // Si hay idioma pero no selección de producto
  //   currentContexts.push("language_selected");
  //   currentContexts.push("waiting_service_selection");
  // } else if (userState.selectedProduct) {
  //   // Si ya seleccionó producto
  //   currentContexts.push("product_selected");
  // }


  // 4. Procesar el mensaje con Dialogflow
  try {
    // const dialogflowResponse = await dialogflowHandler.detectIntent(
    //   userId,
    //   userMessage,
    //   userState.languageCode || "es"
    // );

    console.log("contextos actuales:", currentContexts);
    if (userState.currentContext) {
      currentContexts.push(userState.currentContext);
    }

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

    const outputContexts = dialogflowResponse.queryResult.outputContexts || [];
    const activeContextNames = outputContexts.map(context => {
      const parts = context.name.split('/');
      return parts[parts.length - 1];
    });

    console.log("Contextos activos después de la respuesta:", activeContextNames);

    // 5. Verificar si el proceso ha sido completado
    if (intent === "ProcessCompleted" || userState.processCompleted) {
      // Marcar el chat como completado - desactivará el bot por 24 horas

      console.log("Proceso completado, desactivando el bot por 24 horas.", intent);
      console.log("Proceso completado, desactivando el bot por 24 horas.", userState.processCompleted);

      commandHandler.markProcessCompleted(chatId);

      // Enviar mensaje de despedida final
      const language = userState.languageCode || "es";
      const farewellMsg =
        language === "en"
          ? "Thank you for your inquiry! We've registered your information."
          : "¡Gracias por tu consulta! Hemos registrado tu información.";

      //   await sock.sendMessage(chatId, { text: farewellMsg });
      await sendBotMessage(sock, chatId, farewellMsg);

      stateManager.updateUserState(userId, {
        currentContext: "",
        processCompleted: false,
      });
      return;
    }

    // 6. Continuar con el procesamiento normal de intenciones
    await processIntent(sock, chatId, userId, intent, parameters, userState);
  } catch (error) {
    console.error("Error al procesar mensaje con Dialogflow:", error);

    // Enviar un mensaje de error genérico
    const errorMsg =
      userState.languageCode === "en"
        ? "I'm sorry, there was an error processing your message. Please try again later."
        : "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta más tarde.";

    // await sock.sendMessage(chatId, { text: errorMsg });
    await sendBotMessage(sock, chatId, errorMsg);
  }
}

async function handleOutgoingMessage(sock, message) {
  const chatId = message.key.remoteJid;

  // Ignorar mensajes a grupos
  if (chatId.endsWith("@g.us")) {
    return;
  }

  // Verificar si el mensaje fue generado automáticamente por el bot
  // Esta es la parte clave: necesitamos determinar si el mensaje fue enviado por una persona o por el bot
  if (!wasBotGeneratedMessage(message)) {
    console.log(
      `Detectada intervención manual del propietario en chat: ${chatId}`
    );

    // Desactivar el bot para este chat específico por 24 horas
    commandHandler.registerManualIntervention(chatId);

    const userMessage =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    // 1. Verificar si es mensaje del propietario (prioridad máxima)

    // Si es un comando, procesarlo
    console.log(`Mensaje del propietario: ${userMessage}`);
    if (commandHandler.isCommand(userMessage)) {
      await commandHandler.handleCommand(sock, message);
      return;
    }
  }
}

/**
 * Determina si un mensaje fue generado automáticamente por el bot
 * Esta función identifica los mensajes que envió el bot vs. los que escribió el propietario manualmente
 */
function wasBotGeneratedMessage(message) {
  try {
    // Verificar primero por ID (el método más confiable)
    if (
      message.key &&
      message.key.id &&
      botSentMessageIds.has(message.key.id)
    ) {
      return true;
    }

    // Como respaldo, seguir usando tus métodos actuales:
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
      return message.message.extendedTextMessage.contextInfo.mentionedJid.includes(
        "bot-identifier"
      );
    }

    const messageText =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      "";

    if (
      messageText.includes("Wynwood baby!!!") ||
      messageText.includes("Andy's Don Cash") ||
      messageText.includes("🤖")
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error al verificar origen del mensaje:", error);
    return false;
  }
}

/**
 * Procesa la intención detectada por Dialogflow
 */
async function processIntent(
  sock,
  chatId,
  userId,
  intent,
  parameters,
  userState
) {

  console.log('Intent detectado:', intent);
  console.log('Estado del usuario:', userState);
  console.log('Contextos activos:', userState.dialogflowContexts || []);
  
  // Verificar si el intent coincide con el contexto esperado
  const activeContexts = userState.dialogflowContexts || [];
  
  // Verificar casos confusos especiales
  // if (intent === "ProductSelection" && 
  //     !activeContexts.includes("language_selected") && 
  //     !userState.languageCode) {
    
  //   console.log("Detectada confusión: ProductSelection sin idioma seleccionado");
    
  //   // El usuario probablemente está tratando de seleccionar idioma con un número
  //   if (/^[1-2]$/.test(userMessage.trim())) {
  //     console.log("Redirigiendo entrada numérica a selección de idioma");
      
  //     // Procesar como selección de idioma
  //     const languageCode = userMessage.trim() === "1" ? "es" : "en";
  //     stateManager.updateUserState(userId, {
  //       languageCode: languageCode,
  //       currentContext: "language_selected",
  //       dialogflowContexts: ["language_selected", "waiting_service_selection"]
  //     });
      
  //     // Enviar menú de servicios
  //     const isBusinessHours = timeManager.isBusinessHours();
  //     const menuMessage = isBusinessHours
  //       ? messageProvider.getBusinessHoursMenu(languageCode)
  //       : messageProvider.getOutOfHoursMessage(languageCode);
      
  //     await sendBotMessage(sock, chatId, menuMessage);
  //     return;
  //   }
  // }



  console.log("intent", intent);
  switch (intent) {
    case "Default Welcome Intent":
      // Mensaje de bienvenida con opciones de idioma
      const welcomeMsg = messageProvider.getWelcomeMessage();
      //   await sock.sendMessage(chatId, { text: welcomeMsg });
      await sendBotMessage(sock, chatId, welcomeMsg);

      stateManager.updateUserState(userId, {
        currentContext: "waiting_language_selection",
      });
      break;

    case "lenguaje":
      console.log("los parametros", parameters);
      console.log("los user", userState);

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

        // Verificar horario para enviar menú getLanguagePrompt
        const isBusinessHours = timeManager.isBusinessHours();
        // const menuMessage = isBusinessHours
        //   ? messageProvider.getBusinessHoursMenu(languageCode)
        //   : messageProvider.getOutOfHoursMessage(languageCode);

        if (!isBusinessHours) {
          menuMessage = messageProvider.getBusinessHoursMenu(languageCode);
        } else {
          menuMessage = messageProvider.getOutOfHoursMessage(languageCode);
          stateManager.updateUserState(userId, {
            currentContext: "product_selected",
            processCompleted: true
          });
        }

        // await sock.sendMessage(chatId, { text: menuMessage });
        await sendBotMessage(sock, chatId, menuMessage);
      } else {
        // Idioma no reconocido, reenviar opciones
        const languagePrompt = messageProvider.getLanguagePrompt();
        // await sock.sendMessage(chatId, { text: languagePrompt });
        stateManager.updateUserState(userId, {
          currentContext: "waiting_language_selection", // Importante para las futuras decisiones
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
        // await sock.sendMessage(chatId, { text: responseMessage });
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
      //   await sock.sendMessage(chatId, { text: responseMessage });
      await sendBotMessage(sock, chatId, responseMessage);
      break;

    case "Default Fallback Intent":
      // Mensaje de fallback cuando no se entiende la solicitud

      console.log("Fallback activado, estado del usuario:", userState);
      if(userState.currentContext === "waiting_language_selection"){
        console.log("Idioma no reconocido, reenviar opciones");
                // Idioma no reconocido, reenviar opciones
        const languagePrompt = messageProvider.getLanguagePrompt();
        // await sock.sendMessage(chatId, { text: languagePrompt });
        stateManager.updateUserState(userId, {
          currentContext: "waiting_language_selection", // Importante para las futuras decisiones
        });
        await sendBotMessage(sock, chatId, languagePrompt);
        break;
      }

      const fallbackMsg = messageProvider.getFallbackMessage(
        userState.languageCode
      );
      //   await sock.sendMessage(chatId, { text: fallbackMsg });
      await sendBotMessage(sock, chatId, fallbackMsg);
      break;

    default:
      // Cualquier otro intent no manejado específicamente
      const defaultMsg = messageProvider.getDefaultResponse(
        userState.languageCode
      );
      //   await sock.sendMessage(chatId, { text: defaultMsg });
      await sendBotMessage(sock, chatId, defaultMsg);
  }
}

// Iniciar el bot
console.log("Iniciando bot de WhatsApp para Andy's Don Cash...");
connectToWhatsApp();

// Manejo de errores no capturados
process.on("uncaughtException", (err) => {
  console.error("Error no capturado:", err);
  // Guardar estados antes de cerrar
  stateManager.saveStates();
});

process.on("SIGINT", () => {
  console.log("Bot detenido por el usuario");
  // Guardar estados antes de cerrar
  stateManager.saveStates();
  process.exit(0);
});
