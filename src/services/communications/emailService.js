/**
 * emailService.js - Servicio genérico para envío de correos electrónicos
 * Puede ser reutilizado en cualquier parte de la aplicación
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno si no se han cargado
if (!process.env.NODE_ENV) {
  dotenv.config();
}

// Configuración por defecto del servicio de correo
const defaultConfig = {
  service: process.env.EMAIL_SERVICE || 'gmail',
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS,
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER
};

// Transporte de correo
let transporter = null;

/**
 * Inicializa el transporte de correo con configuración personalizada
 * @param {Object} customConfig - Configuración personalizada (opcional)
 * @returns {boolean} true si la inicialización es exitosa
 */
function initialize(customConfig = {}) {
  try {
    // Combinar configuración por defecto con personalizada
    const config = { ...defaultConfig, ...customConfig };
    
    // Verificar configuración mínima
    if (!config.user || !config.pass) {
      console.error('Configuración de correo incompleta. Verifica las variables de entorno.');
      return false;
    }
    
    // Crear transporte
    transporter = nodemailer.createTransport({
      service: config.service,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
    
    // Verificar conexión
    transporter.verify(function(error, success) {
      if (error) {
        console.error('Error al configurar el servidor de correo:', error);
        transporter = null;
        return false;
      } else {
        console.log('Servidor de correo listo para enviar mensajes');
        return true;
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error al inicializar el transporte de correo:', error);
    return false;
  }
}

/**
 * Verifica si el servicio está inicializado
 * @returns {boolean} true si el servicio está inicializado
 */
function isInitialized() {
  return transporter !== null;
}

/**
 * Envía un correo electrónico
 * @param {Object} options - Opciones de correo
 * @param {string} options.to - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.text - Texto plano
 * @param {string} options.html - Contenido HTML (opcional)
 * @param {Array} options.attachments - Archivos adjuntos (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendEmail(options) {
  try {
    // Verificar si el transporte está inicializado
    if (!transporter) {
      const initResult = initialize();
      if (!initResult) {
        throw new Error('No se pudo inicializar el transporte de correo');
      }
    }
    
    // Verificar opciones mínimas
    if (!options.to || !options.subject || (!options.text && !options.html)) {
      throw new Error('Opciones de correo incompletas. Se requiere destinatario, asunto y contenido.');
    }
    
    // Configurar email
    const mailOptions = {
      from: options.from || defaultConfig.from,
      to: options.to,
      subject: options.subject,
      ...(options.text && { text: options.text }),
      ...(options.html && { html: options.html }),
      ...(options.attachments && { attachments: options.attachments })
    };
    
    // Enviar email
    const info = await transporter.sendMail(mailOptions);
    console.log('Correo enviado:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envía un correo electrónico con un HTML personalizado
 * @param {Object} options - Opciones de correo
 * @param {string} options.to - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.heading - Encabezado del correo
 * @param {string} options.content - Contenido principal del correo
 * @param {string} options.footer - Pie del correo (opcional)
 * @param {Array} options.attachments - Archivos adjuntos (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendFormattedEmail(options) {
  // Crear HTML bonito para el correo
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 5px;">
      <h2 style="color: #4285f4; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">${options.heading || options.subject}</h2>
      <div style="margin: 20px 0; line-height: 1.5;">
        ${options.content}
      </div>
      ${options.footer ? `<p style="color: #777; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">${options.footer}</p>` : ''}
    </div>
  `;
  
  // Usar la función básica de envío con el HTML generado
  return sendEmail({
    to: options.to,
    subject: options.subject,
    html: html,
    attachments: options.attachments
  });
}

/**
 * Envía un correo electrónico con una imagen incrustada
 * @param {Object} options - Opciones de correo
 * @param {string} options.to - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.text - Descripción de texto
 * @param {string} options.imagePath - Ruta de la imagen
 * @param {string} options.imageAlt - Texto alternativo para la imagen
 * @param {string} options.imageCid - ID de contenido para la imagen (por defecto: 'embedded-image')
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendEmailWithImage(options) {
  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(options.imagePath)) {
      throw new Error(`La imagen no existe en la ruta: ${options.imagePath}`);
    }
    
    // Crear HTML con la imagen incrustada
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4285f4;">${options.subject}</h2>
        <p style="margin: 20px 0; line-height: 1.5;">${options.text}</p>
        <div style="margin: 30px 0; text-align: center;">
          <img src="cid:${options.imageCid || 'embedded-image'}" alt="${options.imageAlt || 'Imagen'}" style="max-width: 100%; border: 1px solid #ddd;">
        </div>
        <p style="color: #777; font-size: 12px; text-align: center; margin-top: 30px;">Mensaje generado automáticamente, por favor no responder.</p>
      </div>
    `;
    
    // Configurar adjuntos con la imagen incrustada
    const attachments = [{
      filename: path.basename(options.imagePath),
      path: options.imagePath,
      cid: options.imageCid || 'embedded-image'
    }];
    
    // Enviar correo
    return sendEmail({
      to: options.to,
      subject: options.subject,
      html: html,
      attachments: attachments
    });
  } catch (error) {
    console.error('Error al enviar correo con imagen:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cierra el transporte de correo
 */
function close() {
  if (transporter) {
    transporter.close();
    transporter = null;
    console.log('Servicio de correo cerrado');
  }
}

module.exports = {
  initialize,
  isInitialized,
  sendEmail,
  sendFormattedEmail,
  sendEmailWithImage,
  close
};