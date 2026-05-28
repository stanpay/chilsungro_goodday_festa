import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const StoreCardSkeleton = () => (
  <Card className="h-full overflow-hidden border-border/50 bg-card">
    <div className="flex flex-col">
      <div className="relative flex h-28 items-center justify-center bg-primary/10 p-4">
        <Skeleton className="h-20 w-20 rounded-md" />
      </div>
      <div className="grid grid-cols-1 grid-rows-[1.75rem_1.125rem_1.125rem_1.75rem] gap-y-1 bg-card p-3">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-[1.125rem] w-1/2" />
        <Skeleton className="h-[1.125rem] w-2/5" />
        <Skeleton className="h-[1.75rem] w-full" />
      </div>
    </div>
  </Card>
);

export default StoreCardSkeleton;
