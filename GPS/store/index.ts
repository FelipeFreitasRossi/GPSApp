import { configureStore } from "@reduxjs/toolkit";
import walksReducer from "./walkSlice";

export const store = configureStore({
  reducer: {
    walks: walksReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
