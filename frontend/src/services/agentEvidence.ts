import type { RankingEvidence, RankedSiteEvidence, ToolCallTrace } from '../types';

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): JsonRecord | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord : undefined;
const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const percentage = (value: unknown): number | undefined => {
  const parsed = number(value);
  return parsed !== undefined && parsed >= 0 && parsed <= 100 ? parsed : undefined;
};

/** Render facts from tool payloads only, never extract evidence from model prose. */
export function rankingEvidence(calls: ToolCallTrace[]): RankingEvidence[] {
  return calls.flatMap(call => {
    if (!['rank_cooling_center_sites', 'rank_cooling_sites'].includes(call.name)) return [];
    const output = record(call.output);
    if (!output || output.status !== 'OK' || output.error || output.error_code) return [];
    const family = call.name === 'rank_cooling_sites' ? 'planning' : 'atlanta';
    const rawSites = family === 'planning' ? output.sites : output.ranked_sites;
    if (!Array.isArray(rawSites) || rawSites.length === 0 || rawSites.length > 20) return [];
    const sites: RankedSiteEvidence[] = [];
    for (const raw of rawSites) {
      const site = record(raw);
      if (!site) return [];
      const coordinates = family === 'planning' ? record(site.coordinates) : site;
      const demographics = family === 'planning' ? record(site.demographics) : site;
      const tractId = family === 'planning' ? site.tract_geo_id : site.tract_id;
      const rank = number(site.rank);
      const latitude = number(coordinates?.latitude);
      const longitude = number(coordinates?.longitude);
      const offsetF = number(site.predicted_heat_offset_f);
      if (typeof tractId !== 'string' || !/^\d{11}$/.test(tractId)
        || rank === undefined || !Number.isInteger(rank) || rank < 1
        || latitude === undefined || latitude < -90 || latitude > 90
        || longitude === undefined || longitude < -180 || longitude > 180
        || offsetF === undefined) return [];
      const population = number(family === 'planning' ? demographics?.total_population : site.population);
      sites.push({
        rank, tractId, latitude, longitude, offsetF,
        population: population !== undefined && Number.isInteger(population) && population >= 0
          ? population : undefined,
        povertyPct: percentage(demographics?.poverty_rate_pct),
        noVehiclePct: percentage(demographics?.no_vehicle_rate_pct),
      });
    }
    if (new Set(sites.map(site => site.tractId)).size !== sites.length
      || new Set(sites.map(site => site.rank)).size !== sites.length) return [];
    const provenance = record(output.provenance);
    const model = provenance?.model ?? output.model_used;
    return [{
      family, model: typeof model === 'string' ? model : undefined,
      sites: sites.sort((a, b) => a.rank - b.rank),
    }];
  });
}

/** Match repeated/parallel calls by ADK ID rather than overwriting the first name match. */
export function parseAgentEvents(events: unknown): {
  responseText: string; toolCalls: ToolCallTrace[]; model?: string;
} {
  if (!Array.isArray(events)) throw new Error('Invalid agent response: expected an event list.');
  const toolCalls: ToolCallTrace[] = [];
  const texts: string[] = [];
  let model: string | undefined;
  for (const raw of events) {
    const event = record(raw);
    if (!event) throw new Error('Invalid agent event.');
    if (event.errorCode || event.error_code) {
      throw new Error('The model could not complete this request. Retry or contact the service operator.');
    }
    if (typeof event.modelVersion === 'string') model = event.modelVersion;
    const parts = record(event.content)?.parts;
    if (!Array.isArray(parts)) continue;
    for (const rawPart of parts) {
      const part = record(rawPart);
      if (!part) continue;
      if (typeof part.text === 'string' && !part.thought
        && event.author !== 'user' && !event.partial) texts.push(part.text);
      const call = record(part.functionCall);
      if (call && typeof call.name === 'string') {
        toolCalls.push({
          id: typeof call.id === 'string' ? call.id : undefined,
          name: call.name, arguments: record(call.args) ?? {},
        });
      }
      const response = record(part.functionResponse);
      if (response && typeof response.name === 'string') {
        const match = toolCalls.find(candidate => candidate.output === undefined
          && (typeof response.id === 'string'
            ? candidate.id === response.id : candidate.name === response.name));
        if (match) {
          match.output = record(response.response);
        }
      }
    }
  }
  const responseText = texts.join('\n\n').trim();
  if (!responseText && toolCalls.length === 0) throw new Error('The agent returned no answer or tool evidence.');
  return { responseText, toolCalls, model };
}
