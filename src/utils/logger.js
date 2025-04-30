/**
 * logger.js - Configuración centralizada de logging
 */

const pino = require('pino');

// Configuración de logging
const logger = pino({ 
  level: process.env.LOG_LEVEL || "warn",
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

module.exports = {
  logger
};