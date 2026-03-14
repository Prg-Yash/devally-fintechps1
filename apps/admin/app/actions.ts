"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAdmin(prevState: any, formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (email === "admin@bytecamp.com" && password === "admin123") {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", "valid-admin", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    // Let the component handle redirection, or just do it here:
    // redirect throws, so we can't do it inside a try/catch, but here it's fine.
    redirect("/analytics");
  } else {
    return { error: "Invalid credentials. Try admin@bytecamp.com / admin123" };
  }
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");
  redirect("/");
}
