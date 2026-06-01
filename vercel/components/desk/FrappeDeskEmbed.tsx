"use client";

type FrappeDeskEmbedProps = {
  src: string;
  title: string;
};

/** Full-height iframe into proxied Frappe desk (true 1:1 forms/lists). */
export function FrappeDeskEmbed({ src, title }: FrappeDeskEmbedProps) {
  return (
    <iframe
      src={src}
      title={title}
      className="frappe-desk-iframe"
      referrerPolicy="same-origin"
      allow="clipboard-read; clipboard-write"
    />
  );
}
