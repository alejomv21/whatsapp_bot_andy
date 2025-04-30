/**
 * timeManager.js - Gestor de horarios para Andy's Don Cash
 * Maneja la lógica relacionada con horarios de atención
 */

class TimeManager {
    constructor() {
      // Configuración de horarios de atención
      this.businessHours = {
        // 0 = domingo, 1 = lunes, 2 = martes, 3 = miércoles, 4 = jueves, 5 = viernes, 6 = sábado
        0: { open: false }, // Domingo: Cerrado
        1: { open: true, start: 10, end: 17 }, // Lunes: 10 AM - 5 PM
        2: { open: true, start: 10, end: 17 }, // Martes: 10 AM - 5 PM
        3: { open: true, start: 10, end: 17 }, // Miércoles: 10 AM - 5 PM
        4: { open: true, start: 10, end: 17 }, // Jueves: 10 AM - 5 PM
        5: { open: true, start: 10, end: 17 }, // Viernes: 10 AM - 5 PM
        6: { open: true, start: 10, end: 12 }  // Sábado: 10 AM - 12 PM (sólo WhatsApp)
      };
      
      // Días festivos o días especiales de cierre (formato MM-DD)
      this.holidays = [
        '01-01', // Año Nuevo
        '07-04', // Día de la Independencia
        '12-25', // Navidad
        // Añade más días festivos según sea necesario
      ];
      
      // Variable para simular horario (para pruebas)
      this.mockDate = null;
    }
  
    /**
     * Obtiene la fecha y hora actual o simulada
     * @returns {Date} Fecha y hora actual o simulada
     */
    getCurrentDate() {
      return this.mockDate || new Date();
    }
  
    /**
     * Configura una fecha simulada para pruebas
     * @param {Date|null} date Fecha simulada o null para usar la fecha real
     */
    setMockDate(date) {
      this.mockDate = date;
      console.log(`Fecha simulada configurada: ${date ? date.toLocaleString() : 'Usando fecha real'}`);
    }
  
    /**
     * Verifica si es un día festivo
     * @param {Date} date Fecha a verificar
     * @returns {boolean} Es día festivo o no
     */
    isHoliday(date = this.getCurrentDate()) {
      const month = date.getMonth() + 1; // getMonth() devuelve 0-11
      const day = date.getDate();
      
      // Formato MM-DD (con ceros a la izquierda)
      const dateStr = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      return this.holidays.includes(dateStr);
    }
  
    /**
     * Verifica si es horario de atención
     * @returns {boolean} Es horario de atención o no
     */
    isBusinessHours() {
      const now = this.getCurrentDate();
      const day = now.getDay(); // 0 = domingo, 1 = lunes, etc.
      const hour = now.getHours();
      
      // Verificar si es día festivo
      if (this.isHoliday(now)) {
        return false;
      }
      
      // Verificar si el día está configurado como abierto
      if (!this.businessHours[day].open) {
        return false;
      }
      
      // Verificar si la hora actual está dentro del horario
      return hour >= this.businessHours[day].start && hour < this.businessHours[day].end;
    }
  
    /**
     * Obtiene la próxima fecha y hora de apertura
     * @returns {Date} Próxima fecha y hora de apertura
     */
    getNextOpeningTime() {
      const now = this.getCurrentDate();
      let nextDay = now.getDay();
      let daysToAdd = 0;
      
      // Buscar el próximo día laboral
      while (daysToAdd < 7) {
        // Verificar si es el mismo día pero fuera de horario
        if (daysToAdd === 0 && this.businessHours[nextDay].open && 
            now.getHours() < this.businessHours[nextDay].start) {
          // Aún no ha abierto hoy
          const nextOpening = new Date(now);
          nextOpening.setHours(this.businessHours[nextDay].start, 0, 0, 0);
          return nextOpening;
        }
        
        // Avanzar al siguiente día
        daysToAdd++;
        nextDay = (nextDay + 1) % 7;
        
        // Verificar si el próximo día es laboral
        if (this.businessHours[nextDay].open) {
          const nextOpening = new Date(now);
          nextOpening.setDate(now.getDate() + daysToAdd);
          nextOpening.setHours(this.businessHours[nextDay].start, 0, 0, 0);
          
          // Verificar que no sea día festivo
          if (!this.isHoliday(nextOpening)) {
            return nextOpening;
          }
        }
      }
      
      // Si no se encuentra un día laboral en la próxima semana
      // (esto no debería ocurrir con la configuración actual)
      return null;
    }
  
    /**
     * Obtiene el próximo cierre desde el momento actual
     * @returns {Date} Próxima fecha y hora de cierre
     */
    getNextClosingTime() {
      const now = this.getCurrentDate();
      const day = now.getDay();
      
      // Si estamos en horario de atención, devuelve la hora de cierre de hoy
      if (this.isBusinessHours()) {
        const nextClosing = new Date(now);
        nextClosing.setHours(this.businessHours[day].end, 0, 0, 0);
        return nextClosing;
      }
      
      // Si no estamos en horario de atención, busca el próximo día laboral
      const nextOpening = this.getNextOpeningTime();
      if (nextOpening) {
        const nextDay = nextOpening.getDay();
        const nextClosing = new Date(nextOpening);
        nextClosing.setHours(this.businessHours[nextDay].end, 0, 0, 0);
        return nextClosing;
      }
      
      return null;
    }
  
    /**
     * Formatea una fecha en string legible
     * @param {Date} date Fecha a formatear
     * @param {string} locale Locale para el formato ('es' o 'en')
     * @returns {string} Fecha formateada
     */
    formatDate(date, locale = 'es') {
      if (!date) return '';
      
      const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      };
      
      return date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', options);
    }
  
    /**
     * Obtiene un mensaje con el próximo horario de atención
     * @param {string} languageCode Código de idioma ('es' o 'en')
     * @returns {string} Mensaje con próximo horario
     */
    getNextBusinessHoursMessage(languageCode = 'es') {
      const nextOpening = this.getNextOpeningTime();
      
      if (!nextOpening) {
        return languageCode === 'es' 
          ? 'No se pudo determinar el próximo horario de atención.' 
          : 'Could not determine the next business hours.';
      }
      
      if (languageCode === 'en') {
        return `Our next business hours start on ${this.formatDate(nextOpening, 'en')}.`;
      } else {
        return `Nuestro próximo horario de atención comienza el ${this.formatDate(nextOpening, 'es')}.`;
      }
    }
  }
  
  // Exportar una instancia única del gestor de horarios
  module.exports = new TimeManager();