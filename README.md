# S3 Documentation MCP Server

[![CI](https://github.com/yoanbernabeu/S3-Documentation-MCP-Server/actions/workflows/ci.yml/badge.svg)](https://github.com/yoanbernabeu/S3-Documentation-MCP-Server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yoanbernabeu/S3-Documentation-MCP-Server/branch/main/graph/badge.svg)](https://codecov.io/gh/yoanbernabeu/S3-Documentation-MCP-Server)
[![Build and Push Docker Image](https://github.com/yoanbernabeu/S3-Documentation-MCP-Server/actions/workflows/docker-build.yml/badge.svg)](https://github.com/yoanbernabeu/S3-Documentation-MCP-Server/actions/workflows/docker-build.yml)
[![Docker Hub](https://img.shields.io/docker/pulls/yoanbernabeu/s3-doc-mcp?logo=docker&logoColor=white)](https://hub.docker.com/r/yoanbernabeu/s3-doc-mcp)

A lightweight **[Model Context Protocol (MCP)](https://modelcontextprotocol.io)** server that brings RAG (Retrieval-Augmented Generation) capabilities to your LLM over Markdown documentation stored on S3.

**Built for simplicity:**
- 🪶 **Lightweight Stack**: No heavy dependencies or cloud services
- 🏠 **Flexible Embeddings**: Choose between [Ollama](https://ollama.ai) (local, free) or [OpenAI](https://openai.com) (cloud, high-accuracy)
- 💾 **File-based Storage**: Vector indices stored as simple files (HNSWLib)
- 🔌 **S3-Compatible**: Works with any S3-compatible storage (AWS, MinIO, Scaleway, Cloudflare R2...)

> [!IMPORTANT]  
> 🚧 This project is a work in progress.
> APIs and behavior may change at any time, and backward compatibility is not ensured.
> Not suitable for production.

## Requirements

- **Embedding Provider** (choose one):
  - **[Ollama](https://ollama.ai)** (recommended for local/offline use) with the `nomic-embed-text` model
  - **[OpenAI API Key](https://platform.openai.com/api-keys)** (for cloud-based embeddings)
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

Restart your MCP client, and you should now see:
- **3 MCP Tools**: `search_documentation`, `refresh_index`, `get_full_document`
- **MCP Resources**: Full list of indexed documentation files with direct access

> 💡 **Tip**: If using Docker, make sure the port mapping matches your configuration (default is `3000:3000`)

## Features

- 🔌 **Universal S3**: AWS S3, MinIO, Scaleway, DigitalOcean Spaces, Cloudflare R2, Wasabi...
- 🧠 **Flexible Embeddings**: 
  - **Ollama** ([nomic-embed-text](https://ollama.com/library/nomic-embed-text)) - Local, free, offline-capable
  - **OpenAI** (`text-embedding-3-small`, `text-embedding-3-large`) - Cloud-based, high-accuracy, multilingual
- 🔄 **Smart Sync**: Incremental updates via ETag comparison + automatic full sync on empty vector store
- ⚡ **Fast Search**: HNSWLib vector index with cosine similarity
- 🔐 **Optional Auth**: API key authentication for secure deployments
- 🛠️ **3 MCP Tools**: `search_documentation`, `refresh_index`, and `get_full_document`
- 📚 **MCP Resources**: Native support for discovering and reading indexed files via standard MCP Resources API

## How It Works

The server follows a simple pipeline:

1. **S3Loader**: Scans your S3 bucket for `.md` files, downloads their content, and tracks ETags for change detection
2. **SyncService**: Detects new, modified, or deleted files and performs incremental synchronization (no unnecessary reprocessing)
3. **VectorStore**: 
   - Splits documents into chunks (1000 characters by default)
   - Generates embeddings using your chosen provider:
     - **Ollama**: [`nomic-embed-text`](https://ollama.com/library/nomic-embed-text) (local, free)
     - **OpenAI**: `text-embedding-3-small` or `text-embedding-3-large` (cloud, high-accuracy)
   - Indexes vectors using **HNSWLib** for fast similarity search
4. **MCP Server**: Exposes both **Tools** and **Resources** via HTTP:
   - **Tools**: `search_documentation`, `refresh_index`, `get_full_document` for semantic search and actions
   - **Resources**: `resources/list`, `resources/read` for file discovery and direct access

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

# Embeddings Provider (choose one)
EMBEDDING_PROVIDER=ollama                 # ollama (default) or openai

# Option 1: Ollama (Local)
OLLAMA_BASE_URL=http://localhost:11434    # Ollama API endpoint
OLLAMA_EMBEDDING_MODEL=nomic-embed-text   # Ollama embedding model

# Option 2: OpenAI (Cloud) - Only if EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=                           # Your OpenAI API key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # or text-embedding-3-large
```

See [`env.example`](env.example) for all available options and detailed documentation (RAG parameters, sync mode, chunk size, etc.).

### Embedding Providers

The server supports two embedding providers:

#### 🏠 Ollama (Local) - Default

**Pros:**
- ✅ **Free**: No API costs, unlimited usage
- ✅ **Private**: All data stays on your machine
- ✅ **Offline**: Works without internet connection
- ✅ **Fast**: Direct local API calls

**Cons:**
- ⚠️ Requires Ollama installation and model download
- ⚠️ Uses local CPU/GPU resources

**Setup:**
```bash
# Install Ollama from https://ollama.ai
ollama pull nomic-embed-text

# Configure
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

#### ☁️ OpenAI (Cloud)

**Pros:**
- ✅ **High Accuracy**: State-of-the-art embeddings
- ✅ **Multilingual**: Excellent support for 20+ languages
- ✅ **No Local Resources**: Runs entirely in the cloud
- ✅ **Lower Latency**: Fast API responses

**Cons:**
- ⚠️ Requires API key and credits
- ⚠️ Data sent to OpenAI servers
- ⚠️ Cost per token (very affordable: ~$0.00002/1K tokens for `text-embedding-3-small`)

**Setup:**
```bash
# Get an API key from https://platform.openai.com/api-keys

# Configure
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...your-key...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # or text-embedding-3-large
```

**Model Comparison:**

| Model | Dimensions | Performance | Cost | Best For |
|-------|------------|-------------|------|----------|
| `text-embedding-3-small` | 1536 | High | Low | General purpose, cost-sensitive |
| `text-embedding-3-large` | 3072 | Higher | Medium | Maximum accuracy, multilingual |

> 💡 **Tip**: Start with `text-embedding-3-small` for most use cases. Only switch to `text-embedding-3-large` if you need the absolute best accuracy or work extensively with non-English content.

**Fallback Behavior:**

If you set `EMBEDDING_PROVIDER=openai` but don't provide a valid `OPENAI_API_KEY`, the server will automatically fall back to Ollama (if configured). This ensures the server can always start, even with incomplete configuration.

### Synchronization Modes

The server supports three synchronization modes via `SYNC_MODE`:

- **`startup`** (default): Syncs at server startup
  - ✅ **Auto-detection**: If the vector store is empty, automatically performs a full sync
  - ✅ Otherwise, performs an incremental sync (only changed files)
  - ✅ No manual `refresh_index` needed after restart!
  
- **`periodic`**: Syncs at regular intervals (`SYNC_INTERVAL_MINUTES`)
  - Runs incremental syncs automatically
  
- **`manual`**: No automatic sync
  - You must call `refresh_index` tool manually

> 💡 **Note**: The server automatically detects when the vector store is empty (e.g., after deleting `./data/` folder or first run) and triggers a full synchronization. You no longer need to manually run `refresh_index` after every restart!

## 🔐 Security & Authentication

### API Key Authentication (Optional)

By default, the server runs in **open access mode** for easy local development. For shared or remote deployments, you can enable API key authentication:

```bash
# Enable authentication
ENABLE_AUTH=true

# Set your API key
MCP_API_KEY=your-secret-key-here
```

When authentication is enabled:
- ✅ All endpoints (except `/health`) require a valid API key
- ✅ API key can be provided via:
  - **Authorization header** (recommended): `Authorization: Bearer your-secret-key`
  - **Query parameter**: `?api_key=your-secret-key`
- ✅ Invalid or missing keys return HTTP 401 Unauthorized

**Usage Examples:**

```bash
# With Authorization header (recommended)
curl -H "Authorization: Bearer your-secret-key" http://localhost:3000/mcp

# With query parameter
curl "http://localhost:3000/mcp?api_key=your-secret-key"
```

**MCP Client Configuration with API Key:**

```json
{
  "mcpServers": {
    "doc": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-secret-key"
      },
      "note": "S3 Documentation RAG Server with authentication"
    }
  }
}
```

> 💡 **Best Practices:**
> - Keep authentication **disabled** for local development
> - **Enable** it for shared networks or remote deployments
> - Use strong, randomly generated keys (e.g., `openssl rand -hex 32`)
> - The `/health` endpoint is always accessible without authentication for monitoring

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
  "force": false  // default: incremental sync (recommended)
}
```

Synchronizes the documentation index with S3, detecting new, modified, or deleted files.

**Parameters:**
- `force` (boolean, optional, default: `false`)
  - `false`: **Incremental sync** - Only processes changes (fast, efficient) ✅
  - `true`: **Full reindex** - Reprocesses ALL files (slow, expensive) ⚠️

**⚠️ Important:** The `force` parameter should **ONLY** be set to `true` when explicitly needed (e.g., "force reindex", "rebuild everything from scratch"). Full reindex is expensive:
- Re-downloads all files from S3
- Regenerates all embeddings
- Rebuilds the entire vector store

For normal operations, always use incremental sync (default behavior).

### `get_full_document`

```json
{
  "s3_key": "docs/authentification_magique_symfony.md"
}
```

Retrieves the complete content of a Markdown file from S3 along with metadata:
- **Full S3 key**: The document's S3 identifier
- **Complete Markdown content**: Entire document (not chunked)
- **Metadata**: Size in bytes, last modification date, ETag, chunk count (if indexed)

**Use Cases:**
- View the complete document after finding it via `search_documentation`
- Export documentation for external use
- Understand the full context around a search result
- Display complete documents in third-party integrations

**Important Notes:**
- If a document appears in search results but `get_full_document` returns "not found", it means the file was deleted from S3 after being indexed
- **Solution**: Run `refresh_index` to synchronize the index with the current S3 state
- The tool will provide a helpful error message indicating when a sync is needed

## MCP Resources

In addition to the 3 tools, the server implements [MCP Resources](https://modelcontextprotocol.io/specification/draft/server/resources) for file discovery and direct access:

- **`resources/list`**: Lists all indexed Markdown files with metadata (name, URI, size, chunks, last modified)
- **`resources/read`**: Reads the full content of a specific file by its URI (e.g., `s3doc://docs/authentication.md`)

**Use case:** When users ask "What files do you have?" or "Show me file X", the LLM can browse and access files directly without semantic search.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](.github/CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

## 📝 License

[MIT](LICENSE)

## 👤 Author

Yoan Bernabeu

