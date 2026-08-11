const API_BASE = 'https://pokeapi.co/api/v2';

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao buscar dados: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function getPokemonList(limit = 24, offset = 0) {
  const url = `${API_BASE}/pokemon?limit=${limit}&offset=${offset}`;
  return fetchJson(url);
}

export async function getPokemonDetail(url) {
  return fetchJson(url);
}

export async function getPokemonSpecies(speciesUrl) {
  return fetchJson(speciesUrl);
}

export async function getEvolutionChain(chainUrl) {
  return fetchJson(chainUrl);
}

export async function getPokemonWithDetails(limit = 24, offset = 0) {
  const listData = await getPokemonList(limit, offset);
  const details = await Promise.all(
    listData.results.map(async (item) => {
      const detail = await getPokemonDetail(item.url);
      return {
        name: detail.name,
        id: detail.id,
        sprite: detail.sprites.front_default,
        types: detail.types.map((entry) => entry.type.name),
        abilities: detail.abilities.map((entry) => entry.ability.name),
        stats: detail.stats.map((stat) => ({
          name: stat.stat.name,
          value: stat.base_stat,
        })),
        speciesUrl: detail.species.url,
        detailUrl: item.url,
      };
    })
  );
  return details;
}

export async function getPokemonFullProfile(detailUrl) {
  const detail = await getPokemonDetail(detailUrl);
  const species = await getPokemonSpecies(detail.species.url);
  const evolution = species.evolution_chain
    ? await getEvolutionChain(species.evolution_chain.url)
    : null;

  return {
    id: detail.id,
    name: detail.name,
    sprite: detail.sprites.other['official-artwork'].front_default || detail.sprites.front_default,
    types: detail.types.map((entry) => entry.type.name),
    abilities: detail.abilities.map((entry) => entry.ability.name),
    moves: detail.moves.slice(0, 8).map((entry) => entry.move.name),
    stats: detail.stats.map((stat) => ({
      name: stat.stat.name,
      value: stat.base_stat,
    })),
    speciesName: species.name,
    flavorText: species.flavor_text_entries.find((entry) => entry.language.name === 'en')?.flavor_text.replace(/\n|\f/g, ' ') || '',
    evolutionChain: evolution ? extractEvolutionNames(evolution.chain) : [],
  };
}

function extractEvolutionNames(chain) {
  const names = [];
  let current = chain;
  while (current) {
    names.push(current.species.name);
    current = current.evolves_to?.[0] || null;
  }
  return names;
}
