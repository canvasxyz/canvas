import type { Model } from "./models.js";
export declare type AppStatusStarting = {
    status: "starting";
};
export declare type AppStatusFailed = {
    status: "failed";
    error: string;
};
export declare type AppStatusRunning = {
    status: "running";
    models: Record<string, Model>;
    actionParameters: Record<string, string[]>;
};
export declare type AppStatus = AppStatusStarting | AppStatusFailed | AppStatusRunning;
