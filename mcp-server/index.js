import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

// Setup path helpers for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the parent (root) folder
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Logger helper (Stdio server must print logs to stderr to avoid breaking protocol)
const logger = {
  info: (msg) => console.error(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
};

// Validate environment variables
const requiredEnv = ["GOOGLE_APPLICATION_CREDENTIALS"];
const missingEnv = requiredEnv.filter((env) => !process.env[env]);
if (missingEnv.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
} else {
  logger.info("All environment variables loaded successfully.");
}

// Resolve credentials path for Google
let googleCredsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (googleCredsPath && !path.isAbsolute(googleCredsPath)) {
  googleCredsPath = path.resolve(__dirname, "..", googleCredsPath);
}

// Create MCP Server
const server = new Server(
  {
    name: "local-mcp-server",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools schemas
const TOOLS = [
  {
    name: "read_sheet_schema",
    description: "Lee la estructura de una planilla Google Sheets (encabezados) e infiere tipos basados en las primeras 50 filas de datos.",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: {
          type: "string",
          description: "El ID de la planilla (extraído de la URL).",
        },
        sheetName: {
          type: "string",
          description: "Nombre de la hoja específica a leer (ej: 'Datos'). Si se omite, lee la primera hoja por defecto.",
        },
      },
      required: ["spreadsheetId"],
    },
  },
  {
    name: "download_apps_script",
    description: "Descarga el código fuente (.gs y .html) de un proyecto de Google Apps Script asociado a una planilla.",
    inputSchema: {
      type: "object",
      properties: {
        scriptId: {
          type: "string",
          description: "El ID del proyecto de Apps Script. (Obtenido desde la URL del editor de scripts).",
        },
      },
      required: ["scriptId"],
    },
  },
];

// Register list tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info("Listing tools requested by client");
  return { tools: TOOLS };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info(`Tool called: ${name}`);

  try {
    switch (name) {
      case "read_sheet_schema": {
        const auth = new google.auth.GoogleAuth({
          keyFile: googleCredsPath,
          scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = args.spreadsheetId;
        
        // Lee la fila 1 a la 51 para tener encabezado + 50 filas de muestra
        const range = args.sheetName ? `${args.sheetName}!A1:ZZ51` : "A1:ZZ51";

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
          return {
            content: [{ type: "text", text: "Sheet is empty." }],
          };
        }

        const headers = rows[0];
        const schema = headers.map((header, index) => {
          let type = "string"; // default
          let hasValue = false;
          
          for (let i = 1; i < rows.length; i++) {
            const val = rows[i][index];
            if (val !== undefined && val !== null && val !== "") {
              hasValue = true;
              const numericVal = Number(val.toString().replace(/,/g, ''));
              
              if (!isNaN(numericVal) && val.trim() !== "") {
                type = "number";
              } else if (val.toLowerCase() === "true" || val.toLowerCase() === "false" || val.toLowerCase() === "verdadero" || val.toLowerCase() === "falso") {
                type = "boolean";
              } else {
                type = "string"; // if any string is found, we assume the column is string
                break;
              }
            }
          }
          
          if (!hasValue) type = "unknown";
          
          return { column: header, inferredType: type };
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ schema, sampleRowsCount: rows.length - 1 }, null, 2),
            },
          ],
        };
      }

      case "download_apps_script": {
        const auth = new google.auth.GoogleAuth({
          keyFile: googleCredsPath,
          scopes: ["https://www.googleapis.com/auth/script.projects.readonly"],
        });
        const script = google.script({ version: "v1", auth });
        
        const response = await script.projects.getContent({
          scriptId: args.scriptId,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data.files || [], null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error) {
    logger.error(`Error executing tool ${name}: ${error.message}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing tool ${name}: ${error.response?.data?.error?.message || error.message}`,
        },
      ],
    };
  }
});

// Run server using Stdio transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Local MCP Server connected via stdio");
}

run().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
