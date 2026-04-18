import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const isJoined = localStorage.getItem("joined");

  if (!isJoined) {
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;