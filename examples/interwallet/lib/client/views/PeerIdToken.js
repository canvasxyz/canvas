import React, { useCallback } from "react";
import { ReactComponent as copyIcon } from "../../../icons/copy.svg";
export const PeerIdToken = (props) => {
    const id = props.peerId.toString();
    const text = props.compact ? `…${id.slice(-6)}` : id;
    const classNames = [
        "p-1 inline-flex items-center gap-1 bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300",
    ];
    if (props.className) {
        classNames.push(props.className);
    }
    const handleClick = useCallback(() => {
        navigator.clipboard.writeText(id);
    }, [id]);
    return (React.createElement("button", { className: classNames.join(" "), onClick: handleClick },
        props.children,
        React.createElement("span", { className: "whitespace-pre text-sm font-mono" }, text),
        copyIcon({ width: 24, height: 24 })));
};
