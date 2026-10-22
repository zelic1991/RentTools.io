"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";

const LOADING_COPY: CopyMap<string> = {
  en: "Loading...",
  ru: "Загрузка...",
  de: "Wird geladen...",
  fr: "Chargement...",
  es: "Cargando...",
  hr: "Učitavanje...",
};

interface User {
  userId: number;
  username: string;
  role: string;
}

interface AuthGuardProps {
  children: (user: User) => React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then(async (data) => {
        if (window.location.pathname.startsWith("/dashboard")) {
          const propertiesResponse = await fetch("/api/properties");
          const properties = propertiesResponse.ok ? await propertiesResponse.json() : [];
          const list = Array.isArray(properties) ? properties : properties.data ?? [];
          if (list.length > 0 && list.every((property: { accessLevel?: string }) => property.accessLevel === "family")) {
            router.replace("/mobile");
            return;
          }
        }
        setUser(data.user);
        setChecking(false);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">{resolveCopy(LOADING_COPY, locale)}</div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children(user)}</>;
}
