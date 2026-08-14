/**
 * PokeAPI Wrapper Module
 * Encapsula todas as chamadas HTTP para a PokeAPI v2 com cache em memória,
 * tratamento de erros e suporte a múltiplos níveis de entidades (Pokemons, Espécies,
 * Cadeias Evolutivas, Gerações, Tipos e Habilidades).
 */

const BASE_URL = 'https://pokeapi.co/api/v2';
const cache = new Map();

/**
 * Utilitário interno para fetch com cache em memória
 */
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

/**
 * Nível 1: Listagem Paginada de Pokémon
 * Retorna uma lista de Pokémon com seus dados essenciais já pré-carregados
 */
export async function getPokemonList(limit = 24, offset = 0) {
  const data = await fetchWithCache(`/pokemon?limit=${limit}&offset=${offset}`);
  
  // Buscar detalhes resumidos de cada pokemon em paralelo para obter sprites e tipos
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

/**
 * Nível 2: Detalhes Completos do Pokémon
 */
export async function getPokemonDetail(idOrName) {
  const cleanId = String(idOrName).toLowerCase().trim();
  const data = await fetchWithCache(`/pokemon/${cleanId}`);

  // Normalização e extração de dados relevantes
  return {
    id: data.id,
    name: data.name,
    height: data.height / 10, // Converter para metros (decímetros -> m)
    weight: data.weight / 10, // Converter para kg (hectogramas -> kg)
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

/**
 * Nível 2/3: Dados da Espécie (Descrição, Categoria, Habitat, Taxa de Captura, etc.)
 */
export async function getPokemonSpecies(idOrName) {
  const cleanId = String(idOrName).toLowerCase().trim();
  const data = await fetchWithCache(`/pokemon-species/${cleanId}`);

  // Buscar descrição em português ou fallback para inglês
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
    genderRate: data.gender_rate, // -1 = sem gênero, taxa em oitavos para fêmeas
    growthRate: data.growth_rate?.name || 'médio',
    habitat: data.habitat?.name || 'desconhecido',
    evolutionChainUrl: data.evolution_chain?.url || null
  };
}

/**
 * Nível 3: Cadeia de Evolução Completa
 * Processa a árvore aninhada da PokeAPI em um array linear de estágios com gatilhos
 */
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

    // Extrair gatilho de evolução (nível, pedra, amizade, troca, etc.)
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

/**
 * Nível 1 & 3: Lista e Detalhes de Gerações / Regiões
 */
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

/**
 * Nível 1 & 3: Lista de Tipos de Pokémon
 */
export async function getTypes() {
  const data = await fetchWithCache('/type');
  // Filtrar tipos especiais ou sem pokémons comuns (ex: stellar, unknown, shadow)
  const validTypes = data.results.filter(
    (t) => !['unknown', 'shadow', 'stellar'].includes(t.name)
  );

  return validTypes.map((t) => ({
    name: t.name,
    url: t.url
  }));
}

/**
 * Nível 3: Obter Pokémons por Tipo e Relações de Dano (Fraquezas e Imunidades)
 */
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

/**
 * Nível 3: Calcular Fraquezas, Resistências e Imunidades combinadas para os tipos do Pokémon
 */
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

    // Dano dobrado recebido
    rel.double_damage_from?.forEach((t) => {
      if (multipliers[t.name] !== undefined) multipliers[t.name] *= 2;
    });
    // Metade do dano recebido
    rel.half_damage_from?.forEach((t) => {
      if (multipliers[t.name] !== undefined) multipliers[t.name] *= 0.5;
    });
    // Sem dano recebido (imunidade)
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

/**
 * Nível 3: Detalhes de Habilidade
 */
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

/**
 * Utilitários auxiliares de formatação
 */
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
