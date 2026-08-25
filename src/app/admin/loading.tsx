import { SkeletonLine } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <SkeletonLine className="h-6 w-48" />
      <SkeletonLine className="h-4 w-full max-w-md" />
      <div className="space-y-2 pt-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonLine key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
