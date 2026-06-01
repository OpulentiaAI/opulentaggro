import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FrappeDeskEmbedGate } from "@/components/desk/FrappeDeskEmbedGate";
import { FrappeListChrome } from "@/components/doctype/FrappeListChrome";
import { ListView, ListViewSkeleton } from "@/components/doctype/ListView";
import { DESK_PAGE_SLUGS, getListColumns, resolveDoctypeFromSlug } from "@/lib/doctype";
import { frappeListUrl } from "@/lib/frappe-desk";
import { getResourceList } from "@/lib/erpnext/resource";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doctype: string }>;
}) {
  const { doctype: slug } = await params;
  return { title: resolveDoctypeFromSlug(slug) };
}

async function DoctypeListContent({ doctype }: { doctype: string }) {
  const columns = getListColumns(doctype);
  const fields = columns.map((c) => c.field);

  try {
    const result = await getResourceList<Record<string, unknown>>(doctype, {
      fields: [...new Set(["name", ...fields])],
      limit: 50,
      orderBy: "modified desc",
    });

    if (!result.ok) {
      return <ListView doctype={doctype} rows={[]} columns={columns} error={result.error} />;
    }

    return <ListView doctype={doctype} rows={result.data.data} columns={columns} />;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load list";
    return <ListView doctype={doctype} rows={[]} columns={columns} error={message} />;
  }
}

export default async function DoctypeListPage({
  params,
}: {
  params: Promise<{ doctype: string }>;
}) {
  const { doctype: slug } = await params;

  if (DESK_PAGE_SLUGS.has(slug)) {
    notFound();
  }

  const resolvedDoctype = resolveDoctypeFromSlug(slug);
  const columns = getListColumns(resolvedDoctype);

  return (
    <FrappeDeskEmbedGate
      src={frappeListUrl(resolvedDoctype)}
      title={`${resolvedDoctype} list`}
      fallback={
        <FrappeListChrome doctype={resolvedDoctype}>
          <Suspense fallback={<ListViewSkeleton columns={columns} />}>
            <DoctypeListContent doctype={resolvedDoctype} />
          </Suspense>
        </FrappeListChrome>
      }
    />
  );
}
