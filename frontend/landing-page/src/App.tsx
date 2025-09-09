import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "@/components/landing/LandingPage";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  </BrowserRouter>
);

export default App;