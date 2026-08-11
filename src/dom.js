const ELEMENTS = {
  app: document.getElementById('app'),
};

export function renderApp({ pokemons, onSelect, onReload, onPageChange, page }) {
  ELEMENTS.app.innerHTML = '';
  const header = document.createElement('header');
  header.innerHTML = `
    <div>
      <h1>API Pokémon</h1>
      <p>Lista de pokémon e detalhes em múltiplos níveis.</p>
    </div>
    <div class="controls">
      <button type="button" id="reloadButton">Recarregar</button>
      <label for="pageSelect">Página</label>
      <select id="pageSelect">
        ${[1, 2, 3, 4].map((pageIndex) => `<option value="${pageIndex}" ${pageIndex === page ? 'selected' : ''}>${pageIndex}</option>`).join('')}
      </select>
    </div>
  `;

  const main = document.createElement('main');
  main.innerHTML = `
    <section class="pokemon-list" id="pokemonList">
      <h2>Pokémon</h2>
      <div class="pokemon-items"></div>
    </section>
    <section class="pokemon-detail" id="pokemonDetail">
      <h2>Selecione um pokémon</h2>
      <p>Os detalhes completos aparecem aqui.</p>
    </section>
  `;

  ELEMENTS.app.append(header, main);

  const reloadButton = document.getElementById('reloadButton');
  const pageSelect = document.getElementById('pageSelect');
  reloadButton.addEventListener('click', () => onReload());
  pageSelect.addEventListener('change', (event) => onPageChange(Number(event.target.value)));

  updatePokemonList(pokemons, onSelect);
}

export function updatePokemonList(pokemons, onSelect, selectedId = null) {
  const list = document.querySelector('.pokemon-items');
  list.innerHTML = '';

  pokemons.forEach((pokemon) => {
    const item = document.createElement('div');
    item.className = 'pokemon-item';
    if (pokemon.id === selectedId) {
      item.classList.add('selected');
    }
    item.innerHTML = `
      <span>#${pokemon.id.toString().padStart(3, '0')} ${pokemon.name}</span>
      <span>${pokemon.types.join(', ')}</span>
    `;
    item.addEventListener('click', () => onSelect(pokemon));
    list.appendChild(item);
  });
}

export function renderPokemonDetail(profile) {
  const detail = document.getElementById('pokemonDetail');
  if (!profile) {
    detail.innerHTML = `
      <h2>Selecione um pokémon</h2>
      <p>Os detalhes completos aparecem aqui.</p>
    `;
    return;
  }

  detail.innerHTML = `
    <h2>${profile.name} (#${profile.id})</h2>
    <div class="badge-row">
      ${profile.types.map((type) => `<span class="badge">Tipo: ${type}</span>`).join('')}
      ${profile.abilities.map((ability) => `<span class="badge">Habilidade: ${ability}</span>`).join('')}
    </div>
    <img src="${profile.sprite}" alt="${profile.name}" width="180" height="180" loading="lazy" />
    <section>
      <h3>Sobre</h3>
      <p>${profile.flavorText}</p>
    </section>
    <section>
      <h3>Estatísticas</h3>
      <div class="badge-row">
        ${profile.stats.map((stat) => `<span class="badge">${stat.name}: ${stat.value}</span>`).join('')}
      </div>
    </section>
    <section>
      <h3>Movimentos</h3>
      <div class="badge-row">
        ${profile.moves.map((move) => `<span class="badge">${move}</span>`).join('')}
      </div>
    </section>
    <section>
      <h3>Cadeia de evolução</h3>
      <div class="badge-row">
        ${profile.evolutionChain.length > 0 ? profile.evolutionChain.map((name) => `<span class="badge">${name}</span>`).join('') : '<span class="badge">Sem evolução registrada</span>'}
      </div>
    </section>
  `;
}

export function showLoading() {
  ELEMENTS.app.innerHTML = '<p>Carregando dados do PokeAPI...</p>';
}

export function showError(message) {
  ELEMENTS.app.innerHTML = `<div class="error"><strong>Erro:</strong> ${message}</div>`;
}
