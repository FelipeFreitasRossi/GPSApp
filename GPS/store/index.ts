// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import walksReducer from './walkSlice';

export const store = configureStore({
  reducer: {
    walks: walksReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['walks/addWalk'],
        ignoredPaths: ['walks.history.route'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;