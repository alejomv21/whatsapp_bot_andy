/**
 * autoReactivationManager.js - Gestor de reactivación automática
 * Verifica periódicamente los chats desactivados y los reactiva cuando han pasado 24 horas
 */

const fs = require('fs');
const path = require('path');
const commandHandler = require('../services/commandHandler');

class AutoReactivationManager {
  constructor() {
    // Intervalo de verificación (cada 5 minutos)
    this.checkInterval = 5 * 60 * 1000;
    this.isRunning = false;
    this.lastCheck = null;
    this.checkIntervalId = null;
    this.recentlyReactivated = [];  // Almacena chats recientemente reactivados
    
    // Referencia al TimeManager
    this.timeManager = require('../services/timeManager');
    
    // Estado del horario de atención
    this.wasBusinessHours = null;  // Almacena el estado anterior del horario
    
    // Flag para controlar la reactivación masiva al cierre
    this.massReactivationDone = {
      day: -1,  // Día en que se realizó la última reactivación masiva
      hour: -1  // Hora en que se realizó la última reactivación masiva
    };
  }

  /**
   * Inicia el sistema de reactivación automática
   */
  startAutoReactivation() {
    if (this.isRunning) {
      console.log('El sistema de reactivación automática ya está en ejecución');
      return;
    }

    console.log(`Iniciando sistema de reactivación automática (verificación cada ${this.checkInterval / 60000} minutos)`);
    
    // Guardar el estado inicial del horario de atención
    this.wasBusinessHours = this.timeManager.isBusinessHours();
    
    // Ejecutar verificación inmediatamente al iniciar
    this.checkAndReactivate();
    
    // Programar verificaciones periódicas
    this.checkIntervalId = setInterval(() => {
      this.checkAndReactivate();
    }, this.checkInterval);
    
    this.isRunning = true;
  }

  /**
   * Detiene el sistema de reactivación automática
   */
  stopAutoReactivation() {
    if (!this.isRunning || !this.checkIntervalId) {
      console.log('El sistema de reactivación automática no está en ejecución');
      return;
    }
    
    clearInterval(this.checkIntervalId);
    this.checkIntervalId = null;
    this.isRunning = false;
    
    console.log('Sistema de reactivación automática detenido');
  }

  /**
   * Verifica y reactiva chats cuando ha pasado el periodo de desactivación
   */
  checkAndReactivate() {
    this.lastCheck = new Date();
    console.log(`Ejecutando verificación de reactivación automática: ${this.lastCheck.toLocaleString()}`);
    
    let reactivationCount = 0;
    const now = Date.now();
    this.recentlyReactivated = [];  // Reiniciar lista de chats reactivados
    
    try {
      // Verificar cambio en el horario de atención (de abierto a cerrado)
      const isBusinessHours = this.timeManager.isBusinessHours();
      const currentDate = this.timeManager.getCurrentDate();
      const currentDay = currentDate.getDay();
      const currentHour = currentDate.getHours();
      
      // Detectar si acabamos de salir del horario de atención
      if (this.wasBusinessHours && !isBusinessHours) {
        console.log('¡Detectado fin de horario comercial! Iniciando reactivación masiva...');
        
        // Verificar si ya realizamos una reactivación masiva para este día/hora
        if (this.massReactivationDone.day !== currentDay || this.massReactivationDone.hour !== currentHour) {
          // Realizar reactivación masiva de todos los chats desactivados
          reactivationCount += this.massReactivateAllChats();
          
          // Actualizar estado para evitar reactivaciones duplicadas
          this.massReactivationDone.day = currentDay;
          this.massReactivationDone.hour = currentHour;
          
          console.log(`Reactivación masiva por fin de horario completada: ${reactivationCount} chats reactivados`);
        }
      }
      
      // Actualizar el estado del horario para la próxima verificación
      this.wasBusinessHours = isBusinessHours;
      
      // 1. Verificar chats desactivados por comando
      for (const chatId in commandHandler.disabledChats) {
        if (commandHandler.disabledChats[chatId].expiry <= now) {
          delete commandHandler.disabledChats[chatId];
          this.recentlyReactivated.push(chatId);
          console.log(`Chat reactivado automáticamente (por tiempo): ${chatId}`);
          reactivationCount++;
        }
      }
      
      // 2. Verificar intervenciones manuales
      for (const chatId in commandHandler.manualInterventions) {
        if (commandHandler.manualInterventions[chatId].expiry <= now) {
          delete commandHandler.manualInterventions[chatId];
          this.recentlyReactivated.push(chatId);
          console.log(`Chat reactivado automáticamente (fin de intervención manual): ${chatId}`);
          reactivationCount++;
        }
      }
      
      // 3. Verificar procesos completados
      for (const chatId in commandHandler.completedChats) {
        if (commandHandler.completedChats[chatId].expiry <= now) {
          delete commandHandler.completedChats[chatId];
          this.recentlyReactivated.push(chatId);
          console.log(`Chat reactivado automáticamente (fin de proceso): ${chatId}`);
          reactivationCount++;
        }
      }
      
      // Guardar cambios si hubo reactivaciones
      if (reactivationCount > 0) {
        commandHandler.saveDisabledState();
        console.log(`Reactivación automática completada: ${reactivationCount} chats reactivados`);
      }
      
      return reactivationCount;
    } catch (error) {
      console.error('Error durante la verificación de reactivación automática:', error);
      return 0;
    }
  }

