"use client";

import { useActionState, useState } from "react";

import {
  login,
  type LoginState,
} from "@/app/login/actions";


const initialState: LoginState = {
  error: null,
};

const [showPassword, setShowPassword] =
  useState(false);

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    login,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700"
        >
          Correo electrónico
        </label>

        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="administracion@club.com"
        />
      </div>

<div>
  <label
    htmlFor="password"
    className="text-sm font-medium text-slate-700"
  >
    Contraseña
  </label>

  <div className="relative mt-2">
    <input
      id="password"
      name="password"
      type={showPassword ? "text" : "password"}
      required
      autoComplete="current-password"
      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />

    <button
      type="button"
      onClick={() =>
        setShowPassword((current) => !current)
      }
      aria-label={
        showPassword
          ? "Ocultar contraseña"
          : "Mostrar contraseña"
      }
      aria-pressed={showPassword}
      title={
        showPassword
          ? "Ocultar contraseña"
          : "Mostrar contraseña"
      }
      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-blue-700 focus:outline-none"
    >
      {showPassword ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M3 3l18 18" />
          <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
          <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 4 10 8a13.3 13.3 0 0 1-2.1 4.1" />
          <path d="M6.6 6.6A12.7 12.7 0 0 0 2 12c1 4 5 8 10 8a10.8 10.8 0 0 0 5.4-1.4" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  </div>
</div>

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Ingresando..." : "Ingresar al panel"}
      </button>
    </form>
  );
}