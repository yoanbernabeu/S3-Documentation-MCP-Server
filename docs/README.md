# S3 Documentation MCP - Documentation Site

This directory contains the documentation website for S3 Documentation MCP, built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## 🚀 Project Structure

```
docs/
├── public/              # Static assets
├── src/
│   ├── assets/         # Images and other assets
│   └── content/
│       └── docs/       # Documentation markdown files
│           ├── index.mdx
│           ├── getting-started/
│           ├── configuration/
│           ├── usage/
│           └── reference/
├── astro.config.mjs    # Astro configuration
├── package.json
└── tsconfig.json
```

## 🧞 Commands

All commands are run from this directory (`docs/`):

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 📝 Adding Documentation

1. Create a new `.md` or `.mdx` file in `src/content/docs/`
2. Add frontmatter with `title` and `description`
3. Write your content using Markdown
4. The file will automatically appear in the sidebar (based on `astro.config.mjs`)

### Example

```markdown
---
title: My New Page
description: Description of my new page
---

# My New Page

Content goes here...
```

## 🔧 Configuration

The site is configured in `astro.config.mjs`:

- **site**: GitHub Pages URL
- **base**: Repository name (for correct routing)
- **sidebar**: Navigation structure

## 🌐 Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

- **Workflow**: `.github/workflows/deploy-docs.yml`
- **URL**: https://yoanbernabeu.github.io/S3-Documentation-MCP-Server/

### Manual Deployment

You can also trigger a manual deployment from the GitHub Actions tab.

## 📚 Resources

- [Starlight Documentation](https://starlight.astro.build/)
- [Astro Documentation](https://docs.astro.build)
- [Markdown Guide](https://www.markdownguide.org/)
