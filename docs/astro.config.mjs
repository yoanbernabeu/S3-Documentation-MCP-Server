// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://yoanbernabeu.github.io',
	base: '/S3-Documentation-MCP-Server',
	integrations: [
		starlight({
			title: 'S3 Documentation MCP',
			description: 'A lightweight MCP server that brings RAG capabilities to your LLM over Markdown documentation stored on S3.',
			customCss: [
				'./src/styles/custom.css',
			],
			defaultLocale: 'root',
			locales: {
				root: {
					label: 'English',
					lang: 'en',
				},
			},
			expressiveCode: {
				themes: ['dracula'],
			},
			components: {
				ThemeSelect: './src/components/ThemeSelect.astro',
			},
			social: [
				{ 
					icon: 'github', 
					label: 'GitHub', 
					href: 'https://github.com/yoanbernabeu/S3-Documentation-MCP-Server' 
				}
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'index' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
						{ label: 'Installation', slug: 'getting-started/installation' },
					],
				},
				{
					label: 'Configuration',
					items: [
						{ label: 'Environment Variables', slug: 'configuration/environment-variables' },
						{ label: 'Embedding Providers', slug: 'configuration/embedding-providers' },
						{ label: 'Synchronization Modes', slug: 'configuration/sync-modes' },
						{ label: 'Security & Authentication', slug: 'configuration/security' },
					],
				},
				{
					label: 'Usage',
					items: [
						{ label: 'MCP Tools', slug: 'usage/mcp-tools' },
						{ label: 'MCP Resources', slug: 'usage/mcp-resources' },
						{ label: 'Client Configuration', slug: 'usage/client-configuration' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Architecture', slug: 'reference/architecture' },
						{ label: 'API Reference', slug: 'reference/api' },
					],
				},
			],
		}),
	],
});
