/**
 * Main Application Orchestrator
 * Ponto de entrada que inicializa a aplicação, conecta o wrapper de API ao estado e à DOM.
 */

import {
  getPokemonList,
  getPokemonDetail,
  getGenerations,
  getTypes,
  getTypeDetail,
  formatName
} from './src/pokeApi.js';
import { store } from './src/store.js';
import {
  renderPokemonGrid,
  renderSkeletons,
  clearSkeletons,
  renderGenerationFilter,
  renderTypeFilter,
  renderError,
  renderEmptyState
} from './src/dom.js';
import { initModal, openPokemonModal } from './src/modal.js';

// Elementos principais do DOM
let gridContainer;
let loadMoreBtn;
let searchInput;
let clearSearchBtn;
let genFilterContainer;
let typeFilterContainer;
let favoritesToggleBtn;
let resultsCounter;
let filterSummary;
let heroStatsCount;

// Controle de debounce da busca
let searchDebounceTimer = null;

/**
 * Inicialização do App
 */
async function initApp() {
  cacheDOMElements();
  initModal((pokemonId) => openPokemonModal(pokemonId));

  setupEventListeners();

  // Carregar filtros auxiliares e catálogo inicial em paralelo
  try {
    renderSkeletons(gridContainer, 24);

    const [generations, types] = await Promise.all([
      getGenerations().catch((e) => {
        console.warn('Erro ao carregar gerações:', e);
        return [];
      }),
      getTypes().catch((e) => {
        console.warn('Erro ao carregar tipos:', e);
        return [];
      })
    ]);

    if (generations.length > 0) {
      renderGenerationFilter(genFilterContainer, generations, handleGenerationSelect);
    }

    if (types.length > 0) {
      renderTypeFilter(typeFilterContainer, types, handleTypeSelect);
    }

    // Carregar primeiro lote da Pokédex
    await loadInitialCatalog();
  } catch (error) {
    console.error('Falha na inicialização:', error);
    renderError(gridContainer, 'Não foi possível conectar à PokeAPI. Verifique sua conexão.', () => initApp());
  }
}

/**
 * Cache dos elementos da página
 */
function cacheDOMElements() {
  gridContainer = document.getElementById('pokemon-grid');
  loadMoreBtn = document.getElementById('load-more-btn');
  searchInput = document.getElementById('search-input');
  clearSearchBtn = document.getElementById('clear-search-btn');
  genFilterContainer = document.getElementById('generation-filters');
  typeFilterContainer = document.getElementById('type-filters');
  favoritesToggleBtn = document.getElementById('favorites-toggle-btn');
  resultsCounter = document.getElementById('results-counter');
  filterSummary = document.getElementById('active-filter-badge');
  heroStatsCount = document.getElementById('hero-total-count');
}

/**
 * Registra ouvintes de eventos da interface
 */
function setupEventListeners() {
  // Busca em tempo real com debounce
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearSearchBtn?.classList.toggle('hidden', query.length === 0);

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      handleSearch(query);
    }, 350);
  });

  // Limpar busca
  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      handleSearch('');
    }
  });

  // Botão Carregar Mais
  loadMoreBtn?.addEventListener('click', () => {
    loadMorePokemon();
  });

  // Toggle Favoritos
  favoritesToggleBtn?.addEventListener('click', () => {
    handleFavoritesToggle();
  });

  // Reagir a mudanças de favoritos do Store
  store.subscribe((state) => {
    updateFavoritesBadge(state.favorites.length);
  });
}

/**
 * Carrega o catálogo padrão (Paginado)
 */
async function loadInitialCatalog() {
  store.setState({
    viewMode: 'catalog',
    offset: 0,
    pokemonList: [],
    isLoading: true,
    hasMore: true
  });

  updateFilterSummary('Catálogo Completo');
  renderSkeletons(gridContainer, 24);
  setLoadMoreVisible(false);

  try {
    const response = await getPokemonList(store.state.limit, 0);
    store.setState({
      pokemonList: response.results,
      offset: store.state.limit,
      totalCount: response.count,
      isLoading: false,
      hasMore: !!response.next
    });

    if (heroStatsCount) heroStatsCount.textContent = response.count;
    updateResultsCounter(response.results.length, response.count);

    renderPokemonGrid(gridContainer, response.results, (id) => openPokemonModal(id));
    setLoadMoreVisible(store.state.hasMore);
  } catch (error) {
    store.setState({ isLoading: false });
    renderError(gridContainer, 'Falha ao carregar Pokémon.', () => loadInitialCatalog());
  }
}

