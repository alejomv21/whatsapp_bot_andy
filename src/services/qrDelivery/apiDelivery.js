/**
 * apiDelivery.js - Módulo específico para exponer códigos QR a través de una API REST
 */

const express = require('express');
const basicAuth = require('express-basic-auth');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno si no se han cargado
if (!process.env.NODE_ENV) {
  dotenv.config();
}

// Configuración de la API
const config = {
  port: process.env.QR_API_PORT || 3300,
  username: process.env.QR_API_USERNAME || 'admin',
  password: process.env.QR_API_PASSWORD || 'password',
  qrLifetime: parseInt(process.env.QR_LIFETIME || '60000') // 60 segundos por defecto
};

// Variables para almacenar estado
let app = null;
let server = null;
let initialized = false;
let currentQR = null;
let qrTimestamp = null;

/**
 * Inicializa el servidor API
 * @param {Object} customConfig - Configuración personalizada (opcional)
 * @returns {boolean} true si la inicialización es exitosa
 */
function initialize(customConfig = {}) {
  try {
    // Combinar configuración por defecto con personalizada
    Object.assign(config, customConfig);
    
    // Si ya está inicializado, no hacer nada
    if (initialized && server) {
      console.log('El servidor API ya está en ejecución');
      return true;
    }
    
    // Crear servidor Express
    app = express();
    
    // Configurar middleware
    app.use(cors());
    app.use(express.json());
    
    // Configurar autenticación básica
    app.use(basicAuth({
      users: { [config.username]: config.password },
      challenge: true,
      realm: 'WhatsApp QR Code API'
    }));
    
    // Ruta estática para archivos
    const publicDir = path.join(__dirname, '..', '..', '..', 'public');
    app.use('/static', express.static(publicDir));
    
    // Ruta para ver el estado del QR
    app.get('/api/qr/status', (req, res) => {
      if (!currentQR) {
        return res.status(404).json({
          status: 'error',
          message: 'No hay código QR disponible actualmente'
        });
      }
      
      // Verificar si el QR ha expirado
      const qrAge = Date.now() - qrTimestamp;
      const expired = qrAge > config.qrLifetime;
      
      res.json({
        status: 'success',
        data: {
          exists: true,
          timestamp: qrTimestamp,
          expired: expired,
          timeRemaining: expired ? 0 : config.qrLifetime - qrAge
        }
      });
    });
    
    // Ruta para ver el QR en HTML
    app.get('/qr', (req, res) => {
      if (!currentQR) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Bot - Código QR</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
            </style>
          </head>
          <body>
            <h1>No hay código QR disponible</h1>
            <p>En este momento no hay un código QR de reconexión disponible.</p>
            <p>Cuando el bot necesite reconectarse, se generará un código QR y aparecerá en esta página.</p>
            <p><button onclick="location.reload()">Verificar de nuevo</button></p>
          </body>
          </html>
        `);
      }
      
      // Verificar si el QR ha expirado
      const qrAge = Date.now() - qrTimestamp;
      if (qrAge > config.qrLifetime) {
        return res.status(410).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Bot - Código QR</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
            </style>
          </head>
          <body>
            <h1>Código QR expirado</h1>
            <p>El código QR ha expirado. Espera a que se genere uno nuevo.</p>
            <p><button onclick="location.reload()">Verificar de nuevo</button></p>
            <script>
              // Recargar automáticamente después de 10 segundos
              setTimeout(() => { location.reload(); }, 10000);
            </script>
          </body>
          </html>
        `);
      }
      
      // Renderizar página HTML con el QR
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Bot - Código QR</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin: 20px; background-color: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .qr-container { max-width: 300px; margin: 20px auto; }
            img { width: 100%; }
            .countdown { margin-top: 20px; font-weight: bold; padding: 10px; background: #f8f8f8; border-radius: 5px; }
            h1 { color: #128C7E; } /* Color verde de WhatsApp */
            .instructions { text-align: left; margin: 20px 0; padding: 15px; background: #F0F9FF; border-left: 4px solid #128C7E; border-radius: 4px; }
            .instructions li { margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Código QR de WhatsApp</h1>
            <p>Escanea este código para reconectar el bot</p>
            
            <div class="qr-container">
              <img src="${currentQR}" alt="Código QR de WhatsApp">
            </div>
            
            <div class="countdown" id="countdown"></div>
            
            <div class="instructions">
              <h3>Instrucciones:</h3>
              <ol>
                <li>Abre WhatsApp en tu teléfono</li>
                <li>Toca en el ícono de los tres puntos (⋮) y selecciona "WhatsApp Web"</li>
                <li>Apunta la cámara hacia este código QR</li>
                <li>Mantén la sesión activa para que el bot funcione correctamente</li>
              </ol>
            </div>
          </div>
          
          <script>
            // Contador regresivo
            const qrTimestamp = ${qrTimestamp};
            const updateCountdown = () => {
              const now = Date.now();
              const elapsed = now - qrTimestamp;
              const remaining = Math.max(0, ${config.qrLifetime / 1000} - Math.floor(elapsed/1000));
              
              document.getElementById('countdown').innerText = 
                remaining > 0 ? 'Expira en: ' + remaining + ' segundos' : 'QR expirado, actualizando...';
                
              if (remaining <= 0) {
                setTimeout(() => { location.reload(); }, 3000);
              }
            };
            
            setInterval(updateCountdown, 1000);
            updateCountdown();
          </script>
        </body>
        </html>
      `);
    });
    
    // Iniciar servidor
    server = app.listen(config.port, () => {
      console.log(`Servidor QR iniciado en puerto ${config.port}`);
      console.log(`Accede al QR en: http://localhost:${config.port}/qr`);
      console.log(`Usuario: ${config.username}, Contraseña: ${'*'.repeat(config.password.length)}`);
      initialized = true;
    });
    
    // Manejar errores del servidor
    server.on('error', (err) => {
      console.error('Error en el servidor QR:', err);
      initialized = false;
      server = null;
    });
    
    return true;
  } catch (error) {
    console.error('Error al inicializar el servidor API:', error);
    initialized = false;
    return false;
  }
}

/**
 * Actualiza el QR actual en el servidor
 * @param {string} qrBase64 - Código QR en formato base64
 * @param {number} timestamp - Marca de tiempo de generación
 */
function updateQR(qrBase64, timestamp) {
  currentQR = qrBase64;
  qrTimestamp = timestamp;
  console.log('QR actualizado en el servidor API');
}

/**
 * Detiene el servidor API
 */
function stop() {
  if (server) {
    server.close();
    console.log('Servidor API detenido');
    server = null;
    initialized = false;
  }
}

/**
 * Verifica si el servidor está inicializado
 * @returns {boolean} true si está inicializado
 */
function isInitialized() {
  return initialized;
}

/**
 * Actualiza la configuración del servidor
 * @param {Object} newConfig - Nueva configuración
 */
function updateConfig(newConfig) {
  Object.assign(config, newConfig);
  
  // Reiniciar servidor si ya estaba iniciado
  if (initialized) {
    stop();
    initialize();
  }
}

module.exports = {
  initialize,
  updateQR,
  stop,
  isInitialized,
  updateConfig
};