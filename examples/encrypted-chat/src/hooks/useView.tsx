import React, { useState } from 'react';

export enum VIEWS {
  Login = "LOGIN",
  Dashboard = "DASHBOARD"
}

export const useView = () => {
  const [view, setView] = useState(VIEWS.Login);

  return {view, setView};
};