/**
 * Carrega a próxima página de Pokémon
 */
async function loadMorePokemon() {
  if (store.state.isLoading || !store.state.hasMore) return;

  const currentOffset = store.state.offset;
  store.setState({ isLoading: true });

  // Exibir skeletons de carregamento ao final do grid
  renderSkeletons(gridContainer, 12, true);
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Carregando...';
  }

  try {
    const response = await getPokemonList(store.state.limit, currentOffset);
    clearSkeletons(gridContainer);

    const newList = [...store.state.pokemonList, ...response.results];
    store.setState({
      pokemonList: newList,
      offset: currentOffset + store.state.limit,
      hasMore: !!response.next,
      isLoading: false
    });

    updateResultsCounter(newList.length, store.state.totalCount);
    renderPokemonGrid(gridContainer, response.results, (id) => openPokemonModal(id), true);

    setLoadMoreVisible(store.state.hasMore);
  } catch (error) {
    clearSkeletons(gridContainer);
    store.setState({ isLoading: false });
    console.error('Erro ao carregar mais:', error);
  } finally {
    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Carregar Mais Pokémon';
    }
  }
}

/**
 * Filtro por Geração
 */
async function handleGenerationSelect(gen) {
  // Limpar busca ativa
  if (searchInput) searchInput.value = '';
  clearSearchBtn?.classList.add('hidden');
  resetTypeFiltersUI();
  favoritesToggleBtn?.classList.remove('active');

  if (!gen) {
    await loadInitialCatalog();
    return;
  }

  store.setState({
    viewMode: 'generation',
    currentGeneration: gen,
    isLoading: true,
    pokemonList: [],
    hasMore: false
  });

  updateFilterSummary(`${gen.name} (${gen.region})`);
  renderSkeletons(gridContainer, 24);
  setLoadMoreVisible(false);

  try {
    const response = await getPokemonList(gen.limit, gen.offset);
    store.setState({
      pokemonList: response.results,
      totalCount: response.results.length,
      isLoading: false
    });

    updateResultsCounter(response.results.length, response.results.length);
    renderPokemonGrid(gridContainer, response.results, (id) => openPokemonModal(id));
  } catch (error) {
    store.setState({ isLoading: false });
    renderError(gridContainer, `Erro ao carregar Pokémon da ${gen.name}.`, () => handleGenerationSelect(gen));
  }
}

/**
 * Filtro por Tipo de Pokémon
 */
async function handleTypeSelect(typeName) {
  if (searchInput) searchInput.value = '';
  clearSearchBtn?.classList.add('hidden');
  resetGenerationFiltersUI();
  favoritesToggleBtn?.classList.remove('active');

  if (!typeName) {
    await loadInitialCatalog();
    return;
  }

  store.setState({
    viewMode: 'type',
    currentType: typeName,
    isLoading: true,
    pokemonList: [],
    hasMore: false
  });

  updateFilterSummary(`Tipo: ${formatName(typeName)}`);
  renderSkeletons(gridContainer, 24);
  setLoadMoreVisible(false);

  try {
    const typeDetail = await getTypeDetail(typeName);
    const pokemonToFetch = typeDetail.pokemonList.slice(0, 48); // Carregar primeiros 48 daquele tipo

    const detailedPokemons = await Promise.all(
      pokemonToFetch.map(async (p) => {
        try {
          return await getPokemonDetail(p.name);
        } catch {
          return null;
        }
      })
    );

    const validPokemons = detailedPokemons.filter(Boolean);

    store.setState({
      pokemonList: validPokemons,
      totalCount: typeDetail.pokemonList.length,
      isLoading: false
    });

    updateResultsCounter(validPokemons.length, typeDetail.pokemonList.length);
    renderPokemonGrid(gridContainer, validPokemons, (id) => openPokemonModal(id));
  } catch (error) {
    store.setState({ isLoading: false });
    renderError(gridContainer, `Erro ao filtrar tipo ${typeName}.`, () => handleTypeSelect(typeName));
  }
}

/**
 * Manipulação da Busca
 */
