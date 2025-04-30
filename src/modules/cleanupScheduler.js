/**
 * cleanupScheduler.js - Programador de tareas de limpieza
 * Programa la limpieza periódica de datos antiguos e inactivos
 */

const cron = require('node-cron');
const stateManager = require('../services/stateManager');
const backup = require('./backup');

class CleanupScheduler {
  constructor() {
    // Configuraciones
    this.inactivityMonths = 3; // Meses de inactividad antes de eliminar
    
    // Expresión cron para ejecución mensual (1er día del mes a las 3 AM)
    this.schedule = '0 3 1 * *';
  }

  /**
   * Inicia el programador de tareas
   */
  startScheduler() {
    console.log(`Programador de limpieza iniciado. Próxima ejecución: 1er día del mes a las 3 AM`);
    
    // Programar tarea de limpieza mensual
    cron.schedule(this.schedule, () => {
      this.performCleanup();
    });
  }

  /**
   * Realiza la limpieza de datos antiguos
   */
  performCleanup() {
    console.log(`Iniciando proceso de limpieza programada: ${new Date().toLocaleString()}`);
    
    try {
      // 1. Crear respaldo antes de limpiar
      backup.performManualBackup('pre-cleanup');
      console.log('Respaldo de seguridad creado antes de la limpieza');
      
      // 2. Limpiar usuarios inactivos
      const deletedUsers = stateManager.cleanupInactiveUsers(this.inactivityMonths);
      
      // 3. Crear respaldo después de limpiar
      backup.performManualBackup('post-cleanup');
      
      // 4. Registrar resultado
      const result = {
        timestamp: new Date().toISOString(),
        deletedUsers: deletedUsers,
        inactivityMonths: this.inactivityMonths
      };
      
      console.log(`Limpieza completada: ${deletedUsers} usuarios eliminados por inactividad de ${this.inactivityMonths} meses`);
      return result;
    } catch (error) {
      console.error('Error durante el proceso de limpieza programada:', error);
      return null;
    }
  }

  /**
   * Ejecuta la limpieza manualmente
   * @param {number} months Meses de inactividad (por defecto usa la configuración global)
   * @returns {Object} Resultado de la limpieza
   */
  runManualCleanup(months = null) {
    // Si se especifica un valor de meses, usar ese valor temporalmente
    const originalMonths = this.inactivityMonths;
    if (months !== null) {
      this.inactivityMonths = months;
    }
    
    const result = this.performCleanup();
    
    // Restaurar configuración original
    this.inactivityMonths = originalMonths;
    
    return result;
  }

  /**
   * Cambia el período de inactividad
   * @param {number} months Nuevo período en meses
   */
  setInactivityPeriod(months) {
    if (typeof months === 'number' && months > 0) {
      this.inactivityMonths = months;
      console.log(`Período de inactividad actualizado a ${months} meses`);
      return true;
    }
    return false;
  }

  /**
   * Obtiene la configuración actual
   * @returns {Object} Configuración actual
   */
  getConfig() {
    return {
      inactivityMonths: this.inactivityMonths,
      schedule: this.schedule,
      nextRun: this.getNextRunDate()
    };
  }

  /**
   * Calcula la próxima fecha de ejecución
   * @returns {Date} Próxima fecha de ejecución
   */
  getNextRunDate() {
    const now = new Date();
    let nextMonth = now.getMonth() + 1;
    let nextYear = now.getFullYear();
    
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    }
    
    const nextRunDate = new Date(nextYear, nextMonth, 1, 3, 0, 0);
    return nextRunDate;
  }
}

// Exportar una instancia única del programador de limpieza
module.exports = new CleanupScheduler();