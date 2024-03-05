import { useState } from "react";
import { LoginOptions, LoginSelect } from "./Login-Select";
import { LoginBurner } from "./Login-Burner";
import { LoginMetamask } from "./Login-Metamask";

import { LOGIN_TYPES } from '../types/login';

export const LoginView: React.FC = () => {
  const [selected, setSelected] = useState(LoginOptions[0])

  return (
    <>
      <LoginSelect selected={selected} setSelected={setSelected} />

      { selected.type === LOGIN_TYPES.Burner && 
        <LoginBurner />
      }
      { selected.type === LOGIN_TYPES.Metamask && 
        <LoginMetamask />    
      }
    </>
  )
};