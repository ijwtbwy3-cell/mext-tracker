import { AppShell } from "@/components/AppShell";
import { TasksScreen } from "@/screens/TasksScreen";

export default function Page() {
  return (
    <AppShell>
      <TasksScreen />
    </AppShell>
  );
}
