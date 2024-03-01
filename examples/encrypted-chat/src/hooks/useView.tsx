import React, { useState } from 'react';

export enum VIEWS {
  Login = "LOGIN",
  Dashboard = "DASHBOARD"
}

export const useView = () => {
  const [view, setView] = useState(VIEWS.Login);

  console.log('using view!', view)

  return {view, setView};
};