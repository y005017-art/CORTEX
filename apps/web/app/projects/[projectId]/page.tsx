import Link from "next/link";

import { WorkspaceRouteClient } from "@/components/workspace-route-client";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return (
    <>
      <div className="back-link-row">
        <Link className="back-link" href="/">
          返回首頁
        </Link>
      </div>
      <WorkspaceRouteClient projectId={projectId} />
    </>
  );
}
