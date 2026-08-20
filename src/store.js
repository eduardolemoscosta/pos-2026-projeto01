const STORAGE_FAVORITES_KEY = 'pokedex_favorites_v1';

class Store {
  constructor() {
    this.state = {
      viewMode: 'catalog', 
      currentGeneration: null,
      currentType: null,
      searchQuery: '',
      offset: 0,
      limit: 24,
      totalCount: 0,
      pokemonList: [],
      activePokemonDetail: null,
      isLoading: false,
      hasMore: true,
      favorites: this.loadFavorites()
    };

    this.listeners = [];
  }

  getState() {
    return { ...this.state };
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  loadFavorites() {
    try {
      const saved = localStorage.getItem(STORAGE_FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('Não foi possível carregar favoritos do localStorage', e);
      return [];
    }
  }

  saveFavorites(favorites) {
    try {
      localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.warn('Não foi possível salvar favoritos no localStorage', e);
    }
  }

  toggleFavorite(pokemonId) {
    const id = Number(pokemonId);
    let updated;
    if (this.state.favorites.includes(id)) {
      updated = this.state.favorites.filter((favId) => favId !== id);
    } else {
      updated = [...this.state.favorites, id];
    }

    this.saveFavorites(updated);
    this.setState({ favorites: updated });
    return updated.includes(id);
  }

  isFavorite(pokemonId) {
    return this.state.favorites.includes(Number(pokemonId));
  }

  resetPagination() {
    this.state.offset = 0;
    this.state.pokemonList = [];
    this.state.hasMore = true;
  }
}

export const store = new Store();
