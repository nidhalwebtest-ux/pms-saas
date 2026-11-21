import FullMessagesProvider from "@/components/FullMessagesProvider";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <FullMessagesProvider>{children}</FullMessagesProvider>;
}
