import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
export const metadata: Metadata = { title: "Recuperar senha" };
export default function ForgotPasswordPage() { return <AuthForm mode="forgot" />; }
