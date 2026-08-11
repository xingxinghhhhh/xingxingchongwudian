import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import {
  getCommunityPost,
  listCommunityComments
} from "../../../cloud-pets/cloud-pets-api";
import { CommunityPostDetail } from "./community-post-detail";

interface CommunityPostPageProps {
  params: Promise<{
    postNo: string;
  }>;
}

export default async function CommunityPostPage({ params }: CommunityPostPageProps) {
  const { postNo } = await params;

  try {
    const post = await getCommunityPost(postNo);
    const comments = await listCommunityComments(postNo);

    return (
      <main className="cloud-pets-page">
        <SiteHeader />
        <section className="cloud-pets-section">
          <CommunityPostDetail post={post} comments={comments} />
        </section>
      </main>
    );
  } catch {
    notFound();
  }
}
