"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { CmsBlock, listCmsSlotBlocks } from "./cms-content-api";

export function CmsSlot({ slotPrefix }: { slotPrefix: string }) {
  const [blocks, setBlocks] = useState<CmsBlock[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    listCmsSlotBlocks(slotPrefix)
      .then((nextBlocks) => {
        if (isMounted) {
          setBlocks(nextBlocks);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBlocks([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slotPrefix]);

  if (!blocks.length) {
    return isLoaded ? null : (
      <section className="section cms-slot" aria-label="CMS content loading" />
    );
  }

  return (
    <section className="section cms-slot" id="daily-cms">
      <div className="section__header section__header--tight">
        <div>
          <p className="section__kicker">Daily CMS</p>
          <h2>今天后台推送的成长内容和商家活动。</h2>
        </div>
      </div>
      <div className="roadmap-grid">
        {blocks.map((block) => (
          <article className="roadmap-card" key={block.blockNo}>
            <span className="roadmap-card__badge">{block.slotKey}</span>
            <h3>{block.title}</h3>
            <p>{block.body}</p>
            {block.href ? (
              <Link className="text-link text-link--spaced" href={block.href}>
                {block.ctaLabel ?? "查看详情"}
                <ArrowRight size={16} />
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
