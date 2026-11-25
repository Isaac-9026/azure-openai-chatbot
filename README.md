# Chatbot Inteligente con Azure OpenAI

Proyecto interactivo desarrollado con **Node.js**, **Express** y **Azure OpenAI**, que incluye un asistente web especializado en la **Historia del Perú**, un chatbot por consola para **consulta y gestión de deudas** y un **asistente resumidor de documentos** con exportación a Markdown.

---

## Caracteristicas

1. **Chatbot Web - Historia del Perú (`server.js`):**
   - Interfaz web interactiva (`public/index.html`).
   - Restricción estricta de contexto: responde exclusivamente sobre hechos históricos del Perú (época preínca, Imperio Inca, Conquista, Virreinato, Independencia y República).
   - Manejo de historial conversacional a través de la API `/api/chat`.

2. **Chatbot de Consola - Consulta de Deudas (`chatbot-deudas.js`):**
   - Ejecución interactiva en terminal mediante `readline`.
   - Soporte de Function Calling (llamadas a herramientas locales) para validar DNI, consultar saldos y registrar pagos de clientes en una base de datos simulada.

3. **Asistente Resumidor de Documentos (`resumidor.js`):**
   - Lee archivos locales (`.txt` o `.md`) o textos pegados directamente en consola.
   - Genera resúmenes en estilos **Ejecutivo**, **Puntos Clave** o **Académico**.
   - Exporta automáticamente cada resumen en formato Markdown dentro de la carpeta `resumenes/` y mantiene un historial de sesión.

---

## Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada).
- Una cuenta activa en [Microsoft Azure](https://azure.microsoft.com/) con un recurso desplegado en **Azure OpenAI**.

---

## Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd chat-historia
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo [.env.example](.env.example) a un nuevo archivo llamado `.env`:
   ```bash
   cp .env.example .env
   ```
   *En Windows (PowerShell):*
   ```powershell
   Copy-Item .env.example .env
   ```

   Edita el archivo `.env` con tus credenciales reales:
   ```env
   AZURE_OPENAI_ENDPOINT="https://tu-recurso.services.ai.azure.com/openai/v1"
   AZURE_OPENAI_DEPLOYMENT="tu-despliegue-gpt"
   AZURE_OPENAI_API_KEY="tu_api_key_aqui"
   PORT=3000
   ```

---

## Ejecución

Para consultar el paso a paso de cómo se usa cada asistente y ver ejemplos prácticos, dirígete a [README_USO.md](README_USO.md).

### 1. Iniciar el Chatbot Web (Historia del Perú)
```bash
npm start
```
Luego abre tu navegador en:
```
http://localhost:3000
```

### 2. Iniciar el Chatbot por Consola (Deudas)
```bash
node chatbot-deudas.js
```

### 3. Iniciar el Asistente Resumidor de Documentos
```bash
npm run resumidor
```
*(También puedes ejecutar `node resumidor.js`).*

En la consola puedes:
- Pegar un texto directamente para resumirlo.
- Indicar la ruta de un archivo `.txt` o `.md`, por ejemplo: `Resume Textos/Texto1.md en estilo Académico`.
- Escribir `demo` para probar con un acta de reunión de ejemplo.
- Pedir el historial de resúmenes generados o escribir `salir` para terminar.

Los archivos Markdown generados se guardan en la carpeta `resumenes/`.

---

## Estructura del Proyecto

```text
├── public/
│   ├── index.html         # Interfaz web del Chatbot de Historia
│   └── styles.css         # Estilos de la interfaz web
├── Textos/
│   ├── Texto1.md          # Texto de ejemplo para el resumidor
│   └── historia.md        # Texto de ejemplo sobre historia
├── .env.example           # Plantilla de variables de entorno
├── .gitignore             # Archivos y carpetas excluidas de Git
├── chatbot-deudas.js      # Chatbot de consola con Function Calling
├── package.json           # Dependencias y scripts del proyecto
├── package-lock.json      # Bloqueo de versiones de dependencias
├── README.md              # Documentación del proyecto
├── resumidor.js           # Asistente resumidor de textos y archivos (.md)
└── server.js              # Servidor Express y endpoint de la API
```