  /**
   * Reactiva masivamente todos los chats desactivados
   * @returns {number} Número de chats reactivados
   */
  massReactivateAllChats() {
    let reactivationCount = 0;
    
    try {
      // 1. Reactivar todos los chats desactivados por comando
      for (const chatId in commandHandler.disabledChats) {
        delete commandHandler.disabledChats[chatId];
        this.recentlyReactivated.push(chatId);
        console.log(`Chat reactivado masivamente (fin de horario): ${chatId}`);
        reactivationCount++;
      }
      
      // 2. Reactivar todas las intervenciones manuales
      for (const chatId in commandHandler.manualInterventions) {
        delete commandHandler.manualInterventions[chatId];
        this.recentlyReactivated.push(chatId);
        console.log(`Chat reactivado masivamente (fin de horario - intervención manual): ${chatId}`);
        reactivationCount++;
      }
      
      // 3. Reactivar todos los procesos completados
      for (const chatId in commandHandler.completedChats) {
        delete commandHandler.completedChats[chatId];
        this.recentlyReactivated.push(chatId);
        console.log(`Chat reactivado masivamente (fin de horario - proceso): ${chatId}`);
        reactivationCount++;
      }
      
      // Guardar cambios si hubo reactivaciones
      if (reactivationCount > 0) {
        commandHandler.saveDisabledState();
      }
      
      return reactivationCount;
    } catch (error) {
      console.error('Error durante la reactivación masiva:', error);
      return 0;
    }
  }

  /**
   * Cambia el intervalo de verificación
   * @param {number} minutes Nuevo intervalo en minutos
   */
  setCheckInterval(minutes) {
    if (typeof minutes !== 'number' || minutes <= 0) {
      console.error('Intervalo inválido. Debe ser un número positivo de minutos.');
      return false;
    }
    
    // Guardar nuevo intervalo
    this.checkInterval = minutes * 60 * 1000;
    
    // Reiniciar el timer si está corriendo
    if (this.isRunning) {
      this.stopAutoReactivation();
      this.startAutoReactivation();
    }
    
    console.log(`Intervalo de verificación actualizado a ${minutes} minutos`);
    return true;
  }

  /**
   * Obtiene estadísticas del sistema de reactivación
   */
  getStatus() {
    return {
      running: this.isRunning,
      checkIntervalMinutes: this.checkInterval / 60000,
      lastCheck: this.lastCheck ? this.lastCheck.toISOString() : null,
      isBusinessHours: this.timeManager.isBusinessHours(),
      nextClosingTime: this.timeManager.formatDate(this.timeManager.getNextClosingTime()),
      massReactivationStatus: {
        lastDay: this.massReactivationDone.day,
        lastHour: this.massReactivationDone.hour
      },
      pendingReactivations: {
        disabledChats: Object.keys(commandHandler.disabledChats || {}).length,
        manualInterventions: Object.keys(commandHandler.manualInterventions || {}).length,
        completedChats: Object.keys(commandHandler.completedChats || {}).length
      }
    };
  }
}

// Exportar una instancia única del gestor de reactivación
module.exports = new AutoReactivationManager();