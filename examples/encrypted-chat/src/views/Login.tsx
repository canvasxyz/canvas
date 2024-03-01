import { useState } from "react";
import { LoginOptions, LoginSelect } from "./Login-Select";
import { LoginBurner } from "./Login-Burner";
import { LoginMetamask } from "./Login-Metamask";

export enum LOGIN_TYPES {
  Burner = "burner",
  Metamask = "metamask",
}

export const LoginView: React.FC = () => {
  const [selected, setSelected] = useState(LoginOptions[0])

  return (
    <>
      <LoginSelect selected={selected} setSelected={setSelected} />
      { selected.id === LOGIN_TYPES.Burner && 
        <LoginBurner />
      }
      { selected.id === LOGIN_TYPES.Metamask && 
        <LoginMetamask />    
      }
    </>
  )
};