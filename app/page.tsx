import { redirect } from "next/navigation";

/* The front door is the marketplace. It used to send every visitor to the
   admin sign-in, which is the staff console and not somewhere a collector
   who typed the address should land. The console is still at /admin. */
export default function Home() {
  redirect("/market");
}
