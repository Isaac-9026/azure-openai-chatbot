/*
Asistente resumidor de documentos y textos por consola.
Permite leer archivos locales o recibir texto libre, generar resúmenes en distintos
niveles de detalle y exportarlos automáticamente a archivos Markdown (.md).
*/
import "dotenv/config";
import OpenAI from "openai";
import readLine from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";

// Accesos cargados desde .env
const CONFIG = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT,
};

if (!CONFIG.endpoint || !CONFIG.apiKey || !CONFIG.deploymentName) {
  console.error("Error: Faltan variables de entorno en el archivo .env");
  process.exit(1);
}

const openai = new OpenAI({
  baseURL: CONFIG.endpoint,
  apiKey: CONFIG.apiKey,
});

const DIRECTORIO_BASE = process.cwd();
const CARPETA_RESUMENES = path.join(DIRECTORIO_BASE, "resumenes");
const EXTENSIONES_PERMITIDAS = new Set([".txt", ".md"]);

// Historial en memoria de resúmenes generados en la sesión
const historialResumenes = [];

function resolverRutaSegura(ruta) {
  const rutaResuelta = path.resolve(DIRECTORIO_BASE, ruta);
  const relativa = path.relative(DIRECTORIO_BASE, rutaResuelta);

  if (!relativa || relativa.startsWith("..") || path.isAbsolute(relativa)) {
    return {
      valida: false,
      mensaje: "Acceso denegado: la ruta debe estar dentro del proyecto.",
    };
  }

  const nombreBase = path.basename(rutaResuelta).toLowerCase();
  if (nombreBase.startsWith(".env")) {
    return {
      valida: false,
      mensaje: "Acceso denegado: no se permite leer archivos .env.",
    };
  }

  const extension = path.extname(rutaResuelta).toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.has(extension)) {
    return {
      valida: false,
      mensaje: "Formato no permitido: solo se pueden leer archivos .txt o .md.",
    };
  }

  return { valida: true, rutaResuelta };
}

function obtenerSiguienteId() {
  let maxId = 0;
  if (fs.existsSync(CARPETA_RESUMENES)) {
    for (const archivo of fs.readdirSync(CARPETA_RESUMENES)) {
      const coincidencia = /^resumen_res-(\d+)\.md$/i.exec(archivo);
      if (coincidencia) {
        const num = Number.parseInt(coincidencia[1], 10);
        if (num > maxId) maxId = num;
      }
    }
  }
  return `RES-${String(maxId + 1).padStart(3, "0")}`;
}

// FUNCIONES LOCALES QUE UTILIZARÁ LA IA

function leerDocumento({ ruta }) {
  try {
    const validacion = resolverRutaSegura(ruta);
    if (!validacion.valida) {
      return { exito: false, mensaje: validacion.mensaje };
    }

    const { rutaResuelta } = validacion;
    if (!fs.existsSync(rutaResuelta) || !fs.statSync(rutaResuelta).isFile()) {
      return { exito: false, mensaje: `No se encontró el archivo: ${ruta}` };
    }

    const contenido = fs.readFileSync(rutaResuelta, "utf-8");
    const textoLimpio = contenido.trim();
    const palabras = textoLimpio ? textoLimpio.split(/\s+/).length : 0;

    return {
      exito: true,
      ruta,
      cantidadPalabras: palabras,
      contenido,
    };
  } catch (e) {
    return { exito: false, mensaje: `Error al leer el archivo: ${e.message}` };
  }
}

function guardarResumen({ titulo, estilo, palabrasOriginales, resumen, puntosClave }) {
  try {
    fs.mkdirSync(CARPETA_RESUMENES, { recursive: true });

    const id = obtenerSiguienteId();
    const nombreArchivo = `resumen_${id.toLowerCase()}.md`;
    const rutaDestino = path.join(CARPETA_RESUMENES, nombreArchivo);
    const rutaRelativa = path.join("resumenes", nombreArchivo).replaceAll("\\", "/");

    const contenidoMd = [
      `# ${titulo}`,
      `- **ID:** ${id}`,
      `- **Estilo:** ${estilo}`,
      `- **Palabras originales aprox.:** ${palabrasOriginales}`,
      "",
      "## Resumen",
      resumen,
      "",
      "## Puntos Clave",
      ...puntosClave.map((p) => `- ${p}`),
      "",
    ].join("\n");

    fs.writeFileSync(rutaDestino, contenidoMd, "utf-8");

    const registro = {
      id,
      titulo,
      estilo,
      archivo: rutaRelativa,
      puntos: puntosClave.length,
    };
    historialResumenes.push(registro);

    return {
      exito: true,
      mensaje: `Resumen ${id} exportado correctamente en ${rutaRelativa}.`,
      registro,
    };
  } catch (e) {
    return { exito: false, mensaje: `Error al guardar el resumen: ${e.message}` };
  }
}

function listarResumenes() {
  if (historialResumenes.length === 0) {
    return {
      exito: true,
      total: 0,
      mensaje: "Aún no se ha generado ningún resumen en esta sesión.",
    };
  }

  console.log("\n--- HISTORIAL DE RESÚMENES GENERADOS ---");
  console.table(historialResumenes);

  return {
    exito: true,
    total: historialResumenes.length,
    resumenes: historialResumenes,
  };
}

// Colección de funciones ejecutables
const funciones = { leerDocumento, guardarResumen, listarResumenes };

