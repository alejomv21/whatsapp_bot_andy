# Bot de WhatsApp para Andy's Don Cash

Bot de WhatsApp para gestión de comunicación automatizada con clientes de la casa de empeño Andy's Don Cash en Wynwood, Miami. El bot ofrece asistencia en español e inglés, maneja diferentes tipos de productos (relojes de lujo, diamantes, oro/plata) y se adapta al horario de atención del negocio.

## Características Principales

- **Soporte bilingüe**: Respuestas en español e inglés
- **Detección automática de horario**: Comportamiento diferente dentro y fuera del horario de atención
- **Gestión de productos específicos**: Relojes de lujo, diamantes, oro/plata
- **Detección de intervención manual**: El bot se desactiva automáticamente cuando el dueño interviene
- **Reactivación automática**: El bot se reactiva automáticamente después de 24 horas
- **Limpieza automática**: Elimina usuarios inactivos después de 3 meses
- **Comandos administrativos**: Panel de control para el dueño mediante comandos invisibles
- **Persistencia de estados**: Almacenamiento de estados de usuarios mediante archivos JSON
- **Respaldo automático**: Sistema de respaldo y limpieza periódica de datos

## Tecnologías Utilizadas

- **Baileys**: Librería para conexión con WhatsApp
- **Dialogflow**: Procesamiento de lenguaje natural e intenciones
- **Node.js**: Entorno de ejecución
- **Express**: Servidor para webhooks de Dialogflow
- **Node-cron**: Programación de tareas periódicas

## Estructura del Proyecto

```
└── 📁src
    └── 📁connection
        └── authHelpers.js
        └── index.js
        └── whatsappClient.js
    └── 📁handlers
        └── incomingMessage.js
        └── index.js
        └── intentProcessor.js
        └── outgoingMessage.js
    └── 📁modules
        └── autoReactivationManager.js
        └── backup.js
        └── cleanupScheduler.js
    └── 📁services
        └── commandHandler.js
        └── 📁communications
            └── emailService.js
            └── telegramService.js
        └── dialogflow-credentials.json
        └── dialogflowHandler.js
        └── disabled_chats.json
        └── messageProvider.js
        └── messageService.js
        └── 📁qrDelivery
            └── apiDelivery.js
            └── emailDelivery.js
            └── telegramDelivery.js
        └── qrManager.js
        └── stateManager.js
        └── states.json
        └── timeManager.js
    └── 📁temp
    └── 📁utils
        └── logger.js
    └── index.js
    └── webhook.js
```

## Requisitos Previos

- Node.js 14.0.0 o superior
- Cuenta de WhatsApp para el bot
- Proyecto de Dialogflow configurado

## Configuración de Dialogflow

Antes de ejecutar el proyecto, debes configurar tu agente de Dialogflow:

