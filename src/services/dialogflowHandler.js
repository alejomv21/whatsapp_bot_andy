/**
 * dialogflowHandler.js - Integración con Dialogflow
 * Maneja la conexión y comunicación con Dialogflow
 */
// require('dotenv').config();

const dialogflow = require("@google-cloud/dialogflow");
const path = require("path");
// console.log('DIALOGFLOW_PROJECT_ID:', process.env.DIALOGFLOW_PROJECT_ID);

class DialogflowHandler {
  constructor() {
    this.projectId = process.env.DIALOGFLOW_PROJECT_ID;
    this.credentialsPath = path.join(__dirname, "dialogflow-credentials.json");

    // const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    // Verificar que las credenciales estén configuradas
    if (!this.projectId) {
      console.log(this.projectId);
      console.warn(
        "ADVERTENCIA: DIALOGFLOW_PROJECT_ID no está configurado en el archivo .env"
      );
    }

    // Crear el cliente de sesiones de Dialogflow con las credenciales
    try {
      this.sessionClient = new dialogflow.SessionsClient({
        keyFilename: this.credentialsPath,
      });
      console.log("Cliente Dialogflow inicializado correctamente");
    } catch (error) {
      console.error("Error al inicializar cliente Dialogflow:", error);
      this.sessionClient = null;
    }
  }

  /**
   * Detecta la intención del usuario mediante Dialogflow
   * @param {string} sessionId ID de sesión (normalmente el número de teléfono)
   * @param {string} query Texto del mensaje del usuario
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {Promise<Object>} Respuesta de Dialogflow
   */
  async detectIntent(sessionId, query, languageCode = "es") {
    if (!this.sessionClient) {
      throw new Error("Cliente Dialogflow no inicializado correctamente");
    }

    // Construir la ruta de la sesión
    const sessionPath = this.sessionClient.projectAgentSessionPath(
      this.projectId,
      sessionId
    );

    // Configurar la solicitud a Dialogflow
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: query,
          languageCode: languageCode,
        },
      },
    };

    try {
      // Realizar la solicitud a Dialogflow
      const [response] = await this.sessionClient.detectIntent(request);
      return response;
    } catch (error) {
      console.error("Error al detectar intención con Dialogflow:", error);
      throw error;
    }
  }

/**
 * Detecta la intención del usuario utilizando la API de Dialogflow
 * Versión mejorada con soporte para contextos
 * 
 * @param {string} sessionId - ID de la sesión del usuario
 * @param {string} query - Texto del mensaje del usuario
 * @param {string} languageCode - Código de idioma (es/en)
 * @param {Array} contexts - Array de contextos a activar (opcional)
 * @returns {Promise<Object>} - Respuesta de Dialogflow
 */
  async detectIntentWithContexts(sessionId, query, languageCode = "es", contexts = []) {
    if (!this.sessionClient) {
      throw new Error("Cliente Dialogflow no inicializado correctamente");
    }
    
    // Construir la ruta de la sesión
    const sessionPath = this.sessionClient.projectAgentSessionPath(
      this.projectId,
      sessionId
    );
    
    // Configurar la solicitud básica a Dialogflow
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: query,
          languageCode: languageCode,
        },
      },
    }
    if (contexts && contexts.length > 0) {
      // Formatear los contextos para que Dialogflow los entienda
      const formattedContexts = contexts.map(context => {
        // Si es un string, convertirlo en objeto de contexto
        if (typeof context === 'string') {
          return {
            name: `projects/${this.projectId}/agent/sessions/${sessionId}/contexts/${context}`,
            lifespanCount: 5 // Duración predeterminada en turnos de conversación
          };
        }
        
        // Si ya es un objeto, asegurarse que el nombre esté en formato correcto
        if (typeof context === 'object' && context.name) {
          if (!context.name.includes('/contexts/')) {
            return {
              name: `projects/${this.projectId}/agent/sessions/${sessionId}/contexts/${context.name}`,
              lifespanCount: context.lifespanCount || 5,
              parameters: context.parameters
            };
          }
          return context;
        }
        
        // Formato no reconocido, usar como string
        return {
          name: `projects/${this.projectId}/agent/sessions/${sessionId}/contexts/${context}`,
          lifespanCount: 5
        };
      });
      
      // Añadir los contextos a la solicitud
      request.queryParams = {
        contexts: formattedContexts
      };
      
      // Log para depuración
      console.log(`[Dialogflow] Activando contextos para ${sessionId}:`, 
        formattedContexts.map(c => {
          const parts = c.name.split('/');
          return parts[parts.length - 1];
        }).join(', ')
      );
    }
    
    try {
      // Realizar la solicitud a Dialogflow
      const [response] = await this.sessionClient.detectIntent(request);
      
      // Log de los contextos de salida para depuración
      if (response.queryResult && response.queryResult.outputContexts) {
        console.log(`[Dialogflow] Contextos activos para ${sessionId} después de respuesta:`, 
          response.queryResult.outputContexts.map(c => {
            const parts = c.name.split('/');
            return parts[parts.length - 1];
          }).join(', ')
        );
      }
      
      return response;
    } catch (error) {
      console.error("Error al detectar intención con Dialogflow:", error);
      throw error;
    }
  }

  /**
   * Obtener los contextos activos de un usuario
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Array>} - Lista de contextos activos
   */
  async getActiveContexts(sessionId) {
    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.DIALOGFLOW_PROJECT_ID,
      sessionId
    );

    try {
      const [response] = await sessionClient.getContexts({
        parent: sessionPath,
      });

      return response.map((context) => {
        const parts = context.name.split("/");
        return {
          name: parts[parts.length - 1],
          lifespanCount: context.lifespanCount,
        };
      });
    } catch (error) {
      console.error("Error al obtener contextos activos:", error);
      return [];
    }
  }

  /**
 * Limpia todos los contextos activos para una sesión sin usar listContexts
 * @param {string} sessionId - ID de la sesión del usuario
 * @returns {Promise<boolean>} - Verdadero si se completó la operación
 */
