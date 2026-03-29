/**
 * Exa search integration for enriching the Unit Economics knowledge graph
 * with real industry benchmarks, pricing data, and market insights.
 */
import Exa from 'exa-js';

let exaClient = null;

function getClient() {
  if (!exaClient && process.env.EXA_API_KEY) {
    exaClient = new Exa(process.env.EXA_API_KEY);
  }
  return exaClient;
}

/**
 * Search for industry benchmarks and business context.
 * Returns a structured summary useful for draft generation.
 *
 * @param {Object} kg - Knowledge graph with business context
 * @returns {Object} enrichment data to merge into KG
 */
export async function searchBusinessContext(kg) {
  const exa = getClient();
  if (!exa) {
    console.warn('Exa API key not configured — skipping web research');
    return {};
  }

  const industry = kg.industry || kg.businessDescription || '';
  const city = kg.city || 'India';
  const stage = kg.businessStage || 'early';

  // Run searches in parallel for speed
  const queries = buildSearchQueries(industry, city, stage);

  try {
    const results = await Promise.allSettled(
      queries.map(q =>
        exa.search(q.query, {
          numResults: q.numResults || 5,
          type: 'auto',
          contents: {
            highlights: true,
          },
          ...(q.includeDomains ? { includeDomains: q.includeDomains } : {}),
        })
      )
    );

    const enrichment = {};

    // Parse salary benchmarks
    const salaryResults = results[0];
    if (salaryResults.status === 'fulfilled' && salaryResults.value.results?.length) {
      enrichment.salaryBenchmarks = extractHighlights(salaryResults.value.results, 3);
    }

    // Parse industry margins
    const marginResults = results[1];
    if (marginResults.status === 'fulfilled' && marginResults.value.results?.length) {
      enrichment.industryMargins = extractHighlights(marginResults.value.results, 3);
    }

    // Parse marketing benchmarks
    const marketingResults = results[2];
    if (marketingResults.status === 'fulfilled' && marketingResults.value.results?.length) {
      enrichment.marketingBenchmarks = extractHighlights(marketingResults.value.results, 3);
    }

    // Parse cost structure data
    const costResults = results[3];
    if (costResults.status === 'fulfilled' && costResults.value.results?.length) {
      enrichment.costBenchmarks = extractHighlights(costResults.value.results, 3);
    }

    // Parse rent / real estate data
    const rentResults = results[4];
    if (rentResults.status === 'fulfilled' && rentResults.value.results?.length) {
      enrichment.rentBenchmarks = extractHighlights(rentResults.value.results, 2);
    }

    return enrichment;

  } catch (err) {
    console.error('Exa search failed:', err.message);
    return {};
  }
}

/**
 * Build targeted search queries based on business context.
 */
function buildSearchQueries(industry, city, stage) {
  const base = industry.substring(0, 100); // Truncate for query
  const stageLabel = {
    idea: 'startup',
    early: 'early-stage startup',
    growth: 'growing company',
    scale: 'established company',
  }[stage] || 'startup';

  return [
    {
      query: `${base} industry salary benchmarks India ${city} 2024 2025`,
      numResults: 5,
    },
    {
      query: `${base} business profit margins unit economics India`,
      numResults: 5,
    },
    {
      query: `${base} ${stageLabel} marketing channels customer acquisition cost India`,
      numResults: 5,
    },
    {
      query: `${base} business cost structure operating expenses India`,
      numResults: 5,
    },
    {
      query: `commercial office rent per sqft ${city} India 2024 2025`,
      numResults: 3,
    },
  ];
}

/**
 * Extract the most relevant highlights from Exa search results.
 */
function extractHighlights(results, maxItems = 3) {
  const highlights = [];
  for (const r of results) {
    if (r.highlights && r.highlights.length > 0) {
      for (const h of r.highlights) {
        highlights.push({
          text: h.substring(0, 500),
          source: r.title || r.url,
        });
      }
    }
  }
  // Deduplicate and limit
  const seen = new Set();
  return highlights
    .filter(h => {
      const key = h.text.substring(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

/**
 * Summarize Exa enrichment data into a text block for the LLM prompt.
 */
export function formatEnrichmentForPrompt(enrichment) {
  if (!enrichment || Object.keys(enrichment).length === 0) {
    return '';
  }

  const sections = [];

  if (enrichment.salaryBenchmarks?.length) {
    sections.push('### Salary Benchmarks (from web research)');
    for (const b of enrichment.salaryBenchmarks) {
      sections.push(`- ${b.text} (Source: ${b.source})`);
    }
  }

  if (enrichment.industryMargins?.length) {
    sections.push('\n### Industry Margins & Unit Economics');
    for (const b of enrichment.industryMargins) {
      sections.push(`- ${b.text} (Source: ${b.source})`);
    }
  }

  if (enrichment.marketingBenchmarks?.length) {
    sections.push('\n### Marketing & CAC Benchmarks');
    for (const b of enrichment.marketingBenchmarks) {
      sections.push(`- ${b.text} (Source: ${b.source})`);
    }
  }

  if (enrichment.costBenchmarks?.length) {
    sections.push('\n### Operating Cost Benchmarks');
    for (const b of enrichment.costBenchmarks) {
      sections.push(`- ${b.text} (Source: ${b.source})`);
    }
  }

  if (enrichment.rentBenchmarks?.length) {
    sections.push('\n### Rent / Real Estate Benchmarks');
    for (const b of enrichment.rentBenchmarks) {
      sections.push(`- ${b.text} (Source: ${b.source})`);
    }
  }

  return sections.join('\n');
}
