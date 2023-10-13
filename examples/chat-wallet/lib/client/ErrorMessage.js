import React from "react";
export const ErrorMessage = ({ error }) => {
    if (error === null) {
        return null;
    }
    else if (isErrorCode(error)) {
        return (React.createElement("p", null,
            error.name,
            ": ",
            error.code));
    }
    else {
        return (React.createElement("p", null,
            error.name,
            ": ",
            error.message));
    }
};
const isErrorCode = (error) => {
    return "code" in error;
};
