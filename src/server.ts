import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

// Configuration from environment variables
const PHP_API_URL = process.env.PHP_API_URL;
const API_KEY = process.env.INFORMIX_API_KEY;

if (!API_KEY) {
    console.error("❌ Error: INFORMIX_API_KEY environment variable is required");
    process.exit(1);
}

if (!PHP_API_URL) {
  console.error("❌ Error: PHP_API_URL environment variable is required");
  process.exit(1);
}

// Create an MCP server
const server = new McpServer({
  name: "informix-mcp-server",
  version: "1.0.0"
});

// Register a simple test tool to verify the server is working
server.registerTool(
  "test-connection",
  {
    title: "Test Connection",
    description: "Test the MCP server connection and response",
    inputSchema: {
      message: z.string().optional().describe("Optional test message")
    }
  },
  async ({ message = "Hello from Informix MCP Server!" }) => {
    return {
      content: [{
        type: "text",
        text: `✅ MCP Server is running successfully!\n\nMessage: ${message}\n\nTimestamp: ${new Date().toISOString()}\n\nThis confirms that the Model Context Protocol server is properly connected and responding to requests.`
      }]
    };
  }
);

// Register a tool for Informix database queries via PHP API bridge
server.registerTool(
  "query-informix",
  {
    title: "Query Informix Database",
    description: "Execute predefined queries against the Informix database via PHP API bridge. Supports database discovery, schema introspection, and data sampling across multiple databases (eadmin, payrolldb, ppc, auditdb).",
    inputSchema: {
      queryName: z.enum([
        "test-connection",
        "get-database-count",
        "list-databases", 
        "list-tables",
        "get-table-schema",
        "get-top-records",
        "get-object-type",
        "get-view-schema"
      ]).describe("Name of the predefined query to execute"),
      params: z.record(z.any()).optional().describe("Parameters for the query (e.g., {tableName: 'users', database: 'eadmin', limit: 10})")
    }
  },
  async ({ queryName, params = {} }) => {
    try {
      console.error(`🔍 Executing query: ${queryName} with params:`, params);
      
      // Make HTTP request to PHP API bridge
      const response = await axios.post(PHP_API_URL, {
        queryName,
        params
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY
        },
        timeout: 30000 // 30 second timeout
      });

      if (response.data.status === 'success') {
        const data = response.data.data;
        return {
          content: [{
            type: "text",
            text: `✅ Query executed successfully!\n\n` +
                  `Query: ${data.queryName}\n` +
                  `Parameters: ${JSON.stringify(data.params, null, 2)}\n` +
                  `Results: ${JSON.stringify(data.results, null, 2)}\n` +
                  `Execution Time: ${data.execution_time}s\n` +
                  `Connection ID: ${data.connection_id}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ Query failed: ${response.data.message || 'Unknown error'}`
          }],
          isError: true
        };
      }
    } catch (error: any) {
      console.error('❌ Error calling PHP API:', error.message);
      
      let errorMessage = 'Failed to execute query';
      
      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          errorMessage = 'Authentication failed - invalid API key';
        } else if (status === 403) {
          errorMessage = 'Access forbidden - check API key permissions';
        } else if (status === 400) {
          errorMessage = `Bad request: ${data?.message || 'Invalid query or parameters'}`;
        } else if (status === 500) {
          errorMessage = `Server error: ${data?.message || 'Internal server error'}`;
        } else {
          errorMessage = `HTTP ${status}: ${data?.message || 'Unknown error'}`;
        }
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - PHP API server is not running or not accessible';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Request timed out - PHP API server took too long to respond';
      } else {
        errorMessage = `Network error: ${error.message}`;
      }
      
      return {
        content: [{
          type: "text",
          text: `❌ ${errorMessage}\n\n` +
                `Query: ${queryName}\n` +
                `Parameters: ${JSON.stringify(params, null, 2)}\n` +
                `PHP API URL: ${PHP_API_URL}`
        }],
        isError: true
      };
    }
  }
);

