import FullMessagesProvider from "@/components/FullMessagesProvider";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <FullMessagesProvider>{children}</FullMessagesProvider>;
}
