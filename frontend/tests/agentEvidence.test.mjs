import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

async function load(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  });
  for (const [specifier, target] of Object.entries(imports)) {
    outputText = outputText.replace(`'${specifier}'`, JSON.stringify(target));
  }
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  return { url, module: await import(url) };
}

const evidence = await load('../src/services/agentEvidence.ts');
const { parseAgentEvents, rankingEvidence } = evidence.module;
const { module: { agentApi } } = await load('../src/services/agentApi.ts', {
  './agentEvidence': evidence.url,
});
const site = {
  rank: 1, tract_id: '13121006802', latitude: 33.70429, longitude: -84.36097,
  predicted_heat_offset_f: 0.53, population: 2040,
  poverty_rate_pct: 78.1, no_vehicle_rate_pct: 60.2,
};
const atlanta = output => [{ name: 'rank_cooling_center_sites', arguments: {}, output }];

test('rendered cards link exact coordinates to Google Maps and show a provider-independent fallback', async () => {
  const { module: { RecommendationCards } } = await load('../src/components/RecommendationCards.tsx', {
    react: import.meta.resolve('react'),
    'lucide-react': import.meta.resolve('lucide-react'),
  });
  const [ranking] = rankingEvidence(atlanta({ status: 'OK', ranked_sites: [site] }));
  const html = renderToStaticMarkup(React.createElement(RecommendationCards, {
    evidence: ranking, isMock: false, disabled: false, onAudit: () => {},
  }));
  assert.ok(html.includes('https://www.google.com/maps/search/?api=1&amp;query=33.70429%2C-84.36097'));
  assert.ok(html.includes('33.70429, -84.36097'));
  assert.ok(html.includes('Open in Google Maps'));
  assert.ok(html.includes('target="_blank" rel="noopener noreferrer"'));
  assert.ok(!html.includes('openstreetmap.org'));
});

test('Atlanta cards preserve tool values without interpreting narrative', () => {
  const [ranking] = rankingEvidence(atlanta({
    status: 'OK', ranked_sites: [site], provenance: { model: 'p.d.atlanta' },
  }));
  assert.equal(ranking.family, 'atlanta');
  assert.equal(ranking.model, 'p.d.atlanta');
  assert.equal(ranking.sites[0].offsetF, 0.53);
  assert.equal(ranking.sites[0].noVehiclePct, 60.2);
});

test('planning cards read their own nested schema without changing percentage units', () => {
  const [ranking] = rankingEvidence([{
    name: 'rank_cooling_sites', arguments: {}, output: {
      status: 'OK', model_used: 'p.d.planning', sites: [{
        rank: 1, tract_geo_id: site.tract_id,
        coordinates: { latitude: site.latitude, longitude: site.longitude },
        predicted_heat_offset_f: 1.79,
        demographics: { total_population: 3943, poverty_rate_pct: 48.6, no_vehicle_rate_pct: 56.4 },
      }],
    },
  }]);
  assert.equal(ranking.family, 'planning');
  assert.equal(ranking.sites[0].povertyPct, 48.6);
  assert.equal(ranking.sites[0].population, 3943);
});

test('errors, legacy status-less output, invalid IDs/numbers and partial sets do not generate cards', () => {
  for (const output of [
    { status: 'ERROR', ranked_sites: [site] },
    { ranked_sites: [site] },
    { status: 'OK', error: 'failure', ranked_sites: [site] },
    { status: 'OK', ranked_sites: [] },
    { status: 'OK', ranked_sites: [site, { ...site, tract_id: 'bad' }] },
    { status: 'OK', ranked_sites: [{ ...site, predicted_heat_offset_f: NaN }] },
    { status: 'OK', ranked_sites: [{ ...site, latitude: '33.7' }] },
    { status: 'OK', ranked_sites: [site, site] },
    { status: 'OK', ranked_sites: [{ ...site, rank: 1.5 }] },
  ]) assert.deepEqual(rankingEvidence(atlanta(output)), []);
});

test('missing demographics remain absent, not zero; genuine zero remains zero', () => {
  const [ranking] = rankingEvidence(atlanta({
    status: 'OK', ranked_sites: [{
      ...site, population: null, poverty_rate_pct: 0, no_vehicle_rate_pct: 101,
    }],
  }));
  assert.equal(ranking.sites[0].population, undefined);
  assert.equal(ranking.sites[0].povertyPct, 0);
  assert.equal(ranking.sites[0].noVehiclePct, undefined);
});

test('parallel/repeated tool responses match by call ID, and thoughts/partials are not answers', () => {
  const response = parseAgentEvents([
    { author: 'user', content: { parts: [{ text: 'do not echo' }] } },
    { partial: true, content: { parts: [{ text: 'partial' }] } },
    { content: { parts: [
      { functionCall: { id: 'a', name: 'rank_cooling_sites', args: {} } },
      { functionCall: { id: 'b', name: 'rank_cooling_sites', args: {} } },
      { text: 'hidden reasoning', thought: true },
    ] } },
    { content: { parts: [
      { functionResponse: { id: 'b', name: 'rank_cooling_sites', response: { status: 'ERROR' } } },
      { functionResponse: { id: 'a', name: 'rank_cooling_sites', response: { status: 'OK' } } },
      { text: 'Final answer' },
    ] } },
  ]);
  assert.equal(response.responseText, 'Final answer');
  assert.equal(response.toolCalls[0].output.status, 'OK');
  assert.equal(response.toolCalls[1].output.status, 'ERROR');
});

test('invalid/empty responses and model errors surface explicitly', () => {
  for (const response of [{}, [], [{ errorCode: 'UNAVAILABLE' }], [null]]) {
    assert.throws(() => parseAgentEvents(response));
  }
});

test('live session and /run failures never silently return simulated recommendations', async () => {
  const original = globalThis.fetch;
  try {
    agentApi.setEndpoint('https://agent.example');
    globalThis.fetch = async () => new Response('fail', { status: 500 });
    await assert.rejects(agentApi.runAgent('sites'), /create agent session/);
    let request = 0;
    globalThis.fetch = async () => ++request === 1
      ? new Response(JSON.stringify({ id: 'session' }))
      : new Response('fail', { status: 500 });
    await assert.rejects(agentApi.runAgent('sites'), /No simulated results/);
    globalThis.fetch = async () => { throw new Error('network unavailable'); };
    const mock = await agentApi.runAgent('sites', { useMockFallback: true });
    assert.equal(mock.source, 'mock');
  } finally {
    globalThis.fetch = original;
  }
});
