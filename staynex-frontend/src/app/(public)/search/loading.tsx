import { PropertyCardSkeletonGrid } from "@/ui";

// Mirrors the search results layout while results stream in.
export default function SearchLoading() {
  return (
    <main className="layout-container py-8">
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="skeleton h-7 w-48 rounded-md" />
          <div className="skeleton h-4 w-24 rounded-md" />
        </header>
        <PropertyCardSkeletonGrid count={6} />
      </div>
    </main>
  );
}