// Definición de herramientas para el modelo
const tools = [
  {
    type: "function",
    name: "leerDocumento",
    description:
      "Lee el contenido de un archivo de texto (.txt o .md) local para resumirlo.",
    parameters: {
      type: "object",
      properties: {
        ruta: {
          type: "string",
          description: "Ruta del archivo local (ej. 'acta.txt' o 'apuntes.md').",
        },
      },
      required: ["ruta"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "guardarResumen",
    description:
      "Guarda el resumen generado en un archivo Markdown (.md) y lo registra en el historial.",
    parameters: {
      type: "object",
      properties: {
        titulo: {
          type: "string",
          description: "Título descriptivo y breve del texto resumido.",
        },
        estilo: {
          type: "string",
          enum: ["Ejecutivo", "Puntos Clave", "Académico"],
          description: "Formato o nivel de detalle aplicado al resumen.",
        },
        palabrasOriginales: {
          type: "integer",
          description: "Cantidad aproximada de palabras del texto original.",
        },
        resumen: {
          type: "string",
          description: "Texto del resumen redactado de forma clara y fiel al original.",
        },
        puntosClave: {
          type: "array",
          items: { type: "string" },
          description: "Lista de 3 a 5 ideas principales o acuerdos extraídos.",
        },
      },
      required: [
        "titulo",
        "estilo",
        "palabrasOriginales",
        "resumen",
        "puntosClave",
      ],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "listarResumenes",
    description:
      "Muestra en consola una tabla con todos los resúmenes generados durante la sesión.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    strict: true,
  },
];

// Instrucciones del asistente
const INSTRUCCIONES = `
Eres un asistente de Procesamiento de Lenguaje Natural (NLP) especializado en generar resúmenes claros, precisos y sin inventar información.
Responde siempre en español.

REGLAS DE OPERACIÓN:
1. Si el usuario pega un texto largo o un artículo para resumir, genera el resumen (usando el estilo que pida o 'Ejecutivo' por defecto) y llama a 'guardarResumen' para exportarlo en .md.
2. Si el usuario indica una ruta de archivo (ej. "resume notas.txt"), llama primero a 'leerDocumento' y luego a 'guardarResumen'.
3. Si el usuario pide ver el historial o lista de resúmenes creados, llama a 'listarResumenes'.
4. Si el usuario hace preguntas de seguimiento sobre un texto ya resumido, respóndele directamente usando el contexto de la conversación sin volver a guardar otro archivo, salvo que pida un nuevo formato.
5. Después de guardar un resumen, muéstralo limpio en consola junto con el nombre del archivo .md generado.
`.trim();

// Ciclo de conversación bidireccional
let ultimaRespuestaId = null;

async function preguntar(textoUsuario) {
  let inputActual = [{ role: "user", content: textoUsuario }];

  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const response = await openai.responses.create({
      model: CONFIG.deploymentName,
      instructions: INSTRUCCIONES,
      input: inputActual,
      tools,
      previous_response_id: ultimaRespuestaId ?? undefined,
      max_output_tokens: 1500,
      reasoning: { effort: "low" },
    });

    ultimaRespuestaId = response.id;

    const outputItems = response.output ?? [];
    const llamadas = outputItems.filter(
      (item) => item.type === "function_call"
    );

    if (llamadas.length === 0) {
      return response.output_text;
    }

    inputActual = llamadas.map((llamada) => {
      let resultado;
      try {
        const args = llamada.arguments ? JSON.parse(llamada.arguments) : {};
        console.log(`[Función] ${llamada.name}(${JSON.stringify(args)})`);

        const fn = funciones[llamada.name];
        if (typeof fn !== "function") {
          throw new Error(`Función no registrada: ${llamada.name}`);
        }
        resultado = fn(args);
      } catch (e) {
        resultado = { error: e.message };
      }

      return {
        type: "function_call_output",
        call_id: llamada.call_id,
        output: JSON.stringify(resultado),
      };
    });
  }

  return "No pude completar la solicitud, intenta reformularla.";
}

// Texto largo de prueba para demostración rápida
const TEXTO_DEMO = `
Acta de reunión de seguimiento - Proyecto de Migración a la Nube (18 de noviembre).
Asistentes: Ana Gómez (Líder Técnico), Luis Castro (Backend), Carla Ruiz (QA) y Pedro Díaz (Operaciones).
Durante la sesión se revisó el avance de la migración de la base de datos principal hacia PostgreSQL administrado. Luis confirmó que los scripts de migración ya pasaron las pruebas en entorno de desarrollo, reduciendo el tiempo de consulta en un 35%, pero advirtió que aún falta validar el respaldo automático nocturno. Carla indicó que las pruebas de carga detectaron un cuello de botella en el módulo de reportes cuando hay más de 200 usuarios concurrentes, por lo que propuso implementar caché con Redis antes del pase a producción. Ana aprobó la propuesta de Redis y fijó el 25 de noviembre como fecha límite para completar las pruebas integrales. Pedro se comprometió a preparar la ventana de mantenimiento para el sábado 29 de noviembre a las 11:00 PM y enviar el comunicado oficial a los clientes con 48 horas de anticipación.
`.trim();

// Interfaz por consola (terminal)
const rl = readLine.createInterface({ input, output });
console.log("==============================================================");
console.log(" Asistente Resumidor de Documentos y Textos (NLP -> Markdown)");
console.log(" Comandos: pega un texto, indica un .txt, 'demo' o 'salir'");
console.log("==============================================================\n");

while (true) {
  const texto = await rl.question("Tú: ");
  const comando = texto.trim().toLowerCase();

  if (comando === "salir") break;
  if (!comando) continue;

  try {
    if (comando === "demo") {
      console.log("\nProcesando texto de demostración (Acta de reunión)...\n");
      const resp = await preguntar(
        `Resume este texto en estilo Ejecutivo:\n\n${TEXTO_DEMO}`
      );
      console.log(`IA: ${resp}\n`);
      continue;
    }

    const respuesta = await preguntar(texto);
    console.log(`\nIA: ${respuesta}\n`);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

rl.close();
console.log("Sesión finalizada.");