// Register individual tools for better discoverability
server.registerTool(
  "list-databases",
  {
    title: "List All Databases",
    description: "Get a list of all user databases in the Informix instance, excluding system databases. Useful for discovering available databases before querying specific ones.",
    inputSchema: {
      params: z.record(z.any()).optional().describe("No parameters required for this query")
    }
  },
  async ({ params = {} }) => {
    try {
      console.error(`🔍 Listing databases...`);
      
      const response = await axios.post(PHP_API_URL, {
        queryName: "list-databases",
        params
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY
        },
        timeout: 30000
      });

      if (response.data.status === 'success') {
        const data = response.data.data;
        return {
          content: [{
            type: "text",
            text: `✅ Found ${data.results[0].database_count} user databases:\n\n` +
                  data.results[0].databases.map((db: any) => `• ${db.name}`).join('\n') +
                  `\n\nUse these database names with other queries by setting the 'database' parameter.`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ Failed to list databases: ${response.data.message || 'Unknown error'}`
          }],
          isError: true
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `❌ Error listing databases: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "list-tables",
  {
    title: "List Tables in Database",
    description: "Get a list of all tables in a specific database. Useful for discovering available tables before querying their schema or data.",
    inputSchema: {
      database: z.string().optional().describe("Database name (defaults to 'eadmin'). Available: eadmin, payrolldb, ppc, auditdb")
    }
  },
  async ({ database = 'eadmin' }) => {
    try {
      console.error(`🔍 Listing tables in database: ${database}`);
      
      const response = await axios.post(PHP_API_URL, {
        queryName: "list-tables",
        params: { database }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY
        },
        timeout: 30000
      });

      if (response.data.status === 'success') {
        const data = response.data.data;
        return {
          content: [{
            type: "text",
            text: `✅ Found ${data.results[0].table_count} tables in database '${database}':\n\n` +
                  data.results[0].tables.map((table: string) => `• ${table}`).join('\n') +
                  `\n\nUse these table names with 'get-table-schema' or 'get-top-records' queries.`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ Failed to list tables: ${response.data.message || 'Unknown error'}`
          }],
          isError: true
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `❌ Error listing tables: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get-table-schema",
  {
    title: "Get Table Schema",
    description: "Get detailed column information for a specific table including column names, types, lengths, and nullability. Essential for understanding table structure before querying data.",
    inputSchema: {
      tableName: z.string().describe("Name of the table to get schema for"),
      database: z.string().optional().describe("Database name (defaults to 'eadmin')")
    }
  },
  async ({ tableName, database = 'eadmin' }) => {
    try {
      console.error(`🔍 Getting schema for table: ${tableName} in database: ${database}`);
      
      const response = await axios.post(PHP_API_URL, {
        queryName: "get-table-schema",
        params: { tableName, database }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY
        },
        timeout: 30000
      });

      if (response.data.status === 'success') {
        const data = response.data.data;
        const columns = data.results[0].columns;
        return {
          content: [{
            type: "text",
            text: `✅ Schema for table '${tableName}' in database '${database}':\n\n` +
                  `Columns (${columns.length}):\n` +
                  columns.map((col: any) => 
                    `• ${col.column_name} (${col.type_name}${col.column_length ? `(${col.column_length})` : ''}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`
                  ).join('\n') +
                  `\n\nUse 'get-top-records' to see sample data from this table.`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ Failed to get table schema: ${response.data.message || 'Unknown error'}`
          }],
          isError: true
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `❌ Error getting table schema: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get-sample-data",
  {
    title: "Get Sample Data from Table",
    description: "Get a sample of records from a specific table. Useful for understanding data structure and content before writing queries.",
    inputSchema: {
      tableName: z.string().describe("Name of the table to get sample data from"),
      database: z.string().optional().describe("Database name (defaults to 'eadmin')"),
      limit: z.number().optional().describe("Number of records to return (defaults to 10, max 100)")
    }
  },
  async ({ tableName, database = 'eadmin', limit = 10 }) => {
    try {
      console.error(`🔍 Getting ${limit} sample records from table: ${tableName} in database: ${database}`);
      
      const response = await axios.post(PHP_API_URL, {
        queryName: "get-top-records",
        params: { tableName, database, limit: Math.min(limit, 100) }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY
        },
        timeout: 30000
      });

      if (response.data.status === 'success') {
        const data = response.data.data;
        const records = data.results[0].records;
        return {
          content: [{
            type: "text",
            text: `✅ Sample data from table '${tableName}' in database '${database}':\n\n` +
                  `Records (${records.length}):\n` +
                  records.map((record: any, index: number) => 
                    `${index + 1}. ${JSON.stringify(record, null, 2)}`
                  ).join('\n\n')
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ Failed to get sample data: ${response.data.message || 'Unknown error'}`
          }],
          isError: true
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `❌ Error getting sample data: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Register a resource for server information
server.registerResource(
  "server-info",
  "info://server",
  {
    title: "Server Information",
    description: "Information about the Informix MCP Server",
    mimeType: "application/json"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        name: "informix-mcp-server",
        version: "1.0.0",
        description: "Model Context Protocol server for Informix database access",
        capabilities: {
          tools: ["test-connection", "query-informix", "list-databases", "list-tables", "get-table-schema", "get-sample-data"],
          resources: ["server-info", "query-reference", "database-status"]
        },
        configuration: {
          phpApiUrl: PHP_API_URL,
          apiKeyConfigured: !!API_KEY,
          apiKeyLength: API_KEY ? API_KEY.length : 0
        },
        status: "running",
        timestamp: new Date().toISOString()
      }, null, 2)
    }]
  })
);

// Register a resource for query reference and examples
server.registerResource(
  "query-reference",
  "info://queries",
  {
    title: "Query Reference and Examples",
    description: "Complete reference of all available database queries with examples and parameter descriptions",
    mimeType: "application/json"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        title: "Informix Database Query Reference",
        description: "Complete guide to all available database queries through the MCP server",
        availableDatabases: ["eadmin", "payrolldb", "ppc", "auditdb"],
        queries: {
          "test-connection": {
            description: "Test database connection and verify server is responding",
            parameters: {},
            example: { queryName: "test-connection", params: {} },
            useCase: "Verify the MCP server can connect to the database"
          },
          "list-databases": {
            description: "Get a list of all user databases in the Informix instance",
            parameters: {},
            example: { queryName: "list-databases", params: {} },
            useCase: "Discover available databases before querying specific ones"
          },
          "get-database-count": {
            description: "Get the count of user databases (excluding system databases)",
            parameters: {},
            example: { queryName: "get-database-count", params: {} },
            useCase: "Quick overview of how many databases are available"
          },
          "list-tables": {
            description: "Get a list of all tables in a specific database",
            parameters: {
              database: "string (optional, defaults to 'eadmin')"
            },
            example: { queryName: "list-tables", params: { database: "eadmin" } },
            useCase: "Discover available tables before querying their schema or data"
          },
          "get-table-schema": {
            description: "Get detailed column information for a specific table",
            parameters: {
              tableName: "string (required)",
              database: "string (optional, defaults to 'eadmin')"
            },
            example: { queryName: "get-table-schema", params: { tableName: "users", database: "eadmin" } },
            useCase: "Understand table structure before writing queries or analyzing data"
          },
          "get-top-records": {
            description: "Get sample records from a specific table",
            parameters: {
              tableName: "string (required)",
              database: "string (optional, defaults to 'eadmin')",
              limit: "number (optional, defaults to 10)"
            },
            example: { queryName: "get-top-records", params: { tableName: "users", database: "eadmin", limit: 5 } },
            useCase: "Examine sample data to understand content and structure"
          },
          "get-object-type": {
            description: "Get the type of a database object (table, view, synonym, etc.)",
            parameters: {
              objectName: "string (required)",
              database: "string (optional, defaults to 'eadmin')"
            },
            example: { queryName: "get-object-type", params: { objectName: "users", database: "eadmin" } },
            useCase: "Determine what type of object you're working with"
          },
          "get-view-schema": {
            description: "Get the definition of a database view",
            parameters: {
              viewName: "string (required)",
              database: "string (optional, defaults to 'eadmin')"
            },
            example: { queryName: "get-view-schema", params: { viewName: "user_summary", database: "eadmin" } },
            useCase: "Understand how a view is constructed and what data it contains"
          }
        },
        workflow: {
          "1_discover": "Use 'list-databases' to see available databases",
          "2_explore": "Use 'list-tables' to see tables in a specific database",
          "3_understand": "Use 'get-table-schema' to understand table structure",
          "4_sample": "Use 'get-top-records' to see sample data",
          "5_analyze": "Use other queries based on your analysis needs"
        },
        tips: [
          "Always start with 'list-databases' to discover available databases",
          "Use 'list-tables' to explore what's available in each database",
          "Check table schema before querying data to understand the structure",
          "Sample data with 'get-top-records' to understand content patterns",
          "Use 'get-object-type' to distinguish between tables, views, and other objects"
        ]
      }, null, 2)
    }]
  })
);

// Register a resource for database status and health
server.registerResource(
  "database-status",
  "info://status",
  {
    title: "Database Status and Health",
    description: "Current status of database connections and server health",
    mimeType: "application/json"
  },
  async (uri) => {
    try {
      // Test database connection
      const response = await axios.post(PHP_API_URL, {
        queryName: "test-connection",
        params: {}
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY
        },
        timeout: 10000
      });

      const isHealthy = response.data.status === 'success';
      const dbInfo = isHealthy ? response.data.data.results[0] : null;

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            status: isHealthy ? "healthy" : "unhealthy",
            timestamp: new Date().toISOString(),
            database: {
              connected: isHealthy,
              currentTime: dbInfo?.current_time || null,
              testResult: dbInfo?.test_result || null
            },
            server: {
              phpApiUrl: PHP_API_URL,
              apiKeyConfigured: !!API_KEY,
              version: "1.0.0"
            },
            lastChecked: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            error: error.message,
            database: {
              connected: false
            },
            server: {
              phpApiUrl: PHP_API_URL,
              apiKeyConfigured: !!API_KEY,
              version: "1.0.0"
            }
          }, null, 2)
        }]
      };
    }
  }
);

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🚀 Informix MCP Server started successfully!");
    console.error("📡 Server is listening for MCP protocol messages via stdio");
    console.error("🔧 Available tools: test-connection, query-informix, list-databases, list-tables, get-table-schema, get-sample-data");
    console.error("📄 Available resources: server-info, query-reference, database-status");
    console.error("💡 Use 'query-reference' resource to discover all available queries and examples");
  } catch (error) {
    console.error("❌ Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error("🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error("🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error("💥 Unhandled error:", error);
  process.exit(1);
});
