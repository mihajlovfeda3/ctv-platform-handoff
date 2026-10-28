"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
export function cameraHref(href: string, search: string) {
  const target = new URL(href, "http://local"),
    current = new URLSearchParams(search);
  for (const key of ["zoom", "panX", "panY"])
    if (current.has(key)) target.searchParams.set(key, current.get(key)!);
  return target.pathname + target.search;
}
export function ContextLink(props: React.ComponentProps<typeof Link>) {
  const params = useSearchParams();
  return (
    <Link
      prefetch={false}
      {...props}
      href={
        typeof props.href === "string"
          ? cameraHref(props.href, params.toString())
          : props.href
      }
    />
  );
}
