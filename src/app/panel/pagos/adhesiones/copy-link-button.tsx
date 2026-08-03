"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  link: string;
};

export function CopyLinkButton({
  link,
}: CopyLinkButtonProps) {
  const [copied, setCopied] =
    useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        link,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800"
    >
      {copied
        ? "Enlace copiado"
        : "Copiar enlace"}
    </button>
  );
}