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
			head: [
				// Open Graph / Facebook / LinkedIn
				{
					tag: 'meta',
					attrs: {
						property: 'og:title',
						content: 'S3 Documentation MCP - AI-Powered Documentation Search',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:description',
						content: 'Transform your S3-stored documentation into intelligent, context-aware answers with RAG capabilities. Zero dependencies, local embeddings, universal S3 compatibility.',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: 'https://yoanbernabeu.github.io/S3-Documentation-MCP-Server/image.png',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:image:width',
						content: '1200',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:image:height',
						content: '630',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:url',
						content: 'https://yoanbernabeu.github.io/S3-Documentation-MCP-Server/',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:type',
						content: 'website',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:site_name',
						content: 'S3 Documentation MCP',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:locale',
						content: 'en_US',
					},
				},
				// Twitter Card
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:card',
						content: 'summary_large_image',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:title',
						content: 'S3 Documentation MCP - AI-Powered Documentation Search',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:description',
						content: 'Transform your S3-stored documentation into intelligent, context-aware answers with RAG capabilities. Zero dependencies, local embeddings, universal S3 compatibility.',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:image',
						content: 'https://yoanbernabeu.github.io/S3-Documentation-MCP-Server/image.png',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:image:alt',
						content: 'S3 Documentation MCP - AI-Powered Documentation Search with RAG capabilities',
					},
				},
				// Additional meta tags for better SEO
				{
					tag: 'meta',
					attrs: {
						name: 'keywords',
						content: 'MCP, Model Context Protocol, S3, Documentation, RAG, Vector Search, AI, LLM, Claude, Semantic Search, Embeddings, Ollama, OpenAI',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'author',
						content: 'Yoan Bernabeu',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'canonical',
						href: 'https://yoanbernabeu.github.io/S3-Documentation-MCP-Server/',
					},
				},
			],
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
