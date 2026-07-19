"use client";

import {
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import type { MediaActionState } from "@/app/panel/media-actions";
import { createClient } from "@/lib/supabase/client";

const MEDIA_BUCKET = "club-media";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type ImageUploaderProps = {
  label: string;
  description: string;
  currentUrl: string | null;
  storageFolder: string;
  aspect: "square" | "cover";
  saveImage: (
    publicUrl: string,
    storagePath: string,
  ) => Promise<MediaActionState>;
  removeImage: () => Promise<MediaActionState>;
};

export function ImageUploader({
  label,
  description,
  currentUrl,
  storageFolder,
  aspect,
  saveImage,
  removeImage,
}: ImageUploaderProps) {
  const router = useRouter();
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] =
    useState(currentUrl);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [uploading, setUploading] =
    useState(false);

  const [removing, startRemoving] =
    useTransition();

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);
    setMessage(null);

    if (!allowedTypes.has(file.type)) {
      setError(
        "Seleccioná una imagen JPG, PNG o WebP.",
      );

      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "La imagen no puede superar los 5 MB.",
      );

      event.target.value = "";
      return;
    }

    const extension =
      extensionByType[file.type];

    if (!extension) {
      setError(
        "No fue posible reconocer el formato de la imagen.",
      );

      event.target.value = "";
      return;
    }

    setUploading(true);

    const supabase = createClient();

    const storagePath = `${storageFolder}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } =
      await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "Error subiendo imagen:",
        uploadError,
      );

      setError(
        `No fue posible subir la imagen: ${uploadError.message}`,
      );
      setUploading(false);
      event.target.value = "";
      return;
    }

    const { data: publicUrlData } =
      supabase.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(storagePath);

    const result = await saveImage(
      publicUrlData.publicUrl,
      storagePath,
    );

    if (result.error) {
      await supabase.storage
        .from(MEDIA_BUCKET)
        .remove([storagePath]);

      setError(result.error);
      setUploading(false);
      event.target.value = "";
      return;
    }

    setImageUrl(publicUrlData.publicUrl);
    setMessage(
      result.success ??
        "La imagen se guardó correctamente.",
    );
    setUploading(false);
    event.target.value = "";

    router.refresh();
  }

  function handleRemove() {
    setError(null);
    setMessage(null);

    startRemoving(async () => {
      const result = await removeImage();

      if (result.error) {
        setError(result.error);
        return;
      }

      setImageUrl(null);
      setMessage(
        result.success ??
          "La imagen fue eliminada.",
      );

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      router.refresh();
    });
  }

  const imageClassName =
    aspect === "square"
      ? "h-48 w-48 rounded-2xl object-cover"
      : "h-64 w-full rounded-2xl object-cover";

  const emptyClassName =
    aspect === "square"
      ? "flex h-48 w-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center"
      : "flex h-64 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">
        {label}
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>

      <div className="mt-6">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={label}
            className={imageClassName}
          />
        ) : (
          <div className={emptyClassName}>
            <p className="text-sm text-slate-500">
              No hay una imagen cargada.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <label
          className={`inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 ${
            uploading || removing
              ? "pointer-events-none opacity-50"
              : ""
          }`}
        >
          {uploading
            ? "Subiendo..."
            : imageUrl
              ? "Reemplazar imagen"
              : "Seleccionar imagen"}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || removing}
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>

        {imageUrl ? (
          <button
            type="button"
            disabled={uploading || removing}
            onClick={handleRemove}
            className="rounded-lg border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {removing
              ? "Eliminando..."
              : "Eliminar imagen"}
          </button>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Formatos admitidos: JPG, PNG y WebP.
        Tamaño máximo: 5 MB.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}