1. Crea un nuevo proyecto en [Dialogflow Console](https://dialogflow.cloud.google.com/)
2. Configura intents para:
   - Welcome (Bienvenida)
   - LanguageSelection (Selección de idioma)
   - ProductSelection (Selección de productos)
   - ProcessCompleted (Proceso completado)
   - Default Fallback Intent (Respuestas por defecto)
3. Configura entidades para:
   - @language (1, 2, español, inglés, etc.)
   - @product_type (relojes, diamantes, oro, watches, diamonds, gold, etc.)
4. Configura el webhook fulfillment (apuntando a tu servidor)
5. Descarga el archivo de credenciales y guárdalo como `dialogflow-credentials.json` en la raíz del proyecto

## Instalación

1. Clona este repositorio
2. Instala las dependencias:
   ```
   npm install
   ```
3. Copia `.env.example` a `.env` y configura tus variables de entorno:
   ```
   cp .env.example .env
   ```
4. Coloca tu archivo `dialogflow-credentials.json` en la raíz del proyecto

## Ejecución

Para iniciar el bot de WhatsApp:

```
npm start
```

Para iniciar el servidor webhook de Dialogflow:

```
npm run webhook
```

Para desarrollo (con recarga automática):

```
npm run dev
npm run dev:webhook
```

## Sistemas automáticos

### Respaldos automáticos

El sistema realiza respaldos automáticos diarios de los estados de usuarios. Para crear un respaldo manual:

```
npm run backup
```

Los respaldos se guardan en el directorio `backup/` y se mantienen los últimos 30 respaldos (configurable).

### Limpieza de usuarios inactivos

El sistema elimina automáticamente los usuarios que no han interactuado con el bot en los últimos 3 meses:

- La limpieza se ejecuta el primer día de cada mes a las 3 AM
- Antes y después de cada limpieza se crean respaldos especiales (pre-cleanup y post-cleanup)
- El período de inactividad es configurable mediante comandos administrativos

Para ejecutar una limpieza manual:

```
npm run cleanup
```

### Reactivación automática

El sistema reactiva automáticamente los chats que fueron desactivados después de 24 horas:

- Verifica cada 5 minutos (configurable) si hay chats para reactivar
- Reactiva chats desactivados por comandos, por intervención del dueño o por finalización de procesos
- Permite control mediante comandos administrativos

## Comandos Administrativos

Los siguientes comandos solo están disponibles para el número de teléfono configurado como dueño:

- `/help` - Muestra ayuda sobre comandos disponibles
- `/off [horas]` - Desactiva el bot por el número de horas especificado (por defecto 24h)
- `/on` - Activa el bot nuevamente
- `/status` - Verifica el estado actual del bot
- `/reset [userId]` - Reinicia el estado de un usuario
- `/stats` - Muestra estadísticas de uso
- `/clean` - Limpia datos antiguos
- `/cleanusers [meses]` - Elimina usuarios inactivos (por defecto 3 meses)
- `/setinactive [meses]` - Configura el período de inactividad para limpieza automática
- `/reactivation` - Gestiona el sistema de reactivación automática
  - `/reactivation start` - Inicia el sistema de reactivación
  - `/reactivation stop` - Detiene el sistema de reactivación
  - `/reactivation interval [minutos]` - Cambia el intervalo de verificación
  - `/reactivation check` - Fuerza verificación de reactivación
- `/reactivate [chatId]` - Reactiva manualmente un chat específico

## Flujo del Bot

1. **Mensaje inicial**: Solicita selección de idioma (español/inglés)
2. **Selección de idioma**: El usuario elige su idioma preferido
3. **Menú principal**: Presenta opciones según horario de atención
4. **Selección de producto**: El usuario elige categoría de producto
5. **Respuesta específica**: Información sobre el producto seleccionado
6. **Cierre**: Mensaje de agradecimiento con horarios
7. **Finalización**: Cuando se detecta fin del proceso, el bot se desactiva por 24 horas

## Comportamiento con intervención del dueño

- **Intervención manual**: Cuando el dueño escribe un mensaje (no comando), el bot se desactiva automáticamente por 24 horas
- **Reactivación**: Después de 24 horas, el bot se reactiva automáticamente, o el dueño puede reactivarlo manualmente con `/on`

## Licencia

Uso interno para Andy's Don Cash. Todos los derechos reservados.

# Guía de Usuario: Reconexión del Bot de WhatsApp

## Contenido
1. [Introducción](#introducción)
2. [¿Cuándo es necesario reconectar?](#cuándo-es-necesario-reconectar)
3. [Acceso al Código QR](#acceso-al-código-qr)
4. [Proceso de Escaneo](#proceso-de-escaneo)
5. [Problemas Comunes](#problemas-comunes)
6. [Preguntas Frecuentes](#preguntas-frecuentes)

## Introducción

Este bot de WhatsApp facilita la comunicación automatizada con sus clientes. En algunas ocasiones, necesitará reconectar el bot escaneando un código QR. Este documento explica el proceso completo de reconexión de forma sencilla.

## ¿Cuándo es necesario reconectar?

El bot necesita ser reconectado en los siguientes casos:

- **Cierre de sesión manual**: Si ha cerrado sesión desde su dispositivo WhatsApp
- **Cambio de dispositivo**: Si ha cambiado su teléfono o reinstalado WhatsApp
- **Desconexión prolongada**: Después de un largo periodo sin uso
- **Problemas de conexión**: Tras problemas de red persistentes
- **Actualización forzada**: Cuando WhatsApp requiere una actualización de seguridad

## Acceso al Código QR

Cuando se requiere una reconexión, el sistema genera automáticamente un código QR. Puede acceder a él mediante:

### Método Web (Recomendado)

1. Abra su navegador web (Chrome, Firefox, Edge, etc.)
2. Visite la siguiente dirección:
   ```
   http://[su-servidor]:3300/qr
   ```
   Reemplace `[su-servidor]` con la dirección proporcionada por su administrador de sistemas.

3. Cuando se le solicite, introduzca las siguientes credenciales:
   - Usuario: `admin` (o el proporcionado por su administrador)
   - Contraseña: La contraseña proporcionada por su administrador

4. Verá una página con el código QR y un contador de tiempo que indica cuánto tiempo permanecerá válido el código.

### Notas importantes sobre el código QR:
- Cada código QR es válido por **60 segundos**
- Si expira, la página se actualizará automáticamente con un nuevo código
- El código es único y solo puede ser escaneado una vez

## Proceso de Escaneo

Para escanear el código QR y reconectar el bot:

1. Abra WhatsApp en su teléfono móvil
2. Toque el ícono de **tres puntos (⋮)** en la esquina superior derecha
3. Seleccione **Dispositivos vinculados**
4. Toque en **Vincular un dispositivo**
5. Apunte la cámara de su teléfono hacia el código QR mostrado en su pantalla
6. Mantenga la cámara estable hasta que el código sea escaneado correctamente

Una vez escaneado, verá un mensaje de confirmación en su teléfono y en la página web. El bot estará conectado y listo para funcionar inmediatamente.

## Problemas Comunes

### El código QR expira demasiado rápido
Si el código expira antes de poder escanearlo, no se preocupe. La página se actualizará automáticamente con un nuevo código. Asegúrese de tener WhatsApp abierto y listo para escanear antes de acceder a la página del QR.

### Error de autenticación en la página web
Si recibe un error al intentar acceder a la página del QR, verifique:
- Que está usando las credenciales correctas (usuario y contraseña)
- Que está accediendo a la URL correcta
- Que su conexión a internet está funcionando correctamente

### WhatsApp no reconoce el código
Si WhatsApp no reconoce el código QR:
1. Asegúrese de que la cámara de su teléfono está limpia
2. Ajuste el brillo de su pantalla
3. Intente escanear a una distancia adecuada (ni muy cerca ni muy lejos)
4. Actualice la página para obtener un nuevo código QR
5. Reinicie WhatsApp en su teléfono

### Mensaje "Este código ya ha sido escaneado"
Si recibe este mensaje, significa que alguien ya ha utilizado ese código QR. Actualice la página para obtener un nuevo código y escanéelo rápidamente.

## Preguntas Frecuentes

**¿Puedo tener el bot conectado en múltiples dispositivos?**
No, el bot solo puede estar conectado a un dispositivo a la vez. Cada vez que se escanea un nuevo QR, se cierra la sesión en el dispositivo anterior.

**¿Perderé mis conversaciones al reconectar?**
No, las conversaciones y mensajes anteriores se mantienen en la base de datos del sistema. La reconexión solo afecta al estado de la sesión, no a los datos.

**¿Es seguro escanear este código QR?**
Sí, el código QR generado es específico para su bot y está protegido por credenciales de acceso. Sin embargo, nunca comparta las credenciales ni el código QR con personas no autorizadas.

**¿Qué sucede si no reconecto el bot?**
Si el bot permanece desconectado, no podrá recibir ni enviar mensajes. Todas las funciones automatizadas estarán deshabilitadas hasta que se realice la reconexión.

**¿Con qué frecuencia necesito reconectar?**
En condiciones normales, la reconexión es un evento raro que solo ocurre en las situaciones mencionadas anteriormente. Una conexión estable puede durar meses sin requerir reconexión.

---

Para asistencia adicional, contacte a su administrador de sistemas o soporte técnico.