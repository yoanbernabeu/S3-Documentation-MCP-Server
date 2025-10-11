/**
 * MCP Tool: Search in documentation
 */

import { z } from 'zod';

import { logger, config } from '../config/index.js';
import type { HNSWVectorStore } from '../services/hnswlib-vector-store.js';

// Zod schema for input
export const searchDocumentationInputSchema = z.object({
  query: z.string().describe('Question or search query to perform in the documentation'),
  max_results: z.number().optional().describe('Maximum number of results (default: 4)'),
});

// Zod schema for output
export const searchDocumentationOutputSchema = z.object({
  results: z.array(z.object({
    content: z.string(),
    source: z.string(),
    score: z.number(),
    chunk_info: z.string(),
  })),
  context: z.string(),
  total_results: z.number(),
});

export type SearchDocumentationInput = z.infer<typeof searchDocumentationInputSchema>;
export type SearchDocumentationOutput = z.infer<typeof searchDocumentationOutputSchema>;

/**
 * Implementation of search_documentation tool
 */
export async function searchDocumentation(
  input: SearchDocumentationInput,
  vectorStore: HNSWVectorStore
): Promise<SearchDocumentationOutput> {
  const { query, max_results } = input;
  
  logger.info(`🔍 Search: "${query}"`);
  
  try {
    // Perform vector search
    const searchResults = await vectorStore.similaritySearch(query, max_results);
    
    if (searchResults.length === 0) {
      logger.warn(`⚠️  No relevant results for: "${query}"`);
      
      // Detect if it's an isolated keyword (potentially problematic)
      const isKeyword = query.trim().split(/\s+/).length <= 2;
      const suggestionMessage = isKeyword 
        ? `\n\n⚠️  **Tip**: Isolated keywords (like "${query}") often give low scores (~50%) even if they're in the documents.\n` +
          `💡 **Try a complete question instead**:\n` +
          `   - "What is ${query}?"\n` +
          `   - "How does ${query} work?"\n` +
          `   - "Explain ${query}"\n\n` +
          `Embeddings work MUCH better with sentences than with isolated words!`
        : '';
      
      return {
        results: [],
        context: `No match found for your search "${query}".\n\n` +
                 `This may mean that:\n` +
                 `- The question is not about the indexed documents\n` +
                 `- The documents don't contain information on this topic\n` +
                 `- The similarity with documents is too low (< ${config.rag.minSimilarityScore * 100}%)\n${ 
                 suggestionMessage}`,
        total_results: 0,
      };
    }
    
    // Format results
    const results = searchResults.map(result => ({
      content: result.document.content,
      source: result.document.s3_key,
      score: Math.round(result.score * 100) / 100, // Round to 2 decimals
      chunk_info: `Chunk ${result.document.chunk_index + 1}/${result.document.total_chunks}`,
    }));
    
    // Create formatted context for LLM
    const context = searchResults.map((result, index) => {
      return `\n## Source ${index + 1}: ${result.document.s3_key} (similarity: ${Math.round(result.score * 100)}%)\n` +
             `Chunk ${result.document.chunk_index + 1}/${result.document.total_chunks}\n\n${ 
             result.document.content}`;
    }).join('\n\n---\n');
    
    logger.success(`✅ Found ${searchResults.length} results`);
    
    return {
      results,
      context,
      total_results: searchResults.length,
    };
  } catch (error) {
    logger.error(`❌ Error during search:`, error);
    throw new Error(`Error during search: ${error}`);
  }
}

