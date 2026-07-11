import { BrowserRouter, Route, Routes } from "react-router";

import { HomeView } from "./features/home/HomeView.tsx";
import { RoomRoute } from "./features/session/RoomRoute.tsx";

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/room/:code" element={<RoomRoute />} />
        <Route path="*" element={<HomeView />} />
      </Routes>
    </BrowserRouter>
  );
}
