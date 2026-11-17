export const hashPassword = async (password: string) => `test:${password}`;

export const verifyPassword = async (password: string, hash: string) => hash === `test:${password}`;
