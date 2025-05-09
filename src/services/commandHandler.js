/**
 * commandHandler.js - Manejador de comandos administrativos
 * Procesa comandos exclusivos para el dueño del bot
 */

const fs = require("fs");
const path = require("path");
// require('dotenv').config();
const { sendBotMessage } = require("../services/messageService");

class CommandHandler {
  constructor() {
    this.ownerNumber = process.env.OWNER_NUMBER || "1234567890"; // Número del dueño
    this.commands = {
      "👋": this.showGoodByMessage,
      "/help": this.showHelp,
      "/off": this.deactivateBot,
      "/on": this.activateBot,
      "/status": this.checkStatus,
      "/reset": this.resetUserState,
      "/stats": this.getStats,
      "/clean": this.cleanOldData,
      "/cleanusers": this.cleanInactiveUsers,
      "/setinactive": this.setInactivePeriod,
      "/reactivation": this.manageReactivation,
      "/reactivate": this.forceReactivate,
    };
    console.log(
      "Comandos administrativos cargados:",
      Object.keys(this.commands).join(", ")
    );

    // Controla chats donde el bot está desactivado
    this.disabledChats = {};
    this.manualInterventions = {};
    this.completedChats = {};

    // Cargar estado de chats desactivados
    this.loadDisabledState();
  }

  /**
   * Verifica si el mensaje proviene del dueño
   * @param {string} userId ID del usuario
   * @returns {boolean} Es el dueño o no
   */
  isOwner(userId) {
    console.log("Verificando si el usuario es el dueño:", userId);
    return userId === this.ownerNumber;
  }

  /**
   * Verifica si un mensaje es un comando administrativo
   * @param {string} message Mensaje recibido
   * @returns {boolean} Es comando o no
   */
  isCommand(message) {
    const trimmedMessage = message.trim();
    return (
      trimmedMessage === "👋" ||
      (trimmedMessage.startsWith("/") &&
        Object.keys(this.commands).includes(trimmedMessage.split(" ")[0]))
    );
  }

