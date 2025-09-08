# Informix MCP Server

A Model Context Protocol (MCP) server that provides access to Informix database queries through a PHP API bridge.

## Overview

This MCP server acts as a bridge between AI applications and an Informix 11 database. It communicates with a PHP API endpoint that handles the actual database connections and queries, providing a secure and standardized way for AI models to access database information.

## Features

- **Test Connection Tool**: Verify that the MCP server is running and responding correctly
- **Informix Query Tool**: Execute predefined queries against the Informix database via PHP API bridge
- **Server Information Resource**: Access server metadata, capabilities, and configuration
- **Environment Variable Configuration**: Secure API key management via environment variables
- **HTTP Client Integration**: Built-in axios client for PHP API communication
- **Comprehensive Error Handling**: Detailed error messages for various failure scenarios
- **Real Database Integration**: Uses PDO Informix connections with the InformixDBAHelper class
- **Multiple Database Support**: Query across different databases (eadmin, payrolldb, ppc, auditdb)
- **Schema Discovery**: Get table schemas, column information, and object types
- **Data Sampling**: Retrieve sample records from tables with configurable limits

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env file with your actual values
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Configuration

The MCP server requires the following environment variables:

### Required
- `INFORMIX_API_KEY`: API key for authenticating with the PHP API bridge

### Optional
- `PHP_API_URL`: URL of the PHP API bridge (defaults to `http://localhost/informix_api.php`)

### Example .env file:
```bash
INFORMIX_API_KEY=your-secret-api-key-here
PHP_API_URL=http://localhost/informix_api.php
```

## MCP Client Configuration

To use this MCP server with an MCP client, add the following configuration to your MCP client config JSON:

```json
{
  "informix-mcp": {
    "command": "node",
    "args": [
      "V:\\www\\fgk.net\\api\\informix-mcp\\dist\\server.js"
    ],
    "env": {
      "INFORMIX_API_KEY": "your-secret-api-key-here",
      "PHP_API_URL": "your-php-server-api-with-informix-connection-support"
    }
  }
}
```

**Note:** Update the path in the `args` array to match your actual installation directory.

## Usage

### Development Mode
Run the server in development mode with hot reload:
```bash
npm run dev
```

### Production Mode
Build and run the compiled server:
```bash
npm run build
npm start
```

## Architecture

```
AI Application → MCP Server → PHP API Bridge → Informix Database
```

The MCP server communicates with a PHP API endpoint that:
- Validates API keys for security
- Executes predefined, parameterized queries
- Returns JSON responses with query results
- Handles database connection management

## Available Tools

### test-connection
Tests the MCP server connection and returns a success message.

**Parameters:**
- `message` (optional): Custom test message

### query-informix
Executes queries against the Informix database via the PHP API bridge.

**Parameters:**
- `queryName` (required): Name of the predefined query to execute
- `params` (optional): Parameters for the query

**Available Queries:**

| Query Name | Description | Parameters |
|------------|-------------|------------|
| `test-connection` | Test database connection | None |
| `get-database-count` | Get count of user databases | None |
| `list-tables` | List tables in a database | `database` (optional, defaults to eadmin) |
| `get-table-schema` | Get table column information | `tableName` (required), `database` (optional) |
| `get-top-records` | Get sample records from a table | `tableName` (required), `limit` (optional, default 10), `database` (optional) |
| `get-object-type` | Get type of database object | `objectName` (required), `database` (optional) |
| `get-view-schema` | Get view definition | `viewName` (required), `database` (optional) |

**Example Usage:**
```json
{
  "queryName": "get-table-schema",
  "params": {
    "tableName": "users",
    "database": "eadmin"
  }
}
```

## Available Resources

### server-info
Provides information about the MCP server including:
- Server name and version
- Available tools and resources
- Current status and timestamp

## Development

This project uses:
- **TypeScript** for type safety
- **MCP TypeScript SDK** for protocol implementation
- **tsx** for development execution
- **stdio transport** for communication

## Next Steps

1. Implement PHP API bridge communication
2. Add predefined Informix queries
3. Implement proper error handling
4. Add authentication and security features
5. Add comprehensive logging

## License

ISC
