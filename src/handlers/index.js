/**
 * handlers/index.js - Punto de entrada para los manejadores de mensajes
 */

const { handleIncomingMessage } = require('./incomingMessage');
const { handleOutgoingMessage } = require('./outgoingMessage');
const { processIntent } = require('./intentProcessor');

module.exports = {
  handleIncomingMessage,
  handleOutgoingMessage,
  processIntent
};