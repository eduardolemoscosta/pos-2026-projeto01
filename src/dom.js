/**
 * DOM Manipulation Module
 * Responsável por criar e atualizar os elementos visuais da interface (Cards, Filtros, Badges, Skeletons e Estados).
 */

import { formatName, formatPokemonId } from './pokeApi.js';
import { store } from './store.js';

// Mapa de cores e ícones por tipo
export const TYPE_COLORS = {
  normal: '#9FA19F',
  fire: '#E62829',
  water: '#2980EF',
  grass: '#3FA129',
  electric: '#FAC000',
  ice: '#3DCEF3',
  fighting: '#FF8000',
  poison: '#9141CB',
  ground: '#915121',
  flying: '#81B9EF',
  psychic: '#EF4179',
  bug: '#91A119',
  rock: '#AFA981',
  ghost: '#704170',
  dragon: '#5060E1',
  steel: '#60A1B8',
  dark: '#624D4E',
  fairy: '#EF70EF'
};

export const TYPE_LABELS_PT = {
  normal: 'Normal',
  fire: 'Fogo',
  water: 'Água',
  grass: 'Planta',
  electric: 'Elétrico',
  ice: 'Gelo',
  fighting: 'Lutador',
  poison: 'Veneno',
  ground: 'Terra',
  flying: 'Voador',
  psychic: 'Psíquico',
  bug: 'Inseto',
  rock: 'Pedra',
  ghost: 'Fantasma',
  dragon: 'Dragão',
  steel: 'Aço',
  dark: 'Sombrio',
  fairy: 'Fada'
};

/**
 * Cria a badge visual para um tipo de Pokémon
 */
export function createTypeBadge(typeName) {
  const badge = document.createElement('span');
  const cleanType = typeName.toLowerCase();
  badge.className = `type-badge type-${cleanType}`;
  badge.textContent = TYPE_LABELS_PT[cleanType] || formatName(cleanType);
  return badge;
}

/**
 * Cria o card individual de um Pokémon para o grid
 */
