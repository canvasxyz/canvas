import React from "react";
import { PrivateUserRegistration } from "../../shared/index.js";
interface RegistrationViewProps {
    setUser: (user: PrivateUserRegistration) => void;
}
export declare const RegistrationView: ({ setUser }: RegistrationViewProps) => React.JSX.Element;
export {};
