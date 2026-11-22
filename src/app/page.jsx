import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard"); // the middleware redirects to /login if the user is not logged in
}
