import type { Database } from "@/types/database";

type GenericSchema = {
  Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
  Views: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
  Functions: Record<string, { Args: Record<string, unknown> | never; Returns: unknown }>;
};

type Test = Database["public"] extends GenericSchema ? true : false;
const x: Test = true;
