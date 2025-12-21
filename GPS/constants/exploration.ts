import { Poi, ExplorationArea } from '@/types/map';

// Pontos de interesse pré-definidos (exemplo)
export const SAMPLE_POIS: Poi[] = [
  {
    id: '1',
    name: 'Mirante do Parque',
    category: 'viewpoint',
    coords: { latitude: -23.5505, longitude: -46.6333 },
    distance: 500,
    description: 'Vista panorâmica do parque',
    rating: 4.5,
  },
  {
    id: '2',
    name: 'Trilha das Árvores',
    category: 'natural',
    coords: { latitude: -23.5510, longitude: -46.6340 },
    distance: 800,
    description: 'Trilha com árvores centenárias',
    rating: 4.2,
  },
  {
    id: '3',
    name: 'Lago Central',
    category: 'natural',
    coords: { latitude: -23.5520, longitude: -46.6320 },
    distance: 1200,
    description: 'Lago com pedalinhos e patos',
    rating: 4.7,
  },
  {
    id: '4',
    name: 'Monumento Histórico',
    category: 'historic',
    coords: { latitude: -23.5495, longitude: -46.6350 },
    distance: 1500,
    description: 'Monumento do século XIX',
    rating: 4.0,
  },
  {
    id: '5',
    name: 'Café do Parque',
    category: 'restaurant',
    coords: { latitude: -23.5500, longitude: -46.6310 },
    distance: 600,
    description: 'Café com vista para o jardim',
    rating: 4.3,
  },
];

// Áreas de exploração
export const EXPLORATION_AREAS: ExplorationArea[] = [
  {
    id: 'area1',
    name: 'Setor Norte do Parque',
    coords: { latitude: -23.5505, longitude: -46.6333 },
    radius: 1000,
    pointsDiscovered: 0,
    totalPoints: 3,
  },
  {
    id: 'area2',
    name: 'Área Histórica',
    coords: { latitude: -23.5495, longitude: -46.6350 },
    radius: 800,
    pointsDiscovered: 0,
    totalPoints: 2,
  },
];