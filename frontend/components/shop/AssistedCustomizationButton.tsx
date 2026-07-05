"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addServerCartItem } from "@/lib/api";
import { hasAuthToken } from "@/lib/local-admin-auth";
import { useCartStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { cartItemPrice, inr } from "@/lib/utils";
import type { CustomizationData, FrameTemplate } from "@/types";

export function AssistedCustomizationButton({ frame }: { frame: FrameTemplate }) {
  const router = useRouter();
  const addToCart = useCartStore((state) => state.addToCart);
  const [busy, setBusy] = useState(false);

  const fee = Number(frame.assisted_customization_price ?? 0);
  const enabled = frame.is_active && frame.assisted_customization_price != null;
  const customization: CustomizationData = {
    frame_id: frame.id,
    slots: [],
    texts: [],
    customization_mode: "assisted",
  };
  const price = cartItemPrice(frame, customization);

  const addAssistedItem = async () => {
    if (!enabled || busy) {
      return;
    }

    setBusy(true);
    try {
      let serverCartItemId: string | undefined;
      const { data } = await supabase.auth.getSession();
      if (data.session || hasAuthToken()) {
        try {
          const created = await addServerCartItem({
            frame_id: frame.id,
            quantity: 1,
            customization_data: customization,
          });
          serverCartItemId = created.id;
        } catch {
          // Local cart still works; CartSync can retry when auth/backend is available.
        }
      }

      addToCart({
        frame,
        quantity: 1,
        price,
        customization,
        serverCartItemId,
      });
      toast.success("Customize With Us added to cart.");
      router.push("/cart");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      className="w-full border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 sm:w-auto"
      onClick={() => void addAssistedItem()}
      disabled={!enabled || busy}
    >
      <Sparkles className="mr-2 h-4 w-4" />
      {busy ? "Adding..." : `Customize With Us +${inr(fee)}`}
    </Button>
  );
}
