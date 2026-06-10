import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { google } from "googleapis";
import { Octokit } from "@octokit/rest";

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
const requiredEnv = ["N8N_API_URL", "N8N_API_KEY", "GITHUB_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS"];
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
    version: "1.0.0",
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
    name: "n8n_list_workflows",
    description: "List all workflows from local n8n instance",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "google_sheets_read_headers",
    description: "Read the header row (first row) of a Google Sheets spreadsheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: {
          type: "string",
          description: "The spreadsheet ID (can be extracted from the sheet URL)",
        },
        range: {
          type: "string",
          description: "Range to read, e.g., 'Sheet1!A1:Z1'",
          default: "A1:Z1",
        },
      },
      required: ["spreadsheetId"],
    },
  },
  {
    name: "github_get_repo",
    description: "Get information about a GitHub repository to verify token permissions",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "The owner of the GitHub repository",
        },
        repo: {
          type: "string",
          description: "The name of the GitHub repository",
        },
      },
      required: ["owner", "repo"],
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
      case "n8n_list_workflows": {
        const response = await axios.get(`${process.env.N8N_API_URL}/workflows`, {
          headers: {
            "X-N8N-API-KEY": process.env.N8N_API_KEY,
          },
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "google_sheets_read_headers": {
        const auth = new google.auth.GoogleAuth({
          keyFile: googleCredsPath,
          scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = args.spreadsheetId;
        const range = args.range || "A1:Z1";

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data.values || [], null, 2),
            },
          ],
        };
      }

      case "github_get_repo": {
        const octokit = new Octokit({
          auth: process.env.GITHUB_TOKEN,
        });
        const { owner, repo } = args;
        const response = await octokit.rest.repos.get({
          owner,
          repo,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: response.data.id,
                  name: response.data.name,
                  full_name: response.data.full_name,
                  private: response.data.private,
                  description: response.data.description,
                  html_url: response.data.html_url,
                },
                null,
                2
              ),
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
          text: `Error executing tool ${name}: ${error.response?.data?.message || error.message}`,
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
