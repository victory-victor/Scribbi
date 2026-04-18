import React from "react";
import "./App.css"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Join from "./pages/Join";
import Room from "./pages/Room";
import ProtectedRoute from "./pages/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Join />} />
        <Route
        path="/room"
        element={
          <ProtectedRoute>
            <Room />
          </ProtectedRoute>
        }
      />
      </Routes>
    </Router>
  );
}

export default App;