/**
 * index.js - Archivo principal del bot de WhatsApp para Andy's Don Cash
 * Versión modular optimizada
 */

// Configuración de variables de entorno
const dotenv = require("dotenv");
dotenv.config();

// Módulos principales
const { initConnection } = require("./connection");
const backup = require("./modules/backup");
const cleanupScheduler = require("./modules/cleanupScheduler");
const autoReactivation = require("./modules/autoReactivationManager");

// Iniciar sistemas automáticos
backup.scheduleBackup();
cleanupScheduler.startScheduler();
autoReactivation.startAutoReactivation();

// Iniciar el bot
console.log("Iniciando bot de WhatsApp para Andy's Don Cash...");
initConnection();

// Manejo de errores no capturados
const stateManager = require("./services/stateManager");

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