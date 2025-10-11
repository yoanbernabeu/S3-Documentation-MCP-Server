# S3 Documentation MCP Server

[![CI](https://github.com/yoanbernabeu/s3-doc-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/yoanbernabeu/s3-doc-mcp/actions/workflows/ci.yml)
[![Docker Build](https://github.com/yoanbernabeu/s3-doc-mcp/actions/workflows/docker-build.yml/badge.svg)](https://github.com/yoanbernabeu/s3-doc-mcp/actions/workflows/docker-build.yml)

MCP (Model Context Protocol) server for indexing and searching documentation stored on S3.

## 🎯 Features

- **S3 Connection**: Compatible with AWS S3, MinIO, Scaleway Object Storage, DigitalOcean Spaces, and any S3-compatible service
- **Read-only**: Secure access to Markdown files
- **RAG with HNSWLib**: Optimized vector search
- **Local Embeddings**: Uses Ollama (nomic-embed-text)
- **MCP Tools**:
  - `search_documentation`: Semantic search in documentation
  - `refresh_index`: Manually refresh the index

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **Ollama** installed and running
  ```bash
  brew install ollama  # macOS
  ollama serve
  ollama pull nomic-embed-text
  ```
- **S3 (or compatible)**: Read access to bucket
  - ✅ AWS S3
  - ✅ MinIO (self-hosted)
  - ✅ Scaleway Object Storage
  - ✅ DigitalOcean Spaces
  - ✅ Cloudflare R2
  - ✅ Wasabi
  - ✅ Any other S3-compatible provider

## 🚀 Installation

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp env.example .env
# Edit .env with your AWS credentials and configuration

# Build
npm run build
```

## 🔧 Configuration

See `env.example` for all available environment variables.

## 📦 Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### 🐳 Docker

#### Build and Run

```bash
# Copy and configure environment variables
cp env.example .env
# Edit .env with your configuration

# Build and start with Docker Compose
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

#### Configuration

The Docker setup expects:
- **Ollama** running externally on the host machine at `http://host.docker.internal:11434`
- **S3** (or compatible) service accessible from the container

**Note**: The Ollama URL is hardcoded to `http://host.docker.internal:11434` in the `compose.yaml` file. If your Ollama instance runs on a different host or port, you'll need to modify the `OLLAMA_BASE_URL` value directly in the `compose.yaml` file.

#### Volumes

The vector store data is persisted in a Docker volume named `vector-store-data` to avoid re-indexing on container restart.

## 📝 License

MIT

## 👤 Author

Yoan Bernabeu

