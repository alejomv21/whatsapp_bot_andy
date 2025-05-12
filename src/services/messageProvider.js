/**
 * messageProvider.js - Proveedor de mensajes según idioma y contexto
 * Centraliza todos los mensajes del bot para facilitar modificaciones
 */

const timeManager = require("./timeManager");

class MessageProvider {
  /**
   * Mensaje de bienvenida inicial con selección de idioma
   * @returns {string} Mensaje de bienvenida
   */
  getWelcomeMessage() {
    return `👋 ¡Hola! / Hello!
Gracias por contactar a Andy’s Don Cash — tu casa de empeño en Wynwood, Miami.

🇪🇸 Para continuar en español, responde con: 1️⃣
🇺🇸 To continue in English, reply with: 2️⃣`;
  }

  /**
   * Mensaje de bienvenida inicial con selección de idioma
   * @returns {string} Mensaje de bienvenida
   */
  getWelcomeMessageEnglish() {
    return `👋 Hello! / ¡Hola!
Thanks for contacting Andy’s Don Cash — your trusted pawnshop in Wynwood, Miami.

🇪🇸 Para continuar en español, responde con: 1️⃣
🇺🇸 To continue in English, reply with: 2️⃣`;
  }

  /**
   * Mensaje de selección de idioma
   * @returns {string} Mensaje de selección de idioma
   */
  getLanguagePrompt() {
    return `Por favor, selecciona tu idioma / Please select your language:

1️⃣ Español
2️⃣ English`;
  }

  /**
   * Mensaje fuera de horario según idioma
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {string} Mensaje fuera de horario
   */
  getOutOfHoursMessage(languageCode) {
    if (languageCode === "en") {
      return `👋 Hi! Thanks for contacting *Andy's Don Cash*, your trusted pawnshop in Wynwood, Miami.

🕒 We're currently *closed*, but we'll help you as soon as we're back!

📅 Business Hours:
Mon–Fri: 10 AM – 5 PM
Sat: WhatsApp Only, 10 AM – 12 PM
Sun: Closed

Please reply with the number that best describes what you're interested in:
1️⃣ Luxury Watches
2️⃣ Diamonds
3️⃣ Gold, Jewelryor or Silver

Also send us:
📛 Your name
📞 Your number (if different from this one)
🌐 www.andysdoncash.com
📸 https://instagram.com/andysdoncash

🙏 Thanks for choosing Andy's Don Cash! We'll reach out first thing next business day.`;
    } else {
      return `👋 ¡Hola! Gracias por escribir a *Andy's Don Cash*, tu casa de empeño en Wynwood, Miami.

🕒 En este momento estamos *fuera de horario*, pero no te preocupes, ¡te ayudaremos tan pronto abramos!

📅 *Horario de atención:*
Lunes a Viernes: 10 AM – 5 PM
Sábados: WhatsApp de 10 AM – 12 PM
Domingos: Cerrado

Responde con el número de lo que te interesa:
1️⃣ Estoy interesado en empeñar o vender *relojes de lujo*
2️⃣ Quiero empeñar o vender *diamantes*
3️⃣ Tengo *oro*, *plata* o *joyería* para evaluación o préstamo

También incluye por favor:
📛 Tu nombre
📞 Tu número (si es distinto al de este chat)
🌐 www.andysdoncash.com
📸 https://instagram.com/andysdoncash

🙏 ¡Gracias por confiar en Andy's Don Cash! Te contactaremos a primera hora del próximo día hábil.

Wynwood baby!!!`;
    }
  }

  /**
   * Mensaje en horario de atención según idioma
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {string} Mensaje en horario de atención
   */
  getBusinessHoursMenu(languageCode) {
    if (languageCode === "en") {
      return `👋 Hi! Welcome to *Andy's Don Cash*, your trusted pawnshop in Wynwood.

How can we assist you today? Please reply with:
1️⃣ Luxury Watches
2️⃣ Diamonds
3️⃣ Gold, Jewelry or Silver

📍 We're located in Wynwood, Miami, Florida and ready to help!
🌐 www.andysdoncash.com
📸 https://instagram.com/andysdoncash`;
    } else {
      return `👋 ¡Hola! Bienvenido a *Andy's Don Cash*, tu casa de empeño en Wynwood.

¿Cómo podemos ayudarte hoy?
Responde con:
1️⃣ Estoy interesado en empeñar o vender *relojes de lujo*
2️⃣ Quiero empeñar o vender *diamantes*
3️⃣ Tengo *oro*, *plata* o *joyería* para evaluación o préstamo

📍 Estamos ubicados en Wynwood, Miami, Florida. ¡Listos para ayudarte!
🌐 www.andysdoncash.com
📸 https://instagram.com/andysdoncash`;
    }
  }

  /**
   * Respuesta sobre relojes de lujo según idioma
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {string} Respuesta sobre relojes
   */
  getWatchesResponse(languageCode) {
    if (languageCode === "en") {
      return `⌚ Great! We work with high-end brands like Rolex, Audemars Piguet, Cartier and more.

If you have the watch with you, or would you like to schedule a visit for an appraisal. We'll reply as soon as possible.`;
    } else {
      return `⌚ ¡Excelente! Trabajamos con marcas como Rolex, Audemars Piguet, Cartier y más.

📲 Si quieres evaluar tu reloj o agendar una visita para evaluación, te responderemos lo antes posible`;
    }
  }

