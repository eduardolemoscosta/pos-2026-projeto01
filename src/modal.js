import {
  getPokemonDetail,
  getPokemonSpecies,
  getEvolutionChain,
  calculateTypeMatchups,
  getAbilityDetail,
  formatName,
  formatPokemonId
} from './pokeApi.js';
import { createTypeBadge, TYPE_LABELS_PT } from './dom.js';

let modalElement = null;
let currentPokemonId = null;
let onSelectPokemonCallback = null;

const STAT_NAMES_PT = {
  hp: 'HP',
  attack: 'Ataque',
  defense: 'Defesa',
  'special-attack': 'Atq. Especial',
  'special-defense': 'Def. Especial',
  speed: 'Velocidade'
};

export function initModal(onSelectPokemon) {
  onSelectPokemonCallback = onSelectPokemon;

  modalElement = document.getElementById('pokemon-modal');
  if (!modalElement) {
    modalElement = document.createElement('div');
    modalElement.id = 'pokemon-modal';
    modalElement.className = 'modal-backdrop hidden';
    modalElement.setAttribute('role', 'dialog');
    modalElement.setAttribute('aria-modal', 'true');
    document.body.appendChild(modalElement);
  }

  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement || e.target.closest('.modal-close-btn')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalElement.classList.contains('hidden')) {
      closeModal();
    }
  });
}

export function closeModal() {
  if (modalElement) {
    modalElement.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }
}

