import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ArticlesLoading() {
  return (
    <main id="main" data-slot="articles-loading">
      <Container size="content" className="py-16">
        <header className="mb-12">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="mt-4 h-5 w-full max-w-lg" />
        </header>
        <ul className="space-y-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="border-b border-border pb-8 last:border-b-0">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="mt-3 h-4 w-full max-w-xl" />
              <div className="mt-3 flex gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </main>
  );
}
