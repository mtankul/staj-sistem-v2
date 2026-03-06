//client/src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

import "antd/dist/reset.css";
import "./index.css";

import { AppConfigProvider } from "./context/AppConfigContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppConfigProvider>
      <App />
    </AppConfigProvider>
  </React.StrictMode>
);