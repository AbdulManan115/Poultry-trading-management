"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/api";

export default function EmployeePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "employee") {
      router.push("/");
      return;
    }
    router.push("/admin");
  }, [router]);

  return <main className="min-h-screen grid place-items-center">Loading...</main>;
}