export async function openPokemonModal(pokemonIdOrName) {
  if (!modalElement) initModal(onSelectPokemonCallback);

  modalElement.classList.remove('hidden');
  document.body.classList.add('modal-open');

  modalElement.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-loader">
        <div class="pokeball-spinner"></div>
        <p>Acessando dados da Pokédex...</p>
      </div>
    </div>
  `;

  try {

    const pokemon = await getPokemonDetail(pokemonIdOrName);
    currentPokemonId = pokemon.id;

    let species = null;
    try {
      species = await getPokemonSpecies(pokemon.id);
    } catch (e) {
      console.warn('Espécie não encontrada ou dados limitados:', e);
    }

    let evolutionStages = [];
    if (species && species.evolutionChainUrl) {
      try {
        evolutionStages = await getEvolutionChain(species.evolutionChainUrl);
      } catch (e) {
        console.warn('Cadeia evolutiva indisponível:', e);
      }
    }

    let typeMatchups = { weaknesses: [], resistances: [], immunities: [] };
    try {
      typeMatchups = await calculateTypeMatchups(pokemon.types);
    } catch (e) {
      console.warn('Erro ao calcular relações de tipo:', e);
    }

    const detailedAbilities = await Promise.all(
      pokemon.abilities.map(async (a) => {
        try {
          const detail = await getAbilityDetail(a.name);
          return { ...a, ...detail };
        } catch {
          return { ...a, shortEffect: 'Efeito não disponível' };
        }
      })
    );

    renderModalContent({
      pokemon,
      species,
      evolutionStages,
      typeMatchups,
      detailedAbilities
    });
  } catch (error) {
    console.error('Erro ao carregar dados do modal:', error);
    modalElement.innerHTML = `
      <div class="modal-dialog error-state">
        <button class="modal-close-btn" aria-label="Fechar">&times;</button>
        <h3>Erro ao carregar detalhes</h3>
        <p>Não foi possível obter todas as informações deste Pokémon.</p>
        <button class="retry-btn" id="modal-retry-btn">Tentar Novamente</button>
      </div>
    `;
    modalElement.querySelector('#modal-retry-btn')?.addEventListener('click', () => {
      openPokemonModal(pokemonIdOrName);
    });
  }
}

function renderModalContent({ pokemon, species, evolutionStages, typeMatchups, detailedAbilities }) {
  const primaryType = pokemon.types[0]?.name || 'normal';
  const artworkUrl =
    pokemon.sprites.artwork ||
    pokemon.sprites.frontDefault ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;

  const totalStats = pokemon.stats.reduce((acc, curr) => acc + curr.base, 0);

  modalElement.innerHTML = `
    <div class="modal-dialog type-theme-${primaryType}">
      <header class="modal-header">
        <div class="modal-nav-bar">
          <button class="modal-nav-btn prev-btn" title="Pokémon Anterior" ${pokemon.id <= 1 ? 'disabled' : ''}>
            &#8592; #${String(pokemon.id - 1).padStart(4, '0')}
          </button>
          <button class="modal-close-btn" aria-label="Fechar modal">&times;</button>
          <button class="modal-nav-btn next-btn" title="Próximo Pokémon">
            #${String(pokemon.id + 1).padStart(4, '0')} &#8594;
          </button>
        </div>

        <div class="modal-hero">
          <div class="hero-info">
            <span class="hero-id">${formatPokemonId(pokemon.id)}</span>
            <h2 class="hero-name">${formatName(pokemon.name)}</h2>
            <p class="hero-genus">${species?.genus || 'Pokémon'}</p>
            <div class="hero-types"></div>
          </div>

          <div class="hero-media">
            <div class="hero-circle-glow"></div>
            <img src="${artworkUrl}" alt="${pokemon.name}" class="hero-image" />

            ${pokemon.cries?.latest ? `
              <button class="audio-cry-btn" title="Ouvir som característico (Cry)">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
                <span>Ouvir Cry</span>
              </button>
            ` : ''}
          </div>
        </div>
      </header>

      <!-- Abas de Navegação dos Múltiplos Níveis -->
      <nav class="modal-tabs" role="tablist">
        <button class="modal-tab-btn active" data-tab="tab-overview" role="tab" aria-selected="true">
          Sobre & Atributos
        </button>
        <button class="modal-tab-btn" data-tab="tab-evolutions" role="tab" aria-selected="false">
          Evoluções (${evolutionStages.length})
        </button>
        <button class="modal-tab-btn" data-tab="tab-details" role="tab" aria-selected="false">
          Habilidades & Efetividade
        </button>
      </nav>

      <!-- Conteúdo das Abas -->
      <div class="modal-body">

        <!-- ABA 1: Visão Geral e Estatísticas (Nível 2) -->
        <section id="tab-overview" class="tab-pane active" role="tabpanel">

          <!-- Descrição da Pokédex -->
          <div class="overview-section">
            <p class="flavor-quote">"${species?.flavorText || 'Descrição não disponível.'}"</p>
          </div>

          <!-- Métricas Físicas -->
          <div class="metrics-grid">
            <div class="metric-card">
              <span class="metric-label">Altura</span>
              <span class="metric-val">${pokemon.height} m</span>
              <small class="metric-sub">${(pokemon.height * 3.28084).toFixed(1)} ft</small>
            </div>
            <div class="metric-card">
              <span class="metric-label">Peso</span>
              <span class="metric-val">${pokemon.weight} kg</span>
              <small class="metric-sub">${(pokemon.weight * 2.20462).toFixed(1)} lbs</small>
            </div>
            <div class="metric-card">
              <span class="metric-label">Felicidade Base</span>
              <span class="metric-val">${species?.baseHappiness ?? 'N/A'}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">Taxa de Captura</span>
              <span class="metric-val">${species?.captureRate ? `${((species.captureRate / 255) * 100).toFixed(0)}%` : 'N/A'}</span>
            </div>
          </div>

          <!-- Gráfico de Barras de Estatísticas Base -->
          <div class="stats-section">
            <div class="section-title-wrap">
              <h4>Estatísticas Base</h4>
              <span class="total-stats-badge">Total: <strong>${totalStats}</strong></span>
            </div>

            <div class="stats-list">
              ${pokemon.stats
                .map((stat) => {
                  const percentage = Math.min(100, (stat.base / 200) * 100);
                  const statLabel = STAT_NAMES_PT[stat.name] || formatName(stat.name);
                  let statClass = 'stat-med';
                  if (stat.base < 50) statClass = 'stat-low';
                  else if (stat.base >= 100) statClass = 'stat-high';

                  return `
                    <div class="stat-row">
                      <span class="stat-name">${statLabel}</span>
                      <span class="stat-number">${stat.base}</span>
                      <div class="stat-bar-bg">
                        <div class="stat-bar-fill ${statClass}" style="width: ${percentage}%;"></div>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </section>

        <!-- ABA 2: Cadeia de Evolução Completa (Nível 3) -->
        <section id="tab-evolutions" class="tab-pane" role="tabpanel">
          <div class="evolution-container">
            <h4>Linha Evolutiva Completa</h4>
            <p class="evolution-sub">Clique em qualquer estágio para navegar diretamente para o Pokémon.</p>

            ${
              evolutionStages.length <= 1
                ? '<div class="single-stage-alert">Este Pokémon não possui estágios de evolução conhecidos.</div>'
                : `
                <div class="evolution-flow">
                  ${evolutionStages
                    .map((stage, idx) => {
                      const isCurrent = stage.id === pokemon.id;
                      return `
                        ${
                          idx > 0 && stage.trigger
                            ? `<div class="evolution-arrow">
                                <span class="arrow-trigger">${stage.trigger}</span>
                                <span class="arrow-symbol">&#10140;</span>
                               </div>`
                            : ''
                        }
                        <div class="evolution-stage-card ${isCurrent ? 'current-stage' : ''}" data-id="${stage.id}" role="button" tabindex="0">
                          <img src="${stage.image}" alt="${stage.name}" class="stage-image" />
                          <span class="stage-id">${formatPokemonId(stage.id)}</span>
                          <span class="stage-name">${formatName(stage.name)}</span>
                          ${isCurrent ? '<span class="current-badge">Atual</span>' : ''}
                        </div>
                      `;
                    })
                    .join('')}
                </div>
              `
            }
          </div>
        </section>

        <!-- ABA 3: Habilidades & Relações de Tipo (Nível 3) -->
        <section id="tab-details" class="tab-pane" role="tabpanel">

          <!-- Habilidades Detalhadas -->
          <div class="abilities-section">
            <h4>Habilidades Especiais</h4>
            <div class="abilities-list">
              ${detailedAbilities
                .map(
                  (ab) => `
                <div class="ability-card ${ab.isHidden ? 'hidden-ability' : ''}">
                  <div class="ability-header">
                    <span class="ability-title">${formatName(ab.name)}</span>
                    ${ab.isHidden ? '<span class="hidden-pill">Habilidade Oculta</span>' : ''}
                  </div>
                  <p class="ability-desc">${ab.shortEffect}</p>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- Relações de Tipo: Fraquezas e Resistências -->
          <div class="matchups-section">
            <h4>Efetividade de Dano Recebido</h4>

            <div class="matchup-block">
              <span class="matchup-title weakness">❌ Fraquezas (Recebe Mais Dano)</span>
              <div class="matchup-badges">
                ${
                  typeMatchups.weaknesses.length > 0
                    ? typeMatchups.weaknesses
                        .map(
                          (w) => `
                      <div class="type-matchup-item type-${w.type}">
                        <span>${TYPE_LABELS_PT[w.type] || formatName(w.type)}</span>
                        <span class="mult-tag">${w.multiplier}x</span>
                      </div>
                    `
                        )
                        .join('')
                    : '<span class="neutral-text">Sem fraquezas especiais</span>'
                }
              </div>
            </div>

            <div class="matchup-block">
              <span class="matchup-title resistance">🛡️ Resistências (Recebe Menos Dano)</span>
              <div class="matchup-badges">
                ${
                  typeMatchups.resistances.length > 0
                    ? typeMatchups.resistances
                        .map(
                          (r) => `
                      <div class="type-matchup-item type-${r.type}">
                        <span>${TYPE_LABELS_PT[r.type] || formatName(r.type)}</span>
                        <span class="mult-tag">${r.multiplier}x</span>
                      </div>
                    `
                        )
                        .join('')
                    : '<span class="neutral-text">Nenhuma resistência adicional</span>'
                }
              </div>
            </div>

            ${
              typeMatchups.immunities.length > 0
                ? `
              <div class="matchup-block">
                <span class="matchup-title immunity">✨ Imunidades (Dano Zero)</span>
                <div class="matchup-badges">
                  ${typeMatchups.immunities
                    .map(
                      (im) => `
                    <div class="type-matchup-item type-${im.type}">
                      <span>${TYPE_LABELS_PT[im.type] || formatName(im.type)}</span>
                      <span class="mult-tag">0x</span>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
                : ''
            }
          </div>
        </section>

      </div>
    </div>
  `;

  const typesContainer = modalElement.querySelector('.hero-types');
  pokemon.types.forEach((t) => {
    typesContainer.appendChild(createTypeBadge(t.name));
  });

  const cryBtn = modalElement.querySelector('.audio-cry-btn');
  if (cryBtn && pokemon.cries?.latest) {
    cryBtn.addEventListener('click', () => {
      const audio = new Audio(pokemon.cries.latest);
      audio.volume = 0.5;
      audio.play().catch((err) => console.warn('Erro ao reproduzir áudio:', err));
    });
  }

  const prevBtn = modalElement.querySelector('.prev-btn');
  const nextBtn = modalElement.querySelector('.next-btn');

  if (prevBtn && pokemon.id > 1) {
    prevBtn.addEventListener('click', () => {
      openPokemonModal(pokemon.id - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      openPokemonModal(pokemon.id + 1);
    });
  }

  const tabBtns = modalElement.querySelectorAll('.modal-tab-btn');
  const tabPanes = modalElement.querySelectorAll('.tab-pane');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');

      tabBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const targetPane = modalElement.querySelector(`#${targetTabId}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  const stageCards = modalElement.querySelectorAll('.evolution-stage-card');
  stageCards.forEach((card) => {
    card.addEventListener('click', () => {
      const stageId = card.getAttribute('data-id');
      if (stageId && Number(stageId) !== pokemon.id) {
        openPokemonModal(stageId);
      }
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const stageId = card.getAttribute('data-id');
        if (stageId && Number(stageId) !== pokemon.id) {
          openPokemonModal(stageId);
        }
      }
    });
  });
}
