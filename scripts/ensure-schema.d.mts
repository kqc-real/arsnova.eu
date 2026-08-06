export const DEFAULT_DATABASE_URL: string;

export function shouldSeedMotdRuntime(nodeEnv: string | undefined): boolean;
export function shouldSeedMotdMakingOfRuntime(nodeEnv: string | undefined): boolean;
export function shouldSeedMotdFeatureRuntime(nodeEnv: string | undefined): boolean;

export function getMotdWelcomeSeedFiles(): string[];
export function getMotdMakingOfSeedFiles(): string[];
export function getMotdFeatureSeedFiles(): string[];

export function seedMotdWelcomeSql(): void;
export function seedMotdMakingOfSql(): void;
export function seedMotdFeatureSql(): void;
