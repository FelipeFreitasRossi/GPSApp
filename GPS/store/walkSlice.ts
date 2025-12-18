import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Walk {
  id: string;
  distance: number;
  date: string;
  route: { latitude: number; longitude: number }[];
}

interface WalksState {
  history: Walk[];
}

const initialState: WalksState = {
  history: [],
};

const walksSlice = createSlice({
  name: "walks",
  initialState,
  reducers: {
    addWalk: (state: { history: any[]; }, action: PayloadAction<Walk>) => {
      state.history.push(action.payload);
    },
  },
});

export const { addWalk } = walksSlice.actions;
export default walksSlice.reducer;
