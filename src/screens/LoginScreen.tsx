"use client";

/** Экран входа: пароль из APP_PASSPHRASE (web — сервер проверяет, offline — fetch-bridge). */

import { useState, type FormEvent } from "react";
import Image from "next/image";
import banner from "@/assets/banners/login.png";
import { api } from "@/lib/api";
import { PixelIcon } from "@/components/PixelIcon";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await api.auth(pass);
      onSuccess();
    } catch {
      setError("Неверный пароль");
      setPass("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "var(--color-bg)" }}>
      <div className="pixel-panel w-full max-w-md overflow-hidden">
        <div className="relative w-full h-36 border-b-2" style={{ borderColor: "var(--color-edge)" }}>
          <Image
            src={banner}
            alt="Пиксельный пейзаж: замок и обсерватория"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 448px"
            style={{ objectFit: "cover", imageRendering: "pixelated" }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(18,8,31,0.85))" }}
          />
        </div>

        <div className="p-5">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-widest uppercase">
              MEXT <span style={{ color: "var(--color-violet-2)" }}>Трекер</span>
            </h1>
            <p className="text-xs mt-1 uppercase tracking-widest" style={{ color: "var(--color-dim)" }}>
              Natural Sciences · 209 дней до экзамена
            </p>
          </div>

          <form onSubmit={submit} className={`mt-5 flex flex-col gap-3 ${error ? "pixel-shake" : ""}`}>
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
              <span className="flex items-center gap-1.5 mb-1">
                <PixelIcon name="lock" size={11} color="var(--color-violet-2)" />
                Пароль
              </span>
              <input
                className="pixel-input"
                type="password"
                autoFocus
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <p className="text-xs text-center uppercase" style={{ color: "var(--color-rose)" }}>
                ✕ {error}
              </p>
            ) : null}

            <button className="pixel-btn w-full !py-2.5 uppercase tracking-widest" type="submit" disabled={loading}>
              <PixelIcon name="lock" size={13} />
              {loading ? "Проверка..." : "Войти"}
            </button>
          </form>

          <div
            className="mt-4 pt-3 border-t-2 flex items-center justify-between text-[11px]"
            style={{ borderColor: "var(--color-line)", color: "var(--color-dim)" }}
          >
            <span>Данные хранятся локально</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
