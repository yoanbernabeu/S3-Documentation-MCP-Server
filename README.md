# S3 Documentation MCP Server

[![CI](https://github.com/yoanbernabeu/S3-Documentation-MCP-Server/actions/workflows/ci.yml/badge.svg)](https://github.com/yoanbernabeu/S3-Documentation-MCP-Server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yoanbernabeu/S3-Documentation-MCP-Server/branch/main/graph/badge.svg)](https://codecov.io/gh/yoanbernabeu/S3-Documentation-MCP-Server)
[![Build and Push Docker Image](https://github.com/yoanbernabeu/S3-Documentation-MCP-Server/actions/workflows/docker-build.yml/badge.svg)](https://github.com/yoanbernabeu/S3-Documentation-MCP-Server/actions/workflows/docker-build.yml)
[![Docker Hub](https://img.shields.io/docker/pulls/yoanbernabeu/s3-doc-mcp?logo=docker&logoColor=white)](https://hub.docker.com/r/yoanbernabeu/s3-doc-mcp)

A lightweight **[Model Context Protocol (MCP)](https://modelcontextprotocol.io)** server that brings RAG (Retrieval-Augmented Generation) capabilities to your LLM over Markdown documentation stored on S3.

**Built for simplicity:**
- 🪶 **Lightweight Stack**: No heavy dependencies or cloud services
- 🏠 **Fully Local**: [Ollama](https://ollama.ai) for embeddings (no API costs, no rate limits)
- 💾 **File-based Storage**: Vector indices stored as simple files (HNSWLib)
- 🔌 **S3-Compatible**: Works with any S3-compatible storage (AWS, MinIO, Scaleway, Cloudflare R2...)

> [!IMPORTANT]  
> 🚧 This project is a work in progress.
> APIs and behavior may change at any time, and backward compatibility is not ensured.
> Not suitable for production.

## Requirements

- **[Ollama](https://ollama.ai)** installed and running with the `nomic-embed-text` model
- **Node.js >= 18** (if running from source) **OR** **Docker** (recommended)
- **S3-compatible storage** (AWS S3, MinIO, Scaleway, Cloudflare R2, etc.)

## Use Cases

- **📚 Product Documentation**: Let Claude/Cursor/etc answer from your docs
- **🏢 Internal Wiki**: AI-powered company knowledge search
- **📖 API Docs**: Help developers find API information
- **🎓 Educational Content**: Build AI tutors with course materials

## Quick Start

### With Docker (Recommended)

```bash
# 1. Prerequisites
# Install Ollama from https://ollama.ai
ollama pull nomic-embed-text

# 2. Configure
cp env.example .env  # Add your S3 credentials

# 3. Run
docker run -d \
  --name s3-doc-mcp \
  -p 3000:3000 \
  --env-file .env \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -v $(pwd)/data:/app/data \
  yoanbernabeu/s3-doc-mcp:latest
```

Or use Docker Compose (Local Build):
```bash
docker compose up -d
```

### From Source

```bash
# 1. Prerequisites
# Install Ollama from https://ollama.ai
ollama pull nomic-embed-text

# 2. Install & Run
npm install
cp env.example .env  # Configure your S3 credentials
npm run build && npm start

# 3. For local development
npm run dev
```

Your MCP server is now running on `http://localhost:3000`

## Connect to MCP Clients

Once your server is running, you need to configure your MCP client to connect to it.

### Cursor

Edit your `~/.cursor/mcp.json` file and add:

```json
{
  "mcpServers": {
    "doc": {
        "type": "streamable-http",
        "url": "http://127.0.0.1:3000/mcp",
        "note": "S3 Documentation RAG Server"
    }
  }
}
```

### Claude Desktop

Edit your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "doc": {
        "type": "streamable-http",
        "url": "http://127.0.0.1:3000/mcp",
        "note": "S3 Documentation RAG Server"
    }
  }
}
```

Restart your MCP client, and you should now see the `search_documentation` and `refresh_index` tools available.

> 💡 **Tip**: If using Docker, make sure the port mapping matches your configuration (default is `3000:3000`)

## Features

- 🔌 **Universal S3**: AWS S3, MinIO, Scaleway, DigitalOcean Spaces, Cloudflare R2, Wasabi...
- 🧠 **Local RAG**: Ollama embeddings ([nomic-embed-text](https://ollama.com/library/nomic-embed-text)) - no API costs
- 🔄 **Smart Sync**: Incremental updates via ETag comparison
- ⚡ **Fast Search**: HNSWLib vector index with cosine similarity
- 🛠️ **2 MCP Tools**: `search_documentation` and `refresh_index`

## How It Works

The server follows a simple pipeline:

1. **S3Loader**: Scans your S3 bucket for `.md` files, downloads their content, and tracks ETags for change detection
2. **SyncService**: Detects new, modified, or deleted files and performs incremental synchronization (no unnecessary reprocessing)
3. **VectorStore**: 
   - Splits documents into chunks (1000 characters by default)
   - Generates embeddings using Ollama's [`nomic-embed-text`](https://ollama.com/library/nomic-embed-text) model (running locally)
   - Indexes vectors using **HNSWLib** for fast similarity search
4. **MCP Server**: Exposes `search_documentation` and `refresh_index` tools via HTTP for your LLM to use

### What is HNSWLib?

**[HNSWLib](https://github.com/nmslib/hnswlib)** (Hierarchical Navigable Small World) is a lightweight, in-memory vector search library that's perfect for this use case:

- ⚡ **Fast**: Approximate nearest neighbor search in milliseconds
- 💾 **Simple**: Stores indices as local files (no database needed)
- 🪶 **Efficient**: Low memory footprint, ideal for personal/small-team documentation
- 🎯 **Accurate**: High recall with cosine similarity for semantic search

It's the sweet spot between simplicity and performance for RAG applications.

## Configuration

Copy `env.example` to `.env` and configure your environment variables:

```bash
cp env.example .env
```

### Essential Variables

```bash
# S3 Configuration
S3_BUCKET_NAME=your-bucket-name           # Your S3 bucket name
S3_ACCESS_KEY_ID=your-access-key          # S3 access key
S3_SECRET_ACCESS_KEY=your-secret-key      # S3 secret key
S3_REGION=us-east-1                       # S3 region
S3_ENDPOINT=                              # Optional: for non-AWS S3 (MinIO, Scaleway, etc.)

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434    # Ollama API endpoint
```

See [`env.example`](env.example) for all available options and detailed documentation (RAG parameters, sync mode, chunk size, etc.).

## MCP Tools

### `search_documentation`

```json
{
  "query": "How to configure S3?",
  "max_results": 4
}
```

Returns relevant document chunks with similarity scores and sources.

### `refresh_index`

```json
{
  "force": false  // true = full reindex, false = incremental
}
```

Syncs the index with S3. Use `force: true` to rebuild everything.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](.github/CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

## 📝 License

[MIT](LICENSE)

## 👤 Author

Yoan Bernabeu

