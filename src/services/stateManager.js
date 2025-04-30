/**
 * stateManager.js - Sistema de gestión de estados de usuarios
 * Maneja persistencia de estados y gestión de sesiones
 */

const fs = require('fs');
const path = require('path');

class StateManager {
  constructor() {
    this.statesFilePath = path.join(__dirname, 'states.json');
    this.states = {};
    this.loadStates();
  }

  /**
   * Carga los estados guardados desde el archivo
   */
  loadStates() {
    try {
      if (fs.existsSync(this.statesFilePath)) {
        const data = fs.readFileSync(this.statesFilePath, 'utf8');
        this.states = JSON.parse(data);
        this.cleanupOldSessions();
        console.log('Estados cargados correctamente');
      } else {
        this.states = {};
        this.saveStates();
        console.log('Archivo de estados no encontrado. Creando nuevo...');
      }
    } catch (err) {
      console.error('Error al cargar estados:', err);
      this.states = {};
      this.saveStates();
    }
  }

  /**
   * Guarda los estados actuales en el archivo
   */
  saveStates() {
    try {
      fs.writeFileSync(this.statesFilePath, JSON.stringify(this.states, null, 2));
      return true;
    } catch (err) {
      console.error('Error al guardar estados:', err);
      return false;
    }
  }

  /**
   * Limpia sesiones antiguas (más de 30 días de inactividad)
   */
  cleanupOldSessions() {
    const now = Date.now();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    let cleanupCount = 0;

    for (const userId in this.states) {
      if (now - this.states[userId].lastInteraction > thirtyDaysInMs) {
        delete this.states[userId];
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`Limpieza de sesiones: ${cleanupCount} sesiones antiguas eliminadas`);
      this.saveStates();
    }
  }

  /**
   * Limpia usuarios inactivos por más de X meses
   * @param {number} months Número de meses de inactividad
   * @returns {number} Cantidad de usuarios eliminados
   */
  cleanupInactiveUsers(months = 3) {
    const now = Date.now();
    const inactivityThreshold = months * 30 * 24 * 60 * 60 * 1000; // Convertir meses a milisegundos
    let cleanupCount = 0;
    
    console.log(`Iniciando limpieza de usuarios inactivos por más de ${months} meses...`);

    for (const userId in this.states) {
      // Verificar última interacción
      if (now - this.states[userId].lastInteraction > inactivityThreshold) {
        console.log(`Eliminando usuario inactivo: ${userId} (Última actividad: ${new Date(this.states[userId].lastInteraction).toLocaleDateString()})`);
        delete this.states[userId];
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`Limpieza completada: ${cleanupCount} usuarios inactivos eliminados`);
      this.saveStates();
    } else {
      console.log('No se encontraron usuarios inactivos para eliminar');
    }
    
    return cleanupCount;
  }

  /**
   * Obtiene el estado actual de un usuario
   * @param {string} userId ID del usuario
   * @returns {Object} Estado del usuario
   */
  getUserState(userId) {
    if (!this.states[userId]) {
      // Crear un nuevo estado si no existe
      this.states[userId] = {
        languageCode: null,        // Idioma seleccionado (es/en)
        currentContext: 'welcome', // Contexto actual de la conversación
        lastInteraction: Date.now(), // Última interacción
        sessionStarted: Date.now(), // Inicio de sesión
        selectedProduct: null,     // Producto seleccionado
        processCompleted: false,   // Indica si el proceso ha sido completado
        processStage: 'initial',   // Etapa actual del proceso
        userInfo: {               // Información recopilada del usuario
          name: null,
          phone: null,
          email: null
        }
      };
      this.saveStates();
    }
    return this.states[userId];
  }

  /**
   * Actualiza el estado de un usuario
   * @param {string} userId ID del usuario
   * @param {Object} updates Actualizaciones al estado
   * @returns {Object} Estado actualizado
   */
  updateUserState(userId, updates) {
    const userState = this.getUserState(userId);
    
    // Actualizar el estado con los nuevos valores
    this.states[userId] = { 
      ...userState, 
      ...updates, 
      lastInteraction: Date.now() 
    };
    
    // Guardar en disco
    this.saveStates();
    return this.states[userId];
  }

  /**
   * Verifica si un usuario ha interactuado recientemente
   * @param {string} userId ID del usuario
   * @param {number} timeInMs Tiempo en milisegundos
   * @returns {boolean} Verdadero si ha interactuado dentro del período
   */
  hasRecentInteraction(userId, timeInMs = 30 * 60 * 1000) { // Por defecto 30 minutos
    const userState = this.getUserState(userId);
    return (Date.now() - userState.lastInteraction) < timeInMs;
  }

  /**
   * Reinicia el estado de un usuario
   * @param {string} userId ID del usuario
   */
  resetUserState(userId) {
    if (this.states[userId]) {
      const languageCode = this.states[userId].languageCode; // Preservar idioma seleccionado
      
      this.states[userId] = {
        languageCode,
        currentContext: 'welcome',
        lastInteraction: Date.now(),
        sessionStarted: Date.now(),
        selectedProduct: null,
        processCompleted: false,
        processStage: 'initial',
        userInfo: {
          name: null,
          phone: null,
          email: null
        }
      };
      
      this.saveStates();
      return true;
    }
    return false;
  }

  /**
   * Elimina el estado de un usuario
   * @param {string} userId ID del usuario
   */
  deleteUserState(userId) {
    if (this.states[userId]) {
      delete this.states[userId];
      this.saveStates();
      return true;
    }
    return false;
  }
}

// Exportar una instancia única del gestor de estados
module.exports = new StateManager();