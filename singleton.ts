import { jest, beforeEach } from "@jest/globals";
import { DeepMockProxy, mockDeep, mockReset } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";
import { db } from "./src/db/index";


jest.mock("./src/db/index.ts", () => ({
   __esModule: true,
   default: mockDeep<PrismaClient>(),
   db: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
   mockReset(prismaMock);
});

export const prismaMock = db as unknown as DeepMockProxy<PrismaClient>;
