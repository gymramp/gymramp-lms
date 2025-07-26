
// src/app/admin/programs/new/edit/page.tsx
// This file can act as a redirect or a shell for the real edit page.
// For simplicity, we'll make the real edit page handle the 'new' case.
import EditProgramPage from '../../[programId]/edit/page';

export default function NewProgramPage() {
  // The actual logic is in the dynamic route page.
  // We pass a placeholder param object to it.
  return <EditProgramPage />;
}