async clearAllContexts(sessionId) {
  if (!this.sessionClient) {
    throw new Error("Cliente Dialogflow no inicializado correctamente");
  }
  
  try {
    // Construir la ruta de la sesión
    const sessionPath = this.sessionClient.projectAgentSessionPath(
      this.projectId,
      sessionId
    );
    
    // Lista de todos los posibles contextos que podrían estar activos en tu sistema
    // Añade aquí TODOS los nombres de contextos que uses en tu aplicación
    const possibleContexts = [
      "waiting_language_selection",
      "language_selected",
      "waiting_service_selection",
      "product_selected",
      "default_welcome_context",
      "product_info",
      "language_selection",
      "service_selection",
      "product_info_provided",
      // No olvides añadir otros contextos que puedas tener
    ];
    
    // Crear una lista de contextos con lifespan=0 (inactivos)
    const inactiveContexts = possibleContexts.map(name => ({
      name: `${sessionPath}/contexts/${name}`,
      lifespanCount: 0  // Establecer a 0 desactiva el contexto
    }));
    
    // Crear una solicitud "vacía" que desactive todos los contextos
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: "__reset_all_contexts__",  // Un mensaje que no debería activar ningún intent específico
          languageCode: "es",  // El idioma no importa mucho para esta operación
        },
      },
      queryParams: {
        contexts: inactiveContexts,
        resetContexts: true  // Esta opción adicional debería limpiar cualquier otro contexto
      }
    };
    
    // Enviar la solicitud a Dialogflow
    await this.sessionClient.detectIntent(request);
    
    console.log(`Contextos reseteados para sesión ${sessionId}`);
    return true;
  } catch (error) {
    console.error(`Error al resetear contextos para sesión ${sessionId}:`, error);
    return false;
  }
}

  /**
   * Analiza si un mensaje numérico corresponde a una selección
   * @param {string} message Mensaje a analizar
   * @returns {Object|null} Datos de la selección o null si no es válida
   */
  analyzeNumericSelection(message) {
    // Limpiar el mensaje de espacios y caracteres especiales
    const cleanMessage = message.trim();

    // Verificar si es una selección numérica (1, 2, 3)
    if (["1", "2", "3"].includes(cleanMessage)) {
      const selections = {
        1: { type: "language", value: "es" }, // Para selección inicial
        2: { type: "language", value: "en" }, // Para selección inicial
        // Los valores también pueden ser productos dependiendo del contexto
      };

      return selections[cleanMessage] || null;
    }

    return null;
  }

  /**
   * Obtiene la respuesta predeterminada de Dialogflow
   * @param {Object} dialogflowResponse Respuesta de Dialogflow
   * @returns {string} Mensaje de respuesta
   */
  getResponseText(dialogflowResponse) {
    if (
      dialogflowResponse.queryResult &&
      dialogflowResponse.queryResult.fulfillmentMessages &&
      dialogflowResponse.queryResult.fulfillmentMessages.length > 0
    ) {
      // Obtener el primer mensaje de texto
      const message = dialogflowResponse.queryResult.fulfillmentMessages.find(
        (msg) => msg.text && msg.text.text && msg.text.text.length > 0
      );

      if (message && message.text.text.length > 0) {
        return message.text.text[0];
      }
    }

    // Respuesta por defecto si no hay mensajes
    return null;
  }

  /**
   * Obtiene el nombre de la intención detectada
   * @param {Object} dialogflowResponse Respuesta de Dialogflow
   * @returns {string} Nombre de la intención
   */
  getIntentName(dialogflowResponse) {
    if (
      dialogflowResponse.queryResult &&
      dialogflowResponse.queryResult.intent &&
      dialogflowResponse.queryResult.intent.displayName
    ) {
      return dialogflowResponse.queryResult.intent.displayName;
    }
    return "Fallback"; // Intención por defecto si no se detecta ninguna
  }

  /**
   * Obtiene los parámetros extraídos de la consulta
   * @param {Object} dialogflowResponse Respuesta de Dialogflow
   * @returns {Object} Parámetros extraídos
   */
  getParameters(dialogflowResponse) {
    if (
      dialogflowResponse.queryResult &&
      dialogflowResponse.queryResult.parameters
    ) {
      return dialogflowResponse.queryResult.parameters.fields || {};
    }
    return {};
  }

  /**
   * Verifica si la intención es una acción específica
   * @param {Object} dialogflowResponse Respuesta de Dialogflow
   * @param {string} actionName Nombre de la acción a verificar
   * @returns {boolean} Es la acción especificada o no
   */
  isAction(dialogflowResponse, actionName) {
    if (
      dialogflowResponse.queryResult &&
      dialogflowResponse.queryResult.action
    ) {
      return dialogflowResponse.queryResult.action === actionName;
    }
    return false;
  }

  /**
   * Obtiene la puntuación de confianza de la intención detectada
   * @param {Object} dialogflowResponse Respuesta de Dialogflow
   * @returns {number} Puntuación de confianza (0-1)
   */
  getConfidenceScore(dialogflowResponse) {
    if (
      dialogflowResponse.queryResult &&
      dialogflowResponse.queryResult.intentDetectionConfidence
    ) {
      return dialogflowResponse.queryResult.intentDetectionConfidence;
    }
    return 0;
  }
}

// Exportar una instancia única del manejador de Dialogflow
module.exports = new DialogflowHandler();
