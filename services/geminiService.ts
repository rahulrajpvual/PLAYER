
import { GoogleGenAI } from "@google/genai";
import { NewsArticle } from "../types";

// Initialize the Google GenAI client using the correct pattern and API key from environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchMovieNews = async (): Promise<NewsArticle[]> => {
  try {
    // Generate content using gemini-3-flash-preview for basic text tasks with search grounding
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Find the top 8 most important movie news headlines from the last 24 hours. Focus on major casting, box office results, trailer releases, and production updates. For each item, provide the headline and a very brief 1-sentence summary.",
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const articles: NewsArticle[] = [];

    // Extract web chunks from grounding metadata as per search grounding requirements
    chunks.forEach((chunk) => {
      if (chunk.web) {
        articles.push({
          title: chunk.web.title || "Movie News",
          uri: chunk.web.uri || "#",
          source: chunk.web.uri ? new URL(chunk.web.uri).hostname.replace('www.', '') : 'google.com',
          snippet: "Click to read full story on the publisher's website.",
        });
      }
    });

    // Deduplicate articles based on URI
    const uniqueArticles = Array.from(new Map(articles.map(item => [item.uri, item])).values());
    
    return uniqueArticles.slice(0, 8);
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
};