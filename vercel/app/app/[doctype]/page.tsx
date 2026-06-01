import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FrappeDeskEmbed } from "@/components/desk/FrappeDeskEmbed";
import { FrappeEmbedMode } from "@/components/desk/FrappeEmbedMode";
import { FrappeListChrome } from "@/components/doctype/FrappeListChrome";
import { ListView, ListViewSkeleton } from "@/components/doctype/ListView";
import { DESK_PAGE_SLUGS, getListColumns, resolveDoctypeFromSlug } from "@/lib/doctype";
import { frappeListUrl, isFrappeDeskProxyEnabled } from "@/lib/frappe-desk";
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

  const result = await getResourceList<Record<string, unknown>>(doctype, {
    fields: [...new Set(["name", ...fields])],
    limit: 50,
    orderBy: "modified desc",
  });

  if (!result.ok) {
    return <ListView doctype={doctype} rows={[]} columns={columns} error={result.error} />;
  }

  return <ListView doctype={doctype} rows={result.data.data} columns={columns} />;
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

  if (isFrappeDeskProxyEnabled()) {
    return (
      <>
        <FrappeEmbedMode fullBleed />
        <FrappeDeskEmbed src={frappeListUrl(resolvedDoctype)} title={`${resolvedDoctype} list`} />
      </>
    );
  }

  return (
    <FrappeListChrome doctype={resolvedDoctype}>
      <Suspense fallback={<ListViewSkeleton columns={columns} />}>
        <DoctypeListContent doctype={resolvedDoctype} />
      </Suspense>
    </FrappeListChrome>
  );
}