async function handleSearch(query) {
  if (!query) {
    if (store.state.viewMode === 'catalog') {
      renderPokemonGrid(gridContainer, store.state.pokemonList, (id) => openPokemonModal(id));
      updateResultsCounter(store.state.pokemonList.length, store.state.totalCount);
      setLoadMoreVisible(store.state.hasMore);
    } else if (store.state.viewMode === 'generation') {
      handleGenerationSelect(store.state.currentGeneration);
    } else if (store.state.viewMode === 'type') {
      handleTypeSelect(store.state.currentType);
    } else if (store.state.viewMode === 'favorites') {
      loadFavoritesView();
    }
    return;
  }

  const cleanQuery = query.toLowerCase().trim();
  setLoadMoreVisible(false);

  // 1. Filtrar nos pokémons já carregados em memória
  const localMatches = store.state.pokemonList.filter(
    (p) => p.name.toLowerCase().includes(cleanQuery) || String(p.id) === cleanQuery
  );

  if (localMatches.length > 0) {
    updateFilterSummary(`Busca: "${query}"`);
    updateResultsCounter(localMatches.length, localMatches.length);
    renderPokemonGrid(gridContainer, localMatches, (id) => openPokemonModal(id));
    return;
  }

  // 2. Se não encontrar localmente, consultar diretamente na API
  renderSkeletons(gridContainer, 4);
  updateFilterSummary(`Buscando "${query}" na PokeAPI...`);

  try {
    const directResult = await getPokemonDetail(cleanQuery);
    updateFilterSummary(`Resultado da Busca: "${query}"`);
    updateResultsCounter(1, 1);
    renderPokemonGrid(gridContainer, [directResult], (id) => openPokemonModal(id));
  } catch {
    updateFilterSummary(`Busca: "${query}"`);
    updateResultsCounter(0, 0);
    renderEmptyState(gridContainer, `Nenhum Pokémon encontrado com o termo "${query}". Tente buscar por nome ou número exato (ex: 25 ou pikachu).`);
  }
}

/**
 * Exibir Pokémons Favoritados
 */
async function handleFavoritesToggle() {
  const isNowActive = favoritesToggleBtn?.classList.toggle('active');

  if (!isNowActive) {
    await loadInitialCatalog();
    return;
  }

  resetGenerationFiltersUI();
  resetTypeFiltersUI();
  if (searchInput) searchInput.value = '';
  clearSearchBtn?.classList.add('hidden');

  await loadFavoritesView();
}

async function loadFavoritesView() {
  store.setState({
    viewMode: 'favorites',
    isLoading: true,
    hasMore: false
  });

  updateFilterSummary('Meus Favoritos ❤️');
  setLoadMoreVisible(false);

  const favoriteIds = store.state.favorites;

  if (favoriteIds.length === 0) {
    store.setState({ isLoading: false, pokemonList: [] });
    updateResultsCounter(0, 0);
    renderEmptyState(gridContainer, 'Você ainda não adicionou nenhum Pokémon aos favoritos. Clique no coração de qualquer card para favoritá-lo!');
    return;
  }

  renderSkeletons(gridContainer, favoriteIds.length);

  try {
    const favPokemons = await Promise.all(
      favoriteIds.map(async (id) => {
        try {
          return await getPokemonDetail(id);
        } catch {
          return null;
        }
      })
    );

    const validFavs = favPokemons.filter(Boolean);
    store.setState({
      pokemonList: validFavs,
      totalCount: validFavs.length,
      isLoading: false
    });

    updateResultsCounter(validFavs.length, validFavs.length);
    renderPokemonGrid(gridContainer, validFavs, (id) => openPokemonModal(id));
  } catch (error) {
    store.setState({ isLoading: false });
    renderError(gridContainer, 'Erro ao carregar favoritos.', () => loadFavoritesView());
  }
}

/**
 * Utilitários visuais de controle
 */
function updateResultsCounter(showing, total) {
  if (resultsCounter) {
    resultsCounter.innerHTML = `Exibindo <strong>${showing}</strong> de <strong>${total}</strong> Pokémon`;
  }
}

function updateFilterSummary(text) {
  if (filterSummary) {
    filterSummary.textContent = text;
  }
}

function updateFavoritesBadge(count) {
  const badge = document.getElementById('fav-count-badge');
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('has-items', count > 0);
  }
}

function setLoadMoreVisible(visible) {
  if (loadMoreBtn) {
    loadMoreBtn.classList.toggle('hidden', !visible);
  }
}

function resetGenerationFiltersUI() {
  genFilterContainer?.querySelectorAll('.filter-chip').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-gen') === 'all');
  });
}

function resetTypeFiltersUI() {
  typeFilterContainer?.querySelectorAll('.filter-type-pill').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-type') === 'all');
  });
}

// Iniciar a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initApp);
