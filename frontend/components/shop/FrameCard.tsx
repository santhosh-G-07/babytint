import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { inr } from "@/lib/utils";
import type { FrameTemplate } from "@/types";

export function FrameCard({ frame }: { frame: FrameTemplate }) {
  const finalPrice = Number(frame.offer_price ?? frame.price);
  const hasOffer = frame.offer_price !== null && Number(frame.offer_price) < Number(frame.price);

  return (
    <Card className="group overflow-hidden border-none bg-transparent shadow-none">
      <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          <Badge variant="secondary">{frame.size}</Badge>
          <Badge variant="outline">{frame.category}</Badge>
          {hasOffer ? <Badge variant="success">Sale</Badge> : null}
        </div>
        <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-stone-100 via-stone-50 to-amber-50 dark:from-stone-900 dark:via-stone-900 dark:to-stone-800">
          <Image
            src={frame.frame_asset_url}
            alt={frame.name}
            fill
            className="object-contain p-8 transition duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        </div>
      </div>
      <CardContent className="px-1 pb-0 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="line-clamp-1 text-lg font-semibold">{frame.name}</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{frame.slot_count} photo slots</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-lg font-semibold">{inr(finalPrice)}</span>
              {hasOffer ? (
                <span className="text-sm text-stone-400 line-through">{inr(frame.price)}</span>
              ) : null}
            </div>
          </div>
          <Button asChild size="sm">
            <Link href={`/shop/${frame.slug}`}>
              View
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
