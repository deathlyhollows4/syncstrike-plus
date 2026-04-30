export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  progress: number;
  deadline: string | null;
  scheduled_for: string | null;
  creator_id: string;
  assignee_id: string | null;
  team_id: string | null;
  completion_description: string | null;
  blocker_reason: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: {
    display_name: string | null;
    email: string;
  } | null;
}
