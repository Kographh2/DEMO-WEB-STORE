import { supabase } from "@/lib/supabase";
type Schema = typeof supabase extends { schema: infer S } ? S : never;
type Tables = Schema extends { Tables: infer T } ? T : never;
type Follows = Tables extends { follows: infer F } ? F : never;
const x: Follows = {} as any;