  /**
   * Carga el estado de chats desactivados
   */
  loadDisabledState() {
    try {
      const filePath = path.join(__dirname, "disabled_chats.json");
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        this.disabledChats = data.disabledChats || {};
        this.manualInterventions = data.manualInterventions || {};
        this.completedChats = data.completedChats || {};
        this.cleanExpiredEntries();
      }
    } catch (error) {
      console.error("Error al cargar estado de chats desactivados:", error);
      this.disabledChats = {};
      this.manualInterventions = {};
      this.completedChats = {};
    }
  }

  /**
   * Guarda el estado de chats desactivados
   */
  saveDisabledState() {
    try {
      const data = {
        disabledChats: this.disabledChats,
        manualInterventions: this.manualInterventions,
        completedChats: this.completedChats,
      };
      fs.writeFileSync(
        path.join(__dirname, "disabled_chats.json"),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error("Error al guardar estado de chats desactivados:", error);
    }
  }

  /**
   * Limpia entradas expiradas
   */
  cleanExpiredEntries() {
    const now = Date.now();
    let cleaned = 0;

    // Limpiar chats desactivados expirados
    for (const chat in this.disabledChats) {
      if (this.disabledChats[chat].expiry < now) {
        delete this.disabledChats[chat];
        cleaned++;
      }
    }

    // Limpiar intervenciones manuales expiradas
    for (const chat in this.manualInterventions) {
      if (this.manualInterventions[chat].expiry < now) {
        delete this.manualInterventions[chat];
        cleaned++;
      }
    }

    // Limpiar chats completados expirados
    for (const chat in this.completedChats) {
      if (this.completedChats[chat].expiry < now) {
        delete this.completedChats[chat];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Limpieza: ${cleaned} entradas expiradas eliminadas`);
      this.saveDisabledState();
    }
  }

  /**
   * Verifica si el chat está desactivado por cualquier razón
   */
  isChatDisabled(chatId) {
    this.cleanExpiredEntries();

    // Verificar si está desactivado por comando
    const isDisabledByCommand =
      this.disabledChats[chatId] &&
      this.disabledChats[chatId].expiry > Date.now();

    // Verificar si está desactivado por intervención manual
    const isDisabledByIntervention =
      this.manualInterventions[chatId] &&
      this.manualInterventions[chatId].expiry > Date.now();

    // Verificar si está desactivado por proceso completado
    const isDisabledByCompletion =
      this.completedChats[chatId] &&
      this.completedChats[chatId].expiry > Date.now();

    return (
      isDisabledByCommand || isDisabledByIntervention || isDisabledByCompletion
    );
  }

  /**
   * Detecta si un mensaje es del propietario para registrar intervención
   */
  detectOwnerMessage(chatId, message) {
    // Solo ejecutar si el mensaje viene del propietario
    if (!this.isOwner(chatId.split("@")[0])) {
      return false;
    }

    // Si el mensaje es un comando de activación, no considerar como intervención
    if (message.startsWith("/on")) {
      return false;
    }

    // Registrar intervención que desactiva el bot por 24 horas
    // this.registerManualIntervention(chatId);

    console.log(
      `Dueño ha intervenido en ${chatId}. Bot desactivado por 24 horas.`
    );
    return true;
  }

  /**
   * Registra una intervención manual
   * @param {string} chatId ID del chat
   * @param {number} hours Horas que durará la intervención
   */
  registerManualIntervention(chatId, hours = 1) {
    const expiryTime = Date.now() + hours * 60 * 60 * 1000;

    this.manualInterventions[chatId] = {
      startTime: Date.now(),
      expiry: expiryTime,
    };

    this.saveDisabledState();
    console.log(
      `Intervención manual registrada en ${chatId} por ${hours} horas`
    );
  }

  /**
   * Marca un chat como proceso completado
   * @param {string} chatId ID del chat
   * @param {number} hours Horas que durará la desactivación
   */
  markProcessCompleted(chatId, hours = 1) {
    const expiryTime = Date.now() + hours * 60 * 60 * 1000;

    this.completedChats[chatId] = {
      completedAt: Date.now(),
      expiry: expiryTime,
    };

    this.saveDisabledState();
    console.log(
      `Chat ${chatId} marcado como completado. Bot desactivado por ${hours} horas para este chat.`
    );
  }

  /**
   * Maneja los comandos recibidos
   * @param {Object} sock Socket de WhatsApp
   * @param {Object} message Mensaje recibido
   */
  async handleCommand(sock, message) {
    const chatId = message.key.remoteJid;
    const fullCommand =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    const [command, ...args] = fullCommand.split(" ");

    if (this.commands[command]) {
      try {
        await this.commands[command].call(this, sock, chatId, args);
      } catch (error) {
        console.error(`Error al ejecutar comando ${command}:`, error);
        // await sock.sendMessage(chatId, {
        //   text: `❌ Error al ejecutar el comando: ${error.message}`
        // });

        await sendBotMessage(
          sock,
          chatId,
          `❌ Error al ejecutar el comando: ${error.message}`
        );
      }
    }
  }

  /**
   * Muestra la ayuda de comandos
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   */
  async showGoodByMessage(sock, chatId) {
    const helpMessage =
      `¡Gracias por confiar en Andy's Don Cash!\n\n` +
      `💰 Convertimos tus objetos de valor en soluciones rápidas y seguras.

Wynwood baby!!!`;

    // await sock.sendMessage(chatId, { text: helpMessage });
    await sendBotMessage(sock, chatId, helpMessage);
  }

  /**
   * Muestra la ayuda de comandos
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   */
  async showHelp(sock, chatId) {
    const helpMessage =
      `🤖 *Comandos Administrativos*\n\n` +
      `/help - Muestra este mensaje de ayuda\n` +
      `/off [horas] - Desactiva el bot (default: 24h)\n` +
      `/on - Activa el bot nuevamente\n` +
      `/status - Verifica el estado actual del bot\n` +
      `/reset [userId] - Reinicia el estado de un usuario\n` +
      `/stats - Muestra estadísticas de uso\n` +
      `/clean - Limpia datos antiguos\n` +
      `/cleanusers [meses] - Elimina usuarios inactivos (default: 3 meses)\n` +
      `/setinactive [meses] - Configura el período de inactividad\n` +
      `/reactivation - Gestionar sistema de reactivación automática\n` +
      `/reactivate [chatId] - Reactivar chat específico manualmente`;

    // await sock.sendMessage(chatId, { text: helpMessage });
    await sendBotMessage(sock, chatId, helpMessage);
  }

  // async sendBotMessage(sock, chatId, text) {
  //   try {
  //     const sentMsg = await sock.sendMessage(chatId, { text });
  //     // Guardar el ID del mensaje enviado por el bot
  //     if (sentMsg && sentMsg.key && sentMsg.key.id) {
  //       botSentMessageIds.add(sentMsg.key.id);
  //       // Eliminar IDs viejos para evitar memoria excesiva (opcional)
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
   * Desactiva el bot temporalmente
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   * @param {Array} args Argumentos del comando
   */
  async deactivateBot(sock, chatId, args) {
    const hours = args[0] ? parseInt(args[0]) : 24;

    if (isNaN(hours) || hours <= 0 || hours > 168) {
      // await sock.sendMessage(chatId, {
      //   text: '❌ Por favor especifica un número válido de horas (1-168)'
      // });
      await sendBotMessage(
        sock,
        chatId,
        "❌ Por favor especifica un número válido de horas (1-168)"
      );
      return;
    }

    const expiryTime = Date.now() + hours * 60 * 60 * 1000;

    this.disabledChats[chatId] = {
      disabledBy: this.ownerNumber,
      startTime: Date.now(),
      expiry: expiryTime,
    };

    this.saveDisabledState();

    const offUntil = new Date(expiryTime).toLocaleString();
    // await sock.sendMessage(chatId, {
    //   text: `✅ Bot desactivado por ${hours} horas. Se reactivará automáticamente el ${offUntil}`
    // });
    await sendBotMessage(
      sock,
      chatId,
      `✅ Bot desactivado por ${hours} horas. Se reactivará automáticamente el ${offUntil}`
    );
  }

  /**
   * Activa el bot nuevamente
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   */
  async activateBot(sock, chatId) {
    let wasDisabled = false;

    // Eliminar del listado de chats desactivados
    console.log("Activando bot para el chat:", chatId);
    if (this.disabledChats[chatId]) {
      delete this.disabledChats[chatId];
      wasDisabled = true;
    }

    // Eliminar cualquier intervención manual
    if (this.manualInterventions[chatId]) {
      delete this.manualInterventions[chatId];
      wasDisabled = true;
    }

    // Eliminar cualquier chat marcado como completado
    if (this.completedChats[chatId]) {
      delete this.completedChats[chatId];
      wasDisabled = true;
    }

    this.saveDisabledState();

    // Enviar mensaje de confirmación
    if (wasDisabled) {
      // await sock.sendMessage(chatId, { text: '✅ Bot activado nuevamente para este chat' });
      await sendBotMessage(
        sock,
        chatId,
        "✅ Bot activado nuevamente para este chat"
      );
    } else {
      // await sock.sendMessage(chatId, { text: '✅ El bot ya estaba activo para este chat' });
      await sendBotMessage(
        sock,
        chatId,
        "✅ El bot ya estaba activo para este chat"
      );
    }
  }

  /**
   * Verifica el estado actual del bot
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   */
  async checkStatus(sock, chatId) {
    this.cleanExpiredEntries();

    let status = "🤖 *Estado del Bot*\n\n";

    // Verificar estado del chat
    if (this.disabledChats[chatId]) {
      const expiryDate = new Date(
        this.disabledChats[chatId].expiry
      ).toLocaleString();
      status += `⚠️ *Desactivado* por comando hasta: ${expiryDate}\n`;
    } else if (this.manualInterventions[chatId]) {
      const expiryDate = new Date(
        this.manualInterventions[chatId].expiry
      ).toLocaleString();
      status += `🧑‍💼 *Intervención manual* registrada hasta: ${expiryDate}\n`;
    } else if (this.completedChats[chatId]) {
      const expiryDate = new Date(
        this.completedChats[chatId].expiry
      ).toLocaleString();
      status += `✅ *Proceso completado* - Bot desactivado hasta: ${expiryDate}\n`;
    } else {
      status += "✅ *Activo*\n";
    }

    // Añadir estadísticas generales
    const totalDisabled = Object.keys(this.disabledChats).length;
    const totalInterventions = Object.keys(this.manualInterventions).length;
    const totalCompleted = Object.keys(this.completedChats).length;

    status += `\nChats desactivados por comando: ${totalDisabled}\n`;
    status += `Intervenciones manuales: ${totalInterventions}\n`;
    status += `Procesos completados: ${totalCompleted}`;

    await sock.sendMessage(chatId, { text: status });
  }

  /**
   * Reinicia el estado de un usuario
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   * @param {Array} args Argumentos del comando
   */
  async resetUserState(sock, chatId, args) {
    const stateManager = require("./stateManager");
    const targetUser = args[0] || chatId.split("@")[0];

    if (stateManager.resetUserState(targetUser)) {
      await sock.sendMessage(chatId, {
        text: `✅ Estado del usuario ${targetUser} reiniciado correctamente`,
      });
    } else {
      await sock.sendMessage(chatId, {
        text: `❌ No se encontró estado para el usuario ${targetUser}`,
      });
    }
  }

  /**
   * Muestra estadísticas de uso
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   */
  async getStats(sock, chatId) {
    const stateManager = require("./stateManager");
    const states = stateManager.states;

    const totalUsers = Object.keys(states).length;
    let spanishUsers = 0;
    let englishUsers = 0;
    let activeToday = 0;
    let activeLast7Days = 0;

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    // Calcular estadísticas
    for (const userId in states) {
      const user = states[userId];

      // Contar por idioma
      if (user.languageCode === "es") spanishUsers++;
      else if (user.languageCode === "en") englishUsers++;

      // Contar usuarios activos
      if (now - user.lastInteraction < oneDayMs) activeToday++;
      if (now - user.lastInteraction < sevenDaysMs) activeLast7Days++;
    }

    // Crear mensaje de estadísticas
    const statsMessage =
      `📊 *Estadísticas del Bot*\n\n` +
      `Total de usuarios: ${totalUsers}\n` +
      `Usuarios en español: ${spanishUsers}\n` +
      `Usuarios en inglés: ${englishUsers}\n` +
      `Usuarios sin idioma definido: ${
        totalUsers - spanishUsers - englishUsers
      }\n\n` +
      `Activos hoy: ${activeToday}\n` +
      `Activos últimos 7 días: ${activeLast7Days}\n\n` +
      `Chats desactivados: ${Object.keys(this.disabledChats).length}\n` +
      `Intervenciones manuales: ${
        Object.keys(this.manualInterventions).length
      }\n` +
      `Procesos completados: ${Object.keys(this.completedChats).length}`;

    await sock.sendMessage(chatId, { text: statsMessage });
  }

  /**
   * Limpia datos antiguos
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   */
  async cleanOldData(sock, chatId) {
    const stateManager = require("./stateManager");

    // Limpiar sesiones antiguas (más de 30 días)
    const prevCount = Object.keys(stateManager.states).length;
    stateManager.cleanupOldSessions();
    const newCount = Object.keys(stateManager.states).length;
    const deletedCount = prevCount - newCount;

    // Limpiar entradas desactivadas expiradas
    this.cleanExpiredEntries();

    await sock.sendMessage(chatId, {
      text: `🧹 Limpieza completada:\n- ${deletedCount} sesiones antiguas eliminadas\n- Entradas expiradas limpiadas`,
    });
  }

  /**
   * Limpia usuarios inactivos
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   * @param {Array} args Argumentos del comando
   */
  async cleanInactiveUsers(sock, chatId, args) {
    const stateManager = require("./stateManager");
    const cleanupScheduler = require("../modules/cleanupScheduler");

    // Verificar si se especificó un período personalizado
    const months = args[0] ? parseInt(args[0]) : null;

    if (args[0] && (isNaN(months) || months <= 0)) {
      await sock.sendMessage(chatId, {
        text: "❌ Por favor especifica un número válido de meses (por ejemplo: /cleanusers 3)",
      });
      return;
    }

    // Ejecutar limpieza
    const result = cleanupScheduler.runManualCleanup(months);

    if (result) {
      await sock.sendMessage(chatId, {
        text: `✅ Limpieza completada: ${result.deletedUsers} usuarios eliminados por inactividad de ${result.inactivityMonths} meses`,
      });
    } else {
      await sock.sendMessage(chatId, {
        text: "❌ Error al ejecutar la limpieza de usuarios",
      });
    }
  }

  /**
   * Configura el período de inactividad
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   * @param {Array} args Argumentos del comando
   */
  async setInactivePeriod(sock, chatId, args) {
    const cleanupScheduler = require("../modules/cleanupScheduler");

    if (!args[0] || isNaN(parseInt(args[0])) || parseInt(args[0]) <= 0) {
      await sock.sendMessage(chatId, {
        text: "❌ Por favor especifica un número válido de meses (por ejemplo: /setinactive 6)",
      });
      return;
    }

    const months = parseInt(args[0]);

    if (cleanupScheduler.setInactivityPeriod(months)) {
      await sock.sendMessage(chatId, {
        text: `✅ Período de inactividad actualizado a ${months} meses`,
      });
    } else {
      await sock.sendMessage(chatId, {
        text: "❌ Error al actualizar el período de inactividad",
      });
    }
  }

  /**
   * Gestiona el sistema de reactivación automática
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   * @param {Array} args Argumentos del comando
   */
  async manageReactivation(sock, chatId, args) {
    const autoReactivation = require("../modules/autoReactivationManager");

    if (!args.length) {
      // Mostrar estado actual
      const status = autoReactivation.getStatus();

      const statusMsg =
        `🔄 *Estado del Sistema de Reactivación*\n\n` +
        `• Estado: ${status.running ? "✅ Activo" : "❌ Inactivo"}\n` +
        `• Intervalo: ${status.checkIntervalMinutes} minutos\n` +
        `• Última verificación: ${
          status.lastCheck
            ? new Date(status.lastCheck).toLocaleString()
            : "Nunca"
        }\n\n` +
        `• Pendientes de reactivación: ${
          status.pendingReactivations.disabledChats +
          status.pendingReactivations.manualInterventions +
          status.pendingReactivations.completedChats
        }\n` +
        `  - Por comando: ${status.pendingReactivations.disabledChats}\n` +
        `  - Intervenciones: ${status.pendingReactivations.manualInterventions}\n` +
        `  - Procesos completados: ${status.pendingReactivations.completedChats}\n\n` +
        `Comandos disponibles:\n` +
        `/reactivation start - Iniciar sistema\n` +
        `/reactivation stop - Detener sistema\n` +
        `/reactivation interval [minutos] - Cambiar intervalo\n` +
        `/reactivation check - Forzar verificación`;

      await sock.sendMessage(chatId, { text: statusMsg });
      return;
    }

    // Procesar subcomandos
    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
      case "start":
        autoReactivation.startAutoReactivation();
        await sock.sendMessage(chatId, {
          text: "✅ Sistema de reactivación automática iniciado",
        });
        break;

      case "stop":
        autoReactivation.stopAutoReactivation();
        await sock.sendMessage(chatId, {
          text: "⏹️ Sistema de reactivación automática detenido",
        });
        break;

      case "interval":
        const minutes = parseInt(args[1]);
        if (isNaN(minutes) || minutes <= 0) {
          await sock.sendMessage(chatId, {
            text: "❌ Debes especificar un número válido de minutos (ej: /reactivation interval 10)",
          });
          return;
        }

        if (autoReactivation.setCheckInterval(minutes)) {
          await sock.sendMessage(chatId, {
            text: `✅ Intervalo actualizado a ${minutes} minutos`,
          });
        } else {
          await sock.sendMessage(chatId, {
            text: "❌ Error al actualizar el intervalo",
          });
        }
        break;

      case "check":
        const reactivated = autoReactivation.checkAndReactivate();
        await sock.sendMessage(chatId, {
          text: `✅ Verificación manual completada: ${reactivated} chats reactivados`,
        });
        break;

      default:
        await sock.sendMessage(chatId, {
          text: "❌ Subcomando no reconocido. Usa /reactivation sin argumentos para ver opciones disponibles.",
        });
    }
  }

  /**
   * Fuerza la reactivación de un chat específico
   * @param {Object} sock Socket de WhatsApp
   * @param {string} chatId ID del chat
   * @param {Array} args Argumentos del comando
   */
  async forceReactivate(sock, chatId, args) {
    if (!args.length) {
      await sock.sendMessage(chatId, {
        text: "❌ Debes especificar el ID del chat a reactivar (ej: /reactivate 5551234567)",
      });
      return;
    }

    // Obtener ID del chat a reactivar
    let targetChatId = args[0];

    // Verificar formato del chatId
    if (!targetChatId.includes("@")) {
      targetChatId = `${targetChatId}@s.whatsapp.net`;
    }

    // Verificar si el chat está desactivado
    let wasDisabled = false;

    if (this.disabledChats[targetChatId]) {
      delete this.disabledChats[targetChatId];
      wasDisabled = true;
    }

    if (this.manualInterventions[targetChatId]) {
      delete this.manualInterventions[targetChatId];
      wasDisabled = true;
    }

    if (this.completedChats[targetChatId]) {
      delete this.completedChats[targetChatId];
      wasDisabled = true;
    }

    if (wasDisabled) {
      this.saveDisabledState();

      await sock.sendMessage(chatId, {
        text: `✅ Chat ${targetChatId} reactivado exitosamente`,
      });
    } else {
      await sock.sendMessage(chatId, {
        text: `ℹ️ El chat ${targetChatId} no estaba desactivado`,
      });
    }
  }
}

// Exportar una instancia única del manejador de comandos
module.exports = new CommandHandler();
