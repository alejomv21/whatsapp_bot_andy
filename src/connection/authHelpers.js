/**
 * authHelpers.js - Funciones auxiliares para la gestión de la autenticación con Baileys
 * Versión simplificada que utiliza el sistema de backup centralizado
 */

const fs = require('fs');
const path = require('path');
const backupSystem = require('../modules/backup');

/**
 * Limpia archivos específicos del estado de autenticación que pueden estar corruptos
 * @param {string} authDir - Directorio de autenticación (por defecto: 'auth_info_baileys')
 */
async function cleanupAuthFiles(authDir = 'auth_info_baileys') {
  try {
    // Lista de archivos que podrían estar causando problemas
    const problematicFiles = [
      'session-creds.json',
      'app-state-sync-key.json',
      'app-state-sync-version.json'
    ];
    
    for (const file of problematicFiles) {
      const filePath = path.join(authDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`Eliminando archivo potencialmente problemático: ${filePath}`);
        fs.unlinkSync(filePath);
      }
    }
    
    console.log("Limpieza de archivos de autenticación completada");
  } catch (error) {
    console.error("Error al limpiar archivos de autenticación:", error);
  }
}

/**
 * Crea una copia de seguridad del estado de autenticación actual usando el sistema centralizado
 * @param {string} authDir - Directorio de autenticación (por defecto: 'auth_info_baileys')
 * @returns {string} - Ruta del directorio de copia de seguridad o null en caso de error
 */
async function backupAuthState(authDir = 'auth_info_baileys') {
  try {
    // Utilizar el sistema de backup centralizado
    backupSystem.performBaileysBackup();
    
    // Como el sistema de backup centralizado maneja su propia estructura,
    // devolvemos null ya que no hay una ruta específica que devolver
    return null;
  } catch (error) {
    console.error("Error al crear backup:", error);
    return null;
  }
}

/**
 * Reinicia completamente el estado de autenticación
 * @param {string} authDir - Directorio de autenticación (por defecto: 'auth_info_baileys')
 * @returns {boolean} - true si el reinicio fue exitoso
 */
async function resetAuthState(authDir = 'auth_info_baileys') {
  try {
    console.log("Reiniciando estado de autenticación...");
    
    // Crear backup antes de eliminar (usando el sistema centralizado)
    await backupAuthState(authDir);
    
    // Eliminar directorio actual si existe
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log(`Directorio ${authDir} eliminado.`);
    }
    
    // Crear directorio vacío
    fs.mkdirSync(authDir, { recursive: true });
    console.log(`Directorio ${authDir} recreado.`);
    
    console.log("Estado de autenticación reiniciado. Se generará un nuevo QR en la próxima conexión.");
    return true;
  } catch (error) {
    console.error("Error al reiniciar estado de autenticación:", error);
    return false;
  }
}

/**
 * Restaura una copia de seguridad previa del estado de autenticación
 * @param {string} backupName - Nombre del backup a restaurar
 * @returns {boolean} - true si la restauración fue exitosa
 */
async function restoreAuthBackup(backupName) {
  try {
    // Utilizar el sistema de backup centralizado para restaurar
    return backupSystem.restoreBaileysBackup(backupName);
  } catch (error) {
    console.error("Error al restaurar backup:", error);
    return false;
  }
}

/**
 * Lista todas las copias de seguridad disponibles
 * @returns {Array} - Lista de copias de seguridad disponibles
 */
function listAvailableBackups() {
  try {
    // Utilizar el sistema de backup centralizado para listar
    return backupSystem.getBaileysBackupsList();
  } catch (error) {
    console.error("Error al listar backups disponibles:", error);
    return [];
  }
}

module.exports = {
  cleanupAuthFiles,
  backupAuthState,
  resetAuthState,
  restoreAuthBackup,
  listAvailableBackups
};