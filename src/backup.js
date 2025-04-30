/**
 * backup.js - Sistema de respaldo automático de datos
 * Realiza respaldos periódicos de los estados de usuarios
 */

const fs = require('fs');
const path = require('path');
const stateManager = require('./stateManager');

class BackupSystem {
  constructor() {
    this.backupDir = path.join(__dirname, 'backup');
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
    this.maxBackups = 30; // Número máximo de respaldos a mantener
    
    // Crear directorio de respaldo si no existe
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`Directorio de respaldos creado: ${this.backupDir}`);
    }
  }

  /**
   * Programa el respaldo automático
   */
  scheduleBackup() {
    // Realizar un respaldo inicial al iniciar
    this.performBackup();
    
    // Programar respaldos periódicos
    setInterval(() => {
      this.performBackup();
    }, this.backupInterval);
    
    console.log(`Respaldo automático programado cada ${this.backupInterval / (60 * 60 * 1000)} horas`);
  }

  /**
   * Ejecuta el respaldo de datos
   */
  performBackup() {
    try {
      // Obtener fecha actual para el nombre del archivo
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      const fileName = `states-${dateStr}.json`;
      const filePath = path.join(this.backupDir, fileName);
      
      // Obtener datos actualizados
      const states = stateManager.states;
      
      // Guardar respaldo
      fs.writeFileSync(filePath, JSON.stringify(states, null, 2));
      console.log(`Respaldo realizado: ${fileName}`);
      
      // Limpiar respaldos antiguos
      this.cleanOldBackups();
      
      return true;
    } catch (error) {
      console.error('Error al realizar respaldo:', error);
      return false;
    }
  }

  /**
   * Limpia respaldos antiguos según el límite configurado
   */
  cleanOldBackups() {
    try {
      // Obtener lista de archivos de respaldo
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('states-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Ordenar del más reciente al más antiguo
      
      // Si hay más archivos que el límite, eliminar los más antiguos
      if (files.length > this.maxBackups) {
        console.log(`Limpiando respaldos antiguos (manteniendo ${this.maxBackups} de ${files.length})...`);
        
        const filesToDelete = files.slice(this.maxBackups);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log(`Respaldo antiguo eliminado: ${file.name}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error al limpiar respaldos antiguos:', error);
      return false;
    }
  }

  /**
   * Restaura un respaldo específico
   * @param {string} backupFile Nombre del archivo de respaldo
   * @returns {boolean} Éxito de la restauración
   */
  restoreBackup(backupFile) {
    try {
      const backupPath = path.join(this.backupDir, backupFile);
      
      // Verificar si el archivo existe
      if (!fs.existsSync(backupPath)) {
        console.error(`El archivo de respaldo no existe: ${backupFile}`);
        return false;
      }
      
      // Leer datos del respaldo
      const data = fs.readFileSync(backupPath, 'utf8');
      const states = JSON.parse(data);
      
      // Actualizar estados en el administrador
      Object.assign(stateManager.states, states);
      stateManager.saveStates();
      
      console.log(`Respaldo restaurado: ${backupFile}`);
      return true;
    } catch (error) {
      console.error(`Error al restaurar respaldo ${backupFile}:`, error);
      return false;
    }
  }

  /**
   * Obtiene la lista de respaldos disponibles
   * @returns {Array} Lista de archivos de respaldo
   */
  getBackupsList() {
    try {
      return fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('states-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          date: file.replace('states-', '').replace('.json', ''),
          size: fs.statSync(path.join(this.backupDir, file)).size
        }))
        .sort((a, b) => b.date.localeCompare(a.date)); // Ordenar por fecha, más reciente primero
    } catch (error) {
      console.error('Error al obtener lista de respaldos:', error);
      return [];
    }
  }

  /**
   * Realiza un respaldo manual con nombre personalizado
   * @param {string} customName Nombre personalizado para el respaldo
   * @returns {boolean} Éxito del respaldo
   */
  performManualBackup(customName = '') {
    try {
      // Obtener fecha actual para el nombre del archivo
      const now = new Date();
      const dateStr = now.toISOString().replace(/:/g, '-').split('.')[0]; // Formato YYYY-MM-DDTHH-MM-SS
      const fileName = customName 
        ? `states-${customName}-${dateStr}.json`
        : `states-manual-${dateStr}.json`;
      const filePath = path.join(this.backupDir, fileName);
      
      // Obtener datos actualizados
      const states = stateManager.states;
      
      // Guardar respaldo
      fs.writeFileSync(filePath, JSON.stringify(states, null, 2));
      console.log(`Respaldo manual realizado: ${fileName}`);
      
      return true;
    } catch (error) {
      console.error('Error al realizar respaldo manual:', error);
      return false;
    }
  }
}

// Exportar una instancia única del sistema de respaldo
module.exports = new BackupSystem();