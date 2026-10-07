import type { DatabaseSync } from "node:sqlite";
import type { Express } from "express";
export interface FactoryContext {
  db: DatabaseSync;
  app: Express;
  nowMs(): number;
  runInTransaction(fn: () => void): void;
  broadcast?: (type: string, payload: unknown) => void;
}
export interface FactoryRouteOptions {
  validateFinalApproval?: (planId: string) => void;
  startPlan?: (planId: string) => Promise<{ started: boolean; blockedReason?: string }>;
  onApprovalResolved?: (planId: string) => Promise<void>;
}
export class FactoryError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
