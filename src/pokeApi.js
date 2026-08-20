const BASE_URL = 'https://pokeapi.co/api/v2';
const cache = new Map();

async function fetchWithCache(endpoint) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  if (cache.has(url)) {
    return cache.get(url);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText} ao consultar ${url}`);
    }
    const data = await response.json();
    cache.set(url, data);
    return data;
  } catch (error) {
    console.error(`[PokeAPI Wrapper Error] Falha ao buscar: ${url}`, error);
    throw error;
  }
}

export async function getPokemonList(limit = 24, offset = 0) {
  const data = await fetchWithCache(`/pokemon?limit=${limit}&offset=${offset}`);

  const detailedList = await Promise.all(
    data.results.map(async (p) => {
      try {
        return await getPokemonDetail(p.name);
      } catch (err) {
        return {
          id: extractIdFromUrl(p.url),
          name: p.name,
          sprites: { front_default: null },
          types: []
        };
      }
    })
  );

  return {
    count: data.count,
    next: data.next,
    previous: data.previous,
    results: detailedList
  };
}

export async function getPokemonDetail(idOrName) {
  const cleanId = String(idOrName).toLowerCase().trim();
  const data = await fetchWithCache(`/pokemon/${cleanId}`);

  return {
    id: data.id,
    name: data.name,
    height: data.height / 10, 
    weight: data.weight / 10, 
    baseExperience: data.base_experience,
    types: data.types.map((t) => ({
      slot: t.slot,
      name: t.type.name,
      url: t.type.url
    })),
    stats: data.stats.map((s) => ({
      name: s.stat.name,
      base: s.base_stat,
      effort: s.effort
    })),
    abilities: data.abilities.map((a) => ({
      name: a.ability.name,
      url: a.ability.url,
      isHidden: a.is_hidden,
      slot: a.slot
    })),
    sprites: {
      frontDefault: data.sprites.front_default,
      frontShiny: data.sprites.front_shiny,
      artwork: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default,
      artworkShiny: data.sprites.other?.['official-artwork']?.front_shiny || data.sprites.front_shiny,
      showdown: data.sprites.other?.showdown?.front_default || null
    },
    cries: {
      latest: data.cries?.latest || null,
      legacy: data.cries?.legacy || null
    },
    speciesUrl: data.species.url
  };
}

export async function getPokemonSpecies(idOrName) {
  const cleanId = String(idOrName).toLowerCase().trim();
  const data = await fetchWithCache(`/pokemon-species/${cleanId}`);

  const flavorTextEntry =
    data.flavor_text_entries?.find((entry) => entry.language.name === 'pt' || entry.language.name === 'pt-BR') ||
    data.flavor_text_entries?.find((entry) => entry.language.name === 'en');

  const genusEntry =
    data.genera?.find((g) => g.language.name === 'pt' || g.language.name === 'pt-BR') ||
    data.genera?.find((g) => g.language.name === 'en');

  return {
    id: data.id,
    name: data.name,
    color: data.color?.name || 'gray',
    flavorText: flavorTextEntry ? flavorTextEntry.flavor_text.replace(/[\n\f]/g, ' ') : 'Nenhuma descrição disponível.',
    genus: genusEntry ? genusEntry.genus : 'Pokémon',
    captureRate: data.capture_rate,
    baseHappiness: data.base_happiness,
    isLegendary: data.is_legendary,
    isMythical: data.is_mythical,
    genderRate: data.gender_rate, 
    growthRate: data.growth_rate?.name || 'médio',
    habitat: data.habitat?.name || 'desconhecido',
    evolutionChainUrl: data.evolution_chain?.url || null
  };
}

export async function getEvolutionChain(urlOrId) {
  const endpoint = String(urlOrId).startsWith('http')
    ? urlOrId
    : `/evolution-chain/${urlOrId}/`;

  const data = await fetchWithCache(endpoint);

  const stages = [];

  async function parseChain(node, fromName = null, details = null) {
    if (!node || !node.species) return;

    const speciesName = node.species.name;
    const speciesId = extractIdFromUrl(node.species.url);

    let triggerInfo = null;
    if (details && details.length > 0) {
      const d = details[0];
      if (d.min_level) triggerInfo = `Nv. ${d.min_level}`;
      else if (d.item) triggerInfo = formatName(d.item.name);
      else if (d.min_happiness) triggerInfo = `Felicidade ${d.min_happiness}`;
      else if (d.trigger?.name === 'trade') triggerInfo = 'Troca';
      else if (d.held_item) triggerInfo = `Segurando ${formatName(d.held_item.name)}`;
      else if (d.time_of_day) triggerInfo = `${d.time_of_day === 'day' ? 'Dia' : 'Noite'}`;
      else if (d.known_move) triggerInfo = `Golpe ${formatName(d.known_move.name)}`;
      else if (d.location) triggerInfo = `Local ${formatName(d.location.name)}`;
      else triggerInfo = formatName(d.trigger?.name || 'Evolução Especial');
    }

    stages.push({
      id: speciesId,
      name: speciesName,
      from: fromName,
      trigger: triggerInfo,
      image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`,
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${speciesId}.png`
    });

    if (node.evolves_to && node.evolves_to.length > 0) {
      for (const nextNode of node.evolves_to) {
        await parseChain(nextNode, speciesName, nextNode.evolution_details);
      }
    }
  }

  await parseChain(data.chain);
  return stages;
}

export async function getGenerations() {
  const data = await fetchWithCache('/generation');
  const generationMap = {
    'generation-i': { name: 'Geração I', region: 'Kanto', offset: 0, limit: 151 },
    'generation-ii': { name: 'Geração II', region: 'Johto', offset: 151, limit: 100 },
    'generation-iii': { name: 'Geração III', region: 'Hoenn', offset: 251, limit: 135 },
    'generation-iv': { name: 'Geração IV', region: 'Sinnoh', offset: 386, limit: 107 },
    'generation-v': { name: 'Geração V', region: 'Unova', offset: 493, limit: 156 },
    'generation-vi': { name: 'Geração VI', region: 'Kalos', offset: 649, limit: 72 },
    'generation-vii': { name: 'Geração VII', region: 'Alola', offset: 721, limit: 88 },
    'generation-viii': { name: 'Geração VIII', region: 'Galar', offset: 809, limit: 96 },
    'generation-ix': { name: 'Geração IX', region: 'Paldea', offset: 905, limit: 120 }
  };

  return data.results.map((gen, idx) => {
    const meta = generationMap[gen.name] || {
      name: `Geração ${idx + 1}`,
      region: 'Desconhecida',
      offset: 0,
      limit: 100
    };
    return {
      id: idx + 1,
      apiName: gen.name,
      name: meta.name,
      region: meta.region,
      offset: meta.offset,
      limit: meta.limit
    };
  });
}

export async function getTypes() {
  const data = await fetchWithCache('/type');

  const validTypes = data.results.filter(
    (t) => !['unknown', 'shadow', 'stellar'].includes(t.name)
  );

  return validTypes.map((t) => ({
    name: t.name,
    url: t.url
  }));
}

export async function getTypeDetail(typeName) {
  const data = await fetchWithCache(`/type/${typeName.toLowerCase()}`);
  return {
    name: data.name,
    damageRelations: data.damage_relations,
    pokemonList: data.pokemon.map((p) => ({
      name: p.pokemon.name,
      url: p.pokemon.url,
      id: extractIdFromUrl(p.pokemon.url)
    }))
  };
}

export async function calculateTypeMatchups(pokemonTypes) {
  const multipliers = {};
  const allTypes = [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice',
    'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
    'rock', 'ghost', 'dragon', 'steel', 'dark', 'fairy'
  ];

  allTypes.forEach((t) => {
    multipliers[t] = 1;
  });

  for (const typeObj of pokemonTypes) {
    const typeDetail = await getTypeDetail(typeObj.name);
    const rel = typeDetail.damageRelations;

    rel.double_damage_from?.forEach((t) => {
      if (multipliers[t.name] !== undefined) multipliers[t.name] *= 2;
    });

    rel.half_damage_from?.forEach((t) => {
      if (multipliers[t.name] !== undefined) multipliers[t.name] *= 0.5;
    });

    rel.no_damage_from?.forEach((t) => {
      if (multipliers[t.name] !== undefined) multipliers[t.name] = 0;
    });
  }

  const weaknesses = [];
  const resistances = [];
  const immunities = [];

  Object.entries(multipliers).forEach(([type, mult]) => {
    if (mult > 1) weaknesses.push({ type, multiplier: mult });
    else if (mult === 0) immunities.push({ type, multiplier: mult });
    else if (mult < 1) resistances.push({ type, multiplier: mult });
  });

  return {
    weaknesses: weaknesses.sort((a, b) => b.multiplier - a.multiplier),
    resistances: resistances.sort((a, b) => a.multiplier - b.multiplier),
    immunities
  };
}

export async function getAbilityDetail(nameOrId) {
  const cleanId = String(nameOrId).toLowerCase().trim();
  const data = await fetchWithCache(`/ability/${cleanId}`);

  const effectEntry =
    data.effect_entries?.find((e) => e.language.name === 'en') ||
    data.flavor_text_entries?.find((e) => e.language.name === 'en');

  return {
    id: data.id,
    name: data.name,
    shortEffect: effectEntry?.short_effect || effectEntry?.flavor_text || 'Efeito não catalogado.',
    fullEffect: effectEntry?.effect || effectEntry?.flavor_text || 'Efeito não catalogado.'
  };
}

export function extractIdFromUrl(url) {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? parseInt(match[1], 10) : null;
}

export function formatName(name) {
  if (!name) return '';
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatPokemonId(id) {
  return `#${String(id).padStart(4, '0')}`;
}
