BLOQUE 2: BITÁCORA DEL PRODUCTO DIGITAL
(Para guardar en: docs/02_bitacora_producto/registro_paso_a_paso.md)

Configuración de Accesos: El Escudo Invisible de tu Proyecto
1. El "Por Qué" de este paso (El error que te puede costar el proyecto)
Uno de los errores de novato más destructivos en la programación es el hardcoding: escribir tus contraseñas o tokens directamente dentro del código de tu aplicación. Si por accidente llegaras a subir ese archivo a un repositorio público de GitHub, o si un malware infectara tu PC, los atacantes tendrían acceso total a tus cuentas y datos.

Para solucionar esto con estándar corporativo, utilizamos la combinación perfecta: Google Sheets + Archivo .env. Sheets actúa como tu bóveda maestra en la nube, y el .env inyecta esas llaves únicamente en tu computadora local. Tu código nunca conoce las contraseñas, solo sabe cómo usarlas. Esto no solo blinda tu seguridad, sino que acelera tu desarrollo porque podés cambiar de entorno (de pruebas a producción) simplemente cambiando un archivo de texto.

2. La Guía Visual Mental: ¿Cómo lee la IA sin exponer tus datos?
Imaginá que tu proyecto es un club exclusivo y Google Sheets es el archivo con la lista VIP de invitados.
En lugar de darle la lista original y completa al portero (la IA de Antigravity), lo que hacemos es crear una "Service Account" (Cuenta de Servicio). Esta cuenta es como un robot asistente ciego que solo tiene la llave para entrar a una habitación específica.

Cuando la IA necesita un dato, se lo pide al robot. El robot va a Google Sheets, lee la línea exacta, y se la trae de vuelta al entorno local. En ningún momento la IA ni el código acceden a la planilla completa ni exponen tus datos de acceso a internet. La información fluye por un tubo encriptado directamente hacia el cerebro de tu proyecto.

3. Tip de Oro (Valor Premium)
Creá la cerradura antes de traer el tesoro.
Antes de escribir tu primer token en el archivo .env o de descargar tu archivo .json de Google, lo primero que debes crear es tu archivo .gitignore y escribir los nombres de esos archivos adentro. De esta manera, activás el escudo protector de Git desde el segundo cero. Si te olvidas de hacerlo y haces un guardado (commit), tus claves viajarán a la nube y tendrás que revocarlas y empezar de nuevo. La seguridad proactiva es la marca de un profesional.
