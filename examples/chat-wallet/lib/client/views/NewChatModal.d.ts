import React from "react";
import { PrivateUserRegistration } from "../../shared/index.js";
export interface NewChatModalProps {
    creator: PrivateUserRegistration;
    onClose: () => void;
}
export declare const NewChatModal: ({ creator, onClose }: NewChatModalProps) => React.JSX.Element;
