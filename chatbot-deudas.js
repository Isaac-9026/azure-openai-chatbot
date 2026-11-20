/*
Chatbot inteligente de consulta y pago de deudas por consola.
El modelo utiliza funciones locales para validar DNI, consultar y pagar deudas.
*/
import "dotenv/config";
import OpenAI from "openai";
import readLine from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

//Accesos cargados desde .env
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

//Base de datos simulada de clientes
const clientes = [
  { dni: "12345678", nombre: "Carlos Mendoza", deuda: 450.5 },
  { dni: "87654321", nombre: "María Torres", deuda: 1200.0 },
  { dni: "11223344", nombre: "Luis Paredes", deuda: 0.0 },
];

// Estado de sesión local para recordar el DNI verificado
let clienteActual = null;

//FUNCIONES LOCALES QUE UTILIZARÁ LA IA

function identificarCliente({ dni }) {
  const dniLimpio = String(dni).trim();
  const cliente = clientes.find((c) => c.dni === dniLimpio);

  if (!cliente) {
    return {
      exito: false,
      mensaje: `No se encontró ningún cliente registrado con el DNI ${dniLimpio}.`,
    };
  }

  clienteActual = cliente;
  return {
    exito: true,
    dni: cliente.dni,
    nombre: cliente.nombre,
    mensaje: "Cliente identificado correctamente.",
  };
}

function consultarDeuda({ dni }) {
  const dniBuscar = dni ? String(dni).trim() : clienteActual?.dni;
  const cliente = clientes.find((c) => c.dni === dniBuscar);

  if (!cliente) {
    return {
      exito: false,
      mensaje: "El cliente no existe o no ha sido identificado con su DNI.",
    };
  }

  return {
    exito: true,
    dni: cliente.dni,
    nombre: cliente.nombre,
    deudaActual: cliente.deuda,
    moneda: "PEN",
  };
}

function pagarDeuda({ dni, monto }) {
  const dniBuscar = dni ? String(dni).trim() : clienteActual?.dni;
  const cliente = clientes.find((c) => c.dni === dniBuscar);

  //Validación 1: El cliente debe existir
  if (!cliente) {
    return {
      exito: false,
      mensaje: "No existe un cliente registrado con ese DNI.",
    };
  }

  //Validación 2: La deuda debe ser mayor a 0
  if (cliente.deuda <= 0) {
    return {
      exito: false,
      mensaje: `El cliente ${cliente.nombre} no tiene deudas pendientes (deuda actual: S/ 0.00).`,
    };
  }

  //Validación 3: El monto debe ser mayor a 0 y no exceder la deuda total
  if (typeof monto !== "number" || monto <= 0) {
    return {
      exito: false,
      mensaje: "El monto a pagar debe ser mayor a 0.",
    };
  }

  if (monto > cliente.deuda) {
    return {
      exito: false,
      mensaje: `El monto ingresado (S/ ${monto.toFixed(2)}) excede la deuda actual de S/ ${cliente.deuda.toFixed(2)}.`,
    };
  }

  //Aplicar el pago 
  cliente.deuda = Math.round((cliente.deuda - monto) * 100) / 100;

  return {
    exito: true,
    nombre: cliente.nombre,
    montoPagado: monto,
    deudaRestante: cliente.deuda,
    mensaje:
      cliente.deuda === 0
        ? "Pago registrado. ¡Tu deuda ha sido saldada por completo!"
        : `Pago registrado. Tu nueva deuda pendiente es de S/ ${cliente.deuda.toFixed(2)}.`,
  };
}

// Colección de funciones ejecutables
const funciones = { identificarCliente, consultarDeuda, pagarDeuda };

//Definición de herramientas para el modelo
const tools = [
  {
    type: "function",
    name: "identificarCliente",
    description:
      "Verifica si existe un cliente en el sistema usando su número de DNI.",
    parameters: {
      type: "object",
      properties: {
        dni: {
          type: "string",
          description: "Número de DNI del cliente (8 dígitos).",
        },
      },
      required: ["dni"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "consultarDeuda",
    description:
      "Consulta el estado y monto de la deuda actual de un cliente ya identificado por su DNI.",
    parameters: {
      type: "object",
      properties: {
        dni: {
          type: "string",
          description: "Número de DNI del cliente identificado.",
        },
      },
      required: ["dni"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "pagarDeuda",
    description:
      "Registra el pago parcial o total de la deuda de un cliente. Úsala solo cuando el cliente haya confirmado el monto a pagar.",
    parameters: {
      type: "object",
      properties: {
        dni: {
          type: "string",
          description: "Número de DNI del cliente identificado.",
        },
        monto: {
          type: "number",
          description: "Monto en soles (S/) que el cliente desea pagar.",
        },
      },
      required: ["dni", "monto"],
      additionalProperties: false,
    },
    strict: true,
  },
];

// Instrucciones del asistente
const INSTRUCCIONES = `
Eres un asistente virtual de atención al cliente para consultas y pagos de deudas.
Responde siempre en español, de forma amable, clara y breve.

FLUJO OBLIGATORIO:
1. Antes de realizar cualquier consulta o pago, el usuario DEBE identificarse con su DNI usando la función 'identificarCliente'. Si aún no ha dado su DNI, pídeselo amablemente.
2. Una vez identificado con éxito, salúdalo por su nombre y ofrécele exactamente estas dos alternativas:
   1.- Conocer el estado de la deuda actual.
   2.- Pagar la deuda.
3. Usa SIEMPRE las funciones disponibles ('consultarDeuda' y 'pagarDeuda'); nunca inventes montos ni saldos.
4. Para pagar la deuda, pide el monto si el usuario no lo indicó y confirma antes de ejecutar 'pagarDeuda'.
5. Muestra los montos en soles (S/). Si el usuario pregunta por temas ajenos a consultas o pagos de deudas, indícale brevemente que solo puedes ayudarle con esas dos opciones.
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

    const llamadas = response.output.filter(
      (item) => item.type === "function_call"
    );

    if (llamadas.length === 0) {
      return response.output_text;
    }

    inputActual = llamadas.map((llamada) => {
      const args = JSON.parse(llamada.arguments);
      console.log(`[Función] ${llamada.name}(${JSON.stringify(args)})`);

      let resultado;
      try {
        resultado = funciones[llamada.name](args);
      } catch (e) {
        resultado = { error: e.message };
      }
      console.log(`[Resultado] ${JSON.stringify(resultado)}`);

      return {
        type: "function_call_output",
        call_id: llamada.call_id,
        output: JSON.stringify(resultado),
      };
    });
  }

  return "No pude completar la solicitud, intenta reformularla.";
}

// Interfaz por consola (terminal)
const rl = readLine.createInterface({ input, output });
console.log("==================================================");
console.log(" Asistente de Consulta y Pago de Deudas");
console.log(" Escribe 'salir' para terminar.");
console.log(" DNIs de prueba: 12345678 (S/ 450.50), 87654321 (S/ 1200), 11223344 (S/ 0)");
console.log("==================================================\n");
console.log("IA: ¡Hola! Por favor, indícame tu número de DNI para comenzar.\n");

while (true) {
  const texto = await rl.question("Tú: ");

  if (texto.trim().toLowerCase() === "salir") break;
  if (!texto.trim()) continue;

  try {
    const respuesta = await preguntar(texto);
    console.log(`\nIA: ${respuesta}\n`);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

rl.close();
console.log("Sesión finalizada.");