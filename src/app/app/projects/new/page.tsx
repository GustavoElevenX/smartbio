import { redirect } from "next/navigation";

export default function NewProjectPage() {
  redirect("/app/onboarding/ai?new=1");
}
