import { FitnessGoal, WorkoutPlan } from '@/types/map';

// Metas de fitness pré-definidas
export const FITNESS_GOALS: FitnessGoal[] = [
  {
    type: 'distance',
    target: 5000,
    current: 0,
    unit: 'metros',
    achieved: false,
  },
  {
    type: 'time',
    target: 1800,
    current: 0,
    unit: 'segundos',
    achieved: false,
  },
  {
    type: 'calories',
    target: 300,
    current: 0,
    unit: 'calorias',
    achieved: false,
  },
  {
    type: 'steps',
    target: 10000,
    current: 0,
    unit: 'passos',
    achieved: false,
  },
];

// Planos de treino
export const WORKOUT_PLANS: WorkoutPlan[] = [
  {
    id: 'plan1',
    name: 'Caminhada Iniciante',
    type: 'endurance',
    duration: 30,
    distance: 3000,
    completed: false,
  },
  {
    id: 'plan2',
    name: 'Treino Intervalado',
    type: 'interval',
    duration: 25,
    intervals: [
      { type: 'work', duration: 300, targetSpeed: 1.4 },
      { type: 'rest', duration: 60 },
      { type: 'work', duration: 300, targetSpeed: 1.4 },
      { type: 'rest', duration: 60 },
      { type: 'work', duration: 300, targetSpeed: 1.4 },
    ],
    completed: false,
  },
  {
    id: 'plan3',
    name: 'Queima de Calorias',
    type: 'speed',
    duration: 20,
    distance: 2000,
    completed: false,
  },
  {
    id: 'plan4',
    name: 'Caminhada de Recuperação',
    type: 'recovery',
    duration: 40,
    distance: 4000,
    completed: false,
  },
];

// Estatísticas do usuário
export const USER_STATS = {
  totalDistance: 0,
  totalTime: 0,
  totalCalories: 0,
  totalWorkouts: 0,
  longestStreak: 0,
  currentStreak: 0,
};

// Níveis de conquistas
export const ACHIEVEMENTS = [
  { id: 'first_walk', name: 'Primeiros Passos', description: 'Complete sua primeira caminhada', achieved: false },
  { id: '5k', name: '5K Walker', description: 'Ande 5km em uma única sessão', achieved: false },
  { id: 'marathon', name: 'Maratonista', description: 'Acumule 42km de caminhada', achieved: false },
  { id: 'early_bird', name: 'Madrugador', description: 'Faça uma caminhada antes das 6h', achieved: false },
  { id: 'weekend_warrior', name: 'Guerreiro do Fim de Semana', description: 'Complete 5 caminhadas no fim de semana', achieved: false },
];