import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface WalkPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp: number;
}

export interface Walk {
  id: string;
  distance: number;
  duration: number;
  date: string;
  route: WalkPoint[];
  avgSpeed: number;
  maxSpeed: number;
  calories?: number;
  mode: 'walking' | 'running' | 'cycling' | 'hiking';
  points: number;
  accuracy: number;
  elevationGain?: number;
  elevationLoss?: number;
}

interface WalksState {
  history: Walk[];
  stats: {
    totalDistance: number;
    totalTime: number;
    totalWalks: number;
    longestWalk: number;
    fastestSpeed: number;
    walkingDistance: number;
    runningDistance: number;
    cyclingDistance: number;
    hikingDistance: number;
  };
}

const initialState: WalksState = {
  history: [],
  stats: {
    totalDistance: 0,
    totalTime: 0,
    totalWalks: 0,
    longestWalk: 0,
    fastestSpeed: 0,
    walkingDistance: 0,
    runningDistance: 0,
    cyclingDistance: 0,
    hikingDistance: 0,
  },
};

const walksSlice = createSlice({
  name: "walks",
  initialState,
  reducers: {
    addWalk: (state, action: PayloadAction<Walk>) => {
      const walk = action.payload;
      
      // Calcular calorias se não vier preenchido
      if (!walk.calories) {
        const hours = walk.duration / 3600;
        let calorieMultiplier = 1;
        
        switch(walk.mode) {
          case 'running': calorieMultiplier = 1.5; break;
          case 'cycling': calorieMultiplier = 2; break;
          case 'hiking': calorieMultiplier = 1.2; break;
          default: calorieMultiplier = 1;
        }
        
        walk.calories = Math.round(70 * 5 * hours * calorieMultiplier);
      }
      
      // Calcular elevação
      if (walk.route.length > 1) {
        let gain = 0;
        let loss = 0;
        
        for (let i = 1; i < walk.route.length; i++) {
          const prevAlt = walk.route[i-1].altitude;
          const currAlt = walk.route[i].altitude;
          
          if (prevAlt && currAlt) {
            const diff = currAlt - prevAlt;
            if (diff > 0) gain += diff;
            else loss += Math.abs(diff);
          }
        }
        
        walk.elevationGain = Math.round(gain);
        walk.elevationLoss = Math.round(loss);
      }
      
      state.history.unshift(walk);
      
      // Atualizar estatísticas gerais
      state.stats.totalDistance += walk.distance;
      state.stats.totalTime += walk.duration;
      state.stats.totalWalks += 1;
      state.stats.longestWalk = Math.max(state.stats.longestWalk, walk.distance);
      state.stats.fastestSpeed = Math.max(state.stats.fastestSpeed, walk.maxSpeed);
      
      // Atualizar estatísticas por modo
      switch(walk.mode) {
        case 'walking':
          state.stats.walkingDistance += walk.distance;
          break;
        case 'running':
          state.stats.runningDistance += walk.distance;
          break;
        case 'cycling':
          state.stats.cyclingDistance += walk.distance;
          break;
        case 'hiking':
          state.stats.hikingDistance += walk.distance;
          break;
      }
      
      if (state.history.length > 100) {
        state.history = state.history.slice(0, 100);
      }
    },
    
    removeWalk: (state, action: PayloadAction<string>) => {
      const walkId = action.payload;
      const walkIndex = state.history.findIndex(w => w.id === walkId);
      
      if (walkIndex !== -1) {
        const walk = state.history[walkIndex];
        
        // Recalcular estatísticas
        const remainingWalks = state.history.filter((_, i) => i !== walkIndex);
        
        state.stats = {
          totalDistance: remainingWalks.reduce((sum, w) => sum + w.distance, 0),
          totalTime: remainingWalks.reduce((sum, w) => sum + w.duration, 0),
          totalWalks: remainingWalks.length,
          longestWalk: remainingWalks.reduce((max, w) => Math.max(max, w.distance), 0),
          fastestSpeed: remainingWalks.reduce((max, w) => Math.max(max, w.maxSpeed), 0),
          walkingDistance: remainingWalks
            .filter(w => w.mode === 'walking')
            .reduce((sum, w) => sum + w.distance, 0),
          runningDistance: remainingWalks
            .filter(w => w.mode === 'running')
            .reduce((sum, w) => sum + w.distance, 0),
          cyclingDistance: remainingWalks
            .filter(w => w.mode === 'cycling')
            .reduce((sum, w) => sum + w.distance, 0),
          hikingDistance: remainingWalks
            .filter(w => w.mode === 'hiking')
            .reduce((sum, w) => sum + w.distance, 0),
        };
        
        state.history.splice(walkIndex, 1);
      }
    },
    
    clearHistory: (state) => {
      state.history = [];
      state.stats = initialState.stats;
    },
    
    updateWalk: (state, action: PayloadAction<{id: string, updates: Partial<Walk>}>) => {
      const { id, updates } = action.payload;
      const walkIndex = state.history.findIndex(w => w.id === id);
      
      if (walkIndex !== -1) {
        state.history[walkIndex] = {
          ...state.history[walkIndex],
          ...updates,
        };
      }
    },
  },
});

export const { addWalk, removeWalk, clearHistory, updateWalk } = walksSlice.actions;
export default walksSlice.reducer;