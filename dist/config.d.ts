export interface Config {
    apiUrl: string;
    token: string;
    tokenId: string;
}
export declare function getConfig(): Partial<Config>;
export declare function saveConfig(config: Config): void;
export declare function clearConfig(): void;
export declare function requireToken(): string;
//# sourceMappingURL=config.d.ts.map