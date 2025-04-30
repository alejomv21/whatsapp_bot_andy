/**
 * backup.js - Sistema de respaldo automático de datos
 * Realiza respaldos periódicos de los estados de usuarios y archivos de autenticación de Baileys
 */

const fs = require('fs');
const path = require('path');
const stateManager = require('../services/stateManager');

class BackupSystem {
  constructor() {
    // Configuración general de backups
    this.backupDir = path.join(__dirname, '..', '..', 'backups');
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
    this.maxBackups = 30; // Número máximo de respaldos a mantener
    
    // Configuración específica para Baileys
    this.baileysDirName = 'auth_info_baileys';
    this.baileysSrcDir = path.join(__dirname, '..', '..', this.baileysDirName);
    this.baileysBackupDir = path.join(this.backupDir, 'baileys');
    this.baileysMaxBackups = 5; // Número máximo de backups de autenticación
    
    // Crear directorios de respaldo si no existen
    this.ensureDirectoryExists(this.backupDir);
    this.ensureDirectoryExists(this.baileysBackupDir);
  }

  /**
   * Crea un directorio si no existe
   * @param {string} dir - Ruta del directorio
   */
  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Directorio creado: ${dir}`);
    }
  }

  /**
   * Programa el respaldo automático
   */
  scheduleBackup() {
    // Realizar un respaldo inicial al iniciar
    this.performFullBackup();
    
    // Programar respaldos periódicos
    setInterval(() => {
      this.performFullBackup();
    }, this.backupInterval);
    
    console.log(`Respaldo automático programado cada ${this.backupInterval / (60 * 60 * 1000)} horas`);
  }

  /**
   * Ejecuta un respaldo completo (estados y autenticación)
   */
  performFullBackup() {
    try {
      // Respaldar estados
      this.performStateBackup();
      
      // Respaldar archivos de autenticación de Baileys
      this.performBaileysBackup();
      
      return true;
    } catch (error) {
      console.error('Error al realizar respaldo completo:', error);
      return false;
    }
  }

  /**
   * Ejecuta el respaldo de estados de usuario
   */
  performStateBackup() {
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
      console.log(`Respaldo de estados realizado: ${fileName}`);
      
      // Limpiar respaldos antiguos
      this.cleanOldBackups();
      
      return true;
    } catch (error) {
      console.error('Error al realizar respaldo de estados:', error);
      return false;
    }
  }

  /**
   * Ejecuta el respaldo de archivos de autenticación de Baileys
   */
  performBaileysBackup() {
    try {
      // Verificar que el directorio de Baileys existe
      if (!fs.existsSync(this.baileysSrcDir)) {
        console.warn(`El directorio de Baileys no existe: ${this.baileysSrcDir}`);
        return false;
      }
      
      // Crear nombre del directorio de respaldo con timestamp
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      const backupDirName = `${this.baileysDirName}_${timestamp}`;
      const destDir = path.join(this.baileysBackupDir, backupDirName);
      
      // Copiar todo el directorio
      this.copyDirectory(this.baileysSrcDir, destDir);
      console.log(`Respaldo de Baileys realizado: ${backupDirName}`);
      
      // Limpiar respaldos antiguos de Baileys
      this.cleanOldBaileysBackups();
      
      return true;
    } catch (error) {
      console.error('Error al realizar respaldo de Baileys:', error);
      return false;
    }
  }

  /**
   * Copia un directorio completo a otro destino
   * @param {string} src - Directorio origen
   * @param {string} dest - Directorio destino
   */
  copyDirectory(src, dest) {
    // Crear directorio destino
    fs.mkdirSync(dest, { recursive: true });
    
    // Leer contenido del directorio origen
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    // Copiar cada elemento
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        // Si es directorio, copiar recursivamente
        this.copyDirectory(srcPath, destPath);
      } else {
        // Si es archivo, copiar directamente
        fs.copyFileSync(srcPath, destPath);
      }
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
   * Limpia respaldos antiguos de Baileys según el límite configurado
   */
  cleanOldBaileysBackups() {
    try {
      // Obtener lista de directorios de respaldo
      const dirs = fs.readdirSync(this.baileysBackupDir)
        .filter(dir => dir.startsWith(this.baileysDirName))
        .map(dir => ({
          name: dir,
          path: path.join(this.baileysBackupDir, dir),
          time: fs.statSync(path.join(this.baileysBackupDir, dir)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Ordenar del más reciente al más antiguo
      
      // Si hay más directorios que el límite, eliminar los más antiguos
      if (dirs.length > this.baileysMaxBackups) {
        console.log(`Limpiando respaldos antiguos de Baileys (manteniendo ${this.baileysMaxBackups} de ${dirs.length})...`);
        
        const dirsToDelete = dirs.slice(this.baileysMaxBackups);
        for (const dir of dirsToDelete) {
          this.removeDirRecursive(dir.path);
          console.log(`Respaldo antiguo de Baileys eliminado: ${dir.name}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error al limpiar respaldos antiguos de Baileys:', error);
      return false;
    }
  }

  /**
   * Elimina un directorio y todo su contenido
   * @param {string} dir - Directorio a eliminar
   */
  removeDirRecursive(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
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
   * Restaura un respaldo específico de Baileys
   * @param {string} backupDirName Nombre del directorio de respaldo
   * @returns {boolean} Éxito de la restauración
   */
  restoreBaileysBackup(backupDirName) {
    try {
      const backupPath = path.join(this.baileysBackupDir, backupDirName);
      
      // Verificar si el directorio existe
      if (!fs.existsSync(backupPath)) {
        console.error(`El directorio de respaldo no existe: ${backupDirName}`);
        return false;
      }
      
      // Crear respaldo antes de restaurar (por precaución)
      this.performBaileysBackup();
      
      // Eliminar directorio actual
      if (fs.existsSync(this.baileysSrcDir)) {
        this.removeDirRecursive(this.baileysSrcDir);
      }
      
      // Copiar respaldo al directorio original
      this.copyDirectory(backupPath, this.baileysSrcDir);
      
      console.log(`Respaldo de Baileys restaurado: ${backupDirName}`);
      return true;
    } catch (error) {
      console.error(`Error al restaurar respaldo de Baileys ${backupDirName}:`, error);
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
   * Obtiene la lista de respaldos de Baileys disponibles
   * @returns {Array} Lista de directorios de respaldo
   */
  getBaileysBackupsList() {
    try {
      return fs.readdirSync(this.baileysBackupDir)
        .filter(dir => dir.startsWith(this.baileysDirName))
        .map(dir => ({
          name: dir,
          date: dir.split('_').slice(1).join('_'), // Extraer la parte del timestamp
          size: this.getDirSize(path.join(this.baileysBackupDir, dir))
        }))
        .sort((a, b) => b.date.localeCompare(a.date)); // Ordenar por fecha, más reciente primero
    } catch (error) {
      console.error('Error al obtener lista de respaldos de Baileys:', error);
      return [];
    }
  }

  /**
   * Calcula el tamaño de un directorio
   * @param {string} dir - Directorio a calcular
   * @returns {number} Tamaño en bytes
   */
  getDirSize(dir) {
    let size = 0;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Si es directorio, sumar tamaño recursivamente
        size += this.getDirSize(fullPath);
      } else {
        // Si es archivo, sumar tamaño
        size += fs.statSync(fullPath).size;
      }
    }
    
    return size;
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
      
      // También realizar respaldo de Baileys
      this.performBaileysBackup();
      
      return true;
    } catch (error) {
      console.error('Error al realizar respaldo manual:', error);
      return false;
    }
  }

  /**
   * Comprueba si existen respaldos de Baileys
   * @returns {boolean} true si existen respaldos
   */
  hasBaileysBackups() {
    try {
      const backups = this.getBaileysBackupsList();
      return backups.length > 0;
    } catch (error) {
      console.error('Error al comprobar respaldos de Baileys:', error);
      return false;
    }
  }

  /**
   * Obtiene la información de configuración del sistema de respaldos
   * @returns {Object} Información de configuración
   */
  getBackupInfo() {
    return {
      backupDir: this.backupDir,
      backupInterval: this.backupInterval,
      maxBackups: this.maxBackups,
      baileysSrcDir: this.baileysSrcDir,
      baileysBackupDir: this.baileysBackupDir,
      baileysMaxBackups: this.baileysMaxBackups,
      nextBackupTime: new Date(Date.now() + this.backupInterval),
      statesBackupsCount: this.getBackupsList().length,
      baileysBackupsCount: this.getBaileysBackupsList().length
    };
  }
}

// Exportar una instancia única del sistema de respaldo
module.exports = new BackupSystem();