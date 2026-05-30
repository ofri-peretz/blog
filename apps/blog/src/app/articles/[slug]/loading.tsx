import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/ui/container";

export default function ArticleLoading() {
  return (
    <main id="main" data-slot="article-loading">
      <Container size="prose" className="py-12">
        <header className="mb-10">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-3 h-6 w-3/4" />
          <div className="mt-4 flex flex-wrap gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
        </header>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
          <Skeleton className="h-48 w-full rounded-md" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`p2-${i}`} className="h-4 w-full" />
          ))}
        </div>
      </Container>
    </main>
  );
}
