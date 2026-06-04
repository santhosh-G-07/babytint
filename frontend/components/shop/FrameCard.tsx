import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/utils";
import type { FrameTemplate } from "@/types";

export function FrameCard({ frame }: { frame: FrameTemplate }) {
  const finalPrice = Number(frame.offer_price ?? frame.price);
  const hasOffer = frame.offer_price !== null && Number(frame.offer_price) < Number(frame.price);

  return (
    <article className="group surface h-full overflow-hidden p-0 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative overflow-hidden rounded-t-2xl">
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          <Badge variant="secondary">{frame.size}</Badge>
          <Badge variant="outline">{frame.category}</Badge>
          {hasOffer ? <Badge variant="success">Sale</Badge> : null}
        </div>
        <div className="relative aspect-[4/5] overflow-hidden bg-[radial-gradient(circle_at_16%_18%,rgba(245,158,11,0.16),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.62))] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(245,158,11,0.2),transparent_36%),linear-gradient(135deg,rgba(30,28,26,0.9),rgba(24,22,20,0.76))]">
          <Image
            src={frame.frame_asset_url}
            alt={frame.name}
            fill
            className="object-contain p-8 transition duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        </div>
      </div>
      <div className="space-y-3 px-4 pb-4 pt-4">
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
      </div>
    </article>
  );
}
