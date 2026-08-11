import './style.css';
import { getPokemonWithDetails, getPokemonFullProfile } from './api.js';
import { renderApp, updatePokemonList, renderPokemonDetail, showLoading, showError } from './dom.js';

let pokemons = [];
let selectedPokemon = null;
let currentPage = 1;

function getOffset(page) {
  return (page - 1) * 24;
}

async function loadPokemonList(page = 1) {
  try {
    showLoading();
    currentPage = page;
    pokemons = await getPokemonWithDetails(24, getOffset(page));
    renderApp({
      pokemons,
      onSelect: handleSelectPokemon,
      onReload: handleReload,
      onPageChange: handlePageChange,
      page: currentPage,
    });
    selectedPokemon = pokemons[0] || null;
    updatePokemonList(pokemons, handleSelectPokemon, selectedPokemon?.id);
    if (selectedPokemon) {
      loadPokemonDetail(selectedPokemon);
    }
  } catch (error) {
    showError(error.message || 'Falha ao carregar a lista.');
  }
}

async function loadPokemonDetail(pokemon) {
  try {
    renderPokemonDetail(null);
    const profile = await getPokemonFullProfile(pokemon.detailUrl);
    renderPokemonDetail(profile);
    updatePokemonList(pokemons, handleSelectPokemon, pokemon.id);
  } catch (error) {
    showError(error.message || 'Falha ao carregar o perfil.');
  }
}

function handleSelectPokemon(pokemon) {
  selectedPokemon = pokemon;
  loadPokemonDetail(pokemon);
}

function handleReload() {
  loadPokemonList(currentPage);
}

function handlePageChange(page) {
  loadPokemonList(page);
}

loadPokemonList(currentPage);
