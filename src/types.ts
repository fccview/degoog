export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  thumbnail?: string;
  duration?: string;
}

export interface SearchEngine {
  name: string;
  executeSearch(
    query: string,
    page?: number,
    timeFilter?: TimeFilter,
  ): Promise<SearchResult[]>;
}

export type SearchType = "all" | "images" | "videos" | "news";
export type TimeFilter = "any" | "hour" | "day" | "week" | "month" | "year";

export interface EngineTiming {
  name: string;
  time: number;
  resultCount: number;
}

export interface KnowledgePanel {
  title: string;
  description: string;
  image?: string;
  url: string;
  facts?: Record<string, string>;
}

export interface SearchResponse {
  results: ScoredResult[];
  atAGlance: ScoredResult | null;
  query: string;
  totalTime: number;
  type: SearchType;
  engineTimings: EngineTiming[];
  relatedSearches: string[];
  knowledgePanel: KnowledgePanel | null;
}

export interface ScoredResult extends SearchResult {
  score: number;
  sources: string[];
}

export type EngineConfig = Record<string, boolean>;

export interface CommandResult {
  title: string;
  html: string;
}

export interface BangCommand {
  name: string;
  description: string;
  trigger: string;
  execute(args: string, context?: CommandContext): Promise<CommandResult>;
}

export interface CommandContext {
  clientIp?: string;
}
