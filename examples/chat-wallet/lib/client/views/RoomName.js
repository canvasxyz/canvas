import React, { useContext, useMemo } from "react";
import { useEnsName } from "wagmi";
import { getAddress } from "viem";
import { AppContext } from "../AppContext.js";
const EnsName = ({ address }) => {
    const { data: name } = useEnsName({ address });
    if (name) {
        return React.createElement("span", null, name);
    }
    else {
        const head = address.slice(0, 6);
        const tail = address.slice(-4);
        return (React.createElement("span", null,
            head,
            "\u2026",
            tail));
    }
};
export const RoomName = ({ room }) => {
    const { user } = useContext(AppContext);
    const otherRoomMembers = useMemo(() => user && room.members.filter(({ address }) => getAddress(address) !== user.address), [room, user]);
    if (otherRoomMembers) {
        return (React.createElement("span", null, otherRoomMembers.map((member, index) => (React.createElement(React.Fragment, { key: member.address },
            React.createElement(EnsName, { address: member.address }),
            index < otherRoomMembers.length - 1 && ", ")))));
    }
    else {
        return null;
    }
};
