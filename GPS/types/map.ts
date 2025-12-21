// Adicione ao final do arquivo existente

// Tipos para o modo Exploração
export interface Poi {
  id: string;
  name: string;
  category: 'landmark' | 'natural' | 'historic' | 'viewpoint' | 'restaurant' | 'other';
  coords: {
    latitude: number;
    longitude: number;
  };
  distance: number; // Distância em metros do usuário
  description?: string;
  rating?: number;
  visited?: boolean;
}

export interface ExplorationArea {
  id: string;
  name: string;
  coords: {
    latitude: number;
    longitude: number;
  };
  radius: number; // Raio em metros
  pointsDiscovered: number;
  totalPoints: number;
}

// Tipos para o modo Fitness
export interface FitnessGoal {
  type: 'distance' | 'time' | 'calories' | 'steps';
  target: number;
  current: number;
  unit: string;
  achieved: boolean;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  type: 'interval' | 'endurance' | 'speed' | 'recovery';
  duration: number; // Em minutos
  distance?: number; // Em metros
  intervals?: {
    type: 'work' | 'rest';
    duration: number;
    targetSpeed?: number;
  }[];
  completed: boolean;
}