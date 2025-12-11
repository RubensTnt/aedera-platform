// src/App.tsx
import React from "react";
import { AppRoutes } from "./app/AppRoutes";
import { ProjectProvider } from "./core/projects/ProjectContext";

const App: React.FC = () => {
  return (
    <ProjectProvider>
      <AppRoutes />
    </ProjectProvider>
  );
};

export default App;
