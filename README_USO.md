# Guía de Uso — Asistentes con Azure OpenAI

Esta guía detalla paso a paso cómo configurar, ejecutar y utilizar cada uno de los asistentes incluidos en el repositorio.

---

## 1. Preparación inicial

1. **Requisitos:** Node.js 18 o superior y un recurso activo en Azure OpenAI.
2. **Instalar dependencias:**
   ```bash
   npm install
   ```
3. **Configurar variables de entorno:**
   Copia `.env.example` a `.env` y completa tus credenciales:
   - En Linux/macOS/Git Bash:
     ```bash
     cp .env.example .env
     ```
   - En Windows (PowerShell):
     ```powershell
     Copy-Item .env.example .env
     ```

   Variables requeridas en `.env`:
   ```env
   AZURE_OPENAI_ENDPOINT="https://tu-recurso.services.ai.azure.com/openai/v1"
   AZURE_OPENAI_DEPLOYMENT="tu-modelo-o-despliegue"
   AZURE_OPENAI_API_KEY="tu_azure_openai_api_key_aqui"
   PORT=3000
   ```
   > **Nota:** `PORT` solo se utiliza en el servidor web (`server.js`). Si no se define, usa `3000` por defecto.

---

## 2. Chatbot Web — Historia del Perú (`server.js`)

Asistente web con respuestas en *streaming* restringido exclusivamente a temas de Historia del Perú (época preínca, Imperio Inca, Conquista, Virreinato, Independencia y época Republicana).

### Cómo iniciarlo
```bash
npm start
```
Luego abre en tu navegador:
```text
http://localhost:3000
```

### Cómo usarlo
- Escribe consultas relacionadas con la Historia del Perú en la interfaz web (`public/index.html`).
- Si realizas preguntas fuera de ese tema (matemáticas, programación, deportes, etc.), el asistente rechazará la consulta según sus reglas de contexto.
- Internamente, la interfaz envía el historial conversacional al endpoint `POST /api/chat` con `{ "history": [...] }`.
- Para detener el servidor, presiona `Ctrl + C` en la terminal.

---

## 3. Chatbot de Consola — Consulta y Pago de Deudas (`chatbot-deudas.js`)

Asistente interactivo en terminal con *Function Calling* que valida identidad por DNI, consulta saldos y registra pagos parciales o totales sobre una lista simulada de clientes en memoria.

### Cómo iniciarlo
```bash
node chatbot-deudas.js
```

### Datos de prueba disponibles
| DNI | Cliente | Deuda inicial |
| :--- | :--- | :--- |
| `12345678` | Carlos Mendoza | S/ 450.50 |
| `87654321` | María Torres | S/ 1200.00 |
| `11223344` | Luis Paredes | S/ 0.00 |

### Flujo de uso recomendado
1. Inicia escribiendo un DNI de prueba (por ejemplo: `Mi DNI es 12345678`).
2. Una vez identificado, elige si deseas **consultar tu deuda** o **pagar** un monto específico (ejemplo: `Quiero pagar 200 soles`).
3. Confirma el monto cuando el asistente lo solicite para que registre el pago.
4. Escribe `salir` en cualquier momento para cerrar la sesión.

> **Nota:** Los saldos actualizados se mantienen únicamente en memoria durante la sesión actual; al reiniciar el script vuelven a sus valores iniciales.

---

## 4. Asistente Resumidor de Documentos (`resumidor.js`)

Asistente por consola que resume textos pegados directamente o archivos locales (`.txt` / `.md`) y exporta cada resultado en formato Markdown dentro de la carpeta `resumenes/`.

### Cómo iniciarlo
```bash
npm run resumidor
```
*(También puedes ejecutar `node resumidor.js`).*

### Formas de uso en consola (`Tú: `)

- **Modo demostración rápida (`demo`):**
  ```text
  Tú: demo
  ```
  Resume un acta de reunión predefinida en estilo `Ejecutivo` y genera un archivo `.md` en `resumenes/`.

- **Resumir un archivo local por su ruta:**
  ```text
  Tú: Resume Textos/Texto1.md
  ```
  O especificando un estilo:
  ```text
  Tú: Resume Textos/historia.md en estilo Académico
  ```

- **Resumir texto libre pegado en consola:**
  ```text
  Tú: Resume este texto en puntos clave: <pega aquí tu texto>
  ```

- **Estilos disponibles:**
  - `Ejecutivo` *(por defecto si no indicas uno)*
  - `Puntos Clave`
  - `Académico`

- **Preguntas de seguimiento:**
  Puedes hacer preguntas sobre el texto recién resumido sin generar un archivo nuevo, a menos que solicites explícitamente otro formato.

- **Ver historial de la sesión:**
  ```text
  Tú: Muéstrame la lista de resúmenes generados
  ```
  Imprime en consola una tabla con los resúmenes creados durante la sesión.

- **Salir:**
  ```text
  Tú: salir
  ```

### Salida y restricciones de seguridad
- **Archivos generados:** se guardan automáticamente en `resumenes/resumen_res-001.md`, `resumen_res-002.md`, etc. El numerador detecta los archivos existentes en `resumenes/` para no sobrescribir resúmenes previos.
- **Rutas permitidas:** por seguridad, `leerDocumento` solo acepta archivos `.txt` o `.md` ubicados dentro del directorio del proyecto (desde donde ejecutes el comando) y bloquea la lectura de archivos `.env` o rutas externas.

---

## 5. Solución de problemas frecuentes

- **`Error: Faltan variables de entorno en el archivo .env`:** verifica que el archivo `.env` exista en la raíz del proyecto y tenga valores en `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` y `AZURE_OPENAI_DEPLOYMENT`.
- **`No se encontró el archivo` al usar `resumidor.js`:** asegúrate de ejecutar `npm run resumidor` desde la raíz del proyecto (`chat-historia`) y de usar barras `/` en la ruta (ej. `Textos/Texto1.md`).
- **`Formato no permitido` en `resumidor.js`:** el lector solo procesa texto plano con extensión `.txt` o `.md`.
