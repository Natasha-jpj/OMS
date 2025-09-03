import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret_change_me";

export default async function Page() {
  // await here 👇
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) redirect("/admin");

  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    redirect("/admin");
  }

  return <div>Admin Dashboard here…</div>;
}