  /**
   * Respuesta sobre diamantes según idioma
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {string} Respuesta sobre diamantes
   */
  getDiamondsResponse(languageCode) {
    if (languageCode === "en") {
      return `💎 Perfect. Andy is a certified GIA gemologist. We evaluate diamonds professionally and discreetly.

We'll reply as soon as possible.`;
    } else {
      return `💎 Perfecto. Andy es gemólogo certificado por GIA. Evaluamos tus diamantes profesionalmente y con total discreción.

Te responderemos lo antes posible.`;
    }
  }

  /**
   * Respuesta sobre oro y plata según idioma
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {string} Respuesta sobre oro y plata
   */
  getGoldResponse(languageCode) {
    if (languageCode === "en") {
      return `🪙 We accept gold, silver or jewelry in any condition: 10k, 14k, 18k, 22k and 24k — even broken or damaged pieces.

Would you like to know how much you could get?
We'll reply as soon as possible.`;
    } else {
      return `🪙 Aceptamos oro, plata o joyería en cualquier condición: 10k, 14k, 18k, 22k y 24k — incluso roto o sin forma.

Te responderemos lo antes posible para que sepas cuánto podrías recibir.`;
    }
  }

  /**
   * Mensaje de cierre según idioma y horario
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @param {boolean} inBusinessHours En horario de atención o no
   * @returns {string} Mensaje de cierre
   */
  getClosingMessage(languageCode, inBusinessHours = true) {
    let message = "";

    if (languageCode === "en") {
      message = `🙏 Thank you for trusting Andy's Don Cash!

`;

      if (inBusinessHours) {
        message += `⚡ If it's during hours, we'll reply shortly.`;
      } else {
        message += `🌅 If it's outside hours, we'll reach out first thing next business day.`;
      }

      message += `

💰 We turn your valuables into fast, secure solutions.

Wynwood baby!!!`;
    } else {
      message = `🙏 ¡Gracias por confiar en Andy's Don Cash!

`;

      if (inBusinessHours) {
        message += `⚡ Si es dentro del horario, te atenderemos en breve.`;
      } else {
        message += `🌅 Si es fuera del horario, te contactamos a primera hora del próximo día laboral.`;
      }

      message += `

💰 Convertimos tus objetos de valor en soluciones rápidas y seguras.

Wynwood baby!!!`;
    }

    return message;
  }

  /**
   * Mensaje de fallback para productos no manejados
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {string} Mensaje de fallback
   */
  getFallbackMessage(languageCode) {
    if (languageCode === "en") {
      return `At *Andy's Don Cash*, we specialize only in:
1️⃣ Luxury Watches
2️⃣ Diamonds
3️⃣ Gold, Jewelry or Silver

Unfortunately, we *do not deal with other types of items*.

If you would like to proceed with one of these options, please reply with the corresponding number.

🙏 Thanks for your understanding!`;
    } else {
      return `En *Andy's Don Cash* nos especializamos únicamente en:
1️⃣ Relojes de lujo
2️⃣ Diamantes
3️⃣ Oro, Plata o Joyería

Por el momento, *no trabajamos con otros tipos de artículos*.

Si deseas avanzar con alguno de estos, por favor responde con el número de la opción que mejor se ajuste a lo que tienes.

🙏 ¡Gracias por tu comprensión!`;
    }
  }

  /**
   * Respuesta por defecto cuando no se entiende la consulta
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {string} Respuesta por defecto
   */
  getDefaultResponse(languageCode) {
    if (languageCode === "en") {
      return `I didn't quite understand your message. Could you please select one of our services?

1️⃣ Luxury Watches
2️⃣ Diamonds
3️⃣ Gold, Jewelry or Silver`;
    } else {
      return `No he entendido bien tu mensaje. ¿Podrías seleccionar uno de nuestros servicios?

1️⃣ Relojes de lujo
2️⃣ Diamantes
3️⃣ Oro, Plata o Joyería`;
    }
  }

  /**
   * Mensaje al detectar intervención manual del dueño
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {string} Mensaje de transición
   */
  getOwnerInterventionMessage(languageCode) {
    if (languageCode === "en") {
      return `You're now being assisted by the owner directly. Thank you for your patience.`;
    } else {
      return `Ahora estás siendo atendido por el dueño directamente. Gracias por tu paciencia.`;
    }
  }

  /**
   * Obtiene el mensaje adecuado según el contexto
   * @param {string} context Contexto de la conversación
   * @param {string} languageCode Código de idioma ('es' o 'en')
   * @returns {string} Mensaje según contexto
   */
  getMessageByContext(context, languageCode) {
    switch (context) {
      case "welcome":
        return this.getWelcomeMessage();

      case "language_selection":
        return this.getLanguagePrompt();

      case "main_menu":
        return timeManager.isBusinessHours()
          ? this.getBusinessHoursMenu(languageCode)
          : this.getOutOfHoursMessage(languageCode);

      case "watches_info":
        return this.getWatchesResponse(languageCode);

      case "diamonds_info":
        return this.getDiamondsResponse(languageCode);

      case "gold_info":
        return this.getGoldResponse(languageCode);

      case "closing":
        return this.getClosingMessage(
          languageCode,
          timeManager.isBusinessHours()
        );

      case "fallback":
        return this.getFallbackMessage(languageCode);

      default:
        return this.getDefaultResponse(languageCode);
    }
  }
}

// Exportar una instancia única del proveedor de mensajes
module.exports = new MessageProvider();
