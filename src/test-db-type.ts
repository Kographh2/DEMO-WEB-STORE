import type { Database } from "@/types/database";
type FollowsTable = Database["public"]["Tables"]["follows"];
const x: FollowsTable["Insert"] = { follower_id: "test", following_id: "test2" };