export function createPokemonCard(pokemon, onSelect) {
  const card = document.createElement('article');
  const primaryType = pokemon.types[0]?.name || 'normal';
  const isFav = store.isFavorite(pokemon.id);

  card.className = `pokemon-card type-card-${primaryType}`;
  card.setAttribute('data-id', pokemon.id);
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Ver detalhes de ${formatName(pokemon.name)}`);

  const artworkUrl =
    pokemon.sprites.artwork ||
    pokemon.sprites.frontDefault ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;

  card.innerHTML = `
    <div class="card-bg-glow"></div>
    <div class="card-header">
      <span class="card-number">${formatPokemonId(pokemon.id)}</span>
      <button class="card-fav-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Remover dos favoritos' : 'Favoritar'}" aria-label="Favoritar ${formatName(pokemon.name)}">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="${isFav ? '#e63946' : 'none'}" stroke="currentColor" stroke-width="2">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </button>
    </div>
    
    <div class="card-image-wrap">
      <img src="${artworkUrl}" alt="${pokemon.name}" loading="lazy" class="card-image" />
    </div>

    <div class="card-body">
      <h3 class="card-title">${formatName(pokemon.name)}</h3>
      <div class="card-types"></div>
    </div>
  `;

  // Inserir badges de tipos de forma segura
  const typesContainer = card.querySelector('.card-types');
  pokemon.types.forEach((t) => {
    typesContainer.appendChild(createTypeBadge(t.name));
  });

  // Evento de favoritar
  const favBtn = card.querySelector('.card-fav-btn');
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const active = store.toggleFavorite(pokemon.id);
    favBtn.classList.toggle('active', active);
    const svgPath = favBtn.querySelector('svg');
    if (active) {
      svgPath.setAttribute('fill', '#e63946');
    } else {
      svgPath.setAttribute('fill', 'none');
    }
  });

  // Evento de clique para abrir modal de detalhes
  card.addEventListener('click', () => {
    if (typeof onSelect === 'function') {
      onSelect(pokemon.id);
    }
  });

  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (typeof onSelect === 'function') {
        onSelect(pokemon.id);
      }
    }
  });

  return card;
}

/**
 * Renderiza o Grid de Cards
 */
export function renderPokemonGrid(container, pokemonList, onSelect, append = false) {
  if (!append) {
    container.innerHTML = '';
  }

  if (!pokemonList || pokemonList.length === 0) {
    if (!append) {
      renderEmptyState(container, 'Nenhum Pokémon encontrado com os filtros selecionados.');
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  pokemonList.forEach((pokemon) => {
    fragment.appendChild(createPokemonCard(pokemon, onSelect));
  });

  container.appendChild(fragment);
}

/**
 * Renderiza skeletons placeholders durante o carregamento
 */
export function renderSkeletons(container, count = 12, append = false) {
  if (!append) {
    container.innerHTML = '';
  }

  const skeletonContainer = document.createElement('div');
  skeletonContainer.className = 'skeletons-wrapper';

  for (let i = 0; i < count; i++) {
    const skel = document.createElement('div');
    skel.className = 'pokemon-card skeleton-card';
    skel.innerHTML = `
      <div class="skeleton-shimmer"></div>
      <div class="skeleton-line skeleton-number"></div>
      <div class="skeleton-circle"></div>
      <div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-badges">
        <div class="skeleton-badge"></div>
        <div class="skeleton-badge"></div>
      </div>
    `;
    skeletonContainer.appendChild(skel);
  }

  container.appendChild(skeletonContainer);
}

/**
 * Remove placeholders de skeleton
 */
export function clearSkeletons(container) {
  const skels = container.querySelectorAll('.skeletons-wrapper, .skeleton-card');
  skels.forEach((s) => s.remove());
}

/**
 * Renderiza o seletor de Gerações
 */
export function renderGenerationFilter(container, generations, onSelect) {
  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-chip active';
  allBtn.textContent = 'Todas as Gerações';
  allBtn.setAttribute('data-gen', 'all');
  allBtn.addEventListener('click', () => {
    setActiveChip(container, allBtn);
    onSelect(null);
  });
  container.appendChild(allBtn);

  generations.forEach((gen) => {
    const chip = document.createElement('button');
    chip.className = 'filter-chip';
    chip.innerHTML = `<span>${gen.name}</span> <small class="region-badge">${gen.region}</small>`;
    chip.setAttribute('data-gen', gen.id);
    chip.addEventListener('click', () => {
      setActiveChip(container, chip);
      onSelect(gen);
    });
    container.appendChild(chip);
  });
}

/**
 * Renderiza o seletor de Tipos
 */
export function renderTypeFilter(container, types, onSelect) {
  container.innerHTML = '';

  const allTypeBtn = document.createElement('button');
  allTypeBtn.className = 'filter-type-pill active';
  allTypeBtn.textContent = 'Todos os Tipos';
  allTypeBtn.setAttribute('data-type', 'all');
  allTypeBtn.addEventListener('click', () => {
    setActiveTypePill(container, allTypeBtn);
    onSelect(null);
  });
  container.appendChild(allTypeBtn);

  types.forEach((type) => {
    const pill = document.createElement('button');
    pill.className = `filter-type-pill type-${type.name}`;
    pill.textContent = TYPE_LABELS_PT[type.name] || formatName(type.name);
    pill.setAttribute('data-type', type.name);
    pill.addEventListener('click', () => {
      setActiveTypePill(container, pill);
      onSelect(type.name);
    });
    container.appendChild(pill);
  });
}

function setActiveChip(container, activeElement) {
  container.querySelectorAll('.filter-chip').forEach((el) => el.classList.remove('active'));
  activeElement.classList.add('active');
}

function setActiveTypePill(container, activeElement) {
  container.querySelectorAll('.filter-type-pill').forEach((el) => el.classList.remove('active'));
  activeElement.classList.add('active');
}

/**
 * Renderiza Estado Vazio
 */
export function renderEmptyState(container, message) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" stroke-dasharray="4 4"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
        </svg>
      </div>
      <h3>Nenhum resultado</h3>
      <p>${message}</p>
    </div>
  `;
}

/**
 * Renderiza Alerta de Erro
 */
export function renderError(container, message, onRetry) {
  container.innerHTML = `
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>Ops! Algo deu errado.</h3>
      <p>${message}</p>
      ${onRetry ? '<button class="retry-btn">Tentar Novamente</button>' : ''}
    </div>
  `;

  if (onRetry) {
    const btn = container.querySelector('.retry-btn');
    btn.addEventListener('click', onRetry);
  }
}
